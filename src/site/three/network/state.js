// Shared between the Network section (DOM, scroll, pings) and the stage (three). Plain mutable object
// read in useFrame, so scrolling never re-renders anything. No three imports.
export const net = {
  arrive: 0,   // 0..1, the rack slats that open the stage over Resume
  hold: 0,     // 0..1, scroll through the pinned stage
  out: 0,      // 0..1, the next section burning in over it
  sel: -1,     // slot the camera is on; -1 = the whole mesh
  hover: -1,   // slot under the pointer
  active: false,
  ping: [],    // per slot: { status: "checking" | "up" | "down", ms }
};

export const setScroll = (arrive, hold, out) => { net.arrive = arrive; net.hold = hold; net.out = out; };
export const setSel = (s) => { net.sel = s; };
export const setHover = (h) => { net.hover = h; };
export const setActive = (a) => { net.active = a; };
export const setPings = (p) => { net.ping = p; };
export const reset = () => { net.arrive = 0; net.hold = 0; net.out = 0; net.sel = -1; net.hover = -1; net.active = false; net.ping = []; };

// The hosts the stage draws: the live subdomains first, then reserved slots so the mesh never looks bare.
export function buildSlots(subdomains = []) {
  const live = subdomains.map((d) => ({ kind: "live", host: d.host, title: d.title, desc: d.description, tags: d.tags || [], status: d.status || "live", shot: d.screenshot_url || "" }));
  const ghosts = Math.max(1, 3 - live.length);
  const slots = [...live];
  for (let i = 0; i < ghosts; i++) slots.push({ kind: "ghost", host: `slot ${live.length + i + 1}`, title: "Reserved", desc: "Room for the next thing I ship.", tags: [], status: "reserved", shot: "" });
  return slots;
}

// Where slot k sits around the core. Deterministic, so the camera and the DOM agree.
export function slotPos(k, m) {
  const a = 0.55 + (k / Math.max(1, m)) * Math.PI * 2;
  return [Math.cos(a) * 4.6, Math.sin(a * 2 + 0.4) * 1.5, Math.sin(a) * 3.2];
}
