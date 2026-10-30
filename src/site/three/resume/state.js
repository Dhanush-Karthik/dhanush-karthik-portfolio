// Shared between the Resume section (DOM, scroll, location) and the stage (three). Plain mutable
// object read in useFrame, so nothing re-renders while the journey runs. No three imports.
export const jny = {
  arrive: 0,      // 0..1, the hex dissolve that opens the stage over Projects
  t: -1,          // seconds since the click; -1 = waiting at the server
  run: false,     // the journey is playing
  done: false,    // it finished (or was skipped); the printout stays on
  geo: false,     // the visitor's location is known
  pressed: 0,     // the button is held down (0..1, eased by the stage)
  hover: false,
  active: false,
  dl: 0,          // download progress 0..1 (set by the stage, read by the DOM)
  paused: false,  // test hook: freeze the clock
  speed: 1,       // clock rate; the skip button runs it fast until the print starts
  skipTo: 0,
};

export const setArrive = (a) => { jny.arrive = a; };
export const setActive = (a) => { jny.active = a; };
export const setGeo = (g) => { jny.geo = g; };
export const setHover = (h) => { jny.hover = h; };
export const start = () => { jny.t = 0; jny.run = true; jny.done = false; jny.dl = 0; jny.speed = 1; };
export const finish = () => { jny.run = false; jny.done = true; jny.speed = 1; };
export const skip = (to) => { if (jny.run && jny.t < to) { jny.speed = 5; jny.skipTo = to; } };
// One step of the clock. Holds at `hold` until the location is known; returns true on the step that reaches `end`.
export function advance(dt, hold, end) {
  if (!jny.run || jny.paused) return false;
  let t = jny.t + dt * jny.speed;
  if (!jny.geo && t > hold) t = hold;
  if (jny.speed > 1 && t >= jny.skipTo) { jny.speed = 1; }
  jny.t = Math.min(t, end);
  return jny.t >= end;
}
export const rewind = () => { jny.t = -1; jny.run = false; jny.done = false; jny.geo = false; jny.dl = 0; jny.speed = 1; };
export const seek = (t) => { jny.t = t; };
export const setDl = (d) => { jny.dl = d; };
export const reset = () => { rewind(); jny.arrive = 0; jny.active = false; jny.hover = false; jny.paused = false; };
