// Gesture recognition on MediaPipe hand landmarks (21 points, normalised 0..1).
// Kept free of DOM code so it can be reasoned about (and tested) on its own.

// One Euro filter: smooths jitter at rest without adding lag during fast moves.
export class OneEuro {
  constructor({ minCutoff = 1.4, beta = 0.012, dCutoff = 1 } = {}) {
    Object.assign(this, { minCutoff, beta, dCutoff, x: null, dx: 0, t: null });
  }
  static alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(v, t) {
    if (this.x == null) { this.x = v; this.t = t; return v; }
    const dt = Math.max(1e-3, (t - this.t) / 1000);
    this.t = t;
    const dv = (v - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (dv - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (v - this.x);
    return this.x;
  }
  reset() { this.x = null; this.dx = 0; }
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Finger is extended when its tip is clearly farther from the wrist than its PIP joint.
function extended(lm, tip, pip) {
  return dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.12;
}

export function describeHand(lm) {
  const size = dist(lm[0], lm[9]) || 1e-3; // wrist → middle knuckle, the hand's scale
  const pinchRatio = dist(lm[4], lm[8]) / size;
  const fingers = [extended(lm, 8, 6), extended(lm, 12, 10), extended(lm, 16, 14), extended(lm, 20, 18)];
  const up = fingers.filter(Boolean).length;
  const palm = { x: (lm[0].x + lm[5].x + lm[17].x) / 3, y: (lm[0].y + lm[5].y + lm[17].y) / 3 };
  let pose = "other";
  if (up === 0 && pinchRatio > 0.35) pose = "fist";
  else if (up >= 4) pose = "palm";
  else if (fingers[0] && up <= 2) pose = "point";
  return { pinchRatio, pose, palm, tip: lm[8], size };
}

// Pinch with hysteresis so a single pinch never registers twice.
export class PinchState {
  constructor(on = 0.33, off = 0.5) { this.on = on; this.off = off; this.active = false; }
  update(ratio) {
    if (!this.active && ratio < this.on) { this.active = true; return "start"; }
    if (this.active && ratio > this.off) { this.active = false; return "end"; }
    return null;
  }
}

// Detects a quick horizontal palm movement. Returns "left" | "right" | null.
export class SwipeDetector {
  constructor() { this.hist = []; this.cool = 0; }
  update(x, t, isPalm) {
    if (!isPalm) { this.hist = []; return null; }
    this.hist.push({ x, t });
    while (this.hist.length && t - this.hist[0].t > 260) this.hist.shift();
    if (t < this.cool || this.hist.length < 4) return null;
    const dx = this.hist[this.hist.length - 1].x - this.hist[0].x;
    if (Math.abs(dx) > 0.2) {
      this.cool = t + 750;
      this.hist = [];
      return dx < 0 ? "left" : "right";
    }
    return null;
  }
}
