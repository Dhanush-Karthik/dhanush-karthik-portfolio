// Small maths shared by the Contact stage files.
export const FONT = "/fonts/archivo-wide-black.ttf";
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const outCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const inCubic = (t) => { t = clamp(t); return t * t * t; };
export const inOutCubic = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const outBack = (t, s = 1.7) => { t = clamp(t) - 1; return 1 + t * t * ((s + 1) * t + s); };
export const nowS = () => performance.now() / 1000;
