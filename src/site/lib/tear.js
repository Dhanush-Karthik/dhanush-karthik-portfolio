// Deterministic torn-paper edge for section sheets. Seeded by a string so the server
// render and the client hydrate produce the same clip-path.
function rng(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

// Top edge: jagged line within `depth` px from the top, the rest of the box kept.
export function tornTop(seed, depth = 26, steps = 64) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * 100;
    const y = r() * depth * 0.75 + (i % 2 ? depth * 0.25 : 0);
    pts.push(`${x.toFixed(2)}% ${y.toFixed(1)}px`);
  }
  return `polygon(${pts.join(",")},100% 100%,0% 100%)`;
}
