import * as THREE from "three";

// One tiny 3D diorama per project. Each has its own scene and camera and is drawn into its own
// render target every frame; the card shader samples that target inside the card's window, so the
// face of every card is a live, rotating model (a technical drawing: flat fills, thick ink hulls).
export const MOTIF_W = 640;
export const MOTIF_H = 400;

const PAPER = 0xefede7;
const INK = 0x111311;
const SIGNAL = 0xe5432d;
const TAPE = 0xf2c94c;
const PHOS = 0x4ade80;
const WHITE = 0xfbfaf6;
const GREY = 0xb9b6ae;

const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
const fill = (color) => new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

// A flat-filled mesh with an inverted-hull outline (the hull is the same geometry, scaled up and
// drawn back-faces only), which stays a few pixels thick at any distance, unlike GL lines.
function solid(geo, color, hull = 0.055) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo, fill(color));
  const edge = new THREE.Mesh(geo, inkMat);
  edge.scale.setScalar(1 + hull);
  g.add(edge, body);
  g.body = body;
  return g;
}

// A thin cylinder between two points (graph edges).
function bar(a, b, r = 0.025, color = INK) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), fill(color));
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

function base() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  const camera = new THREE.PerspectiveCamera(32, MOTIF_W / MOTIF_H, 0.1, 60);
  camera.position.set(0, 0.7, 8);
  camera.lookAt(0, 0, 0);
  return { scene, camera };
}

// ---- 0 · IBM IDP: nested certificate rings, services riding them, a signal core ----
function identity() {
  const { scene, camera } = base();
  const rings = [];
  [[1.05, TAPE], [1.6, WHITE], [2.15, SIGNAL]].forEach(([r, c], k) => {
    const pivot = new THREE.Group();
    pivot.add(solid(new THREE.TorusGeometry(r, 0.1, 12, 64), c));
    const svc = solid(new THREE.BoxGeometry(0.34, 0.34, 0.34), k === 1 ? INK : PAPER, 0.08);
    svc.position.set(r, 0, 0);
    pivot.add(svc);
    scene.add(pivot);
    rings.push(pivot);
  });
  const core = solid(new THREE.IcosahedronGeometry(0.46, 0), PHOS, 0.07);
  scene.add(core);
  const root = new THREE.Group();
  scene.children.slice().forEach((c) => root.add(c));
  scene.add(root);
  return {
    scene, camera,
    update(t, s) {
      rings.forEach((r, k) => {
        r.rotation.x = t * (0.55 + k * 0.22) * s + k * 1.1;
        r.rotation.y = t * (0.35 - k * 0.1) * s + k * 0.7;
      });
      core.rotation.set(t * 0.8 * s, t * 1.1 * s, 0);
      core.scale.setScalar(1 + Math.sin(t * 2.4) * 0.07);
      root.rotation.y = Math.sin(t * 0.3) * 0.35;
    },
  };
}

// ---- 1 · Migros: a hub with a ring of consumers, events pulsing out over the edges ----
function pubsub() {
  const { scene, camera } = base();
  const root = new THREE.Group();
  root.rotation.x = 0.55;
  scene.add(root);
  const hub = solid(new THREE.SphereGeometry(0.55, 20, 14), SIGNAL, 0.07);
  root.add(hub);
  const N = 9, R = 2.25;
  const nodes = [], pulses = [], ends = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const p = new THREE.Vector3(Math.cos(a) * R, Math.sin(i * 1.7) * 0.5, Math.sin(a) * R);
    ends.push(p);
    root.add(bar(new THREE.Vector3(), p));
    const n = solid(new THREE.SphereGeometry(0.24, 14, 10), i % 3 === 0 ? TAPE : WHITE, 0.09);
    n.position.copy(p);
    root.add(n);
    nodes.push(n);
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), fill(INK));
    root.add(pulse);
    pulses.push(pulse);
  }
  return {
    scene, camera,
    update(t, s) {
      root.rotation.y = t * 0.28 * s;
      hub.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
      pulses.forEach((p, i) => {
        const k = (t * 0.7 + i / N) % 1;
        p.position.copy(ends[i]).multiplyScalar(k);
        p.visible = k < 0.96;
        const hit = Math.max(0, 1 - Math.abs(k - 0.98) * 14);
        nodes[i].scale.setScalar(1 + hit * 0.35);
      });
    },
  };
}

// ---- 2 · ShiftPen: a fan of documents and a signature drawing itself ----
function signing() {
  const { scene, camera } = base();
  const root = new THREE.Group();
  scene.add(root);
  for (let k = 0; k < 4; k++) {
    const doc = solid(new THREE.BoxGeometry(2.2, 2.9, 0.07), k === 3 ? WHITE : [GREY, PAPER, WHITE][k % 3], 0.03);
    doc.position.set((k - 1.5) * 0.3, (k - 1.5) * 0.05, -k * -0.22 - 0.4);
    doc.rotation.z = -(k - 1.5) * 0.1;
    root.add(doc);
    for (let l = 0; l < 4; l++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(l === 3 ? 0.9 : 1.6, 0.06, 0.02), fill(INK));
      line.position.set(l === 3 ? -0.3 : 0, 0.95 - l * 0.28, 0.05);
      doc.add(line);
    }
  }
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    pts.push(new THREE.Vector3(-0.9 + u * 2.2, -0.55 + Math.sin(u * 17) * 0.22 * (1 - u * 0.4) + Math.sin(u * 5) * 0.12, 0.45));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, 160, 0.035, 5, false);
  const total = tube.index.count;
  const sig = new THREE.Mesh(tube, fill(SIGNAL));
  root.add(sig);
  const pen = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 8), fill(INK));
  root.add(pen);
  const signers = [TAPE, PHOS, SIGNAL].map((c, i) => {
    const s = solid(new THREE.SphereGeometry(0.17, 12, 8), c, 0.1);
    s.position.set(-1.2 + i * 1.2, 1.95, 0.2);
    root.add(s);
    return s;
  });
  return {
    scene, camera,
    update(t, s) {
      const f = ((t * 0.32) % 1.5) / 1.1;
      const k = Math.min(1, f);
      tube.setDrawRange(0, Math.floor((total * k) / 3) * 3);
      const tip = curve.getPoint(k);
      pen.position.set(tip.x + 0.1, tip.y + 0.2, tip.z + 0.05);
      pen.rotation.z = 0.5;
      pen.visible = f < 1.25;
      signers.forEach((m, i) => { m.position.y = 1.95 + Math.sin(t * 2 + i * 2) * 0.08; });
      root.rotation.y = Math.sin(t * 0.35 * s) * 0.45;
      root.rotation.x = -0.18;
    },
  };
}

// ---- 3 · ArchiStudio: a plan of blocks whose heights breathe ----
function blocks() {
  const { scene, camera } = base();
  const root = new THREE.Group();
  root.rotation.set(0.62, 0.6, 0);
  scene.add(root);
  const slab = solid(new THREE.BoxGeometry(5, 0.12, 5), WHITE, 0.02);
  slab.position.y = -0.1;
  root.add(slab);
  const items = [];
  const G = 4;
  for (let x = 0; x < G; x++) {
    for (let z = 0; z < G; z++) {
      const hot = (x + z) % 5 === 0;
      const b = solid(new THREE.BoxGeometry(0.9, 1, 0.9), hot ? TAPE : (x * 3 + z) % 4 === 1 ? SIGNAL : GREY, 0.06);
      b.position.set((x - (G - 1) / 2) * 1.15, 0, (z - (G - 1) / 2) * 1.15);
      root.add(b);
      items.push({ b, p: x * 1.3 + z * 0.9 });
    }
  }
  return {
    scene, camera,
    update(t, s) {
      items.forEach(({ b, p }) => {
        const h = 0.5 + (Math.sin(t * 0.9 + p) * 0.5 + 0.5) * 1.9;
        b.scale.y = h;
        b.position.y = h / 2;
      });
      root.rotation.y = 0.6 + t * 0.16 * s;
    },
  };
}

// ---- 4 · PSK: framed work hanging at different depths ----
function gallery() {
  const { scene, camera } = base();
  const root = new THREE.Group();
  scene.add(root);
  const frames = [];
  const cfg = [
    [-1.9, 0.3, -0.6, 1.5, 2.0, SIGNAL], [0, -0.1, 0.4, 1.9, 2.5, WHITE], [1.95, 0.4, -0.3, 1.5, 1.9, TAPE],
  ];
  cfg.forEach(([x, y, z, w, h, c], i) => {
    const g = new THREE.Group();
    g.add(solid(new THREE.BoxGeometry(w, h, 0.12), PAPER, 0.035));
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, h - 0.4), fill(c));
    pic.position.z = 0.075;
    g.add(pic);
    if (i === 1) {
      const roof = solid(new THREE.ConeGeometry(0.62, 0.5, 4), INK, 0.0);
      roof.position.set(0, 0.4, 0.2);
      roof.rotation.y = Math.PI / 4;
      const house = solid(new THREE.BoxGeometry(0.75, 0.6, 0.4), PAPER, 0.07);
      house.position.set(0, -0.1, 0.2);
      g.add(house, roof);
    } else {
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, 0.07, 0.02), fill(INK));
      bar1.position.set(-0.1, -h * 0.28, 0.1);
      g.add(bar1);
    }
    g.position.set(x, y, z);
    root.add(g);
    frames.push({ g, y, i });
  });
  const cursor = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), fill(INK));
  root.add(cursor);
  return {
    scene, camera,
    update(t, s) {
      frames.forEach(({ g, y, i }) => {
        g.position.y = y + Math.sin(t * 1.1 + i * 2) * 0.1;
        g.rotation.y = Math.sin(t * 0.5 + i) * 0.28 * s;
      });
      cursor.position.set(Math.sin(t * 0.8) * 1.6 + 0.2, Math.cos(t * 0.6) * 0.9 - 0.2, 1.2);
      cursor.rotation.z = 2.6;
      root.rotation.y = Math.sin(t * 0.25) * 0.18;
    },
  };
}

// ---- 5 · TailorlyAI: a resume under a scanning beam, an ATS ring filling up ----
function resume() {
  const { scene, camera } = base();
  const root = new THREE.Group();
  scene.add(root);
  const sheet = solid(new THREE.BoxGeometry(2.2, 3, 0.06), WHITE, 0.03);
  sheet.position.x = -0.9;
  root.add(sheet);
  const bars = [];
  for (let i = 0; i < 9; i++) {
    const w = 1.5 - ((i * 37) % 5) * 0.16;
    const l = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, 0.02), fill(INK));
    l.position.set(-0.9 + (w - 1.6) / 2, 1.1 - i * 0.26, 0.05);
    root.add(l);
    bars.push(l);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.2), fill(PHOS));
  beam.position.set(-0.9, 0, 0.1);
  root.add(beam);
  const segs = [];
  for (let i = 0; i < 20; i++) {
    const a = -(i / 20) * Math.PI * 2 + Math.PI / 2;
    const m = solid(new THREE.BoxGeometry(0.13, 0.36, 0.13), GREY, 0.1);
    m.position.set(1.6 + Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0);
    m.rotation.z = a - Math.PI / 2;
    root.add(m);
    segs.push(m);
  }
  const col = new THREE.Color();
  return {
    scene, camera,
    update(t, s) {
      const sweep = (t * 0.45) % 1;
      beam.position.y = 1.45 - sweep * 2.9;
      bars.forEach((l) => { l.material.color.setHex(Math.abs(l.position.y - beam.position.y) < 0.28 ? PHOS : INK); });
      const prog = Math.floor(sweep * 21);
      segs.forEach((m, i) => { m.body.material.color.copy(col.setHex(i < prog ? PHOS : GREY)); });
      root.rotation.y = Math.sin(t * 0.4 * s) * 0.3 - 0.1;
      root.rotation.x = -0.1;
    },
  };
}

const MAKERS = [identity, pubsub, signing, blocks, gallery, resume];

export function makeMotif(i) {
  return MAKERS[((i % MAKERS.length) + MAKERS.length) % MAKERS.length]();
}
