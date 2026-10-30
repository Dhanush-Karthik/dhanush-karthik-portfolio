// Decides the default browsing mode. "stack" = full WebGL experience, "print" = flat 2D.
export function detectMode() {
  try {
    const saved = localStorage.getItem("dk_mode");
    if (saved === "stack" || saved === "print") return saved;
  } catch { /* storage blocked */ }
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "print";
  if (navigator.connection?.saveData) return "print";
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return "print";
  try {
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) return "print";
  } catch { return "print"; }
  return "stack";
}

export function saveMode(mode) {
  try { localStorage.setItem("dk_mode", mode); } catch { /* storage blocked */ }
}
