import { useCallback, useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { BlurSelector } from "@/components/BlurSelector";
import { CompareView } from "@/components/CompareView";
import { ComparisonGrid } from "@/components/ComparisonGrid";
import { Header } from "@/components/Header";
import { ImageUpload } from "@/components/ImageUpload";
import { ModelSelector } from "@/components/ModelSelector";
import { Button } from "@/components/ui/button";
import { describeProcessingError } from "@/lib/apiError";
import { decodeImage, imageDataToPngBlob, MAX_DIMENSION } from "@/lib/image";
import { downloadBlob, outputFileName, runPipeline } from "@/lib/pipeline";
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
    async (file: File) => {
      setIsProcessing(false);
      clearResult();

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
      } catch (error) {
        setSourceImage(null);
        setOriginal(null);
        setFileName(undefined);
        toast.error("That photo could not be read", {
          description: describeProcessingError(error),
        });
      }
    },
    [clearResult, setOriginal],
  );

  const handleProcess = useCallback(async () => {
    if (!sourceImage) return;

    setIsProcessing(true);
    clearResult();
    setProgressLabel("Loading models");

    try {
      const output = await runPipeline({
        image: sourceImage,
        model,
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
          description: `${modelLabel(model)} found nothing to blur. Metadata was still stripped. ${DISCLAIMER}`,
        });
      } else {
        toast.success(
          `${output.faceCount} face${output.faceCount === 1 ? "" : "s"} anonymized`,
          { description: output.summary },
        );
      }
    } catch (error) {
      toast.error("Processing stopped", {
        description: describeProcessingError(error),
      });
    } finally {
      setIsProcessing(false);
      setProgressLabel(undefined);
    }
  }, [sourceImage, model, blurMethod, clearResult, setProcessed]);

  const handleDownload = useCallback(() => {
    if (!processedBlob) return;
    downloadBlob(processedBlob, outputFileName(fileName, model));
  }, [processedBlob, fileName, model]);

  const status = isProcessing ? "working" : processedUrl ? "done" : "ready";

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1180px] px-6 pb-24">
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
            <div className="mt-10 text-left">
              <ImageUpload
                onSelect={handleSelect}
                hasImage={false}
                disabled={isProcessing}
              />
            </div>
            <p className="mt-6 text-micro text-muted-foreground">{DISCLAIMER}</p>
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

            <ComparisonGrid
              sourceImage={sourceImage}
              sourceName={fileName}
              defaultBlurMethod={blurMethod}
            />
          </>
        )}
      </main>
    </div>
  );
}
