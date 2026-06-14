# Camscii

> Webcam, image &amp; video → **live ASCII art**, right in your browser. Tune it, record it, export it.

Camscii converts your **webcam**, **images**, and **videos** into ASCII art in real time — entirely client-side. Adjust detail, character ramps, color, mirror and invert, then **record to WebM** or **export PNG / TXT**. Nothing is ever uploaded; every frame stays on your device.

**Built by [saranshh.dev](https://saranshh.dev)**

---

## Features

- 🎥 **Live camera → ASCII** at 30–60 fps via `requestAnimationFrame`
- 🖼️ **Image upload** — drop in a photo, get ASCII
- 🎬 **Video upload** — plays through the same pipeline, looped
- 🌈 **Color mode** — each glyph tinted with its source pixel color
- 🎚️ **Controls** — detail (resolution), character ramp, color, mirror, invert
- 🔤 **Ramps** — classic, dense, blocks, shaded (Unicode)
- ⏺️ **Record** the live feed or a video to `.webm` (`MediaRecorder` + canvas `captureStream`)
- 💾 **Export** the current frame as **PNG** or raw **TXT**
- 📱 **Responsive** — works on laptop and mobile, touch-friendly controls
- 🔒 **Private** — 100% in-browser, no backend, no uploads

## Quick start

```bash
npm install
npm run dev
```

Open the printed `http://localhost:5173`, press **Camera** (and allow access) or **Upload** an image/video.

> Camera access requires a secure context — `localhost` or `https`. Opening `index.html` from `file://` will not work.

### Build

```bash
npm run build     # outputs to dist/
npm run preview   # serve the production build
```

## How it works

```
camera / <img> / <video>
        │  draw each frame
        ▼
offscreen <canvas> downscaled to N columns   ← "Detail" slider
        │  getImageData → RGBA pixels
        ▼
luminance per pixel → mapped to a character ramp
        │
        ▼
glyphs drawn onto the output <canvas>          ← recordable & exportable
        │
        ├── captureStream() → MediaRecorder → .webm
        └── toBlob() → .png
```

Rendering to a `<canvas>` (instead of DOM text) is what makes recording and PNG export possible.

## Project structure

```
camscii/
├── index.html          # markup + SEO meta + structured data
├── style.css           # UI, theme tokens, responsive layout
├── src/
│   ├── main.js         # sources (camera/image/video), render loop, exports
│   ├── asciify.js      # pixel → character mapping, .txt builder
│   ├── render.js       # draws ASCII onto the output canvas
│   ├── controls.js     # live-updating settings from the UI
│   └── recorder.js     # MediaRecorder wrapper → .webm
└── public/             # favicon, og image, manifest, robots, sitemap
```

## Browser support

Needs `getUserMedia` (camera), `canvas.captureStream` and `MediaRecorder` (recording). Works in current Chrome, Edge, Firefox, and Safari. Recording exports WebM (VP9/VP8).

## Tech

Vanilla JS + [Vite](https://vitejs.dev/). No framework, no backend.

## License

[MIT](LICENSE) © [saranshh.dev](https://saranshh.dev)
