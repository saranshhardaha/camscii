// Reads the UI controls into a shared, live-updating settings object.
export function initControls() {
  const els = {
    resolution: document.getElementById("resolution"),
    ramp: document.getElementById("ramp"),
    color: document.getElementById("color"),
    mirror: document.getElementById("mirror"),
    invert: document.getElementById("invert"),
  };

  const settings = {
    cols: Number(els.resolution.value),
    ramp: els.ramp.value,
    color: els.color.checked,
    mirror: els.mirror.checked,
    invert: els.invert.checked,
  };

  els.resolution.addEventListener("input", () => {
    settings.cols = Number(els.resolution.value);
  });
  els.ramp.addEventListener("change", () => {
    settings.ramp = els.ramp.value;
  });
  els.color.addEventListener("change", () => {
    settings.color = els.color.checked;
  });
  els.mirror.addEventListener("change", () => {
    settings.mirror = els.mirror.checked;
  });
  els.invert.addEventListener("change", () => {
    settings.invert = els.invert.checked;
  });

  return settings;
}
