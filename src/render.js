// Canvas renderer: draws an ASCII frame onto a 2D canvas so it can be
// recorded (captureStream) and exported (toBlob). Mono mode draws a whole
// row per fillText (fast); color mode draws each glyph in its pixel color.
const FONT_STACK = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const BG = "#0a0a0a";

// Measure the monospace advance width for a given font size, cached.
const widthCache = new Map();
export function cellMetrics(ctx, fontPx) {
  if (widthCache.has(fontPx)) return widthCache.get(fontPx);
  ctx.font = `${fontPx}px ${FONT_STACK}`;
  const w = ctx.measureText("M").width;
  const m = { w, h: Math.round(fontPx * 1.15), fontPx };
  widthCache.set(fontPx, m);
  return m;
}

// Draw RGBA sample data (cols*rows) as ASCII onto ctx.
export function drawAscii(ctx, data, cols, rows, opts) {
  const { ramp, invert, color, fontPx, fgColor } = opts;
  const { w: cw, h: ch } = cellMetrics(ctx, fontPx);
  const last = ramp.length - 1;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, cols * cw, rows * ch);
  ctx.font = `${fontPx}px ${FONT_STACK}`;
  ctx.textBaseline = "top";
  if (!color) ctx.fillStyle = fgColor;

  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      let lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
      if (invert) lum = 1 - lum;
      const ch_ = ramp[Math.round(lum * last)];
      if (color) {
        ctx.fillStyle = `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`;
        ctx.fillText(ch_, x * cw, y * ch);
      } else {
        line += ch_;
      }
    }
    if (!color) ctx.fillText(line, 0, y * ch);
  }
}
