/** Resolve a path under public/ against the app's base URL. */
export function assetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/${relativePath.replace(/^\//, "")}`;
}

export const ASSETS = {
  mediapipeWasm: () => assetUrl("vendor/mediapipe-wasm"),
  opencvJs: () => assetUrl("vendor/opencv.js"),
  blazeShortRange: () => assetUrl("models/blaze_face_short_range.tflite"),
  blazeFullRange: () => assetUrl("models/blaze_face_full_range.tflite"),
  dnnPrototxt: () => assetUrl("models/deploy.prototxt"),
  dnnCaffemodel: () => assetUrl("models/res10.caffemodel"),
  yunetOnnx: () => assetUrl("models/face_detection_yunet_2023mar.onnx"),
  haarCascade: () => assetUrl("models/haarcascade_frontalface_default.xml"),
} as const;
