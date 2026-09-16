import { ASSETS } from "../assets";
import type { FaceBox } from "../types";

/**
 * Haar, OpenCV DNN SSD and YuNet, running on OpenCV.js from public/vendor.
 *
 * The 11 MB runtime and the model weights are fetched lazily — nothing is
 * downloaded until a detector that needs it is actually run.
 */

/* OpenCV.js ships no type definitions for the pieces we use, so we declare the
   narrow surface this module touches rather than leaning on `any` everywhere. */
interface CvMat {
  rows: number;
  cols: number;
  data32F: Float32Array;
  delete(): void;
}
interface CvRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface CvRectVector {
  size(): number;
  get(i: number): CvRect;
  delete(): void;
}
interface CvNet {
  setInput(blob: CvMat): void;
  forward(): CvMat;
  delete(): void;
}
interface CvCascadeClassifier {
  load(path: string): boolean;
  detectMultiScale(
    image: CvMat,
    objects: CvRectVector,
    scaleFactor: number,
    minNeighbors: number,
    flags: number,
    minSize: unknown,
    maxSize: unknown,
  ): void;
  delete(): void;
}
interface CvFaceDetectorYN {
  setInputSize(size: unknown): void;
  detect(image: CvMat, faces: CvMat): void;
  delete?(): void;
}

interface OpenCvModule {
  Mat: new () => CvMat;
  Size: new (w: number, h: number) => unknown;
  Scalar: new (a: number, b: number, c: number) => unknown;
  RectVector: new () => CvRectVector;
  CascadeClassifier: new () => CvCascadeClassifier;
  FaceDetectorYN: new (
    model: string,
    config: string,
    inputSize: unknown,
    scoreThreshold: number,
    nmsThreshold: number,
    topK: number,
  ) => CvFaceDetectorYN;
  COLOR_RGBA2GRAY: number;
  COLOR_RGBA2BGR: number;
  matFromImageData(imageData: ImageData): CvMat;
  cvtColor(src: CvMat, dst: CvMat, code: number): void;
  blobFromImage(
    image: CvMat,
    scaleFactor: number,
    size: unknown,
    mean: unknown,
    swapRB: boolean,
    crop: boolean,
  ): CvMat;
  readNetFromCaffe(prototxt: string, model: string): CvNet;
  FS_createDataFile(
    parent: string,
    name: string,
    data: Uint8Array,
    canRead: boolean,
    canWrite: boolean,
    canOwn: boolean,
  ): void;
  FS_unlink(path: string): void;
}

declare global {
  interface Window {
    cv?: OpenCvModule | Promise<OpenCvModule>;
  }
}

let runtimePromise: Promise<OpenCvModule> | null = null;

/** Load OpenCV.js once, via a <script> tag, and resolve when its wasm is ready. */
function loadRuntime(): Promise<OpenCvModule> {
  if (runtimePromise) return runtimePromise;

  runtimePromise = new Promise<OpenCvModule>((resolve, reject) => {
    const existing = window.cv;
    if (existing) {
      // Already on the page (e.g. a hot reload) — it is thenable once ready.
      Promise.resolve(existing).then(resolve, reject);
      return;
    }

    const script = document.createElement("script");
    script.src = ASSETS.opencvJs();
    script.async = true;
    script.onerror = () =>
      reject(
        new Error(
          "Could not load the OpenCV runtime from public/vendor/opencv.js. Run `npm run fetch-models` and reload.",
        ),
      );
    script.onload = () => {
      const mod = window.cv;
      if (!mod) {
        reject(new Error("OpenCV.js loaded but did not register itself."));
        return;
      }
      // The emscripten module is a thenable that settles when wasm is ready.
      Promise.resolve(mod).then(
        (cv) => resolve(cv as OpenCvModule),
        (err) =>
          reject(
            new Error(
              `The OpenCV runtime failed to start: ${
                err instanceof Error ? err.message : String(err)
              }`,
            ),
          ),
      );
    };
    document.head.appendChild(script);
  });

  runtimePromise.catch(() => {
    // Let a later attempt retry from a clean slate.
    runtimePromise = null;
  });

  return runtimePromise;
}

/** Fetch a model file and mount it in the OpenCV virtual filesystem, once. */
const mountedFiles = new Map<string, Promise<void>>();

function mountFile(cv: OpenCvModule, name: string, url: string): Promise<void> {
  let pending = mountedFiles.get(name);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          `Could not load model file ${name} (HTTP ${res.status}). Run \`npm run fetch-models\` and reload.`,
        );
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      try {
        cv.FS_unlink(name);
      } catch {
        // Not mounted yet — expected on the first run.
      }
      cv.FS_createDataFile("/", name, bytes, true, false, false);
    })();
    pending.catch(() => mountedFiles.delete(name));
    mountedFiles.set(name, pending);
  }
  return pending;
}

/* Detector instances are reused across runs, mirroring the original singletons. */
let cascade: CvCascadeClassifier | null = null;
let dnnNet: CvNet | null = null;
let yunet: CvFaceDetectorYN | null = null;

const HAAR_FILE = "haarcascade_frontalface_default.xml";
const PROTOTXT_FILE = "deploy.prototxt";
const CAFFEMODEL_FILE = "res10.caffemodel";
const YUNET_FILE = "face_detection_yunet_2023mar.onnx";

export async function detectWithHaar(image: ImageData): Promise<FaceBox[]> {
  const cv = await loadRuntime();
  await mountFile(cv, HAAR_FILE, ASSETS.haarCascade());

  if (!cascade) {
    const classifier = new cv.CascadeClassifier();
    if (!classifier.load(HAAR_FILE)) {
      classifier.delete();
      throw new Error("OpenCV could not parse the Haar cascade file.");
    }
    cascade = classifier;
  }

  const src = cv.matFromImageData(image);
  const gray = new cv.Mat();
  const found = new cv.RectVector();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cascade.detectMultiScale(
      gray,
      found,
      1.1,
      5,
      0,
      new cv.Size(30, 30),
      new cv.Size(0, 0),
    );
    const faces: FaceBox[] = [];
    for (let i = 0; i < found.size(); i++) {
      const r = found.get(i);
      faces.push({ x: r.x, y: r.y, width: r.width, height: r.height });
    }
    return faces;
  } finally {
    src.delete();
    gray.delete();
    found.delete();
  }
}

export async function detectWithDnn(image: ImageData): Promise<FaceBox[]> {
  const cv = await loadRuntime();
  await mountFile(cv, PROTOTXT_FILE, ASSETS.dnnPrototxt());
  await mountFile(cv, CAFFEMODEL_FILE, ASSETS.dnnCaffemodel());

  if (!dnnNet) {
    dnnNet = cv.readNetFromCaffe(PROTOTXT_FILE, CAFFEMODEL_FILE);
  }

  const src = cv.matFromImageData(image);
  const bgr = new cv.Mat();
  let blob: CvMat | null = null;
  let output: CvMat | null = null;
  try {
    cv.cvtColor(src, bgr, cv.COLOR_RGBA2BGR);
    blob = cv.blobFromImage(
      bgr,
      1.0,
      new cv.Size(300, 300),
      new cv.Scalar(104, 177, 123),
      false,
      false,
    );
    dnnNet.setInput(blob);
    output = dnnNet.forward();

    // Output rows are [batch, class, confidence, x1, y1, x2, y2] in 0..1 coords.
    const data = output.data32F;
    const faces: FaceBox[] = [];
    for (let i = 0; i + 6 < data.length; i += 7) {
      if (data[i + 2] <= 0.5) continue;
      const x1 = data[i + 3] * image.width;
      const y1 = data[i + 4] * image.height;
      const x2 = data[i + 5] * image.width;
      const y2 = data[i + 6] * image.height;
      faces.push({
        x: x1,
        y: y1,
        width: Math.max(0, x2 - x1),
        height: Math.max(0, y2 - y1),
      });
    }
    return faces;
  } finally {
    src.delete();
    bgr.delete();
    blob?.delete();
    output?.delete();
  }
}

export async function detectWithYunet(image: ImageData): Promise<FaceBox[]> {
  const cv = await loadRuntime();
  await mountFile(cv, YUNET_FILE, ASSETS.yunetOnnx());

  if (!yunet) {
    yunet = new cv.FaceDetectorYN(
      YUNET_FILE,
      "",
      new cv.Size(320, 320),
      0.6,
      0.3,
      5000,
    );
  }

  const src = cv.matFromImageData(image);
  const bgr = new cv.Mat();
  const results = new cv.Mat();
  try {
    cv.cvtColor(src, bgr, cv.COLOR_RGBA2BGR);
    yunet.setInputSize(new cv.Size(image.width, image.height));
    yunet.detect(bgr, results);

    // Each row is [x, y, w, h, 5 landmark pairs, score].
    const faces: FaceBox[] = [];
    for (let r = 0; r < results.rows; r++) {
      const base = r * results.cols;
      faces.push({
        x: results.data32F[base],
        y: results.data32F[base + 1],
        width: results.data32F[base + 2],
        height: results.data32F[base + 3],
      });
    }
    return faces;
  } finally {
    src.delete();
    bgr.delete();
    results.delete();
  }
}

/** True once the OpenCV runtime has been requested — used to warn about the first-run download. */
export function isOpenCvLoaded(): boolean {
  return runtimePromise !== null;
}
