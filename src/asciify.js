// Core: turn a canvas frame into ASCII.
// Chars are ~2x taller than wide, so we sample fewer rows than columns
// to keep the picture's aspect ratio roughly correct.
const CHAR_ASPECT = 0.5;

// Escape the few chars that would break the HTML string in color mode.
const HTML_ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const escapeHtml = (c) => HTML_ESCAPE[c] || c;

// Given a frame's intrinsic size and a target column count, work out the
// sampling grid (cols x rows) that preserves aspect ratio for char cells.
export function gridFor(frameWidth, frameHeight, cols) {
  const rows = Math.max(1, Math.round((cols * frameHeight) / frameWidth * CHAR_ASPECT));
  return { cols, rows };
}

// Build a plain-text ASCII frame from RGBA pixel data.
// `data` is the Uint8ClampedArray from ctx.getImageData(...).data, sized cols*rows.
export function asciiText(data, cols, rows, ramp, invert) {
  const last = ramp.length - 1;
  let out = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      // Rec. 601 luma
      let lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
      if (invert) lum = 1 - lum;
      out += ramp[Math.round(lum * last)];
    }
    out += "\n";
  }
  return out;
}

// Build a colored ASCII frame as an HTML string. Each character is wrapped
// in a <span> tinted with its source pixel color. Heavier — keep cols lower.
export function asciiHtml(data, cols, rows, ramp, invert) {
  const last = ramp.length - 1;
  let out = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      let lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      if (invert) lum = 1 - lum;
      const ch = escapeHtml(ramp[Math.round(lum * last)]);
      out += `<span style="color:rgb(${r},${g},${b})">${ch}</span>`;
    }
    out += "\n";
  }
  return out;
}
