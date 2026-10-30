import * as THREE from "three";
import { toVec, toLatLon, frameAt, walk, gcAngle, buildMask } from "./geo";
import { seaRoute } from "./sea";

// ---------------------------------------------------------------------------------------------
// The route a download takes, as data: where each stop is on the globe, the curve between stops,
// when the packet is on each leg, and where the camera should be at every moment.
// ---------------------------------------------------------------------------------------------

export const SITE_S = 0.0035; // world units per local unit; a site is a few local units wide
export const R_EARTH_KM = 6371;

// Where the file "lives". Chosen per visitor, so the trip is always a long one.
export const ORIGINS = [
  { lat: 39.04, lon: -77.49, city: "N. Virginia", region: "us-east-1" },
  { lat: 45.6, lon: -121.2, city: "Oregon", region: "us-west-2" },
];
export function pickOrigin(dest) {
  const u = toVec(dest.lat, dest.lon);
  const [a, b] = ORIGINS.map((o) => gcAngle(toVec(o.lat, o.lon), u));
  return b > a ? ORIGINS[1] : ORIGINS[0];
}

// Seconds since the click.
export const T = {
  globe: [1.3, 2.0],
  in: [2.0, 3.4],
  AB: [3.4, 4.7],
  BC: [4.7, 5.8],
  sea: [6.2, 10.8],
  DE: [11.6, 12.7],
  EH: [12.7, 13.7],
  toPC: [13.7, 14.5],
  toPr: [14.5, 15.3],
  print: [15.3, 20.3],
  end: 20.3,
};
export const HOLD = T.globe[1]; // wait here (globe view) until the visitor's location is known

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rot = (v, axis, a) => v.clone().applyAxisAngle(axis, a);

function tangentTo(from, to) {
  const t = to.clone().sub(from.clone().multiplyScalar(from.dot(to)));
  if (t.lengthSq() < 1e-10) { const f = frameAt(from); return f.east.clone(); }
  return t.normalize();
}

function makeSite(id, kind, n, label, sub) {
  const f = frameAt(n);
  const pos = n.clone().normalize();
  const site = { id, kind, n: pos, label, sub, east: f.east, up: f.up, north: f.north, pos };
  // local (x east, y up, z south) -> world
  site.at = (x, y, z, out = new THREE.Vector3()) =>
    out.copy(pos).addScaledVector(f.east, x * SITE_S).addScaledVector(f.up, y * SITE_S + 0.0006).addScaledVector(f.north, -z * SITE_S);
  site.basis = new THREE.Matrix4().makeBasis(f.east, f.up, f.north.clone().negate());
  return site;
}

// Local anchors the packet visits at each kind of site.
const PORT = { server: [0, 3.6, 0.2], isp: [0, 7.4, 0], dc: [0, 3.2, 0], room: [0, 9, 0] };
export const ROOM = { pc: [-2.2, 1.4, -2.1], printer: [2.5, 2.1, -2.05] };

const D2R = Math.PI / 180;
const wrapLon = (l) => ((l + 540) % 360) - 180;

// a site (and the ring around it) must sit on land, or its pad would hang over the sea
function landOK(mask, lat, lon, rad) {
  lon = wrapLon(lon);
  if (!mask.land(lat, lon)) return false;
  if (!rad) return true;
  const dl = rad / D2R, dn = dl / Math.max(0.2, Math.cos(lat * D2R));
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    if (!mask.land(lat + Math.sin(a) * dl, wrapLon(lon + Math.cos(a) * dn))) return false;
  }
  return true;
}
// nearest spot that passes, searching outward in rings of a quarter degree
function snapLand(mask, lat, lon, rad) {
  for (let r = 0; r <= 8; r += 0.25) {
    const steps = r === 0 ? 1 : Math.round(r * 8) + 6;
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const la = lat + Math.sin(a) * r;
      if (la > 84 || la < -84) continue;
      const lo = wrapLon(lon + (Math.cos(a) * r) / Math.max(0.2, Math.cos(lat * D2R)));
      if (landOK(mask, la, lo, rad)) return { lat: la, lon: lo };
    }
  }
  return { lat, lon };
}

// two short hops away from a site, bent a little; swing the whole thing around until both land on land
const SWING = [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.1, -2.1, 2.7, -2.7, Math.PI];
function hops(mask, from, dir, bends, dists, rad) {
  const up = frameAt(from).up;
  let first = null;
  for (const sw of SWING) {
    const p = walk(from, rot(dir, up, bends[0] + sw), dists[0]);
    const q = walk(p, rot(dir, up, bends[1] + sw), dists[1]);
    first = first || [p, q];
    const a = toLatLon(p), b = toLatLon(q);
    if (landOK(mask, a.lat, a.lon, 0.013) && landOK(mask, b.lat, b.lon, 0.013)) return [p, q];
  }
  return first;
}

export function buildRoute(dest, host, mask) {
  const origin = pickOrigin(dest);
  const oc = snapLand(mask, origin.lat, origin.lon, 0.018);
  const uc = snapLand(mask, dest.lat, dest.lon, 0.013);
  const O = toVec(oc.lat, oc.lon);
  const U = toVec(uc.lat, uc.lon);
  const ang = gcAngle(O, U);
  const toU = tangentTo(O, U);   // heading at the origin
  const back = tangentTo(U, O);  // from the visitor, towards home

  const A = O.clone();
  const [B, C] = hops(mask, O, toU, [0.42, -0.3], [0.036, 0.036], 0.013);
  const [E, D] = hops(mask, U, back, [-0.4, 0.3], [0.032, 0.036], 0.013);
  const H = U.clone();

  const sites = [
    makeSite("A", "server", A, "ORIGIN SERVER", `${host} · ${origin.region}`),
    makeSite("B", "isp", B, "ISP EDGE", "first hop out of the building"),
    makeSite("C", "dc", C, `DATA CENTER · ${origin.city}`, "internet exchange"),
    makeSite("D", "dc", D, `DATA CENTER · ${dest.city}`, "regional edge"),
    makeSite("E", "isp", E, dest.isp ? `YOUR ISP · ${dest.isp}` : "YOUR ISP", "last mile"),
    makeSite("H", "room", H, `YOU · ${dest.city}${dest.country ? `, ${dest.country}` : ""}`, "computer + printer"),
  ];
  const [sA, sB, sC, sD, sE, sH] = sites;
  const port = (s, k = s.kind) => s.at(...PORT[k]);

  // short hops lift off in an arch; the long one follows the sea lanes
  const arch = (a, b, lift) => {
    const m = a.clone().add(b).multiplyScalar(0.5);
    const up = m.clone().normalize();
    return new THREE.CatmullRomCurve3([
      a.clone(), a.clone().addScaledVector(a.clone().normalize(), lift * 0.5 * SITE_S),
      m.addScaledVector(up, lift * SITE_S),
      b.clone().addScaledVector(b.clone().normalize(), lift * 0.5 * SITE_S), b.clone(),
    ], false, "centripetal");
  };
  const pAs = port(sA), pBs = port(sB), pCs = port(sC), pDs = port(sD), pEs = port(sE);
  const pc = sH.at(...ROOM.pc), pr = sH.at(...ROOM.printer);
  const pH = sH.at(...PORT.room);

  const lane = seaRoute(mask, pCs.clone().normalize(), pDs.clone().normalize(), R_EARTH_KM);
  const spine = new THREE.CatmullRomCurve3(lane.pts, false, "centripetal");
  const seaPts = [];
  const NS = 260, span = Math.min(1.2, lane.km / R_EARTH_KM);
  const spaced = spine.getSpacedPoints(NS);
  for (let i = 0; i <= NS; i++) {
    const s = i / NS;
    const r = THREE.MathUtils.lerp(pCs.length(), pDs.length(), s) + 0.004 + 0.03 * Math.sin(Math.PI * s) * span;
    seaPts.push(spaced[i].normalize().multiplyScalar(r));
  }
  const seaCurve = new THREE.CatmullRomCurve3(seaPts, false, "centripetal");
  // is the long leg mostly water?
  let wet = 0;
  for (let i = 0; i < 48; i++) { const { lat, lon } = toLatLon(seaCurve.getPointAt(i / 47)); if (!mask.land(lat, lon)) wet++; }
  const cable = wet / 48 > 0.4 ? "SUBMARINE CABLE" : "LONG-HAUL FIBER";

  const legs = [
    { id: "AB", win: T.AB, curve: arch(pAs, pBs, 2.6) },
    { id: "BC", win: T.BC, curve: arch(pBs, pCs, 2.6) },
    { id: "sea", win: T.sea, curve: seaCurve, long: true },
    { id: "DE", win: T.DE, curve: arch(pDs, pEs, 2.6) },
    { id: "EH", win: T.EH, curve: new THREE.CatmullRomCurve3([pEs, pEs.clone().addScaledVector(sH.up, 0.004), pH.clone().addScaledVector(sH.up, 0.002), pH, pc.clone().addScaledVector(sH.up, 0.0035), pc], false, "centripetal") },
    { id: "toPr", win: T.toPr, curve: arch(pc, pr, 1.2) },
  ];

  return {
    dest, origin, sites, legs, A, B, C, D, E, H, O, U, ang, cable, km: Math.max(8, lane.km),
    hd0: headingAt(sA, tangentTo(O, C)), hdIn: headingAt(sH, tangentTo(U, D).negate()), pc, pr,
  };
}

// Built once per visitor location; the section (log lines) and the stage (3D) share it.
let memo = { key: "", route: null };
export function getRoute(dest, host) {
  const key = `${dest.lat},${dest.lon},${dest.city},${dest.country},${dest.isp},${host}`;
  if (memo.key !== key) memo = { key, route: buildRoute(dest, host, buildMask()) };
  return memo.route;
}

export function headingAt(site, dir) {
  return Math.atan2(dir.dot(site.east), dir.dot(site.north));
}

const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
const eio = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));

// Where the packet is at time t. Before the first leg it hovers over the server; the last leg
// ends at the printer.
export function packetAt(route, t, out = { pos: new THREE.Vector3(), tan: new THREE.Vector3(), leg: -1, u: 0 }) {
  const { legs } = route;
  let k = -1;
  for (let i = 0; i < legs.length; i++) if (t >= legs[i].win[0]) k = i;
  if (k < 0) { out.pos.copy(route.sites[0].at(...PORT.server)); out.tan.copy(route.sites[0].north); out.leg = -1; out.u = 0; return out; }
  const l = legs[k];
  const raw = (t - l.win[0]) / (l.win[1] - l.win[0]);
  const u = l.long ? eio(Math.min(1, raw)) * 0.9 + Math.min(1, raw) * 0.1 : eio(raw);
  out.pos.copy(l.curve.getPointAt(Math.min(1, u)));
  out.tan.copy(l.curve.getTangentAt(Math.min(1, u)));
  out.leg = raw >= 1 ? k + 0.5 : k; out.u = Math.min(1, u);
  return out;
}

// ---- camera ----
function mono(ts, vs) {
  const n = ts.length;
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d[i] = (vs[i + 1] - vs[i]) / Math.max(1e-6, ts[i + 1] - ts[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
  }
  return (t) => {
    if (t <= ts[0]) return vs[0];
    if (t >= ts[n - 1]) return vs[n - 1];
    let k = 0;
    while (t > ts[k + 1]) k++;
    const h = ts[k + 1] - ts[k], x = (t - ts[k]) / h;
    const x2 = x * x, x3 = x2 * x;
    return (2 * x3 - 3 * x2 + 1) * vs[k] + (x3 - 2 * x2 + x) * h * m[k] + (-2 * x3 + 3 * x2) * vs[k + 1] + (x3 - x2) * h * m[k + 1];
  };
}

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function makeRig(route, aspect) {
  const mob = aspect < 0.85;
  const m = mob ? 1.85 : 1, g = mob ? 1.35 : 1;
  const { sites, hd0, hdIn } = route;
  const [sA, sB, sC, sD, sE, sH] = sites;
  const mid = (a, b, w = 0.5) => a.n.clone().lerp(b.n, w).normalize();
  const room = (p) => sH.at(...p);

  // focus = a point (direction + radius), alt = height above it, el = tilt from straight down, hd = which way is up
  const F = (p) => ({ n: p.clone().normalize(), rf: p.length() });
  const surf = (n) => ({ n: n.clone().normalize(), rf: 1 });
  const east = frameAt(sA.n).east;
  const K = [
    { t: 0, ...surf(walk(sA.n, east, 0.5)), alt: 9 * g, el: 0, hd: 0 },
    { t: T.globe[0], ...surf(sA.n), alt: 3.5 * g, el: 0, hd: 0 },
    { t: T.globe[1], ...surf(sA.n), alt: 3.2 * g, el: 0.1, hd: 0 },
    { t: 2.7, ...surf(mid(sA, sB, 0.2)), alt: 0.5 * g, el: 0.5, hd: hd0 * 0.6 },
    { t: T.AB[0], ...surf(mid(sB, sC, 0.0)), alt: 0.13 * m, el: 0.86, hd: hd0 },
    { t: T.BC[0], ...surf(mid(sB, sC, 0.5)), alt: 0.115 * m, el: 0.86, hd: hd0 },
    { t: T.BC[1], ...surf(mid(sB, sC, 1)), alt: 0.085 * m, el: 0.8, hd: hd0 },
    { t: 6.6, ...surf(sC.n), alt: 0.7 * g, el: 0.5, hd: hd0 },
    { t: 10.9, ...surf(sD.n), alt: 0.7 * g, el: 0.5, hd: hdIn },
    { t: T.DE[0], ...surf(mid(sD, sE, 0.5)), alt: 0.115 * m, el: 0.86, hd: hdIn },
    { t: T.EH[0], ...surf(mid(sE, sH, 0.0)), alt: 0.1 * m, el: 0.84, hd: hdIn },
    { t: T.EH[1], ...F(room([0, 1.6, -0.6])), alt: 0.052 * m, el: 0.7, hd: 0 },
    { t: T.toPC[1], ...F(room([-1.9, 1.9, -2.0])), alt: 0.03 * m, el: 0.62, hd: 0.0 },
    { t: T.print[0], ...F(room([0.2, 1.9, -2.0])), alt: 0.04 * m, el: 0.7, hd: 0.0 },
    { t: 17.5, ...F(room([2.5, 3.0, -2.1])), alt: 0.03 * m, el: 0.95, hd: 0.0 },
    { t: T.end, ...F(room([2.5, 3.1, -2.1])), alt: 0.034 * m, el: 1.12, hd: 0.0 },
    { t: 40, ...F(room([2.5, 3.1, -2.1])), alt: 0.034 * m, el: 1.12, hd: 0.0 },
  ];
  const ts = K.map((k) => k.t);
  const hd = [K[0].hd];
  for (let i = 1; i < K.length; i++) hd.push(hd[i - 1] + wrapA(K[i].hd - hd[i - 1]));
  // unit direction components are blended then renormalised
  const ch = {
    x: mono(ts, K.map((k) => k.n.x)), y: mono(ts, K.map((k) => k.n.y)), z: mono(ts, K.map((k) => k.n.z)),
    rf: mono(ts, K.map((k) => k.rf)), la: mono(ts, K.map((k) => Math.log(k.alt))),
    el: mono(ts, K.map((k) => k.el)), hd: mono(ts, hd),
  };
  const wk = [[0, 0], [3.4, 0], [3.9, 0.4], [5.3, 0.4], [5.9, 0], [6.1, 0], [7.0, 0.95], [10.4, 0.95], [11.0, 0], [11.6, 0], [12.0, 0.35], [13.2, 0.35], [13.8, 0], [99, 0]];
  const follow = mono(wk.map((a) => a[0]), wk.map((a) => a[1]));
  const n = new THREE.Vector3(), pn = new THREE.Vector3();

  return function sample(t, pkt, out = {}) {
    n.set(ch.x(t), ch.y(t), ch.z(t)).normalize();
    let rf = ch.rf(t), alt = Math.exp(ch.la(t)), el = ch.el(t), h = ch.hd(t);
    const w = follow(t);
    if (w > 0.001 && pkt) {
      pn.copy(pkt.pos).normalize();
      n.lerp(pn, w).normalize();
      rf += (pkt.pos.length() - rf) * w;
      const f = frameAt(n);
      const live = Math.atan2(pkt.tan.dot(f.east), pkt.tan.dot(f.north));
      h += wrapA(live - h) * w * (t > T.sea[0] - 0.5 && t < T.sea[1] + 0.5 ? 0.85 : 0.5);
    }
    out.n = n; out.rf = rf; out.alt = alt; out.el = el; out.hd = h;
    return out;
  };
}
