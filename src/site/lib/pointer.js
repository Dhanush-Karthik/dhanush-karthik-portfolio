// Normalised pointer (-1..1) shared by every 3D scene for parallax.
// Mouse writes here by default; hand mode takes over while it is on.
export const pointer = { x: 0, y: 0, source: "mouse" };

// Two-hand gestures as plain numbers the 3D scenes can read in useFrame. Written by hand mode only.
//   zoom   -1..1  hands pulled apart (+) or pushed together (-); eases back to 0 on its own
//   twist  radians the line between the hands has turned; also eases back
export const gesture = { zoom: 0, twist: 0, two: false };

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
  gesture.zoom = 0; gesture.twist = 0; gesture.two = false;
}
