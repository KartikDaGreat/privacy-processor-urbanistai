import { processImage, summarizeStages, type StageResult } from "./detect";
import { imageDataToPngBlob } from "./image";
import type { BlurMethod, DetectionModelId, RealModelId } from "./types";

export interface PipelineOutput {
  /** PNG blob, re-encoded from a canvas and therefore free of all metadata. */
  blob: Blob;
  /** Object URL for the blob. The caller owns it and must revoke it. */
  url: string;
  faceCount: number;
  stages: StageResult[];
  summary: string;
}

/**
 * Detect, blur, and re-encode — the single path both the main panel and the
 * comparison grid run through.
 */
export async function runPipeline(options: {
  image: ImageData;
  model: DetectionModelId;
  blurMethod: BlurMethod;
  onStage?: (modelId: RealModelId, index: number, total: number) => void;
}): Promise<PipelineOutput> {
  const result = await processImage({
    image: options.image,
    model: options.model,
    blurMethod: options.blurMethod,
    onStage: options.onStage,
  });

  const blob = await imageDataToPngBlob(result.imageData);

  const summary =
    result.faceCount === 0
      ? "No faces detected — metadata still stripped"
      : `${result.faceCount} face${result.faceCount === 1 ? "" : "s"} blurred (${summarizeStages(result.stages)}) — metadata stripped`;

  return {
    blob,
    url: URL.createObjectURL(blob),
    faceCount: result.faceCount,
    stages: result.stages,
    summary,
  };
}

/** Save a blob under `name` using a transient anchor. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** "beach.jpg" + "yunet" -> "beach-anonymized-yunet.png" */
export function outputFileName(
  sourceName: string | undefined,
  model: DetectionModelId,
): string {
  const stem = (sourceName ?? "image").replace(/\.[^.]+$/, "") || "image";
  return `${stem}-anonymized-${model}.png`;
}
