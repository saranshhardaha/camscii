import { gridFor, asciiText } from "./asciify.js";
import { initControls } from "./controls.js";
import { drawAscii, cellMetrics } from "./render.js";
import { createRecorder, recordingSupported } from "./recorder.js";

// ---- elements ----
const video = document.getElementById("video"); // camera + uploaded video
const uimg = document.getElementById("uimg"); // uploaded image
const sampler = document.getElementById("sampler"); // tiny downscale canvas
const output = document.getElementById("output"); // ASCII render target
const message = document.getElementById("message");
const statusEl = document.getElementById("status");
const fileInput = document.getElementById("file");

const camBtn = document.getElementById("cam");
const camLabel = camBtn.querySelector(".btn-text");
const uploadBtn = document.getElementById("upload");
const recordBtn = document.getElementById("record");
const snapBtn = document.getElementById("snap");
const txtBtn = document.getElementById("savetxt");

const sctx = sampler.getContext("2d", { willReadFrequently: true });
const octx = output.getContext("2d");
const settings = initControls();

const FONT_PX = 14; // export quality of the ASCII glyphs

// ---- state ----
let mode = "idle"; // 'camera' | 'video' | 'image' | 'idle'
let stream = null; // camera MediaStream
let rafId = null;
let dirty = true; // for static image: redraw needed
let lastFrame = null; // { data, cols, rows } for .txt export
let objectUrl = null; // uploaded media blob URL

// FPS meter
let frames = 0;
let lastTick = performance.now();

const recorder = createRecorder(output, onRecordingComplete);

// ---- helpers ----
function setStatus(msg) {
  statusEl.textContent = msg;
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
  output.hidden = !!text;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

// Enable/disable export buttons for the current mode.
function syncButtons() {
  const live = mode === "camera" || mode === "video";
  const hasFrame = mode !== "idle";
  snapBtn.disabled = !hasFrame;
  txtBtn.disabled = !hasFrame;
  recordBtn.disabled = !(live && recordingSupported());
  camLabel.textContent = mode === "camera" ? "Stop camera" : "Camera";
  camBtn.classList.toggle("running", mode === "camera");
}

function preflight() {
  if (window.self !== window.top) {
    return "Running inside an embedded frame, which blocks the camera. Open this page in a real browser tab.";
  }
  if (!window.isSecureContext) {
    return "Not a secure context. Use http://localhost or https — not a file:// path.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser has no camera API. Try Chrome, Edge, Safari, or Firefox.";
  }
  return null;
}

function explain(err) {
  switch (err.name) {
    case "NotAllowedError":
      return "Permission denied or dismissed. Click the camera icon in the address bar → Allow, then retry. On macOS also enable your browser in System Settings → Privacy & Security → Camera.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera found. Plug one in or enable it, then retry.";
    case "NotReadableError":
      return "Camera is busy — another app (Zoom, FaceTime…) is using it. Close it and retry.";
    case "SecurityError":
      return "Blocked by browser security policy. Open this page directly in a browser tab.";
    default:
      return `${err.name}: ${err.message}`;
  }
}

// ---- source switching ----
function stopCamera() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
}

function releaseMedia() {
  stopCamera();
  video.pause?.();
  video.removeAttribute("src");
  video.srcObject = null;
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

function startLoop() {
  if (!rafId) loop();
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

async function startCamera() {
  const blocked = preflight();
  if (blocked) {
    setStatus(blocked);
    showMessage("⚠ Camera unavailable here.");
    return;
  }
  try {
    setStatus("Requesting camera… (allow the prompt)");
    releaseMedia();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    video.loop = false;
    await video.play();
    mode = "camera";
    showMessage("");
    syncButtons();
    setStatus("Live.");
    startLoop();
  } catch (err) {
    mode = "idle";
    syncButtons();
    setStatus(`Camera blocked — ${explain(err)}`);
    showMessage("⚠ Camera blocked. See message below.");
  }
}

function stopCameraMode() {
  stopLoop();
  releaseMedia();
  mode = "idle";
  syncButtons();
  showMessage("Press “Camera” or upload an image / video.");
  setStatus("Stopped.");
}

function loadImage(file) {
  releaseMedia();
  stopLoop();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  uimg.onload = () => {
    mode = "image";
    dirty = true;
    showMessage("");
    syncButtons();
    setStatus(`Image: ${file.name}`);
    startLoop();
  };
  uimg.onerror = () => setStatus("Could not load that image.");
  uimg.src = objectUrl;
}

function loadVideo(file) {
  releaseMedia();
  stopLoop();
  objectUrl = URL.createObjectURL(file);
  video.srcObject = null;
  video.src = objectUrl;
  video.loop = true;
  video.muted = true;
  video.onloadeddata = () => {
    mode = "video";
    showMessage("");
    syncButtons();
    setStatus(`Video: ${file.name} — playing (loops)`);
    video.play();
    startLoop();
  };
  video.onerror = () => setStatus("Could not load that video.");
}

// ---- render loop ----
function frameReady() {
  if (mode === "image") return uimg.complete && uimg.naturalWidth > 0;
  return video.videoWidth > 0;
}

function sourceSize() {
  return mode === "image"
    ? [uimg.naturalWidth, uimg.naturalHeight]
    : [video.videoWidth, video.videoHeight];
}

function sourceEl() {
  return mode === "image" ? uimg : video;
}

function renderFrame() {
  const [sw, sh] = sourceSize();
  if (!sw || !sh) return;

  const { cols, rows } = gridFor(sw, sh, settings.cols);

  if (sampler.width !== cols || sampler.height !== rows) {
    sampler.width = cols;
    sampler.height = rows;
  }

  sctx.save();
  if (settings.mirror) {
    sctx.translate(cols, 0);
    sctx.scale(-1, 1);
  }
  sctx.drawImage(sourceEl(), 0, 0, cols, rows);
  sctx.restore();

  const { data } = sctx.getImageData(0, 0, cols, rows);
  lastFrame = { data, cols, rows };

  // Size the output canvas to the glyph grid.
  const { w: cw, h: chh } = cellMetrics(octx, FONT_PX);
  const ow = Math.round(cols * cw);
  const oh = Math.round(rows * chh);
  if (output.width !== ow || output.height !== oh) {
    output.width = ow;
    output.height = oh;
  }

  drawAscii(octx, data, cols, rows, {
    ramp: settings.ramp,
    invert: settings.invert,
    color: settings.color,
    fontPx: FONT_PX,
    fgColor: "#d7ffd7",
  });
}

function loop() {
  rafId = requestAnimationFrame(loop);
  if (!frameReady()) return;

  if (mode === "image") {
    if (!dirty) return;
    dirty = false;
    renderFrame();
    setStatus(`Image · ${output.width}×${output.height}px`);
    return;
  }

  renderFrame();

  frames++;
  const now = performance.now();
  if (now - lastTick >= 1000) {
    setStatus(
      `${mode === "camera" ? "Live" : "Video"} — ${frames} fps · ${lastFrame.cols}×${lastFrame.rows}${
        settings.color ? " · color" : ""
      }${recorder.isActive() ? " · ● REC" : ""}`
    );
    frames = 0;
    lastTick = now;
  }
}

// ---- exports ----
function onRecordingComplete(blob) {
  download(blob, `camscii-${stamp()}.webm`);
  setStatus(`Saved recording (${(blob.size / 1048576).toFixed(1)} MB).`);
}

function toggleRecord() {
  if (recorder.isActive()) {
    recorder.stop();
    recordBtn.classList.remove("running");
    recordBtn.querySelector(".rec-text").textContent = "Record";
  } else {
    recorder.start(30);
    recordBtn.classList.add("running");
    recordBtn.querySelector(".rec-text").textContent = "Stop";
    setStatus("Recording… click Stop to export .webm");
  }
}

function savePng() {
  if (mode === "idle") return;
  output.toBlob((blob) => {
    if (blob) download(blob, `camscii-${stamp()}.png`);
  }, "image/png");
}

function saveTxt() {
  if (!lastFrame) return;
  const text = asciiText(
    lastFrame.data,
    lastFrame.cols,
    lastFrame.rows,
    settings.ramp,
    settings.invert
  );
  download(new Blob([text], { type: "text/plain" }), `camscii-${stamp()}.txt`);
}

// ---- wiring ----
camBtn.addEventListener("click", () => {
  if (mode === "camera") stopCameraMode();
  else startCamera();
});

uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (file.type.startsWith("image/")) loadImage(file);
  else if (file.type.startsWith("video/")) loadVideo(file);
  else setStatus("Unsupported file type. Pick an image or a video.");
  fileInput.value = ""; // allow re-selecting the same file
});

recordBtn.addEventListener("click", toggleRecord);
snapBtn.addEventListener("click", savePng);
txtBtn.addEventListener("click", saveTxt);

// Any control change → redraw (covers static-image mode too).
["input", "change"].forEach((ev) =>
  document.addEventListener(ev, (e) => {
    if (e.target.closest(".controls")) dirty = true;
  })
);

window.addEventListener("beforeunload", () => {
  recorder.stop();
  releaseMedia();
});

// init
showMessage("Press “Camera” or upload an image / video.");
syncButtons();
