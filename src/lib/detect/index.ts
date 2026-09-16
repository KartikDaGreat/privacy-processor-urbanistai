import { blurFaces } from "../blur";
import { cloneImageData } from "../image";
import {
  REAL_MODEL_IDS,
  modelLabel,
  type BlurMethod,
  type DetectionModelId,
  type FaceBox,
  type RealModelId,
} from "../types";
import { detectWithMediaPipe } from "./mediapipe";
import { detectWithDnn, detectWithHaar, detectWithYunet } from "./opencv";

/** A failure that knows which model caused it, so the UI never has to say "processing failed". */
export class DetectionError extends Error {
  readonly modelId: RealModelId;

  constructor(modelId: RealModelId, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DetectionError";
    this.modelId = modelId;
  }
}

const DETECTORS: Record<RealModelId, (image: ImageData) => Promise<FaceBox[]>> = {
  mediapipe: (image) => detectWithMediaPipe(image, "short"),
  mediapipe_full: (image) => detectWithMediaPipe(image, "full"),
  opencv_dnn: detectWithDnn,
  haar: detectWithHaar,
  yunet: detectWithYunet,
};

/** Run one detector, tagging any failure with the model that produced it. */
export async function detectFaces(
  image: ImageData,
  modelId: RealModelId,
): Promise<FaceBox[]> {
  try {
    return await DETECTORS[modelId](image);
  } catch (error) {
    throw new DetectionError(
      modelId,
      error instanceof Error ? error.message : String(error),
      { cause: error },
    );
  }
}

export interface StageResult {
  modelId: RealModelId;
  faces: number;
  /** Exactly the regions this stage blurred, in source-image pixels. */
  boxes: FaceBox[];
}

export interface ProcessResult {
  imageData: ImageData;
  /** Total faces blurred across every stage. */
  faceCount: number;
  stages: StageResult[];
  /** Every blurred region, flattened, for drawing detection overlays. */
  boxes: FaceBox[];
}

export interface ProcessOptions {
  image: ImageData;
  model: DetectionModelId;
  blurMethod: BlurMethod;
  /** Called before each detector runs, for progress reporting. */
  onStage?: (modelId: RealModelId, index: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Detect and blur faces.
 *
 * "run_all" chains the models cumulatively: each one detects on the output of
 * the previous stage, so their coverage adds up instead of competing.
 */
export async function processImage({
  image,
  model,
  blurMethod,
  onStage,
  signal,
}: ProcessOptions): Promise<ProcessResult> {
  const pipeline: RealModelId[] =
    model === "run_all" ? [...REAL_MODEL_IDS] : [model];

  // Work on a copy so the caller keeps an untouched original for comparison.
  const working = cloneImageData(image);
  const stages: StageResult[] = [];
  let faceCount = 0;

  for (const [index, modelId] of pipeline.entries()) {
    if (signal?.aborted) throw new DOMException("Processing cancelled", "AbortError");
    onStage?.(modelId, index, pipeline.length);

    const faces = await detectFaces(working, modelId);
    const blurred = blurFaces(working, faces, blurMethod);
    faceCount += blurred.length;
    stages.push({ modelId, faces: blurred.length, boxes: blurred });

    // Yield to the event loop so the spinner keeps animating between stages.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return {
    imageData: working,
    faceCount,
    stages,
    boxes: stages.flatMap((stage) => stage.boxes),
  };
}

/** "2 via MediaPipe, 1 via YuNet" — a readable summary of a run_all pass. */
export function summarizeStages(stages: StageResult[]): string {
  const hits = stages.filter((s) => s.faces > 0);
  if (hits.length === 0) return "no faces detected";
  return hits.map((s) => `${s.faces} via ${modelLabel(s.modelId)}`).join(", ");
}
