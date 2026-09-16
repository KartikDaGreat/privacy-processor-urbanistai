/**
 * Image decode / encode helpers.
 *
 * Everything here routes pixels through a <canvas>. That is what strips
 * metadata: a canvas holds pixels and nothing else, so anything re-encoded
 * from one carries no EXIF, GPS, maker notes or colour-profile tags.
 */

/** Very large photos are downscaled to stay inside browser canvas limits. */
export const MAX_DIMENSION = 4096;

export interface DecodedImage {
  imageData: ImageData;
  width: number;
  height: number;
  /** True when the source exceeded MAX_DIMENSION and was scaled down. */
  downscaled: boolean;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  // willReadFrequently: every pass here does getImageData immediately after drawing.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get a 2D canvas context in this browser.");
  return ctx;
}

async function decodeToBitmap(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" honours the EXIF orientation tag before we discard metadata.
      return await createImageBitmap(source, { imageOrientation: "from-image" });
    } catch {
      // Fall through to the <img> path below.
    }
  }
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("This file could not be decoded as an image."));
      img.src = url;
    });
    return img;
  } finally {
    // The bitmap is already rasterised into the element by the time we revoke.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Decode any image blob into raw pixels, applying EXIF rotation and the size cap. */
export async function decodeImage(source: Blob): Promise<DecodedImage> {
  const bitmap = await decodeToBitmap(source);
  const naturalWidth = "width" in bitmap ? bitmap.width : 0;
  const naturalHeight = "height" in bitmap ? bitmap.height : 0;

  if (!naturalWidth || !naturalHeight) {
    throw new Error("This file could not be decoded as an image.");
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = makeCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
  if ("close" in bitmap) bitmap.close();

  return {
    imageData: ctx.getImageData(0, 0, width, height),
    width,
    height,
    downscaled: scale < 1,
  };
}

/** Re-encode pixels as PNG. The result carries no metadata of any kind. */
export async function imageDataToPngBlob(imageData: ImageData): Promise<Blob> {
  const canvas = makeCanvas(imageData.width, imageData.height);
  context2d(canvas).putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser failed to encode the processed image."));
    }, "image/png");
  });
}

/**
 * Strip metadata from an arbitrary image blob by round-tripping it through a
 * canvas. Used for the "Original" preview so that even the untouched side of
 * the comparison is never rendered from a file carrying EXIF/GPS data.
 */
export async function stripMetadata(source: Blob): Promise<Blob> {
  const { imageData } = await decodeImage(source);
  return imageDataToPngBlob(imageData);
}

/** An ImageData-backed copy, so successive passes never alias each other. */
export function cloneImageData(source: ImageData): ImageData {
  return new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );
}
