// Shared between the Skills section (DOM, scroll) and the rack stage (three). Plain mutable
// object, so nothing re-renders while the stage runs. No three imports: the section reads it too.
export const rack = {
  sel: 0,        // 0..n-1, which tray is pulled out (fractional while it swaps)
  hot: -1,       // tray under the cursor / hovered in the list
  spread: 0,     // 0..1, two-hand spread in hand mode: every tray slides out
  seen: false,   // the rack has scrolled into view: start the boot sequence
  boot: -1,      // seconds since the boot sequence began, -1 before
  active: false, // the stage is on screen and should render
};

export const setHot = (i) => { rack.hot = i; };
