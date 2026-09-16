import type { BlurMethod, FaceBox } from "./types";

/**
 * Blur implementations for face regions, run on raw ImageData in the browser.
 *
 * Kernel sizing mirrors the original OpenCV pipeline: k = max(23, (side / 5) | 1),
 * so a given face gets roughly the blur strength it would have had server-side.
 */

/** Median cost scales with kernel width; cap it so huge faces stay interactive. */
const MAX_MEDIAN_KERNEL = 99;

function oddKernel(side: number): number {
  return Math.max(23, Math.floor(side / 5) | 1);
}

interface Roi {
  data: Uint8ClampedArray; // RGBA
  width: number;
  height: number;
}

function readRoi(src: ImageData, r: FaceBox): Roi {
  const out = new Uint8ClampedArray(r.width * r.height * 4);
  for (let y = 0; y < r.height; y++) {
    const srcStart = ((r.y + y) * src.width + r.x) * 4;
    out.set(src.data.subarray(srcStart, srcStart + r.width * 4), y * r.width * 4);
  }
  return { data: out, width: r.width, height: r.height };
}

function writeRoi(dst: ImageData, roi: Roi, r: FaceBox): void {
  for (let y = 0; y < roi.height; y++) {
    const dstStart = ((r.y + y) * dst.width + r.x) * 4;
    dst.data.set(roi.data.subarray(y * roi.width * 4, (y + 1) * roi.width * 4), dstStart);
  }
}

/** Clamp a box to the image bounds; returns null for degenerate boxes. */
function clampBox(box: FaceBox, width: number, height: number): FaceBox | null {
  const x = Math.max(0, Math.round(box.x));
  const y = Math.max(0, Math.round(box.y));
  const x2 = Math.min(width, Math.round(box.x + box.width));
  const y2 = Math.min(height, Math.round(box.y + box.height));
  if (x2 <= x || y2 <= y) return null;
  return { x, y, width: x2 - x, height: y2 - y };
}

function clampIndex(i: number, n: number): number {
  return i < 0 ? 0 : i >= n ? n - 1 : i;
}

/** Moving-sum horizontal pass, so cost does not grow with kernel size. */
function horizontalBoxPass(roi: Roi, k: number): void {
  const { data, width, height } = roi;
  const radius = (k - 1) / 2;
  const line = new Uint8ClampedArray(width * 4);
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      // Seed the window at x = 0, replicating the edge pixel outside the ROI.
      for (let i = -radius; i <= radius; i++) {
        sum += data[row + clampIndex(i, width) * 4 + c];
      }
      for (let x = 0; x < width; x++) {
        line[x * 4 + c] = sum / k;
        const outIdx = clampIndex(x - radius, width);
        const inIdx = clampIndex(x + radius + 1, width);
        sum += data[row + inIdx * 4 + c] - data[row + outIdx * 4 + c];
      }
    }
    for (let x = 0; x < width; x++) {
      data[row + x * 4] = line[x * 4];
      data[row + x * 4 + 1] = line[x * 4 + 1];
      data[row + x * 4 + 2] = line[x * 4 + 2];
    }
  }
}

function verticalBoxPass(roi: Roi, k: number): void {
  const { data, width, height } = roi;
  const radius = (k - 1) / 2;
  const col = new Uint8ClampedArray(height * 4);
  for (let x = 0; x < width; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let i = -radius; i <= radius; i++) {
        sum += data[(clampIndex(i, height) * width + x) * 4 + c];
      }
      for (let y = 0; y < height; y++) {
        col[y * 4 + c] = sum / k;
        const outIdx = clampIndex(y - radius, height);
        const inIdx = clampIndex(y + radius + 1, height);
        sum += data[(inIdx * width + x) * 4 + c] - data[(outIdx * width + x) * 4 + c];
      }
    }
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      data[idx] = col[y * 4];
      data[idx + 1] = col[y * 4 + 1];
      data[idx + 2] = col[y * 4 + 2];
    }
  }
}

function boxBlur(roi: Roi, kw: number, kh: number): void {
  horizontalBoxPass(roi, kw);
  verticalBoxPass(roi, kh);
}

/** Three successive box passes converge on a Gaussian while staying O(1) per pixel. */
function gaussianBlur(roi: Roi, kw: number, kh: number): void {
  for (let pass = 0; pass < 3; pass++) {
    horizontalBoxPass(roi, kw);
    verticalBoxPass(roi, kh);
  }
}

/**
 * Median filter with a sliding 256-bin histogram per channel (Huang's method):
 * stepping one pixel right swaps a single column in and out, making the cost
 * O(kernel) per pixel instead of O(kernel^2).
 */
function medianBlur(roi: Roi, k: number): void {
  const { data, width, height } = roi;
  const radius = (k - 1) / 2;
  const src = new Uint8ClampedArray(data);
  const threshold = (k * k) >> 1;
  const hist = new Int32Array(256);

  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < height; y++) {
      hist.fill(0);
      // Seed the window centred on x = 0.
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = clampIndex(y + dy, height);
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = clampIndex(dx, width);
          hist[src[(yy * width + xx) * 4 + c]]++;
        }
      }
      for (let x = 0; x < width; x++) {
        let count = 0;
        let value = 0;
        for (let bin = 0; bin < 256; bin++) {
          count += hist[bin];
          if (count > threshold) {
            value = bin;
            break;
          }
        }
        data[(y * width + x) * 4 + c] = value;

        if (x + 1 < width) {
          const outX = clampIndex(x - radius, width);
          const inX = clampIndex(x + radius + 1, width);
          for (let dy = -radius; dy <= radius; dy++) {
            const yy = clampIndex(y + dy, height);
            hist[src[(yy * width + outX) * 4 + c]]--;
            hist[src[(yy * width + inX) * 4 + c]]++;
          }
        }
      }
    }
  }
}

/** Block-average then replicate — equivalent to a downscale plus nearest upscale. */
function pixelate(roi: Roi, blockW: number, blockH: number): void {
  const { data, width, height } = roi;
  for (let by = 0; by < height; by += blockH) {
    for (let bx = 0; bx < width; bx += blockW) {
      const maxX = Math.min(bx + blockW, width);
      const maxY = Math.min(by + blockH, height);
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = by; y < maxY; y++) {
        for (let x = bx; x < maxX; x++) {
          const i = (y * width + x) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
      }
      if (n === 0) continue;
      r /= n;
      g /= n;
      b /= n;
      for (let y = by; y < maxY; y++) {
        for (let x = bx; x < maxX; x++) {
          const i = (y * width + x) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
        }
      }
    }
  }
}

/** Blur every detected face into `image`, in place. Returns how many were blurred. */
export function blurFaces(
  image: ImageData,
  faces: FaceBox[],
  method: BlurMethod,
): number {
  let applied = 0;
  for (const face of faces) {
    const box = clampBox(face, image.width, image.height);
    if (!box) continue;

    const roi = readRoi(image, box);

    switch (method) {
      case "box":
        boxBlur(roi, fitKernel(oddKernel(box.width), roi.width), fitKernel(oddKernel(box.height), roi.height));
        break;
      case "gaussian":
        gaussianBlur(
          roi,
          fitKernel(oddKernel(box.width), roi.width),
          fitKernel(oddKernel(box.height), roi.height),
        );
        break;
      case "median": {
        const side = Math.min(box.width, box.height);
        const k = Math.min(
          oddKernel(side),
          MAX_MEDIAN_KERNEL,
          fitKernel(oddKernel(side), Math.min(roi.width, roi.height)),
        );
        medianBlur(roi, k % 2 === 0 ? k - 1 : k);
        break;
      }
      case "pixelate":
        pixelate(
          roi,
          Math.max(1, Math.round(box.width / 10)),
          Math.max(1, Math.round(box.height / 10)),
        );
        break;
    }

    writeRoi(image, roi, box);
    applied++;
  }
  return applied;
}

/** Keep the kernel odd and no wider than the ROI can support. */
function fitKernel(k: number, extent: number): number {
  const maxK = Math.max(1, (extent * 2 - 1) | 1);
  const fitted = Math.min(k, maxK);
  return fitted % 2 === 0 ? fitted - 1 : fitted;
}
