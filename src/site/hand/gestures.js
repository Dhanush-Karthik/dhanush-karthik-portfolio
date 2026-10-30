// Gesture recognition on MediaPipe hand landmarks (21 points, normalised 0..1).
// Kept free of DOM code so it can be reasoned about (and tested) on its own.

// One Euro filter: smooths jitter at rest without adding lag during fast moves.
export class OneEuro {
  constructor({ minCutoff = 0.9, beta = 0.03, dCutoff = 1 } = {}) {
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
  get speed() { return Math.abs(this.dx); }
  reset() { this.x = null; this.dx = 0; }
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Ratio of a fingertip's reach to its middle joint's reach, measured from the wrist.
function reach(lm, tip, pip) { return dist(lm[tip], lm[0]) / (dist(lm[pip], lm[0]) || 1e-3); }

export function describeHand(lm) {
  const size = dist(lm[0], lm[9]) || 1e-3; // wrist → middle knuckle, the hand's scale
  const pinchRatio = dist(lm[4], lm[8]) / size;
  const r = [reach(lm, 8, 6), reach(lm, 12, 10), reach(lm, 16, 14), reach(lm, 20, 18)];
  const ext = r.map((v) => v > 1.12);    // clearly out
  const curled = r.map((v) => v < 1.04); // clearly in
  const up = ext.filter(Boolean).length;
  const palm = { x: (lm[0].x + lm[5].x + lm[17].x) / 3, y: (lm[0].y + lm[5].y + lm[17].y) / 3 };
  const mid = { x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 };
  let pose = "other";
  if (up === 0 && pinchRatio > 0.35) pose = "fist";
  else if (up >= 4) pose = "palm";
  else if (ext[0] && ext[1] && curled[2] && curled[3]) pose = "peace";
  else if (ext[0] && curled[1] && curled[2] && curled[3]) pose = "point";
  return { pinchRatio, pose, palm, mid, tip: lm[8], size };
}

// A pose only counts once it has held for a few frames, so a hand passing through "point" on its
// way to "palm" never fires the point gesture. Poses nobody recognises keep the previous one.
export class PoseFilter {
  constructor(frames = 3) { this.frames = frames; this.cur = "other"; this.cand = "other"; this.n = 0; }
  update(pose) {
    if (pose === this.cur) { this.cand = pose; this.n = 0; return this.cur; }
    if (pose === this.cand) { if (++this.n >= this.frames) { this.cur = pose; this.n = 0; } } else { this.cand = pose; this.n = 1; }
    return this.cur;
  }
}

// Pinch with hysteresis so a single pinch never registers twice. The ratio is smoothed a little
// so one bad landmark frame cannot release a grab.
export class PinchState {
  constructor(on = 0.32, off = 0.5) { this.on = on; this.off = off; this.active = false; this.ratio = null; }
  update(raw) {
    this.ratio = this.ratio == null ? raw : this.ratio + (raw - this.ratio) * 0.65;
    const r = this.ratio;
    if (!this.active && r < this.on) { this.active = true; return "start"; }
    if (this.active && r > this.off) { this.active = false; return "end"; }
    return null;
  }
  reset() { this.active = false; this.ratio = null; }
}

// Recent cursor positions with the pinch ratio at each. A pinch drags the index fingertip toward
// the thumb, so the position where the visitor *aimed* is the one from just before it closed.
export class Trail {
  constructor(ms = 360) { this.ms = ms; this.buf = []; }
  push(x, y, ratio, t) {
    this.buf.push({ x, y, ratio, t });
    while (this.buf.length && t - this.buf[0].t > this.ms) this.buf.shift();
  }
  // Newest sample taken while the fingers were still clearly apart.
  aim(open = 0.8) {
    for (let i = this.buf.length - 1; i >= 0; i--) if (this.buf[i].ratio >= open) return this.buf[i];
    return this.buf[0] || null;
  }
  clear() { this.buf = []; }
}

// Everything tracked per physical hand (MediaPipe labels them left/right, which stays put
// when two hands cross the frame, unlike their order in the result).
export class HandTrack {
  constructor() {
    this.fx = new OneEuro(); this.fy = new OneEuro();       // fingertip, screen px
    this.mx = new OneEuro(); this.my = new OneEuro();       // pinch point, screen px
    this.pinch = new PinchState();
    this.pose = new PoseFilter();
    this.trail = new Trail();
    this.swipe = new SwipeDetector();
    this.fistAt = 0;
    this.peaceY = null;
    this.alive = false;
  }
  lose() {
    [this.fx, this.fy, this.mx, this.my].forEach((f) => f.reset());
    this.pinch.reset(); this.trail.clear();
    this.pose = new PoseFilter();
    this.fistAt = 0; this.peaceY = null; this.alive = false;
  }
}

// Two hands as one control: how far apart they are and which way the line between them points.
// Positions are in camera-frame units (width = 1), already mirrored to match the screen.
export class TwoHand {
  constructor() { this.kind = null; this.dist = 0; this.ang = 0; }
  // `kind` ("grab" | "open") restarts the measurement when the pose changes, so closing the
  // hands into a pinch does not read as a pull.
  update(a, b, kind) {
    const l = a.x <= b.x ? a : b, r = a.x <= b.x ? b : a;
    const dx = r.x - l.x, dy = (r.y - l.y) * 0.75;
    const dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    const first = this.kind !== kind;
    let dDist = 0, dAng = 0;
    if (!first) {
      dDist = dist - this.dist;
      dAng = ang - this.ang;
      if (dAng > Math.PI) dAng -= 2 * Math.PI; else if (dAng < -Math.PI) dAng += 2 * Math.PI;
    }
    this.kind = kind; this.dist = dist; this.ang = ang;
    return { dist, ang, dDist, dAng, first, cx: (l.x + r.x) / 2, cy: (l.y + r.y) / 2 };
  }
  end() { this.kind = null; }
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
