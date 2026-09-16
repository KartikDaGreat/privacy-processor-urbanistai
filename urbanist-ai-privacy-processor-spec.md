# Build Spec: Urbanist AI Privacy Processor

Paste everything below this line into a Claude agent (e.g. Lovable) as the build prompt.

---

## Project: Urbanist AI Privacy Processor

Build a full-stack web app called **Urbanist AI Privacy Processor**. Tagline: **"Remove metadata + face anonymization"**. Users upload a photo, pick a face-detection model and a blur method, and get back an anonymized image with all metadata stripped. Display this disclaimer near the main controls: **"Results may not always be accurate. Double check your results."**

### Tech stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui components, `lucide-react` icons, `sonner` toasts
- **Backend:** Python FastAPI (deployed separately, e.g. Google Cloud Run) — full backend code is included at the bottom of this spec. The frontend calls it via a configurable `API_BASE` URL constant.

### Design / color scheme

Dark, techy privacy-tool look. Palette: **pure blue (#0000FF), grey, black, white**. JetBrains Mono for headings/labels (`font-mono-display`), Inter for body text. Use semantic design tokens in `index.css` (never hardcode colors):

- `--background`: very dark blue-black (~HSL 225 25% 5%)
- `--foreground`: near-white
- `--primary` / `--accent` / `--ring` / `--glow-primary`: pure blue (HSL 240 100% 50%)
- `--card` / `--surface-glass`: dark blue-grey panels
- Utility classes: `.glass-surface` (blurred translucent panel with border), `.glow-primary` (soft blue box-shadow glow), `.gradient-text` (blue-to-light-blue gradient headline text), `.font-mono-display`

Set `<title>Urbanist AI Privacy Processor</title>` in index.html with a matching meta description ("Upload a photo, detect faces with multiple models, blur them, and strip metadata — privacy-first face anonymization.") and og:title/og:description.

### Pages & layout (single page, `/`)

1. **Header** — Shield icon (blue) + app name in gradient text; right side: mono-font tagline "Remove metadata + face anonymization".
2. **Hero block** — centered `<h2>` "Anonymize Faces Instantly" (gradient text) + subtext: "Upload an image, choose a detection model and blur method, and protect identities in seconds."
3. **Two-column grid** (upload+result left, controls right at `lg:grid-cols-[1fr_320px]`):

**Left column:**
- `ImageUpload` — drag & drop + click-to-browse zone (JPG/PNG etc.), dashed border, glass surface. After an image is selected it collapses to a small "Change image" button so the result view takes center stage.
- `ResultView` — side-by-side **Original** and **Processed** panels with labels; shows a processing spinner while waiting; a **Download** button appears after processing (downloads the metadata-stripped image as PNG).

**Right column (glass panel):**
- `ModelSelector` — detection model choices (see list below), each a selectable row with name + short description; includes a **"Run All"** option as the first choice.
- `BlurSelector` — blur method choices: Box, Gaussian, Median, Pixelate.
- **"Process Image"** button (blue, glow, Zap icon; disabled without an image; shows "Processing..." while running).
- Status card: colored dot (idle grey / pulsing blue while processing / green when complete) + text showing selected model and blur method, plus the disclaimer "Results may not always be accurate. Double check your results."

4. **ComparisonGrid** (below the main grid) — "Model Comparison" section: an **"All Models"** button auto-adds one card per detection model, an **"Add"** button adds a blank card; each card has dropdowns to pick model + blur method and its own thumbnail result; a **"Run All"** button processes every card in parallel; hovering a finished result reveals a per-card download button.

### Detection models (must match backend IDs exactly)

| UI label | backend id |
|---|---|
| Run All (cumulative) | `run_all` (frontend-only, see below) |
| MediaPipe (fast, close-range) | `mediapipe` |
| MediaPipe Full Range (far/small faces) | `mediapipe_full` |
| OpenCV DNN SSD (balanced) | `opencv_dnn` |
| Haar Cascade (classic, fastest) | `haar` |
| YuNet (accurate, lightweight ONNX) | `yunet` |

**"Run All" behavior:** chain all 5 models cumulatively — upload once, process with model 1, then re-upload the result and process with model 2, and so on — so each model's output feeds the next, maximizing detection coverage.

### Blur methods

`box`, `gaussian`, `median`, `pixelate` (must match backend).

### Processing flow (per run)

1. `POST {API_BASE}/upload` with multipart `file` → returns `{ filename, temp_id }`
2. `POST {API_BASE}/process` with FormData fields `filename`, `face_model`, `blur_method`, `temp_id` → returns the processed image binary
3. Create an object URL from the response blob and show it in ResultView

### Metadata stripping

Strip EXIF/metadata client-side before display/download: draw the processed image onto a `<canvas>` and export via `canvas.toDataURL("image/png")` / `toBlob` — canvas re-encoding drops all metadata. The Download button must save this clean version.

### Error handling

Errors must say which model failed and why, not a generic "Processing failed". Include a helper (`src/lib/apiError.ts`) that interprets failed responses: network failure → "service offline / can't be reached", 404 → "service not found at this address", 503/cold start → "service still starting up, try again", otherwise surface the server's error text. Show via `sonner` toast.

### Backend (deploy separately; needs CORS enabled)

Deploy this exact FastAPI app (e.g. on Cloud Run) and set the frontend's `API_BASE` to its URL:

```python
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from PIL import Image
import numpy as np
import cv2
import uuid
import urllib.request

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

DNN_PROTOTXT   = "deploy.prototxt"
DNN_CAFFEMODEL = "res10.caffemodel"
YUNET_MODEL    = "face_detection_yunet_2023mar.onnx"

DNN_PROTOTXT_URL   = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
DNN_CAFFEMODEL_URL = "https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"
YUNET_URL          = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"

def download_if_missing(path, url):
    if not os.path.exists(path):
        urllib.request.urlretrieve(url, path)

download_if_missing(DNN_PROTOTXT,   DNN_PROTOTXT_URL)
download_if_missing(DNN_CAFFEMODEL, DNN_CAFFEMODEL_URL)
download_if_missing(YUNET_MODEL,    YUNET_URL)

_mediapipe_detector = None
_dnn_net            = None
_haar_cascade       = None
_yunet              = None

def get_mediapipe():
    global _mediapipe_detector
    if _mediapipe_detector is None:
        import mediapipe as mp
        _mediapipe_detector = mp.solutions.face_detection.FaceDetection(
            model_selection=0, min_detection_confidence=0.5)
    return _mediapipe_detector

def get_dnn_net():
    global _dnn_net
    if _dnn_net is None:
        _dnn_net = cv2.dnn.readNetFromCaffe(DNN_PROTOTXT, DNN_CAFFEMODEL)
    return _dnn_net

def get_haar():
    global _haar_cascade
    if _haar_cascade is None:
        _haar_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    return _haar_cascade

def get_yunet():
    global _yunet
    if _yunet is None:
        _yunet = cv2.FaceDetectorYN.create(
            YUNET_MODEL, "", (320, 320),
            score_threshold=0.6, nms_threshold=0.3, top_k=5000)
    return _yunet

def detect_mediapipe(image_np):
    detector = get_mediapipe()
    rgb = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
    results = detector.process(rgb)
    faces = []
    if results.detections:
        h, w = image_np.shape[:2]
        for det in results.detections:
            box = det.location_data.relative_bounding_box
            x  = max(0, int(box.xmin  * w)); y = max(0, int(box.ymin * h))
            faces.append((x, y, int(box.width * w), int(box.height * h)))
    return faces

def detect_dnn(image_np):
    net = get_dnn_net()
    h, w = image_np.shape[:2]
    blob = cv2.dnn.blobFromImage(cv2.resize(image_np, (300, 300)), 1.0, (300, 300), (104, 177, 123))
    net.setInput(blob)
    detections = net.forward()
    faces = []
    for i in range(detections.shape[2]):
        if detections[0, 0, i, 2] > 0.5:
            box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
            x1, y1, x2, y2 = box.astype(int)
            x1, y1 = max(0, x1), max(0, y1)
            faces.append((x1, y1, max(0, x2 - x1), max(0, y2 - y1)))
    return faces

def detect_haar(image_np):
    gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
    detected = get_haar().detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    return [tuple(face) for face in detected] if len(detected) else []

def detect_yunet(image_np):
    detector = get_yunet()
    h, w = image_np.shape[:2]
    detector.setInputSize((w, h))
    _, detections = detector.detect(image_np)
    faces = []
    if detections is not None:
        for det in detections:
            x, y, bw, bh = int(det[0]), int(det[1]), int(det[2]), int(det[3])
            faces.append((max(0, x), max(0, y), bw, bh))
    return faces

def detect_mediapipe_full(image_np):
    import mediapipe as mp
    detector = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.4)
    rgb = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
    results = detector.process(rgb)
    faces = []
    if results.detections:
        h, w = image_np.shape[:2]
        for det in results.detections:
            box = det.location_data.relative_bounding_box
            x  = max(0, int(box.xmin  * w)); y = max(0, int(box.ymin * h))
            faces.append((x, y, int(box.width * w), int(box.height * h)))
    return faces

MODELS = {
    "mediapipe":      detect_mediapipe,
    "mediapipe_full": detect_mediapipe_full,
    "opencv_dnn":     detect_dnn,
    "haar":           detect_haar,
    "yunet":          detect_yunet,
}

def detect_faces(image_np, model):
    fn = MODELS.get(model)
    if fn is None:
        return []
    try:
        return fn(image_np)
    except Exception as e:
        print(f"[detect_faces] model={model} error: {e}")
        return []

def blur_face(image_np, faces, method):
    for (x, y, w, h) in faces:
        x2, y2 = min(x + w, image_np.shape[1]), min(y + h, image_np.shape[0])
        if x2 <= x or y2 <= y:
            continue
        roi = image_np[y:y2, x:x2]
        ksize = (max(23, (w // 5) | 1), max(23, (h // 5) | 1))
        if method == "box":
            roi = cv2.blur(roi, ksize)
        elif method == "gaussian":
            roi = cv2.GaussianBlur(roi, ksize, 30)
        elif method == "median":
            roi = cv2.medianBlur(roi, max(23, (min(w, h) // 5) | 1))
        elif method == "pixelate":
            small = cv2.resize(roi, (max(1, w // 10), max(1, h // 10)), interpolation=cv2.INTER_LINEAR)
            roi = cv2.resize(small, (x2 - x, y2 - y), interpolation=cv2.INTER_NEAREST)
        image_np[y:y2, x:x2] = roi
    return image_np

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/models")
def get_models():
    return JSONResponse({
        "face_models": [
            {"id": "mediapipe",      "label": "MediaPipe (fast, close-range)"},
            {"id": "mediapipe_full", "label": "MediaPipe Full Range (far/small faces)"},
            {"id": "opencv_dnn",     "label": "OpenCV DNN SSD (balanced)"},
            {"id": "haar",           "label": "Haar Cascade (classic, fastest)"},
            {"id": "yunet",          "label": "YuNet (accurate, lightweight ONNX)"},
        ],
        "blur_methods": ["box", "gaussian", "median", "pixelate"],
    })

@app.post("/upload")
def upload_image(file: UploadFile = File(...)):
    temp_id = str(uuid.uuid4())
    temp_dir = os.path.join(UPLOAD_DIR, temp_id)
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, file.filename)
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    return {"filename": file.filename, "temp_id": temp_id}

@app.post("/process")
def process_image(filename: str = Form(...), face_model: str = Form(...),
                  blur_method: str = Form(...), temp_id: str = Form(...)):
    file_path = os.path.join(UPLOAD_DIR, temp_id, filename)
    image = Image.open(file_path).convert("RGB")
    image_bgr = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    faces = detect_faces(image_bgr, face_model)
    if faces:
        image_bgr = blur_face(image_bgr, faces, blur_method)
    processed = Image.fromarray(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB))
    processed_path = os.path.join(UPLOAD_DIR, temp_id, f"processed_{filename}")
    processed.save(processed_path)
    return FileResponse(processed_path)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
```

Backend dependencies: `fastapi uvicorn pillow numpy opencv-python-headless mediapipe python-multipart`

---

End of spec.
