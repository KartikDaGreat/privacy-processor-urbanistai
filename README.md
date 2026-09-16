# Urbanist AI Privacy Processor

**Remove metadata + face anonymization.**

Upload a photo, pick a face-detection model and a blur method, and get back an
anonymized image with all metadata stripped.

Everything runs **in the browser**. There is no backend, no upload, and no API
call — the image never leaves the machine it was opened on.

**Live:**
- Vercel — https://privacy-processor-urbanistai.vercel.app
- GitHub Pages — https://kartikdagreat.github.io/privacy-processor-urbanistai/

---

## Quick start

```bash
npm install
npm run fetch-models   # one-time: downloads ~33 MB of models into public/
npm run dev            # http://localhost:5173
```

`npm run fetch-models` is required before the first run. The model weights and
wasm runtimes are gitignored rather than committed, so a fresh clone needs this
step once. It is safe to re-run; existing files are skipped.

```bash
npm run build      # production build into dist/
npm run preview    # serve the build
npm run typecheck  # tsc, no emit
```

`dist/` is a fully static directory. Any static host will do — there is nothing
to deploy server-side.

---

## How it works

The original design for this app called for a FastAPI service doing detection
with OpenCV and MediaPipe. This build does the same work client-side:

| Stage | Where it runs |
|---|---|
| Decode + EXIF orientation | `createImageBitmap` |
| Face detection | MediaPipe Tasks (wasm) and OpenCV.js (wasm) |
| Blurring | Hand-written kernels over `ImageData` |
| Metadata stripping | Canvas re-encode to PNG |

**Metadata stripping** is a property of the pipeline, not a separate step. A
`<canvas>` holds pixels and nothing else, so anything re-encoded from one carries
no EXIF, GPS, maker notes, or colour profile. Both the *Original* preview and the
downloaded result are rendered from re-encoded pixels, so even the "before" image
on screen is already clean.

### Detection models

| UI label | id | Runtime |
|---|---|---|
| Run All (cumulative) | `run_all` | orchestration only |
| MediaPipe | `mediapipe` | BlazeFace short-range, MediaPipe Tasks |
| MediaPipe Full Range | `mediapipe_full` | BlazeFace full-range, MediaPipe Tasks |
| OpenCV DNN SSD | `opencv_dnn` | res10 SSD Caffe model, OpenCV.js |
| Haar Cascade | `haar` | `haarcascade_frontalface_default`, OpenCV.js |
| YuNet | `yunet` | `face_detection_yunet_2023mar.onnx`, OpenCV.js |

**Run All** chains the five models cumulatively: each one detects on the *output*
of the previous stage, so a face already blurred by MediaPipe is no longer a face
by the time YuNet looks. Coverage adds up instead of competing, which is the
point — it maximizes the chance that every face is caught by at least one model.

### Blur methods

`box`, `gaussian`, `median`, `pixelate`. Kernel size follows the original
pipeline: `k = max(23, (side / 5) | 1)`, so a given face gets roughly the same
blur strength it would have had server-side.

Box and Gaussian use moving-sum passes, so their cost does not grow with kernel
size. Median uses a sliding 256-bin histogram (Huang's method), which is O(kernel)
per pixel rather than O(kernel²).

### Loading behavior

Model files are fetched lazily and cached for the session — nothing downloads
until a detector that needs it is actually run. Picking an OpenCV-backed model
pulls in the 11 MB OpenCV.js runtime on first use; MediaPipe models are much
smaller. Subsequent runs reuse the loaded detectors.

---

## Project layout

```
src/
  lib/
    assets.ts       Paths to everything under public/
    blur.ts         Box / Gaussian / median / pixelate kernels
    image.ts        Decode, re-encode, metadata stripping
    pipeline.ts     Detect -> blur -> encode, shared by both UI surfaces
    apiError.ts     Turns failures into messages that name the model
    types.ts        Model and blur-method registries
    detect/
      index.ts      Orchestration, including the run_all chain
      mediapipe.ts  MediaPipe Tasks detectors
      opencv.ts     Haar, DNN SSD, YuNet via OpenCV.js
  components/       Header, ImageUpload, ResultView, selectors, ComparisonGrid
  pages/Index.tsx   The single page
scripts/
  fetch-models.mjs  Downloads models and runtimes into public/
```

---

## Deployment

The build is fully static, so both targets are just file hosting. Both deploy
automatically on push to `main`.

| Target | Trigger | Base path |
|---|---|---|
| Vercel | GitHub integration | `/` |
| GitHub Pages | `.github/workflows/deploy.yml` | `/privacy-processor-urbanistai/` |

The two differ only in where they are rooted. `vite.config.ts` reads `VITE_BASE`
(defaulting to `/`), and the Pages workflow sets it to the repo path. Because
`src/lib/assets.ts` resolves model paths against `import.meta.env.BASE_URL`,
the same source builds correctly for both.

Neither target commits the model weights — both run `npm run fetch-models`
during the build.

### Custom domain via Cloudflare

Point the subdomain at **one** target (Vercel is the better default — faster
CDN, no base-path rewriting):

**Vercel**
1. `vercel domains add <sub.domain.com>` — or add it under the project's
   Settings → Domains.
2. In Cloudflare, add a `CNAME` for the subdomain to `cname.vercel-dns.com`.
3. Set that record to **DNS only** (grey cloud) until Vercel reports the
   certificate as issued. Leaving Cloudflare's proxy on during issuance is the
   usual cause of a stuck "Invalid Configuration".

**GitHub Pages** (if you prefer Pages as the canonical host)
1. Add the domain under repo Settings → Pages → Custom domain. This commits a
   `CNAME` file.
2. In Cloudflare, add a `CNAME` for the subdomain to `kartikdagreat.github.io`,
   again **DNS only** until the certificate is issued.
3. Drop `VITE_BASE` from the workflow — on a custom domain the site is served
   from the root, so the base path must go back to `/`.

---

## Notes and limits

- **Accuracy.** Results may not always be accurate. Double check your results.
  No detector catches every face, which is why Run All exists.
- **Large images** are scaled to 4096px on the longest edge before processing, to
  stay inside browser canvas limits. The app says so via a toast when it happens.
- **Median kernel** is capped at 99px. At that radius the visual difference is
  negligible and the cost is not.
- **Output is always PNG**, since that is what a canvas re-encode produces
  losslessly.
- Detection runs on the main thread. A large image with Run All takes a few
  seconds; the UI shows which model is currently running.
