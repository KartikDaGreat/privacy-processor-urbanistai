import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { ASSETS } from "../assets";
import type { FaceBox } from "../types";

/**
 * MediaPipe BlazeFace detectors, running on the local wasm runtime in public/vendor.
 * Two variants, matching the original pipeline's model_selection 0 and 1.
 */

type Variant = "short" | "full";

const CONFIG: Record<Variant, { model: () => string; minConfidence: number }> = {
  short: { model: ASSETS.blazeShortRange, minConfidence: 0.5 },
  full: { model: ASSETS.blazeFullRange, minConfidence: 0.4 },
};

const detectors = new Map<Variant, Promise<FaceDetector>>();
let visionFileset: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;

function getFileset() {
  if (!visionFileset) {
    visionFileset = FilesetResolver.forVisionTasks(ASSETS.mediapipeWasm());
  }
  return visionFileset;
}

function getDetector(variant: Variant): Promise<FaceDetector> {
  let pending = detectors.get(variant);
  if (!pending) {
    const { model, minConfidence } = CONFIG[variant];
    pending = (async () => {
      const fileset = await getFileset();
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: model(), delegate: "CPU" },
        runningMode: "IMAGE",
        minDetectionConfidence: minConfidence,
      });
    })();
    // Don't cache a rejected load — let the next attempt retry from scratch.
    pending.catch(() => detectors.delete(variant));
    detectors.set(variant, pending);
  }
  return pending;
}

/** MediaPipe wants a drawable source rather than bare pixels. */
function toCanvas(image: ImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D canvas context in this browser.");
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export async function detectWithMediaPipe(
  image: ImageData,
  variant: Variant,
): Promise<FaceBox[]> {
  const detector = await getDetector(variant);
  const result = detector.detect(toCanvas(image));
  const faces: FaceBox[] = [];
  for (const detection of result.detections) {
    const box = detection.boundingBox;
    if (!box) continue;
    faces.push({
      x: box.originX,
      y: box.originY,
      width: box.width,
      height: box.height,
    });
  }
  return faces;
}

/** Release the wasm-side detectors (used when the page tears down). */
export function disposeMediaPipe(): void {
  for (const pending of detectors.values()) {
    pending.then((d) => d.close()).catch(() => undefined);
  }
  detectors.clear();
}
