// One shared requestAnimationFrame loop for scroll-driven effects, so every
// frame reads layout once per subscriber instead of each effect owning a loop.
const subs = new Set();
let raf = 0;

function loop(t) {
  subs.forEach((fn) => fn(t));
  raf = subs.size ? requestAnimationFrame(loop) : 0;
}

export function onTick(fn) {
  subs.add(fn);
  if (!raf && typeof window !== "undefined") raf = requestAnimationFrame(loop);
  return () => subs.delete(fn);
}
