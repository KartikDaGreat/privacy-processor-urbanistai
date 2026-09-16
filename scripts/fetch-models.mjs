/**
 * Downloads every model + runtime this app needs into public/, so the whole
 * pipeline runs in the browser with no backend and no third-party CDN calls
 * at runtime. Images never leave the machine.
 *
 *   npm run fetch-models
 */
import { createWriteStream } from "node:fs";
import { mkdir, stat, cp, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPENCV_VERSION = "4.11.0-release.1";

const DOWNLOADS = [
  {
    dest: "public/vendor/opencv.js",
    url: `https://cdn.jsdelivr.net/npm/@techstark/opencv-js@${OPENCV_VERSION}/dist/opencv.js`,
    note: "OpenCV.js (haar, opencv_dnn, yunet)",
  },
  {
    dest: "public/models/deploy.prototxt",
    url: "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt",
    note: "OpenCV DNN SSD architecture",
  },
  {
    dest: "public/models/res10.caffemodel",
    url: "https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel",
    note: "OpenCV DNN SSD weights",
  },
  {
    dest: "public/models/face_detection_yunet_2023mar.onnx",
    url: "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    note: "YuNet",
  },
  {
    dest: "public/models/haarcascade_frontalface_default.xml",
    url: "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml",
    note: "Haar cascade",
  },
  {
    dest: "public/models/blaze_face_short_range.tflite",
    url: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
    note: "MediaPipe short range",
  },
  {
    dest: "public/models/blaze_face_full_range.tflite",
    url: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite",
    note: "MediaPipe full range",
  },
];

async function exists(p) {
  try {
    const s = await stat(p);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function dirExists(p) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function download({ dest, url, note }) {
  const out = path.join(root, dest);
  if (await exists(out)) {
    console.log(`  skip  ${dest} (already present)`);
    return;
  }
  await mkdir(path.dirname(out), { recursive: true });
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`${dest}: HTTP ${res.status} from ${url}`);
  }
  const tmp = `${out}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  await cp(tmp, out);
  await rm(tmp, { force: true });
  const { size } = await stat(out);
  console.log(`  ok    ${dest}  (${(size / 1e6).toFixed(1)} MB) — ${note}`);
}

/** The MediaPipe wasm runtime ships inside the npm package; copy it into public/. */
async function copyMediapipeWasm() {
  const from = path.join(root, "node_modules/@mediapipe/tasks-vision/wasm");
  const to = path.join(root, "public/vendor/mediapipe-wasm");
  if (!(await dirExists(from))) {
    throw new Error(
      "node_modules/@mediapipe/tasks-vision/wasm not found — run `npm install` first.",
    );
  }
  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true });
  console.log("  ok    public/vendor/mediapipe-wasm/ — MediaPipe wasm runtime");
}

console.log("Fetching models and runtimes into public/ ...");
for (const item of DOWNLOADS) {
  await download(item);
}
await copyMediapipeWasm();
console.log("Done. All inference assets are served locally.");
