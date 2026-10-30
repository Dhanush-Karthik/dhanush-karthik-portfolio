import * as THREE from "three";
import { toVec, toLatLon } from "./geo";

// ---------------------------------------------------------------------------------------------
// Where a long cable can run. A 1-degree grid is cut from the land mask; A* walks it, paying more for
// land than for water, so a route hugs the ocean and only crosses land where it has to (Suez, a
// landing station's last stretch). The result is straightened wherever that does not cost extra, then
// densified so the curve through it stays in the water.
// ---------------------------------------------------------------------------------------------

const W = 360, H = 150, LAT0 = -75; // 1-degree cells, 75S..75N
const LAND_K = 4;
const D2R = Math.PI / 180;

let grid = null, gridMask = null;
function getGrid(mask) {
  if (grid && gridMask === mask) return grid;
  const land = new Uint8Array(W * H), vec = new Float32Array(W * H * 3);
  const v = new THREE.Vector3();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, lat = LAT0 + j + 0.5, lon = -180 + i + 0.5;
    land[k] = mask.land(lat, lon) ? 1 : 0;
    toVec(lat, lon, 1, v); vec[k * 3] = v.x; vec[k * 3 + 1] = v.y; vec[k * 3 + 2] = v.z;
  }
  grid = { land, vec }; gridMask = mask;
  return grid;
}

// binary min-heap on parallel arrays
function heap() {
  const key = [], val = [];
  return {
    get size() { return key.length; },
    push(k, v) {
      let i = key.length; key.push(k); val.push(v);
      while (i > 0) { const p = (i - 1) >> 1; if (key[p] <= k) break; key[i] = key[p]; val[i] = val[p]; i = p; }
      key[i] = k; val[i] = v;
    },
    pop() {
      const out = val[0], k = key.pop(), v = val.pop();
      const n = key.length;
      if (n) {
        let i = 0;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= n) break;
          if (c + 1 < n && key[c + 1] < key[c]) c++;
          if (key[c] >= k) break;
          key[i] = key[c]; val[i] = val[c]; i = c;
        }
        key[i] = k; val[i] = v;
      }
      return out;
    },
  };
}

const ang = (a, b) => Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
function slerp(a, b, s, out) {
  const w = ang(a, b);
  if (w < 1e-6) return out.copy(a);
  return out.copy(a).multiplyScalar(Math.sin((1 - s) * w) / Math.sin(w)).addScaledVector(b, Math.sin(s * w) / Math.sin(w)).normalize();
}

// cost of the straight (great-circle) hop p -> q, land sampled every half degree
function hopCost(mask, p, q) {
  const w = ang(p, q);
  const n = Math.max(1, Math.ceil(w / (0.5 * D2R)));
  const v = new THREE.Vector3();
  let c = 0;
  for (let k = 0; k < n; k++) {
    slerp(p, q, (k + 0.5) / n, v);
    const { lat, lon } = toLatLon(v);
    c += (w / n) * (mask.land(lat, lon) ? LAND_K : 1);
  }
  return c;
}

// a, b: unit vectors. Returns { pts: unit vectors from a to b, km }
export function seaRoute(mask, a, b, R = 6371) {
  const g = getGrid(mask);
  const cell = (v) => {
    const { lat, lon } = toLatLon(v);
    const j = Math.min(H - 1, Math.max(0, Math.floor(lat - LAT0)));
    const i = (((Math.floor(lon + 180) % W) + W) % W);
    return j * W + i;
  };
  const s = cell(a), t = cell(b);
  const N = W * H;
  const gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const dot = (p, q) => g.vec[p * 3] * g.vec[q * 3] + g.vec[p * 3 + 1] * g.vec[q * 3 + 1] + g.vec[p * 3 + 2] * g.vec[q * 3 + 2];
  const d = (p, q) => Math.acos(Math.min(1, Math.max(-1, dot(p, q))));
  const open = heap();
  gs[s] = 0; open.push(d(s, t), s);
  while (open.size) {
    const u = open.pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === t) break;
    const ui = u % W, uj = (u / W) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!dj && !di) continue;
      const nj = uj + dj;
      if (nj < 0 || nj >= H) continue;
      const k = nj * W + ((ui + di + W) % W);
      if (done[k]) continue;
      const f = (g.land[u] ? LAND_K : 1) * 0.5 + (g.land[k] ? LAND_K : 1) * 0.5;
      const ng = gs[u] + d(u, k) * f;
      if (ng < gs[k]) { gs[k] = ng; from[k] = u; open.push(ng + d(k, t), k); }
    }
  }
  const chain = [];
  for (let k = t; k !== -1; k = from[k]) { chain.push(k); if (k === s) break; }
  chain.reverse();
  const pts = chain.map((k) => new THREE.Vector3(g.vec[k * 3], g.vec[k * 3 + 1], g.vec[k * 3 + 2]));
  pts[0] = a.clone(); pts[pts.length - 1] = b.clone();

  // straighten: jump ahead whenever the straight hop costs no more than the grid walk
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hopCost(mask, pts[i - 1], pts[i]));
  const keep = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = Math.min(pts.length - 1, i + 60);
    for (; j > i + 1; j--) if (hopCost(mask, pts[i], pts[j]) <= (cum[j] - cum[i]) * 1.03) break;
    keep.push(pts[j]); i = j;
  }

  // densify so a spline through the points stays on the straightened lanes
  const out = [];
  let len = 0;
  for (let k = 0; k < keep.length - 1; k++) {
    const w = ang(keep[k], keep[k + 1]);
    len += w;
    const n = Math.max(1, Math.ceil(w / (2.2 * D2R)));
    for (let m = 0; m < n; m++) out.push(slerp(keep[k], keep[k + 1], m / n, new THREE.Vector3()));
  }
  out.push(keep[keep.length - 1].clone());
  return { pts: out, km: len * R };
}
