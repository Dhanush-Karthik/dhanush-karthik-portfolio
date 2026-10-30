// Shared between the Contact section (DOM, scroll, form) and the stage (three). Plain mutable object read in
// useFrame, so scrolling and typing never re-render the scene. No three imports.
export const ct = {
  arrive: 0,    // 0..1, the paper burning in over the Network stage
  hold: 0,      // 0..1, scroll through the pinned stage
  meet: 0,      // 0..1, how close the two halves of the fresco are (scroll-scrubbed)
  cardT: 0,     // 0..1, the certificate condensing out of the spark and assembling (time-driven)
  cert: null,   // the issued certificate (see cert.js), set just before send()
  sentAt: -1,   // performance.now() when the message was sent; -1 = not sent
  touchAt: -1,  // seconds (performance.now()/1000) when the fingers met; -1 = not touching
  active: false,
  dom: { root: null, cam: null, card: null, face: null },
  tip: [{ x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } }, { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } }], // fingertips, stage px
  fire: null,   // set by the stage: fire(x, y, power, flash) throws confetti
  flown: false, // the certificate is on its way out
  P: 1000,      // camera distance in px
};

export const setScroll = (arrive, hold, meet) => { ct.arrive = arrive; ct.hold = hold; ct.meet = meet; };
export const setActive = (a) => { ct.active = a; };
export const send = () => { ct.sentAt = performance.now(); };
export const unsend = () => { ct.sentAt = -1; ct.cert = null; ct.cardT = 0.02; }; // reopen: a new certificate condenses out of the spark
export const reset = () => { ct.arrive = 0; ct.hold = 0; ct.meet = 0; ct.cardT = 0; ct.sentAt = -1; ct.cert = null; ct.touchAt = -1; ct.active = false; };

// Michelangelo, The Creation of Adam (Sistine Chapel, public domain), 3524 x 1599. The fingertips almost
// meet near TOUCH; the fresco is torn along a seam that runs between them.
export const FR = { w: 3524, h: 1599, touch: [1335, 728], tipA: [1330, 735], tipG: [1340, 722], src: "/hands/creation.webp" };

// Screen layout in CSS px, y up, origin at the middle of the stage. Wide screens show the whole fresco with
// the touch left of centre (as in the painting); tall screens crop in on the hands.
export function layoutFor(w, h) {
  const portrait = w / h < 0.85;
  const wide = !portrait && w >= 820 && w / h >= 1.05; // landscape certificate with two columns
  const s = portrait ? (h * 0.5) / FR.h : Math.min((w * 0.98) / FR.w, (h * 0.8) / FR.h); // css px per fresco px
  const fx = portrait ? -(FR.touch[0] - FR.w / 2) * s : 0;      // fresco centre
  const fy = portrait ? h * 0.04 : h * 0.02;
  return {
    portrait, s, fx, fy,
    cp: { x: fx + (FR.touch[0] - FR.w / 2) * s, y: fy - (FR.touch[1] - FR.h / 2) * s },
    top: fy + (FR.h * s) / 2,
    rest: { x: 0, y: -h * 0.004 },
    wide,
    cw: wide ? Math.round(Math.min(760, w - 40)) : Math.round(Math.min(500, w - 24)),
    ch: wide ? Math.round(Math.max(456, Math.min(500, h * 0.7))) : Math.round(Math.min(portrait ? 600 : 640, h * (portrait ? 0.66 : 0.72))),
  };
}
