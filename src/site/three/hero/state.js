// Mutable state shared by the hero stage pieces. Written by React/scroll code,
// read inside useFrame, so nothing here re-renders.
export const stage = {
  p: 0,        // scroll progress through the pinned hero, 0..1
  tear: 0,     // 0..1 progress of the rip
  t: 0,        // seconds since the intro iris started
  drag: false, // a floating object is being dragged
  seam: 0.46,  // y (0..1, up) where the page rips, between the two name lines
};

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const outCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const outBack = (t, s = 1.6) => { t = clamp(t) - 1; return 1 + t * t * ((s + 1) * t + s); };
export const inOutCubic = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const lerp = (a, b, t) => a + (b - a) * t;

// Site palette (CMS overrides land in CSS custom properties on .dk), read once.
export function readPalette() {
  const root = typeof document !== "undefined" ? document.querySelector(".dk") : null;
  const cs = root ? getComputedStyle(root) : null;
  const get = (name, fb) => (cs?.getPropertyValue(name).trim() || fb);
  return {
    paper: get("--paper", "#E8E6E1"),
    paper2: get("--paper-2", "#D9D7D1"),
    ink: get("--ink", "#111311"),
    term: get("--term", "#07110A"),
    termLine: get("--term-line", "#1E3A26"),
    phosphor: get("--phosphor", "#4ADE80"),
    signal: get("--signal", "#E5432D"),
    tape: get("--tape", "#F2C94C"),
  };
}

// Responsive placement shared by every piece of the stage. World units: the
// plane z=0 is `viewport.width × viewport.height`.
export function heroLayout(viewport, size) {
  const W = viewport.width, H = viewport.height;
  const aspect = size.width / size.height;
  const mobile = aspect < 0.85;
  const px = H / size.height;                       // world units per css pixel
  const topPad = (mobile ? 96 : 104) * px;          // hud + meta row
  const imgAspect = 616 / 1556;
  let fh = H - topPad + 0.03 * H;                   // bleeds a little past the bottom, the ribbon hides the crop
  fh = Math.min(fh, (mobile ? 0.86 : 0.5) * W / imgAspect);
  const top = H / 2 - topPad;
  const faceBottom = top - 0.25 * fh;               // nothing in front of the face above this line
  return {
    W, H, px, mobile, topPad, fh, top,
    figW: fh * imgAspect,
    figY: top - fh / 2,
    faceBottom,
    ribbonY: -H / 2 + 34 * px,
    ribbonH: (mobile ? 46 : 60) * px,
    fs: mobile ? 0.52 : Math.min(1.15, Math.max(0.7, H / 5.2)),
  };
}
