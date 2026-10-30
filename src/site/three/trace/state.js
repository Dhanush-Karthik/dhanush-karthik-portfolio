// Shared between the Experience section (DOM, scroll) and the graph stage (three). Plain mutable
// object, so nothing re-renders while the stage runs. No three imports: the section reads it too.
export const trace = {
  f: 0,          // 0..n-1, the commit the camera is on (fractional while it travels)
  arrive: 0,     // 0..1, the graph is uncovered from under Skills and builds itself
  out: 0,        // 0..1, the section is leaving
  hot: -1,       // commit under the cursor
  tech: null,    // a skill the graph is filtered to, or null
  filter: "all", // all | work | edu
  active: false, // the stage is on screen and should render
};

// Setters live here so components never mutate the shared object themselves.
export const setScroll = (f, arrive, out) => { trace.f = f; trace.arrive = arrive; trace.out = out; };
export const setHot = (i) => { trace.hot = i; };
export const setTech = (t) => { trace.tech = t; };
export const setFilter = (f) => { trace.filter = f; };
export const reset = () => { trace.f = 0; trace.arrive = 0; trace.out = 0; trace.hot = -1; trace.tech = null; trace.filter = "all"; trace.active = false; };
