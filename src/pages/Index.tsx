import { useCallback, useEffect, useRef, useState } from "react";
import { PlayCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { BlurSelector } from "@/components/BlurSelector";
import { CompareView } from "@/components/CompareView";
import {
  ComparisonGrid,
  type ComparisonGridHandle,
  type GridResult,
} from "@/components/ComparisonGrid";
import { Header } from "@/components/Header";
import { ImageUpload } from "@/components/ImageUpload";
import { ModelSelector } from "@/components/ModelSelector";
import { SampleImages } from "@/components/SampleImages";
import { Tour, type TourStep } from "@/components/Tour";
import { Button } from "@/components/ui/button";
import { describeProcessingError } from "@/lib/apiError";
import { decodeImage, imageDataToPngBlob, MAX_DIMENSION } from "@/lib/image";
import { downloadBlob, outputFileName, runPipeline } from "@/lib/pipeline";
import { SAMPLES, loadSample } from "@/lib/samples";
import {
  blurLabel,
  modelLabel,
  type BlurMethod,
  type DetectionModelId,
  type FaceBox,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const DISCLAIMER = "Results may not always be accurate. Double check your results.";

export default function Index() {
  const [fileName, setFileName] = useState<string>();
  const [sourceImage, setSourceImage] = useState<ImageData | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);

  const [model, setModel] = useState<DetectionModelId>("run_all");
  const [blurMethod, setBlurMethod] = useState<BlurMethod>("gaussian");

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string>();
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [boxes, setBoxes] = useState<FaceBox[]>([]);
  const [faceCount, setFaceCount] = useState(0);

  const [tourStep, setTourStep] = useState<TourStep | null>(null);
  const [tourBusy, setTourBusy] = useState(false);
  const [tourBusyLabel, setTourBusyLabel] = useState<string>();
  const [gridResults, setGridResults] = useState<GridResult[] | null>(null);
  const gridRef = useRef<ComparisonGridHandle>(null);
  const gridSectionRef = useRef<HTMLDivElement>(null);

  // Both preview URLs are owned here and revoked as they are replaced.
  const originalUrlRef = useRef<string | null>(null);
  const processedUrlRef = useRef<string | null>(null);

  const setOriginal = useCallback((url: string | null) => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    originalUrlRef.current = url;
    setOriginalUrl(url);
  }, []);

  const setProcessed = useCallback((url: string | null) => {
    if (processedUrlRef.current) URL.revokeObjectURL(processedUrlRef.current);
    processedUrlRef.current = url;
    setProcessedUrl(url);
  }, []);

  useEffect(
    () => () => {
      if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
      if (processedUrlRef.current) URL.revokeObjectURL(processedUrlRef.current);
    },
    [],
  );

  const clearResult = useCallback(() => {
    setProcessed(null);
    setProcessedBlob(null);
    setBoxes([]);
    setFaceCount(0);
  }, [setProcessed]);

  const handleSelect = useCallback(
    async (file: File): Promise<ImageData | null> => {
      setIsProcessing(false);
      clearResult();
      setGridResults(null);

      try {
        const decoded = await decodeImage(file);
        setSourceImage(decoded.imageData);
        setFileName(file.name);

        // Render the "before" side from re-encoded pixels too, so nothing with
        // EXIF or GPS attached is ever put on screen.
        const clean = await imageDataToPngBlob(decoded.imageData);
        setOriginal(URL.createObjectURL(clean));

        if (decoded.downscaled) {
          toast.info("Photo resized", {
            description: `Scaled to ${MAX_DIMENSION}px on its longest edge to stay within browser canvas limits.`,
          });
        }
        return decoded.imageData;
      } catch (error) {
        setSourceImage(null);
        setOriginal(null);
        setFileName(undefined);
        toast.error("That photo could not be read", {
          description: describeProcessingError(error),
        });
        return null;
      }
    },
    [clearResult, setOriginal],
  );

  /*
   * Takes the image and model as arguments rather than reading them from
   * state, so the tour can select a model and run it in the same tick without
   * waiting for a re-render.
   */
  const runOn = useCallback(
    async (image: ImageData, modelId: DetectionModelId) => {
    setIsProcessing(true);
    clearResult();
    setProgressLabel("Loading models");

    try {
      const output = await runPipeline({
        image,
        model: modelId,
        blurMethod,
        onStage: (stageModel, index, total) => {
          setProgressLabel(
            total > 1
              ? `${modelLabel(stageModel)} — ${index + 1} of ${total}`
              : modelLabel(stageModel),
          );
        },
      });

      setProcessed(output.url);
      setProcessedBlob(output.blob);
      setBoxes(output.boxes);
      setFaceCount(output.faceCount);

      if (output.faceCount === 0) {
        toast.warning("No faces found", {
          description: `${modelLabel(modelId)} found nothing to blur. Metadata was still stripped. ${DISCLAIMER}`,
        });
      } else {
        toast.success(
          `${output.faceCount} face${output.faceCount === 1 ? "" : "s"} anonymized`,
          { description: output.summary },
        );
      }
      return output;
    } catch (error) {
      toast.error("Processing stopped", {
        description: describeProcessingError(error),
      });
      return null;
    } finally {
      setIsProcessing(false);
      setProgressLabel(undefined);
    }
    },
    [blurMethod, clearResult, setProcessed],
  );

  const handleProcess = useCallback(() => {
    if (!sourceImage) return;
    return runOn(sourceImage, model);
  }, [sourceImage, model, runOn]);

  const handleDownload = useCallback(() => {
    if (!processedBlob) return;
    downloadBlob(processedBlob, outputFileName(fileName, model));
  }, [processedBlob, fileName, model]);

  const exitTour = useCallback(() => {
    setTourStep(null);
    setTourBusy(false);
    setTourBusyLabel(undefined);
  }, []);

  /*
   * Each step performs the real action before advancing, so the narration
   * always describes something that actually happened.
   */
  const advanceTour = useCallback(async () => {
    if (tourBusy) return;
    setTourBusy(true);
    try {
      switch (tourStep) {
        case "intro": {
          // The large group is the sample where the detectors disagree most.
          const sample = SAMPLES.find((s) => s.id === "large-group") ?? SAMPLES[0];
          setTourBusyLabel("Loading the photo");
          const image = await handleSelect(await loadSample(sample));
          if (!image) return exitTour();
          setTourStep("loaded");
          break;
        }
        case "loaded": {
          if (!sourceImage) return exitTour();
          setModel("run_all");
          setTourBusyLabel("Chaining five detectors");
          const output = await runOn(sourceImage, "run_all");
          if (!output) return exitTour();
          setTourStep("chained");
          break;
        }
        case "chained": {
          setTourBusyLabel("Running each detector");
          gridSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          const results = (await gridRef.current?.addAllAndRun()) ?? [];
          setGridResults(results);
          setTourStep("compared");
          break;
        }
        case "compared":
          exitTour();
          break;
      }
    } catch (error) {
      toast.error("The tour could not finish", {
        description: describeProcessingError(error),
      });
      exitTour();
    } finally {
      setTourBusy(false);
      setTourBusyLabel(undefined);
    }
  }, [tourStep, tourBusy, sourceImage, handleSelect, runOn, exitTour]);

  const status = isProcessing ? "working" : processedUrl ? "done" : "ready";

  return (
    <div className="min-h-screen">
      <Header />

      <main
        className={cn(
          "mx-auto max-w-[1180px] px-6",
          tourStep ? "pb-72" : "pb-24",
        )}
      >
        {!sourceImage ? (
          /* Empty state: the pitch, then the one thing there is to do. */
          <section className="mx-auto max-w-2xl pt-16 text-center">
            <h1 className="gradient-text text-display font-bold">
              Anonymize Faces Instantly
            </h1>
            <p className="mx-auto mt-4 max-w-md text-lead text-muted-foreground">
              Upload an image, choose a detection model and blur method, and
              protect identities in seconds.
            </p>
            <div className="mt-10 space-y-8 text-left">
              <ImageUpload
                onSelect={handleSelect}
                hasImage={false}
                disabled={isProcessing}
              />
              <SampleImages
                onSelect={handleSelect}
                onError={(description) =>
                  toast.error("That sample could not be loaded", { description })
                }
                disabled={isProcessing}
              />

              <div className="flex items-center gap-3 border-t border-border pt-6">
                <Button
                  variant="outline"
                  onClick={() => setTourStep("intro")}
                  disabled={isProcessing || tourStep !== null}
                >
                  <PlayCircle />
                  Take the tour
                </Button>
                <p className="text-micro leading-snug text-muted-foreground">
                  Runs a photo through all five detectors and compares what each
                  one caught.
                </p>
              </div>
            </div>
            <p className="mt-8 text-micro text-muted-foreground">{DISCLAIMER}</p>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 pt-8 lg:grid-cols-[1fr_286px]">
              <div className="space-y-3">
                <ImageUpload
                  onSelect={handleSelect}
                  hasImage
                  fileName={fileName}
                  disabled={isProcessing}
                />
                <CompareView
                  originalUrl={originalUrl}
                  processedUrl={processedUrl}
                  boxes={boxes}
                  imageWidth={sourceImage.width}
                  imageHeight={sourceImage.height}
                  isProcessing={isProcessing}
                  progressLabel={progressLabel}
                  faceCount={faceCount}
                  onDownload={handleDownload}
                />
              </div>

              <aside className="h-fit space-y-5 rounded-panel border border-border bg-card p-4 lg:sticky lg:top-6">
                <ModelSelector
                  value={model}
                  onChange={setModel}
                  disabled={isProcessing}
                />

                <BlurSelector
                  value={blurMethod}
                  onChange={setBlurMethod}
                  disabled={isProcessing}
                />

                <Button
                  className="w-full glow-primary"
                  onClick={handleProcess}
                  disabled={isProcessing}
                >
                  <Zap />
                  {isProcessing ? "Processing" : "Process photo"}
                </Button>

                <div className="space-y-2 border-t border-border pt-4">
                  <p className="flex items-center gap-2 text-micro text-muted-foreground">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        status === "working" && "animate-pulse bg-primary",
                        status === "done" && "bg-[hsl(var(--success))]",
                        status === "ready" && "bg-muted-foreground/60",
                      )}
                    />
                    {status === "working"
                      ? (progressLabel ?? "Working")
                      : status === "done"
                        ? `Done using ${modelLabel(model)}`
                        : `Ready to run ${modelLabel(model)}`}
                  </p>
                  <p className="text-micro leading-relaxed text-muted-foreground">
                    {blurLabel(blurMethod)} blur. {DISCLAIMER}
                  </p>
                </div>
              </aside>
            </div>

            <div ref={gridSectionRef}>
              <ComparisonGrid
                ref={gridRef}
                sourceImage={sourceImage}
                sourceName={fileName}
                defaultBlurMethod={blurMethod}
                onResults={setGridResults}
              />
            </div>
          </>
        )}
      </main>

      {tourStep && (
        <Tour
          step={tourStep}
          busy={tourBusy}
          busyLabel={tourBusyLabel}
          chainedCount={faceCount}
          results={gridResults}
          onNext={advanceTour}
          onExit={exitTour}
        />
      )}
    </div>
  );
}
