// Tiny store that sequences the intro: boot log → stage ready → paper floods in.
// The hero stage reads `t0` every frame; React bits (boot overlay, hero DOM) subscribe.
const subs = new Set();

export const intro = {
  stageReady: false,   // the hero canvas has drawn its first (dark) frame
  bootActive: false,   // boot log overlay is still on screen
  t0: 0,               // performance.now() when the iris starts
  played: false,       // the intro already ran in this page load, later mounts skip it
  overlayIn: false,    // hero DOM text may fade in
  grabbed: false,      // visitor has moved a floating object
};

export function setIntro(patch) {
  Object.assign(intro, patch);
  if (!intro.t0 && intro.stageReady && !intro.bootActive) {
    intro.t0 = performance.now();
    document.documentElement.classList.remove("boot-pending");
  }
  subs.forEach((fn) => fn());
}

export function subscribeIntro(fn) { subs.add(fn); return () => subs.delete(fn); }

// Seconds since the iris started; huge once the intro has been played (so SPA returns skip it).
export function introTime() {
  if (intro.played) return 99;
  return intro.t0 ? (performance.now() - intro.t0) / 1000 : 0;
}
