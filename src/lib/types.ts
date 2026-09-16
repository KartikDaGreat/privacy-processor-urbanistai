/** Detection model ids. `run_all` is orchestration-only — it chains the real models. */
export type DetectionModelId =
  | "run_all"
  | "mediapipe"
  | "mediapipe_full"
  | "opencv_dnn"
  | "haar"
  | "yunet";

/** The models that actually detect; `run_all` runs these in order. */
export type RealModelId = Exclude<DetectionModelId, "run_all">;

export type BlurMethod = "box" | "gaussian" | "median" | "pixelate";

export interface ModelOption {
  id: DetectionModelId;
  label: string;
  description: string;
}

export const REAL_MODEL_IDS: RealModelId[] = [
  "mediapipe",
  "mediapipe_full",
  "opencv_dnn",
  "haar",
  "yunet",
];

export const MODELS: ModelOption[] = [
  {
    id: "run_all",
    label: "Run All (cumulative)",
    description: "Chains all five detectors so their coverage adds up",
  },
  {
    id: "mediapipe",
    label: "MediaPipe",
    description: "Fast, close-range",
  },
  {
    id: "mediapipe_full",
    label: "MediaPipe Full Range",
    description: "Far / small faces",
  },
  {
    id: "opencv_dnn",
    label: "OpenCV DNN SSD",
    description: "Balanced accuracy and speed",
  },
  {
    id: "haar",
    label: "Haar Cascade",
    description: "Classic, fastest",
  },
  {
    id: "yunet",
    label: "YuNet",
    description: "Accurate, lightweight ONNX",
  },
];

export interface BlurOption {
  id: BlurMethod;
  label: string;
  description: string;
}

export const BLUR_METHODS: BlurOption[] = [
  { id: "box", label: "Box", description: "Uniform average blur" },
  { id: "gaussian", label: "Gaussian", description: "Smooth, natural falloff" },
  { id: "median", label: "Median", description: "Edge-preserving smear" },
  { id: "pixelate", label: "Pixelate", description: "Chunky mosaic blocks" },
];

export function modelLabel(id: DetectionModelId): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}

export function blurLabel(id: BlurMethod): string {
  return BLUR_METHODS.find((b) => b.id === id)?.label ?? id;
}

/** A detected face, in pixel coordinates of the source image. */
export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
