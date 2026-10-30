// Procedural sound: no audio files. Everything is synthesised from filtered noise
// and a few oscillators, so it costs nothing to ship. Browsers keep the context
// locked until the first click / key / touch; until then every call is a no-op.
let ctx = null, master = null, noise = null, body = null, bodyGain = null;
let enabled = true;
let unlocked = false;
let acc = 0;

try { enabled = localStorage.getItem("dk_sound") !== "0"; } catch { /* storage blocked */ }

export const isOn = () => enabled;

export function setOn(v) {
  enabled = v;
  try { localStorage.setItem("dk_sound", v ? "1" : "0"); } catch { /* storage blocked */ }
  if (master && ctx) master.gain.setTargetAtTime(v ? 0.7 : 0, ctx.currentTime, 0.04);
  if (v) tick();
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.7 : 0;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);
  const len = ctx.sampleRate * 2;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

function unlock() {
  if (unlocked) return;
  if (!ctx && !build()) return;
  ctx.resume().then(() => { unlocked = ctx.state === "running"; }).catch(() => {});
}

if (typeof window !== "undefined") {
  ["pointerdown", "keydown", "touchend"].forEach((e) => window.addEventListener(e, unlock, { passive: true }));
}

const live = () => enabled && ctx && ctx.state === "running";

function burst({ dur = 0.05, freq = 3000, q = 1, gain = 0.2, type = "bandpass", rate = 1, at = 0 }) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = rate;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + Math.min(0.004, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 1.4);
  src.stop(t + dur + 0.03);
}

function tone({ from, to, dur = 0.2, gain = 0.2, type = "sine", at = 0 }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

export function tick() { if (live()) burst({ dur: 0.018, freq: 2600 + Math.random() * 900, q: 3, gain: 0.08 }); }

// Terminal "enter" thunk.
export function enter() { if (live()) { tone({ from: 140, to: 60, dur: 0.12, gain: 0.22 }); burst({ dur: 0.05, freq: 900, gain: 0.12 }); } }

// Paper flooding in over the terminal.
export function flood() {
  if (!live()) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass"; f.Q.value = 0.9;
  f.frequency.setValueAtTime(260, t);
  f.frequency.exponentialRampToValueAtTime(5200, t + 1.1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.2, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random()); src.stop(t + 1.3);
  tone({ from: 70, to: 38, dur: 0.9, gain: 0.18 });
}

// The portrait landing on the page.
export function pop() {
  if (!live()) return;
  tone({ from: 320, to: 90, dur: 0.16, gain: 0.22 });
  burst({ dur: 0.22, freq: 1400, q: 0.6, gain: 0.1 });
}

// Words swinging round the figure.
export function swoosh(at = 0) {
  if (!live()) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass"; f.Q.value = 1.4;
  f.frequency.setValueAtTime(500, t);
  f.frequency.exponentialRampToValueAtTime(2600, t + 0.4);
  f.frequency.exponentialRampToValueAtTime(700, t + 0.9);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.13, t + 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random()); src.stop(t + 1);
}

export function grab() { if (live()) { tone({ from: 700, to: 520, dur: 0.06, gain: 0.1, type: "triangle" }); burst({ dur: 0.02, freq: 4000, gain: 0.06 }); } }
// Two floating objects knock together; `strength` is the impact speed, 0..1.
export function clink(strength = 0.3) {
  if (!live()) return;
  const s = Math.min(1, strength);
  tone({ from: 1500 + Math.random() * 500, to: 900, dur: 0.07, gain: 0.025 + 0.05 * s, type: "triangle" });
  burst({ dur: 0.02, freq: 3800, q: 2, gain: 0.02 + 0.04 * s });
}
export function drop(speed = 0.3) { if (live()) { tone({ from: 240, to: 110, dur: 0.1, gain: 0.08 + 0.12 * Math.min(1, speed), type: "triangle" }); burst({ dur: 0.04, freq: 1800, gain: 0.05 + 0.08 * Math.min(1, speed) }); } }

// The first crack when the paper starts to give.
export function crack() {
  if (!live()) return;
  burst({ dur: 0.16, freq: 1800, q: 0.5, gain: 0.42, rate: 1.3 });
  burst({ dur: 0.09, freq: 5200, q: 0.8, gain: 0.3, at: 0.02 });
  tone({ from: 120, to: 48, dur: 0.18, gain: 0.2 });
}

// Continuous rip: called every frame with how fast the tear is moving (0..1).
// Short filtered grains at a random rate sound like paper fibres letting go.
export function rip(speed, dt) {
  if (!live()) return;
  if (!body) {
    body = ctx.createBufferSource();
    body.buffer = noise; body.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 520;
    bodyGain = ctx.createGain();
    bodyGain.gain.value = 0;
    body.connect(lp); lp.connect(bodyGain); bodyGain.connect(master);
    body.start();
  }
  bodyGain.gain.setTargetAtTime(Math.min(1, speed) * 0.1, ctx.currentTime, 0.05);
  acc += Math.min(1, speed) * dt * 110;
  let n = 0;
  while (acc >= 1 && n++ < 8) {
    acc -= 1;
    burst({
      dur: 0.012 + Math.random() * 0.05,
      freq: 900 + Math.random() * 4800,
      q: 0.6 + Math.random() * 1.6,
      gain: (0.05 + 0.15 * speed) * (0.35 + Math.random() * 0.65),
      rate: 0.6 + Math.random() * 1.5,
      at: Math.random() * 0.02,
    });
  }
  if (acc > 8) acc = 0;
}

export function ripEnd() { if (bodyGain && ctx) bodyGain.gain.setTargetAtTime(0, ctx.currentTime, 0.06); }
