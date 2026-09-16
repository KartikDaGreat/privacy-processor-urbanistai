import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Zap } from "lucide-react";
import { toast } from "sonner";
import { BlurSelector } from "@/components/BlurSelector";
import { ComparisonGrid } from "@/components/ComparisonGrid";
import { Header } from "@/components/Header";
import { ImageUpload } from "@/components/ImageUpload";
import { ModelSelector } from "@/components/ModelSelector";
import { ResultView } from "@/components/ResultView";
import { Button } from "@/components/ui/button";
import { describeProcessingError } from "@/lib/apiError";
import { decodeImage, imageDataToPngBlob, MAX_DIMENSION } from "@/lib/image";
import { downloadBlob, outputFileName, runPipeline } from "@/lib/pipeline";
import {
  blurLabel,
  modelLabel,
  type BlurMethod,
  type DetectionModelId,
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
  const [resultSummary, setResultSummary] = useState<string>();

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

  const handleSelect = useCallback(
    async (file: File) => {
      setIsProcessing(false);
      setProcessed(null);
      setProcessedBlob(null);
      setResultSummary(undefined);

      try {
        const decoded = await decodeImage(file);
        setSourceImage(decoded.imageData);
        setFileName(file.name);

        // Show the original from re-encoded pixels, so even the "before" panel
        // is rendered from data with no EXIF or GPS attached.
        const clean = await imageDataToPngBlob(decoded.imageData);
        setOriginal(URL.createObjectURL(clean));

        if (decoded.downscaled) {
          toast.info("Large image resized", {
            description: `Scaled down to ${MAX_DIMENSION}px on its longest edge to stay within browser canvas limits.`,
          });
        }
      } catch (error) {
        setSourceImage(null);
        setOriginal(null);
        setFileName(undefined);
        const description = describeProcessingError(error);
        toast.error("Could not read that image", { description });
      }
    },
    [setOriginal, setProcessed],
  );

  const handleProcess = useCallback(async () => {
    if (!sourceImage) return;

    setIsProcessing(true);
    setProcessed(null);
    setProcessedBlob(null);
    setResultSummary(undefined);
    setProgressLabel("Loading models...");

    try {
      const output = await runPipeline({
        image: sourceImage,
        model,
        blurMethod,
        onStage: (stageModel, index, total) => {
          setProgressLabel(
            total > 1
              ? `${modelLabel(stageModel)} (${index + 1}/${total})...`
              : `Running ${modelLabel(stageModel)}...`,
          );
        },
      });

      setProcessed(output.url);
      setProcessedBlob(output.blob);
      setResultSummary(output.summary);

      if (output.faceCount === 0) {
        toast.warning("No faces detected", {
          description: `${modelLabel(model)} found nothing to blur. Metadata was still stripped. ${DISCLAIMER}`,
        });
      } else {
        toast.success(
          `${output.faceCount} face${output.faceCount === 1 ? "" : "s"} anonymized`,
          { description: output.summary },
        );
      }
    } catch (error) {
      const description = describeProcessingError(error);
      toast.error("Processing stopped", { description });
    } finally {
      setIsProcessing(false);
      setProgressLabel(undefined);
    }
  }, [sourceImage, model, blurMethod, setProcessed]);

  const handleDownload = useCallback(() => {
    if (!processedBlob) return;
    downloadBlob(processedBlob, outputFileName(fileName, model));
  }, [processedBlob, fileName, model]);

  const statusTone = isProcessing
    ? "processing"
    : processedUrl
      ? "complete"
      : "idle";

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        <section className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="gradient-text font-mono-display text-3xl font-bold sm:text-4xl">
            Anonymize Faces Instantly
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Upload an image, choose a detection model and blur method, and protect
            identities in seconds.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <ImageUpload
              onSelect={handleSelect}
              hasImage={Boolean(sourceImage)}
              fileName={fileName}
              disabled={isProcessing}
            />
            <ResultView
              originalUrl={originalUrl}
              processedUrl={processedUrl}
              isProcessing={isProcessing}
              progressLabel={progressLabel}
              resultSummary={resultSummary}
              onDownload={handleDownload}
            />
          </div>

          <aside className="glass-surface h-fit space-y-5 rounded-xl p-4 lg:sticky lg:top-24">
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
              size="lg"
              onClick={handleProcess}
              disabled={!sourceImage || isProcessing}
            >
              <Zap />
              {isProcessing ? "Processing..." : "Process Image"}
            </Button>

            <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    statusTone === "processing" && "animate-pulse bg-primary",
                    statusTone === "complete" && "bg-[hsl(var(--success))]",
                    statusTone === "idle" && "bg-muted-foreground/50",
                  )}
                />
                <span className="font-mono-display text-[11px] uppercase tracking-widest text-muted-foreground">
                  {statusTone === "processing"
                    ? "Processing"
                    : statusTone === "complete"
                      ? "Complete"
                      : "Idle"}
                </span>
              </div>

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {modelLabel(model)} · {blurLabel(blurMethod)} blur
              </p>

              <p className="flex items-start gap-1.5 border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{DISCLAIMER}</span>
              </p>
            </div>
          </aside>
        </div>

        <ComparisonGrid
          sourceImage={sourceImage}
          sourceName={fileName}
          defaultBlurMethod={blurMethod}
        />
      </main>
    </div>
  );
}
