// Thin MediaRecorder wrapper around a canvas captureStream → .webm blob.
const MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function recordingSupported() {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

export function createRecorder(canvas, onComplete) {
  let rec = null;
  let chunks = [];

  function start(fps = 30) {
    const stream = canvas.captureStream(fps);
    const mime = pickMime();
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime || "video/webm" });
      onComplete(blob);
    };
    rec.start();
  }

  function stop() {
    if (rec && rec.state !== "inactive") rec.stop();
  }

  function isActive() {
    return !!rec && rec.state === "recording";
  }

  return { start, stop, isActive };
}
