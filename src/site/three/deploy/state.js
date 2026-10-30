// Shared between the Projects section (DOM, scroll) and the deploy stage (three). Plain mutable
// object, so nothing re-renders while the stage runs. No three imports.
export const deploy = {
  arrive: 0,   // 0..1, the paper iris opens over Experience; at 1 the cards start to fall
  hold: 0,     // 0..1, scroll spent on the landed cards before the stage leaves
  out: 0,      // 0..1, the stage is leaving
  sel: -1,     // selected project, or -1
  hot: -1,     // project under the cursor
  active: false,
};

// Setters live here so components never mutate the shared object themselves.
export const setScroll = (arrive, hold, out) => { deploy.arrive = arrive; deploy.hold = hold; deploy.out = out; };
export const setSel = (i) => { deploy.sel = i; };
export const setHot = (i) => { deploy.hot = i; };
export const setActive = (a) => { deploy.active = a; };
export const reset = () => { deploy.arrive = 0; deploy.hold = 0; deploy.out = 0; deploy.sel = -1; deploy.hot = -1; deploy.active = false; };
