import * as THREE from "three";

// ---------------------------------------------------------------------------------------------
// The little buildings of the route, built from boxes in local units (x east, y up, z south).
// Every builder returns { group, tick(time, st) }; the scene scales and places them on the globe.
// ---------------------------------------------------------------------------------------------

const BOX = new THREE.BoxGeometry(1, 1, 1);
const EDGES = new THREE.EdgesGeometry(BOX);
const PHOS = "#4ADE80", AMBER = "#F2C94C", RED = "#E5432D";

const std = (color, rough = 0.6, metal = 0.25, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
export const MAT = {
  body: std("#12281c"),
  panel: std("#183324", 0.5, 0.35),
  dark: std("#050b07", 0.8, 0.1),
  steel: std("#2b4c39", 0.35, 0.6),
  wall: std("#0d1d14", 0.8, 0.1, { transparent: true, opacity: 0.86 }),
  floor: std("#0a160e", 0.9, 0.05),
  paper: new THREE.MeshStandardMaterial({ color: "#ECEAE4", roughness: 0.9 }),
  green: new THREE.MeshBasicMaterial({ color: PHOS, toneMapped: false }),
  amber: new THREE.MeshBasicMaterial({ color: AMBER, toneMapped: false }),
  red: new THREE.MeshBasicMaterial({ color: RED, toneMapped: false }),
  line: new THREE.LineBasicMaterial({ color: "#3FBF74", transparent: true, opacity: 0.55 }),
  lineHi: new THREE.LineBasicMaterial({ color: PHOS, transparent: true, opacity: 0.9 }),
};

function box(parent, w, h, d, mat, x, y, z, edge = true) {
  const m = new THREE.Mesh(BOX, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y + h / 2, z);
  if (edge) m.add(new THREE.LineSegments(EDGES, MAT.line));
  parent.add(m);
  return m;
}

function cyl(parent, r, h, mat, x, y, z, seg = 20, sx = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  m.scale.set(sx, 1, sz);
  parent.add(m);
  return m;
}

function pad(group, r = 5.4) {
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 56), new THREE.MeshStandardMaterial({ color: "#09170e", roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02;
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.07, r, 72), new THREE.MeshBasicMaterial({ color: "#2F8F55", toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  const ticks = new THREE.Mesh(new THREE.RingGeometry(r + 0.25, r + 0.32, 72, 1, 0, Math.PI * 2), new THREE.MeshBasicMaterial({ color: "#2F8F55", toneMapped: false, transparent: true, opacity: 0.45 }));
  ticks.rotation.x = -Math.PI / 2; ticks.position.y = 0.03;
  group.add(disc, ring, ticks);
}

// Expanding rings that mark "a packet just passed through here".
function pulses(group, y, r0 = 1.2) {
  const rings = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: PHOS, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.visible = false;
    group.add(m);
    return m;
  });
  return (p) => { // p: seconds since the packet hit this stop
    rings.forEach((m, i) => {
      const k = (p - i * 0.22) / 1.5;
      m.visible = k > 0 && k < 1;
      if (m.visible) { m.scale.setScalar(r0 + k * 5.5); m.material.opacity = (1 - k) * 0.85; }
    });
  };
}

// ---- origin: a row of racks with the file waiting above them ----
function ledTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const x = c.getContext("2d");
  x.fillStyle = "#031007"; x.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 52; i++) { x.fillStyle = Math.random() > 0.2 ? PHOS : AMBER; x.globalAlpha = 0.35 + Math.random() * 0.6; x.fillRect(4 + i * 4.8, 6, 2.4, 52); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildServer() {
  const group = new THREE.Group();
  pad(group, 5.6);
  const racks = [];
  const xs = [-2.9, -1.45, 0, 1.45, 2.9];
  xs.forEach((x, i) => {
    const h = i === 2 ? 2.9 : 2.5;
    box(group, 1.2, h, 1.05, MAT.body, x, 0.04, -0.9);
    box(group, 1.0, h - 0.3, 0.05, MAT.dark, x, 0.2, -0.36, false);
    box(group, 1.24, 0.07, 1.09, MAT.steel, x, h + 0.04, -0.9, false);
    racks.push({ x, h });
  });
  // blinking drive LEDs: a grid per rack
  const per = 13 * 4;
  const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.06, 0.03), new THREE.MeshBasicMaterial({ toneMapped: false }), per * racks.length);
  const c = new THREE.Color();
  let k = 0;
  racks.forEach(({ x, h }) => {
    for (let r = 0; r < 13; r++) for (let q = 0; q < 4; q++) {
      const m = new THREE.Matrix4().makeTranslation(x - 0.36 + q * 0.24, 0.42 + r * ((h - 0.9) / 13), -0.34);
      leds.setMatrixAt(k, m); leds.setColorAt(k, c.set(Math.random() > 0.15 ? PHOS : AMBER)); k++;
    }
  });
  group.add(leds);
  // the rack that holds the file: a lit slot and a tray
  box(group, 1.0, 0.16, 0.55, MAT.steel, 0, 2.15, -0.12, false);
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.12), MAT.green); slot.position.set(0, 2.5, -0.33); group.add(slot);

  // holo base under the floating file
  const holo = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 48), new THREE.MeshBasicMaterial({ color: PHOS, transparent: true, opacity: 0.8, toneMapped: false, side: THREE.DoubleSide }));
  holo.rotation.x = -Math.PI / 2; holo.position.set(0, 3.05, 0.2); group.add(holo);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.55, 40, 1, true), new THREE.MeshBasicMaterial({ color: PHOS, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  beam.position.set(0, 3.32, 0.2); group.add(beam);

  const wall = ledTexture();
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.5), new THREE.MeshBasicMaterial({ map: wall, toneMapped: false }));
  strip.position.set(0, 0.16, 0.0); // under the racks: a status ribbon
  strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.06, 0.55); group.add(strip);

  const pulse = pulses(group, 0.08);
  let nextLed = 0;
  return {
    group,
    tick(time, st) {
      holo.rotation.z = time * 0.8; holo.material.opacity = 0.55 + 0.25 * Math.sin(time * 3);
      beam.material.opacity = 0.09 + 0.05 * Math.sin(time * 2);
      holo.visible = beam.visible = st.t < 3.6;
      if (time > nextLed) { // reshuffle a few LEDs
        nextLed = time + 0.09;
        for (let n = 0; n < 14; n++) leds.setColorAt((Math.random() * leds.count) | 0, c.set(Math.random() > 0.18 ? PHOS : (Math.random() > 0.5 ? AMBER : "#0b3a1f")));
        leds.instanceColor.needsUpdate = true;
      }
      pulse(st.pulse);
    },
  };
}

// ---- ISP: a lattice mast with dishes ----
function strut(group, a, b, r, mat) {
  const d = b.clone().sub(a), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  group.add(m);
}

export function buildIsp() {
  const group = new THREE.Group();
  pad(group, 5.4);
  const H = 7, base = 1.35, top = 0.28;
  const corners = (y, w) => [[-w, y, -w], [w, y, -w], [w, y, w], [-w, y, w]].map((p) => new THREE.Vector3(...p));
  const lvl = [0.04, 1.8, 3.6, 5.4, H];
  const w = (y) => THREE.MathUtils.lerp(base, top, y / H);
  const rings = lvl.map((y) => corners(y, w(y)));
  const seg = [];
  for (let i = 0; i < lvl.length; i++) {
    for (let c = 0; c < 4; c++) {
      const a = rings[i][c], b = rings[i][(c + 1) % 4];
      seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
      if (i < lvl.length - 1) {
        const n = rings[i + 1][c], m2 = rings[i + 1][(c + 1) % 4];
        seg.push(a.x, a.y, a.z, n.x, n.y, n.z);
        seg.push(a.x, a.y, a.z, m2.x, m2.y, m2.z);
      }
    }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  group.add(new THREE.LineSegments(lg, MAT.lineHi));
  for (let c = 0; c < 4; c++) strut(group, rings[0][c], rings[4][c], 0.07, MAT.steel);
  // dishes and antennas
  const dish = (y, ry, s = 1) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.8 * s, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#b9d8c4", roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }));
    d.rotation.set(Math.PI / 2 - 0.2, ry, 0); d.position.set(Math.sin(ry) * 0.55, y, Math.cos(ry) * 0.55);
    group.add(d);
    return d;
  };
  dish(6.3, 0.5); dish(5.2, 2.6, 0.8); dish(4.2, -1.6, 0.7);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), MAT.red); beacon.position.set(0, H + 0.5, 0); group.add(beacon);
  strut(group, new THREE.Vector3(0, H, 0), new THREE.Vector3(0, H + 0.8, 0), 0.05, MAT.steel);
  // equipment hut
  box(group, 2.2, 1.2, 1.7, MAT.body, 2.4, 0.04, 1.6);
  box(group, 0.5, 0.9, 0.05, MAT.dark, 2.4, 0.05, 2.47, false);
  const hutLed = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.1), MAT.green); hutLed.position.set(2.9, 0.95, 2.46); group.add(hutLed);
  const pulse = pulses(group, 7.2, 0.8);
  return {
    group,
    tick(time, st) {
      beacon.visible = Math.sin(time * 5) > 0;
      pulse(st.pulse);
    },
  };
}

// ---- data centre ----
export function buildDc() {
  const group = new THREE.Group();
  pad(group, 5.6);
  box(group, 5.8, 2.3, 3.4, MAT.body, 0, 0.04, 0);
  box(group, 5.95, 0.14, 3.55, MAT.steel, 0, 2.34, 0, false);
  const tex = ledTexture();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 1.0), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  face.position.set(0, 1.2, 1.72); group.add(face);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), MAT.dark); door.position.set(0, 0.6, 1.73); group.add(door);
  // roof fans
  const fans = [-1.9, 0, 1.9].map((x) => {
    const g = new THREE.Group(); g.position.set(x, 2.55, 0);
    cyl(g, 0.72, 0.16, MAT.steel, 0, -0.05, 0, 24);
    const bl = new THREE.Group(); bl.position.y = 0.13;
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(BOX, MAT.green); b.scale.set(0.9, 0.02, 0.17); b.rotation.y = (i * Math.PI) / 4 * 2; b.position.y = 0; bl.add(b); }
    g.add(bl); group.add(g);
    return bl;
  });
  // chillers
  box(group, 1.1, 1.3, 1.4, MAT.panel, -3.7, 0.04, -0.7);
  box(group, 1.1, 1.3, 1.4, MAT.panel, 3.7, 0.04, -0.7);
  // cable mast
  const mast = new THREE.Group(); mast.position.set(2.9, 0, 2.7); group.add(mast);
  cyl(mast, 0.1, 3.6, MAT.steel, 0, 0.04, 0, 8);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 24), MAT.green); ring.position.y = 3.7; ring.rotation.x = Math.PI / 2; mast.add(ring);
  const pulse = pulses(group, 3.2, 1.0);
  return {
    group,
    tick(time, st) {
      fans.forEach((f, i) => { f.rotation.y = time * (6 + i); });
      ring.scale.setScalar(1 + 0.12 * Math.sin(time * 4));
      pulse(st.pulse);
    },
  };
}

// ---- the visitor's room: laptop, dot-matrix printer, and a page ----
export const PAGE_W = 1.75, PAGE_H = 2.35;

function laptopScreen() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 320;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return { c, ctx: c.getContext("2d"), tex };
}

function drawScreen(s, st, time) {
  const { ctx, tex } = s;
  ctx.fillStyle = "#04100a"; ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = "#1E3A26"; ctx.lineWidth = 2; ctx.strokeRect(6, 6, 500, 308);
  ctx.fillStyle = "#4ADE80"; ctx.font = '600 22px "JetBrains Mono", ui-monospace, monospace';
  const bar = (p, n = 28) => `[${"#".repeat(Math.round(p * n)).padEnd(n, ".")}] ${String(Math.round(p * 100)).padStart(3)}%`;
  const L = [];
  L.push(`$ curl -O ${st.file}`);
  L.push(st.recv < 1 ? "  receiving..." : "  received.");
  L.push(bar(st.recv));
  if (st.print > 0) {
    L.push("");
    L.push("> lp -d dk-lpt0 resume");
    L.push(`  printing ${bar(st.print, 20)}`);
  }
  if (st.dl > 0) {
    L.push(`> saving ~/Downloads/${st.file}`);
    L.push(st.dl >= 1 ? "  saved ✔" : `  ${bar(st.dl, 20)}`);
  }
  L.forEach((l, i) => ctx.fillText(l.slice(0, 33), 22, 48 + i * 30));
  if (Math.floor(time * 2) % 2 === 0) ctx.fillRect(22 + Math.min(L[L.length - 1].length, 32) * 13.2, 48 + (L.length - 1) * 30 - 18, 12, 22);
  tex.needsUpdate = true;
}

export function pageTexture(file) {
  const W = 512, H = Math.round(512 * (PAGE_H / PAGE_W));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#F4F2EC"; x.fillRect(0, 0, W, H);
  const mono = '500 15px "JetBrains Mono", ui-monospace, monospace';
  x.fillStyle = "#111311";
  x.font = '900 40px Archivo, "Arial Black", sans-serif';
  x.fillText("DHANUSH KARTHIK", 34, 68);
  x.font = mono; x.fillStyle = "#2F6F48";
  x.fillText("Java Backend Engineer · Chennai, India", 36, 94);
  x.fillStyle = "#111311"; x.fillRect(34, 108, W - 68, 3);
  const block = (y, head, rows) => {
    x.fillStyle = "#E5432D"; x.fillRect(34, y - 12, 10, 10);
    x.fillStyle = "#111311"; x.font = '700 15px "JetBrains Mono", monospace'; x.fillText(head, 54, y - 3);
    x.font = '500 14px "JetBrains Mono", monospace';
    rows.forEach((r, i) => {
      if (typeof r === "string") { x.fillStyle = "#1E2A22"; x.fillText(r.slice(0, 46), 38, y + 24 + i * 22); }
      else { x.fillStyle = "#C9C6BD"; r.forEach(([a, w], j) => x.fillRect(38 + (j ? r[j - 1][0] + 8 : 0), y + 14 + i * 22, w, 6)); }
    });
    return y + 24 + rows.length * 22 + 20;
  };
  let y = 150;
  y = block(y, "EXPERIENCE", [
    "Software Engineer · Grootan Technologies",
    "May 2024 – Present · Chennai",
    "IBM e-Health identity platform (IDP):",
    "  3 of 8 Java microservices in production",
    "  50+ client-facing REST APIs",
    "Migros Consumer Identity Platform",
    "ShiftPen multi-signer e-signing PoC",
    "Junior Software Engineer – Intern",
    "Jun 2023 – May 2024 · Keycloak 22 → 24",
  ]);
  y = block(y, "EDUCATION", ["B.E. Computer Science & Engineering", "Sri Krishna College of Technology", "2020 – 2024 · CGPA 8.85"]);
  y = block(y, "STACK", ["Java · Spring Boot · Quarkus · Keycloak", "Microservices · REST · WebSockets", [[300, 80], [150, 60]]]);
  x.fillStyle = "#8A8A82"; x.font = '500 12px "JetBrains Mono", monospace';
  x.fillText(`${file} · dhanushkarthik.com`, 34, H - 26);
  // perforated feed edges, like tractor paper
  x.fillStyle = "#D9D5CA";
  for (let i = 0; i < H; i += 26) { x.beginPath(); x.arc(12, i + 13, 4.5, 0, 7); x.arc(W - 12, i + 13, 4.5, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

const PAPER_V = /* glsl */ `
  uniform float uFeed, uH;
  varying vec2 vUv;
  varying vec3 vW;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.y += (uFeed - 0.5) * uH;
    float k = uv.y;
    // paper leans and bows a little as it comes out of the platen
    p.z += sin((1.0 - k) * 3.0 + uFeed * 4.0) * 0.012 * uFeed;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const PAPER_F = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uFeed, uHead;
  varying vec2 vUv;
  void main() {
    if (vUv.y < 1.0 - uFeed) discard;
    vec3 c = texture2D(uTex, vUv).rgb;
    float shade = 0.94 + 0.06 * vUv.y;
    // the line being struck right now glows
    float d = (vUv.y - (1.0 - uFeed)) * 40.0;
    c = mix(c, vec3(1.0, 0.82, 0.45), exp(-d * 1.4) * uHead * 0.55);
    gl_FragColor = vec4(c * shade, 1.0);
    #include <colorspace_fragment>
  }
`;

export function buildRoom(file) {
  const group = new THREE.Group();
  const floor = box(group, 10.2, 0.2, 7.4, MAT.floor, 0, -0.18, 0);
  floor.material = MAT.floor;
  box(group, 10.2, 3.6, 0.2, MAT.wall, 0, 0, -3.6);
  box(group, 0.2, 3.6, 7.4, MAT.wall, -5.0, 0, 0);
  box(group, 0.2, 3.6, 7.4, MAT.wall, 5.0, 0, 0);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), new THREE.MeshBasicMaterial({ color: "#12331f", toneMapped: false })); win.position.set(0.1, 2.3, -3.48); group.add(win);

  // desk with a laptop
  const desk = new THREE.Group(); group.add(desk);
  box(desk, 4.4, 0.14, 1.9, MAT.panel, -2.2, 0.98, -2.3);
  [[-4.2, -3.05], [-0.2, -3.05], [-4.2, -1.55], [-0.2, -1.55]].forEach(([x, z]) => box(desk, 0.12, 1.0, 0.12, MAT.steel, x, 0, z, false));
  const lap = new THREE.Group(); lap.position.set(-2.2, 1.12, -2.1); group.add(lap);
  box(lap, 2.3, 0.08, 1.55, MAT.steel, 0, 0, 0);
  const lid = new THREE.Group(); lid.position.set(0, 0.08, -0.74); lid.rotation.x = -0.22; lap.add(lid);
  box(lid, 2.3, 1.45, 0.07, MAT.steel, 0, 0, 0);
  const screen = laptopScreen();
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.3), new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false }));
  sm.position.set(0, 0.76, 0.04); lid.add(sm);
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.8), new THREE.MeshBasicMaterial({ color: "#0b2013" })); keys.rotation.x = -Math.PI / 2; keys.position.set(0, 0.095, 0.2); lap.add(keys);

  // printer on its own stand
  box(group, 3.3, 0.12, 2.4, MAT.panel, 2.5, 0.98, -1.7);
  [[1.0, -2.7], [4.0, -2.7], [1.0, -0.7], [4.0, -0.7]].forEach(([x, z]) => box(group, 0.12, 1.0, 0.12, MAT.steel, x, 0, z, false));
  const pr = new THREE.Group(); pr.position.set(2.5, 1.1, -1.7); group.add(pr);
  box(pr, 2.5, 0.85, 1.55, MAT.body, 0, 0, 0);
  box(pr, 2.5, 0.12, 1.55, MAT.steel, 0, 0.85, 0, false);
  box(pr, 1.9, 0.07, 0.34, MAT.dark, 0, 0.97, -0.38, false);        // paper slot
  box(pr, 2.1, 0.5, 0.06, MAT.panel, 0, 0.18, 0.78, false);         // front tray
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), MAT.green); lamp.position.set(0.95, 0.62, 0.79); pr.add(lamp);
  const lamp2 = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), MAT.amber); lamp2.position.set(0.75, 0.62, 0.79); pr.add(lamp2);
  const headBar = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.05), new THREE.MeshBasicMaterial({ color: "#FFD27A", transparent: true, opacity: 0, toneMapped: false })); headBar.position.set(0, 1.02, -0.2); headBar.rotation.x = -Math.PI / 2; pr.add(headBar);

  const pageTex = pageTexture(file);
  const pgeo = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 1, 24);
  const paperMat = new THREE.ShaderMaterial({
    vertexShader: PAPER_V, fragmentShader: PAPER_F, side: THREE.DoubleSide,
    uniforms: { uTex: { value: pageTex }, uFeed: { value: 0 }, uH: { value: PAGE_H }, uHead: { value: 0 } },
  });
  const paper = new THREE.Mesh(pgeo, paperMat);
  paper.frustumCulled = false;
  // the plane is centred on its group; the shader slides it so the top edge rises by uFeed * H
  const sheet = new THREE.Group(); sheet.position.set(0, 0.98, -0.38); sheet.rotation.x = -0.16; sheet.add(paper); pr.add(sheet);

  const pulse = pulses(group, 0.12, 1.4);
  let lastDraw = 0;
  return {
    group, screen,
    tick(time, st) {
      paperMat.uniforms.uFeed.value = st.feed;
      paperMat.uniforms.uHead.value = st.feed > 0 && st.feed < 1 ? 1 : 0;
      headBar.material.opacity = st.feed > 0 && st.feed < 1 ? 0.5 + 0.5 * Math.sin(time * 40) : 0;
      headBar.position.x = Math.sin(time * 14) * 0.8;
      lamp2.visible = st.feed > 0 && st.feed < 1 ? Math.sin(time * 20) > 0 : st.feed >= 1;
      if (st.near && time - lastDraw > 0.07) { lastDraw = time; drawScreen(screen, st, time); }
      pulse(st.pulse);
    },
  };
}
