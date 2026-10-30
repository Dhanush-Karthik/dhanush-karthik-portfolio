// Normalised pointer (-1..1) shared by every 3D scene for parallax.
// Mouse writes here by default; hand mode takes over while it is on.
export const pointer = { x: 0, y: 0, source: "mouse" };

if (typeof window !== "undefined") {
  window.addEventListener("pointermove", (e) => {
    if (pointer.source !== "mouse" || e.pointerType === "touch") return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });
}

export function setHandPointer(x, y) {
  pointer.source = "hand";
  pointer.x = x;
  pointer.y = y;
}

export function releaseHandPointer() {
  pointer.source = "mouse";
}
