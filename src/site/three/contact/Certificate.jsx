import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import { ct, layoutFor } from "./state";
import { FONT, clamp, smooth, outCubic, inCubic, inOutCubic } from "./util";
import { backBase, backLayout, drawIssued, frontPaper, glyphAtlas, sealTexture } from "./certTextures";

// A TLS certificate, as an object. The spark between the fingertips condenses into an orb of light, then the
// parts spiral in and lock together: a gold-edged slab with security-printed paper, a rosette seal, a padlock,
// and two certificate-authority crystals orbiting it. The form is real DOM riding the front face.
// Send: the fields are "hashed" in a wave of hex, the slab flips to the issued certificate, the padlock
// snaps shut, the signature is drawn on in gold wire, a stamp comes down, the chain of trust verifies, and it flies off.

const eps = (v) => (Math.abs(v) < 1e-10 ? 0 : v);
const cssMatrix = (m, mult) => { let s = "matrix3d("; for (let i = 0; i < 16; i++) s += eps(m.elements[i] * mult[i]) + (i !== 15 ? "," : ")"); return s; };
const CAM_MULT = [1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1];
const OBJ_MULT = [1, 1, 1, 1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1];

const SLAB = 12;     // slab thickness
const RIM = 8;       // gold rim round the paper
const MOD_DY = -34;  // the certificate rests a little low so the padlock clears the header
const Z0 = 40;       // floats this far in front of the fresco

const INK = { color: "#15181A", roughness: 0.36, metalness: 0.78, transparent: true };
const GOLD = { color: "#E2B23A", roughness: 0.28, metalness: 0.95, transparent: true };
const STEEL = { color: "#A9B1B6", roughness: 0.32, metalness: 0.92, transparent: true };

function lipGeometry(w, h, t) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 - t, -h / 2 - t); s.lineTo(w / 2 + t, -h / 2 - t); s.lineTo(w / 2 + t, h / 2 + t); s.lineTo(-w / 2 - t, h / 2 + t); s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2, -h / 2); hole.lineTo(-w / 2, h / 2); hole.lineTo(w / 2, h / 2); hole.lineTo(w / 2, -h / 2); hole.closePath();
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8, bevelSegments: 2 });
}
function starGeometry(r1, r2, n, depth) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * 6.2831853, r = i % 2 ? r2 : r1; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.7, bevelThickness: 0.7, bevelSegments: 1, curveSegments: 2 });
}
function tailGeometry(len, w) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, -len); s.lineTo(0, -len + w * 0.45); s.lineTo(-w / 2, -len); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false });
}
function keyholeGeometry() {
  const s = new THREE.Shape();
  s.absarc(0, 3.2, 4.2, 0, 6.2831853, false);
  const t = new THREE.Shape();
  t.moveTo(-2.4, 3); t.lineTo(2.4, 3); t.lineTo(3.6, -8); t.lineTo(-3.6, -8); t.closePath();
  return [new THREE.ShapeGeometry(s, 20), new THREE.ShapeGeometry(t)];
}

// ----------------------------------------------------------------- shaders
const VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const NOISE = /* glsl */ `float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`;

const PANEL_F = /* glsl */ `
  uniform sampler2D uMap, uGlyph;
  uniform vec2 uSize;
  uniform float uOn, uSheen, uSend, uTime;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    vec3 c = texture2D(uMap, vUv).rgb;
    vec2 px = vUv * uSize;
    // printed foil: the guilloche border catches the light as the sheet tilts
    float ed = min(min(px.x, uSize.x - px.x), min(px.y, uSize.y - px.y));
    float band = smoothstep(48.0, 42.0, ed) * smoothstep(6.0, 12.0, ed);
    vec3 irid = 0.5 + 0.5 * cos(6.2831853 * (vUv.x * 0.9 + vUv.y * 0.5 - uSheen * 1.1 + vec3(0.0, 0.33, 0.67)));
    c = mix(c, c * 0.8 + irid * 0.30, band * 0.5);
    // power-on: the sheet wipes in from the middle line with a hot scan line at the front
    float d = abs(vUv.y - 0.5) * 2.0;
    float m = smoothstep(uOn, uOn - 0.06, d);
    float scan = exp(-pow((d - uOn) / 0.014, 2.0)) * step(0.002, uOn) * (1.0 - step(1.06, uOn));
    c = mix(vec3(0.07, 0.075, 0.07), c, m);
    c += scan * vec3(1.0, 0.76, 0.28) * 0.9;
    float gl = vUv.x * 0.65 + vUv.y * 0.35 - uSheen;
    c += vec3(1.0, 0.97, 0.9) * (exp(-gl * gl * 70.0) * 0.10 + exp(-pow((gl - 0.16) / 0.02, 2.0)) * 0.05) * m;
    c *= 0.94 + 0.06 * smoothstep(0.95, 0.2, length(vUv - 0.5) * 1.25);
    // hashing: a wave of hex sweeps down the sheet and the page goes dark behind it
    float yT = 1.0 - vUv.y, wave = uSend * 1.3 - 0.15, on = step(0.001, uSend);
    float enc = smoothstep(wave, wave - 0.1, yT) * on;
    vec2 cell = floor(px / 13.0), lp = fract(px / 13.0);
    float sp = 6.0 + 14.0 * h21(vec2(cell.x, 4.0));
    float gi = floor(h21(cell + floor(uTime * sp)) * 16.0);
    float g = texture2D(uGlyph, vec2((gi + lp.x) / 16.0, lp.y)).a;
    float lit = h21(cell * 1.7 + floor(uTime * 3.0));
    c = mix(c, vec3(0.05, 0.055, 0.05), enc * 0.94);
    c += vec3(0.95, 0.76, 0.25) * g * enc * (0.3 + 0.7 * lit);
    c += exp(-pow((yT - wave) / 0.012, 2.0)) * vec3(1.0, 0.78, 0.3) * on * (1.0 - step(1.05, uSend));
    gl_FragColor = vec4(c, 1.0);
  }
`;
const BACK_F = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uSize;
  uniform float uSheen, uGlow;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(uMap, vUv).rgb;
    vec2 px = vUv * uSize;
    float ed = min(min(px.x, uSize.x - px.x), min(px.y, uSize.y - px.y));
    float band = smoothstep(48.0, 42.0, ed) * smoothstep(6.0, 12.0, ed);
    vec3 irid = 0.5 + 0.5 * cos(6.2831853 * (vUv.x * 0.9 + vUv.y * 0.5 - uSheen * 1.1 + vec3(0.0, 0.33, 0.67)));
    c = mix(c, c * 0.78 + irid * 0.34, band * 0.6);
    float gl = vUv.x * 0.65 + vUv.y * 0.35 - uSheen;
    c += vec3(1.0, 0.97, 0.9) * (exp(-gl * gl * 70.0) * 0.10 + exp(-pow((gl - 0.16) / 0.02, 2.0)) * 0.05);
    c += uGlow * vec3(0.16, 0.30, 0.14) * (smoothstep(70.0, 0.0, ed) * 0.8 + 0.15);
    c *= 0.94 + 0.06 * smoothstep(0.95, 0.2, length(vUv - 0.5) * 1.25);
    gl_FragColor = vec4(c, 1.0);
  }
`;
const ORB_F = /* glsl */ `
  uniform float uA, uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p), a = atan(p.y, p.x);
    float core = exp(-r * r * 14.0), halo = exp(-r * r * 3.2) * 0.55;
    float rays = pow(abs(cos(a * 7.0 + uTime * 1.5 + sin(a * 3.0) * 1.2)), 14.0) * smoothstep(1.0, 0.05, r) * 0.5;
    float ring = exp(-pow((r - 0.55 - 0.05 * sin(uTime * 5.0)) / 0.025, 2.0)) * 0.6;
    float al = clamp((core + halo + rays + ring) * uA, 0.0, 1.0);
    if (al < 0.003) discard;
    gl_FragColor = vec4(mix(vec3(0.9, 0.28, 0.1), vec3(1.0, 0.9, 0.5), clamp(core * 1.4 + rays, 0.0, 1.0)), al);
  }
`;
const BOX_F = /* glsl */ `
  uniform vec2 uSize, uHalf;
  uniform float uR, uBlur, uA;
  varying vec2 vUv;
  float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  void main() {
    float d = sdBox((vUv - 0.5) * uSize, uHalf, uR);
    gl_FragColor = vec4(0.07, 0.05, 0.03, (1.0 - smoothstep(-uBlur, uBlur, d)) * uA);
  }
`;
const SEAL_F = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uA;
  varying vec2 vUv;
  void main() { vec4 t = texture2D(uMap, vUv); gl_FragColor = vec4(t.rgb, t.a * uA); }
`;
const SHOCK_F = /* glsl */ `
  uniform float uT;
  varying vec2 vUv;
  void main() {
    if (uT < 0.0) discard;
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p), a = atan(p.y, p.x);
    float R = uT * 1.1;
    float ring = exp(-pow((r - R) / (0.025 + uT * 0.04), 2.0)) * exp(-uT * 2.6);
    float ring2 = exp(-pow((r - R * 0.62) / 0.02, 2.0)) * exp(-uT * 3.6) * 0.7;
    float spokes = pow(abs(cos(a * 12.0)), 30.0) * exp(-pow((r - R * 0.9) / 0.1, 2.0)) * exp(-uT * 3.0);
    float al = clamp(ring + ring2 + spokes * 0.8, 0.0, 1.0);
    if (al < 0.004) discard;
    gl_FragColor = vec4(mix(vec3(1.0, 0.72, 0.25), vec3(1.0, 0.97, 0.8), al), al);
  }
`;
const BEAM_F = /* glsl */ `
  uniform float uA, uTime, uOk, uLen;
  varying vec2 vUv;
  void main() {
    float core = exp(-pow((vUv.y - 0.5) / 0.1, 2.0));
    float flow = smoothstep(0.55, 0.95, fract(vUv.x * uLen / 16.0 - uTime * (0.8 + uOk * 3.0)));
    float al = (core * (0.35 + 0.65 * flow) + exp(-pow((vUv.y - 0.5) / 0.4, 2.0)) * 0.12) * uA * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
    if (al < 0.004) discard;
    gl_FragColor = vec4(mix(vec3(0.95, 0.76, 0.25), vec3(0.3, 0.92, 0.55), uOk), clamp(al, 0.0, 1.0));
  }
`;
const shaderMat = (fragmentShader, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, transparent: true, ...extra });

// One piece of the certificate. It starts scattered round the spark and spirals in to `at` between T = delay and
// delay + dur. Pieces register their spec so the single useFrame in Certificate can drive them all.
function Part({ specs, i, at, delay, dur = 0.36, children }) {
  const spec = useRef({}).current;
  const a = i * 2.399963 + 0.6, r = 430 + (i % 3) * 110;
  spec.rest = at; spec.delay = delay; spec.dur = dur;
  spec.from = [Math.cos(a) * r, Math.sin(a) * r * 0.78, 140 + (i % 4) * 70];
  spec.spin = [Math.sin(i * 7.1) * 2.4, Math.cos(i * 3.3) * 2.4, Math.sin(i * 5.7) * 3.2];
  spec.sw = 1.4 + (i % 3) * 0.5;
  useEffect(() => { specs.push(spec); return () => { const k = specs.indexOf(spec); if (k >= 0) specs.splice(k, 1); }; }, [specs, spec]);
  return <group ref={(el) => { spec.g = el; }} position={at} visible={false}>{children}</group>;
}

const CRYSTALS = [
  { label: "ROOT CA", mat: { ...GOLD, flatShading: true }, col: new THREE.Color("#F2C94C") },
  { label: "INTERMEDIATE", mat: { ...STEEL, flatShading: true }, col: new THREE.Color("#7FA6D8") },
];

function clearGroup(g) {
  for (let i = g.children.length - 1; i >= 0; i--) { const o = g.children[i]; g.remove(o); o.geometry?.dispose(); }
}

// The signature the visitor drew, rebuilt as gold wire. Returns the strokes in draw order, each with the slice
// of the overall progress it covers, so useFrame can reveal them one after another with drawRange.
function buildSignature(group, cert, L, cw, ch, mat, tipMat) {
  clearGroup(group);
  const strokes = (cert.strokes || []).filter((s) => s.length > 0);
  const box = { w: (L.sig.x1 - L.sig.x0) * cw, h: ch * 0.2 };
  let wpx = box.w, hpx = wpx / (cert.ar || 3);
  if (hpx > box.h) { hpx = box.h; wpx = hpx * (cert.ar || 3); }
  const x0 = (L.sig.x0 - 0.5) * cw + 6, y0 = (0.5 - L.sig.lineY) * ch + 3 + hpx;
  const curves = strokes.map((s) => {
    const step = Math.max(1, Math.ceil(s.length / 90));
    const pts = [];
    for (let i = 0; i < s.length; i += step) pts.push(new THREE.Vector3(x0 + s[i][0] * wpx, y0 - s[i][1] * hpx, 0));
    if (pts.length < 2) pts.push(pts[0].clone().add(new THREE.Vector3(2.5, 0.5, 0)));
    return new THREE.CatmullRomCurve3(pts, false, "centripetal");
  });
  const lens = curves.map((c) => c.getLength()), total = lens.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const list = curves.map((c, i) => {
    const geo = new THREE.TubeGeometry(c, Math.max(8, Math.min(240, Math.round(lens[i] / 2))), 1.7, 6, false);
    geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 10; mesh.frustumCulled = false;
    group.add(mesh);
    const e = { curve: c, geo, a: acc / total, b: (acc + lens[i]) / total, count: geo.index.count };
    acc += lens[i];
    return e;
  });
  const tip = new THREE.Mesh(new THREE.SphereGeometry(3.6, 12, 8), tipMat); tip.renderOrder = 11; tip.frustumCulled = false; tip.visible = false;
  group.add(tip);
  return { list, tip };
}

export default function Certificate() {
  const { size, camera } = useThree();
  const L = useMemo(() => layoutFor(size.width, size.height), [size.width, size.height]);
  const { cw, ch } = L;
  const BL = useMemo(() => backLayout(cw, ch), [cw, ch]);
  const front = useMemo(() => frontPaper(cw, ch), [cw, ch]);
  const glyphs = useMemo(() => glyphAtlas(), []);
  const seal = useMemo(() => sealTexture(true), []);
  const backPre = useMemo(() => backBase(cw, ch), [cw, ch]); // [pristine canvas, ctx]
  const work = useMemo(() => {
    const c = document.createElement("canvas"); c.width = backPre[0].width; c.height = backPre[0].height;
    const g = c.getContext("2d"); g.drawImage(backPre[0], 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
    return { c, g, t };
  }, [backPre]);
  const lip = useMemo(() => lipGeometry(cw, ch, 5), [cw, ch]);
  const star = useMemo(() => starGeometry(30, 25.5, 24, 3), []);
  const tail = useMemo(() => tailGeometry(46, 17), []);
  const [kh1, kh2] = useMemo(() => keyholeGeometry(), []);

  const panel = useMemo(() => shaderMat(PANEL_F, { uMap: { value: front }, uGlyph: { value: glyphs }, uSize: { value: new THREE.Vector2(cw, ch) }, uOn: { value: 0 }, uSheen: { value: 0.5 }, uSend: { value: 0 }, uTime: { value: 0 } }), [front, glyphs, cw, ch]);
  const back = useMemo(() => shaderMat(BACK_F, { uMap: { value: work.t }, uSize: { value: new THREE.Vector2(cw, ch) }, uSheen: { value: 0.5 }, uGlow: { value: 0 } }), [work, cw, ch]);
  const orbMat = useMemo(() => shaderMat(ORB_F, { uA: { value: 0 }, uTime: { value: 0 } }, { depthTest: false, depthWrite: false }), []);
  const shadow = useMemo(() => shaderMat(BOX_F, { uSize: { value: new THREE.Vector2() }, uHalf: { value: new THREE.Vector2() }, uR: { value: 8 }, uBlur: { value: 30 }, uA: { value: 0 } }, { depthTest: false, depthWrite: false }), []);
  const imprintMat = useMemo(() => shaderMat(SEAL_F, { uMap: { value: seal }, uA: { value: 0 } }, { depthWrite: false }), [seal]);
  const shockMat = useMemo(() => shaderMat(SHOCK_F, { uT: { value: -1 } }, { depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const beams = useMemo(() => [0, 1].map(() => shaderMat(BEAM_F, { uA: { value: 0 }, uTime: { value: 0 }, uOk: { value: 0 }, uLen: { value: 100 } }, { depthWrite: false })), []);
  const sigMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#E2B23A", metalness: 0.9, roughness: 0.25, emissive: "#FFB020", emissiveIntensity: 0.4, transparent: true }), []);
  const tipMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFF1B8", transparent: true, depthTest: false }), []);
  const stampMats = useMemo(() => ({
    base: new THREE.MeshStandardMaterial({ ...STEEL }), enamel: new THREE.MeshStandardMaterial({ color: "#B0261C", roughness: 0.4, metalness: 0.3, transparent: true }),
    handle: new THREE.MeshStandardMaterial({ ...INK }), knob: new THREE.MeshStandardMaterial({ ...GOLD }),
  }), []);
  const ringMat = useMemo(() => new THREE.MeshStandardMaterial({ ...INK, emissive: "#E5432D", emissiveIntensity: 1 }), []);
  const orbitLine = useMemo(() => {
    const pts = []; for (let i = 0; i < 96; i++) { const a = (i / 96) * 6.2831853; pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: "#111311", transparent: true, opacity: 0, depthWrite: false }));
  }, []);

  const specs = useRef([]).current;
  const outer = useRef(), pivot = useRef(), content = useRef(), shadowMesh = useRef(), orb = useRef();
  const lock = useRef(), shackle = useRef(), rosetteG = useRef(), sigG = useRef(), stamper = useRef(), imprint = useRef(), shock = useRef();
  const crystals = useRef([]), labels = useRef([]), beamMesh = useRef([]), bolts = useRef([]);
  const tilt = useRef({ x: 0, y: 0 });
  const flags = useRef({ built: -2, stamped: false, clicked: false, launched: false, sig: null }).current;
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmp2 = useMemo(() => new THREE.Vector3(), []);
  const green = useMemo(() => new THREE.Color("#3DDC84"), []);
  const red = useMemo(() => new THREE.Color("#E5432D"), []);
  const domCache = useRef({ cam: "", card: "", vis: "", op: "", pe: "", persp: "" }).current;

  useEffect(() => () => {
    front.dispose(); glyphs.dispose(); seal.dispose(); work.t.dispose(); lip.dispose(); star.dispose(); tail.dispose(); kh1.dispose(); kh2.dispose();
    panel.dispose(); back.dispose(); orbMat.dispose(); shadow.dispose(); imprintMat.dispose(); shockMat.dispose(); beams.forEach((b) => b.dispose());
    sigMat.dispose(); tipMat.dispose(); Object.values(stampMats).forEach((m) => m.dispose()); ringMat.dispose();
    orbitLine.geometry.dispose(); orbitLine.material.dispose();
  }, [front, glyphs, seal, work, lip, star, tail, kh1, kh2, panel, back, orbMat, shadow, imprintMat, shockMat, beams, sigMat, tipMat, stampMats, ringMat, orbitLine]);
  // everything draws in the transparent pass so it sorts after the fresco by renderOrder
  useLayoutEffect(() => { outer.current?.traverse((o) => { if (o.isMesh && o.renderOrder === 0) o.renderOrder = 9; }); });

  const lockY = ch / 2 + RIM + 2;
  const ros = cw < 480 ? 24 : 34;           // rosette inset from the corner
  const sx = (BL.stamp.x - 0.5) * cw, sy = (0.5 - BL.stamp.y) * ch, sr = BL.stamp.r;

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05);
    const g = outer.current, g2 = content.current, pv = pivot.current;
    if (!g || !g2 || !pv) return;
    const ts = ct.sentAt < 0 ? -1 : (performance.now() - ct.sentAt) / 1000;
    const target = ts >= 0 ? 1 : ct.meet >= 0.995 ? 1 : 0;
    ct.cardT += clamp(target - ct.cardT, -dt / 0.7, dt / 2.6);
    const T = ct.cardT, el = state.clock.elapsedTime, cp = L.cp, rest = L.rest;
    const k = Math.max(0.02, (camera.position.z - Z0) / camera.position.z); // px per world unit at the unit's depth

    const appear = smooth(0, 0.1, T), fly = inOutCubic(T / 0.5), set = 1 - outCubic(T / 0.55);
    const live = (ts < 0 ? 1 : 0) * smooth(0.9, 1, T);

    // ---- the send sequence, all a function of ts (seconds since SEND)
    const rain = ts < 0 ? 0 : smooth(0.12, 0.8, ts);
    const flipT = ts < 0 ? 0 : inOutCubic((ts - 0.4) / 0.85);
    const lockClose = ts < 0 ? 0 : clamp((ts - 1.15) / 0.28);
    const sigP = ts < 0 ? 0 : clamp((ts - 1.25) / 0.75);
    const sigSink = ts < 0 ? 0 : smooth(1.95, 2.2, ts);
    const down = ts < 0 ? 0 : clamp((ts - 1.95) / 0.3);
    const up = ts < 0 ? 0 : clamp((ts - 2.5) / 0.5);
    const verify = ts < 0 ? 0 : clamp((ts - 2.4) / 0.8);
    const hitT = ts - 2.25;

    // build the issued face the first frame after SEND
    if (ts >= 0 && flags.built !== ct.sentAt && ct.cert) {
      flags.built = ct.sentAt; flags.stamped = false; flags.clicked = false;
      work.g.clearRect(0, 0, work.c.width, work.c.height);
      work.g.drawImage(backPre[0], 0, 0);
      work.g.save(); work.g.scale(work.c.width / cw, work.c.height / ch); drawIssued(work.g, cw, ch, ct.cert); work.g.restore();
      work.t.needsUpdate = true;
      flags.sig = buildSignature(sigG.current, ct.cert, BL, cw, ch, sigMat, tipMat);
    }
    if (ts < 0 && flags.built !== -2) { flags.built = -2; if (flags.sig) { clearGroup(sigG.current); flags.sig = null; } }

    let sc = appear * (0.55 + 0.45 * fly) * k;
    let x = cp.x + (rest.x - cp.x) * fly, y = cp.y + (rest.y + MOD_DY - cp.y) * fly + Math.sin(el * 1.1) * 3 * live;
    let rx = set * 0.9, ry = -set * 1.3, rz = -set * 0.25;
    tilt.current.x += (-state.pointer.y * 0.12 - tilt.current.x) * (1 - Math.exp(-dt * 5));
    tilt.current.y += (state.pointer.x * 0.18 - tilt.current.y) * (1 - Math.exp(-dt * 5));
    rx += tilt.current.x * live; ry += tilt.current.y * live;

    let fade = smooth(0.8, 1, T), vis = T > 0.01;
    if (ts >= 0) {
      fade *= 1 - smooth(0, 0.3, ts);
      const shake = hitT > 0 ? Math.exp(-hitT * 12) * Math.sin(ts * 110) : 0;
      x += shake * 5; y += shake * 3.5;
      const f = clamp((ts - 3.1) / 1.0), e = f * f;
      x += e * size.width * 0.62; y += e * size.height * 0.7 - Math.sin(f * Math.PI) * 60;
      rz += -e * 1.1; rx += e * 5; sc *= 1 - 0.88 * e;
      if (!flags.launched && ts > 3.1) { flags.launched = true; ct.flown = true; ct.fire?.(x, y, 0.7, false); }
      vis = vis && ts < 4.3;
    } else { flags.launched = false; ct.flown = false; }

    g.visible = vis;
    g.position.set(x, y, Z0);
    g.rotation.set(rx, ry, rz);
    g.scale.setScalar(sc);
    const dip = Math.sin(flipT * Math.PI);
    pv.rotation.y = flipT * Math.PI;
    pv.position.z = -SLAB / 2 + dip * 70;
    pv.scale.setScalar(1 - 0.17 * dip);

    // ---- the pieces spiral in from the spark
    specs.forEach((s) => {
      const gr = s.g;
      if (!gr) return;
      const p = clamp((T - s.delay) / s.dur), e = 1 - Math.pow(1 - p, 4), rem = 1 - e;
      const c = Math.cos(rem * s.sw), sn = Math.sin(rem * s.sw), fx = s.from[0] * rem, fy = s.from[1] * rem;
      gr.visible = T > s.delay;
      gr.position.set(s.rest[0] + fx * c - fy * sn, s.rest[1] + fx * sn + fy * c, s.rest[2] + s.from[2] * rem);
      gr.rotation.set(s.spin[0] * rem, s.spin[1] * rem, s.spin[2] * rem);
      gr.scale.setScalar(0.25 + 0.75 * e);
    });

    // ---- the spark's orb, until the certificate has closed round it
    const oa = smooth(0, 0.1, T) * (1 - smooth(0.3, 0.62, T)) * (ts < 0 ? 1 : 0);
    orbMat.uniforms.uA.value = oa; orbMat.uniforms.uTime.value = el;
    orb.current.visible = oa > 0.003;
    orb.current.scale.setScalar(110 + 150 * smooth(0, 0.3, T));

    // ---- faces
    const pu = panel.uniforms;
    pu.uOn.value = ts < 0 ? smooth(0.62, 0.88, T) * 1.08 : 1.08;
    const sheen = 0.55 + tilt.current.y * 1.8 + Math.sin(el * 0.35) * 0.25;
    pu.uSheen.value = sheen; pu.uSend.value = rain; pu.uTime.value = el;
    back.uniforms.uSheen.value = sheen;
    back.uniforms.uGlow.value = ts < 0 ? 0 : (hitT > 0 ? Math.exp(-hitT * 2.4) * 1.2 : 0) + 0.3 * smooth(0.7, 1, verify);

    // ---- padlock: swings gently open, then the shackle slams home
    const lk = ts < 0 ? 0.62 + 0.06 * Math.sin(el * 1.7) : 1 - inCubic(lockClose);
    const lockSc = 1 + (lockClose >= 1 ? 0.12 * Math.exp(-(ts - 1.43) * 14) : 0);
    if (lock.current) { lock.current.scale.setScalar(lockSc); lock.current.position.y = lockClose >= 1 ? -2.5 * Math.exp(-(ts - 1.43) * 16) : 0; }
    if (shackle.current) { shackle.current.position.y = 18 + 10 * lk; shackle.current.rotation.y = -2.1 * lk; }
    if (lockClose >= 1 && !flags.clicked) { flags.clicked = true; }
    ringMat.emissive.copy(red).lerp(green, ts < 0 ? 0 : smooth(1.4, 1.55, ts));
    ringMat.emissiveIntensity = 0.6 + 0.8 * (0.5 + 0.5 * Math.sin(el * (ts < 0 ? 2.4 : 8))) * (ts < 0 ? 1 : 0.6);

    // ---- certificate authorities orbit the padlock; on send the chain of trust lights up root → intermediate → leaf
    const assembled = smooth(0.78, 0.98, T);
    for (let i = 0; i < 2; i++) {
      const m = crystals.current[i];
      if (!m) continue;
      const ph = el * 0.6 + i * Math.PI + 0.7, spread = 1 - 0.28 * verify;
      m.position.set(Math.cos(ph) * 112 * spread, lockY + 4 + Math.sin(ph) * 10, -SLAB / 2 + Math.sin(ph) * 58);
      m.scale.setScalar(assembled * (0.92 + 0.08 * Math.sin(el * 2 + i)) * (hitT > 0 ? 1 + 0.25 * Math.exp(-(hitT - 0.2 * i) * 6) : 1));
      m.visible = assembled > 0.01;
      const ok = i === 0 ? smooth(0.0, 0.35, verify) : smooth(0.35, 0.7, verify);
      const body = m.children[0], mat = body.material;
      mat.emissive.copy(CRYSTALS[i].col).lerp(green, ok);
      mat.emissiveIntensity = 0.35 + 0.5 * Math.sin(el * 3 + i * 2) * 0.5 + ok * 0.9;
      body.rotation.y += dt * (0.8 + i * 0.5); body.rotation.x += dt * (0.5 - i * 0.2);
      const lb = labels.current[i];
      if (lb) { lb.fillOpacity = assembled * 0.8; lb.rotation.y = -pv.rotation.y; } // labels always face the camera, even on the flip side
    }
    orbitLine.position.set(0, lockY + 4, -SLAB / 2);
    orbitLine.scale.set(112 * (1 - 0.28 * verify), 10, 1);
    orbitLine.material.opacity = assembled * 0.16;
    const c0 = crystals.current[0], c1 = crystals.current[1];
    if (c0 && c1) {
      const pairs = [[c0.position, c1.position], [c1.position, tmp2.set(0, lockY + 6, -SLAB / 2)]];
      pairs.forEach(([a, b], i) => {
        const bm = beamMesh.current[i];
        if (!bm) return;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        bm.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        bm.rotation.z = Math.atan2(dy, dx);
        bm.scale.set(len, 5, 1);
        const u = beams[i].uniforms;
        u.uLen.value = len; u.uTime.value = el;
        u.uOk.value = i === 0 ? smooth(0.0, 0.35, verify) : smooth(0.35, 0.7, verify);
        u.uA.value = assembled * (0.22 + 0.78 * smooth(0, 0.2, verify) * (ts >= 0 && ts < 3.6 ? 1 : 0));
        bm.visible = assembled > 0.01;
      });
    }
    bolts.current.forEach((b, i) => { if (b) b.rotation.z = i * 1.7 + (1 - smooth(0.3, 0.8, T)) * 6; });
    if (rosetteG.current) rosetteG.current.rotation.z = Math.sin(el * 0.9) * 0.05;

    // ---- signature, drawn on in gold wire above the issued face
    const sg = flags.sig;
    if (sg && sigG.current) {
      sigG.current.position.z = 2.6 + 15 * (1 - sigSink);
      sg.list.forEach((s) => {
        const lp = clamp((sigP - s.a) / Math.max(1e-4, s.b - s.a));
        s.geo.setDrawRange(0, Math.floor((lp * s.count) / 6) * 6);
        if (lp > 0 && lp < 1) { s.curve.getPoint(lp, tmp); sg.tip.position.copy(tmp); sg.tip.visible = true; }
      });
      if (sigP >= 1 || sigP <= 0) sg.tip.visible = false;
      sigMat.emissiveIntensity = 0.35 + 1.6 * (sigP > 0 && sigP < 1 ? 1 : 0) + 0.8 * Math.exp(-Math.max(0, ts - 2.0) * 3) * (sigP >= 1 ? 1 : 0);
    }

    // ---- the stamp comes down, presses, and lifts away, leaving its impression
    const st = stamper.current;
    if (st) {
      const hold = ts >= 2.25 && ts < 2.5;
      const z = ts < 2.25 ? 5 + 300 * (1 - inCubic(down)) : hold ? 5 : 5 + 300 * outCubic(up);
      st.position.set(sx, sy, z);
      st.rotation.z = (1 - down) * 0.5;
      st.visible = ts >= 1.9 && ts < 3.1;
      const squash = hitT > 0 && hitT < 0.4 ? 1 - 0.22 * Math.exp(-hitT * 18) : 1;
      st.scale.set(1 + (1 - squash) * 0.5, 1 + (1 - squash) * 0.5, squash);
      const fo = ts < 2.5 ? 1 : 1 - smooth(0.35, 1, up);
      Object.values(stampMats).forEach((m) => { m.opacity = fo; });
    }
    if (imprint.current) {
      imprintMat.uniforms.uA.value = ts < 0 ? 0 : smooth(2.25, 2.3, ts) * 0.92;
      imprint.current.scale.setScalar(1 + (hitT > 0 ? 0.1 * Math.exp(-hitT * 10) : 0));
    }
    shockMat.uniforms.uT.value = ts >= 2.25 && hitT < 1.3 ? hitT : -1;
    if (ts >= 2.25 && !flags.stamped && st) {
      flags.stamped = true;
      st.getWorldPosition(tmp); ct.fire?.(tmp.x, tmp.y, 0.8, false);
    }

    // ---- shadow
    const sh = shadowMesh.current, sw = cw + 2 * RIM + 30, shh = ch + 2 * RIM + 30;
    sh.position.set(18, -18, -64);
    shadow.uniforms.uA.value = smooth(0.2, 0.8, T) * 0.36 * (ts >= 0 ? 1 - smooth(3.1, 3.7, ts) : 1);
    shadow.uniforms.uSize.value.set(sw + 160, shh + 160);
    shadow.uniforms.uHalf.value.set(sw / 2, shh / 2);
    sh.scale.set(sw + 160, shh + 160, 1);

    // ---- the DOM form rides the front face, so the fields are really on the paper. Styles are only touched when they change.
    const d = ct.dom;
    if (d.root && d.cam && d.card && d.face) {
      g2.updateWorldMatrix(true, false);
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      const P = camera.projectionMatrix.elements[5] * (size.height / 2);
      const persp = `${P}px`;
      if (domCache.persp !== persp) { domCache.persp = persp; d.root.style.perspective = persp; }
      const cam = `translateZ(${P}px) ${cssMatrix(camera.matrixWorldInverse, CAM_MULT)} translate(${size.width / 2}px,${size.height / 2}px)`;
      if (domCache.cam !== cam) { domCache.cam = cam; d.cam.style.transform = cam; }
      const card = `translate(-50%,-50%) ${cssMatrix(g2.matrixWorld, OBJ_MULT)}`;
      if (domCache.card !== card) { domCache.card = card; d.card.style.transform = card; }
      const v = g.visible && fade > 0.01 ? "visible" : "hidden";
      if (domCache.vis !== v) { domCache.vis = v; d.card.style.visibility = v; }
      const op = String(fade);
      if (domCache.op !== op) { domCache.op = op; d.face.style.opacity = op; }
      const pe = fade > 0.9 && ts < 0 ? "auto" : "none";
      if (domCache.pe !== pe) { domCache.pe = pe; d.face.style.pointerEvents = pe; }
    }
  });

  const hw = cw / 2, hh = ch / 2;

  return (
    <group ref={outer} visible={false}>
      <mesh ref={shadowMesh} material={shadow} renderOrder={5}><planeGeometry args={[1, 1]} /></mesh>
      <mesh ref={orb} material={orbMat} position={[0, 0, 40]} renderOrder={11}><planeGeometry args={[2, 2]} /></mesh>

      <group ref={pivot} position={[0, 0, -SLAB / 2]}>
        <group ref={content} position={[0, 0, SLAB / 2]}>
          {/* the gold-edged slab and its printed front */}
          <Part specs={specs} i={2} at={[0, 0, -SLAB / 2]} delay={0.04} dur={0.42}>
            <RoundedBox args={[cw + 2 * RIM, ch + 2 * RIM, SLAB]} radius={7} smoothness={3}><meshStandardMaterial {...GOLD} /></RoundedBox>
          </Part>
          <Part specs={specs} i={0} at={[0, 0, 0.06]} delay={0.1}><mesh material={panel}><planeGeometry args={[cw, ch]} /></mesh></Part>
          <Part specs={specs} i={1} at={[0, 0, 0]} delay={0.32}><mesh geometry={lip}><meshStandardMaterial {...GOLD} /></mesh></Part>

          {/* the issued face, with the signature wire, stamp and impression */}
          <Part specs={specs} i={3} at={[0, 0, -SLAB - 0.06]} delay={0.06} dur={0.42}>
            <group rotation={[0, Math.PI, 0]}>
              <mesh material={back}><planeGeometry args={[cw, ch]} /></mesh>
              <mesh geometry={lip}><meshStandardMaterial {...GOLD} /></mesh>
              <group ref={sigG} />
              <mesh ref={imprint} material={imprintMat} position={[sx, sy, 0.5]}><planeGeometry args={[sr * 2.1, sr * 2.1]} /></mesh>
              <mesh ref={shock} material={shockMat} position={[sx, sy, 3]}><planeGeometry args={[sr * 6, sr * 6]} /></mesh>
              <group ref={stamper} visible={false}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={stampMats.base}><cylinderGeometry args={[sr * 0.98, sr * 0.98, 7, 48]} /></mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 4]} material={stampMats.enamel}><cylinderGeometry args={[sr * 0.8, sr * 0.8, 3, 48]} /></mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 24]} material={stampMats.handle}><cylinderGeometry args={[sr * 0.26, sr * 0.34, 36, 24]} /></mesh>
                <mesh position={[0, 0, 46]} material={stampMats.knob}><sphereGeometry args={[sr * 0.4, 24, 16]} /></mesh>
              </group>
            </group>
          </Part>

          {/* bolts in the corners */}
          {[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([bx, by], i) => (
            <Part key={i} specs={specs} i={4 + i} at={[bx * (hw + 3.5), by * (hh + 3.5), 3.2]} delay={0.38 + i * 0.05} dur={0.28}>
              <group ref={(el) => { bolts.current[i] = el; }}>
                <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[3.6, 3.6, 3.4, 6]} /><meshStandardMaterial {...GOLD} /></mesh>
                <mesh position={[0, 0, 1.8]}><boxGeometry args={[5, 0.9, 0.8]} /><meshStandardMaterial {...INK} /></mesh>
              </group>
            </Part>
          ))}

          {/* rosette: a gold starburst with two red ribbon tails, pinned on the top-right corner */}
          <Part specs={specs} i={8} at={[hw - ros, hh - ros, 3]} delay={0.46} dur={0.32}>
            <group ref={rosetteG}>
              <mesh position={[-8, -22, -1.2]} rotation={[0, 0, 0.2]} geometry={tail}><meshStandardMaterial color="#B0261C" roughness={0.5} metalness={0.2} transparent /></mesh>
              <mesh position={[9, -22, -1.6]} rotation={[0, 0, -0.18]} geometry={tail}><meshStandardMaterial color="#8E1D14" roughness={0.5} metalness={0.2} transparent /></mesh>
              <mesh geometry={star}><meshStandardMaterial {...GOLD} /></mesh>
              <mesh position={[0, 0, 3.4]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[19, 19, 1.6, 36]} /><meshStandardMaterial color="#B0261C" roughness={0.4} metalness={0.4} transparent /></mesh>
              <mesh position={[0, 0, 4.4]}><torusGeometry args={[14.5, 1.1, 8, 40]} /><meshStandardMaterial {...GOLD} /></mesh>
              <Text font={FONT} position={[0, 0.5, 4.8]} fontSize={9.5} color="#F6D9A6" anchorX="center" anchorY="middle" renderOrder={10}>TLS</Text>
            </group>
          </Part>

          {/* the padlock */}
          <Part specs={specs} i={9} at={[0, lockY, -SLAB / 2]} delay={0.5} dur={0.4}>
            <group ref={lock}>
              <RoundedBox args={[48, 36, 20]} radius={5} smoothness={3}><meshStandardMaterial {...GOLD} /></RoundedBox>
              <mesh geometry={kh1} position={[0, -1, 10.4]}><meshBasicMaterial color="#15181A" transparent /></mesh>
              <mesh geometry={kh2} position={[0, -1, 10.4]}><meshBasicMaterial color="#15181A" transparent /></mesh>
              <mesh position={[0, 1, 10.7]} material={ringMat}><torusGeometry args={[11.5, 1.1, 8, 40]} /></mesh>
              <group ref={shackle} position={[14, 18, 0]}>
                <group position={[-14, 0, 0]}>
                  <mesh><torusGeometry args={[14, 3.4, 10, 28, Math.PI]} /><meshStandardMaterial {...STEEL} /></mesh>
                  <mesh position={[14, -8, 0]}><cylinderGeometry args={[3.4, 3.4, 16, 12]} /><meshStandardMaterial {...STEEL} /></mesh>
                  <mesh position={[-14, -8, 0]}><cylinderGeometry args={[3.4, 3.4, 16, 12]} /><meshStandardMaterial {...STEEL} /></mesh>
                </group>
              </group>
            </group>
          </Part>

          {/* two certificate authorities in orbit, and the beams that chain them to the lock */}
          <primitive object={orbitLine} />
          {CRYSTALS.map((c, i) => (
            <group key={i} ref={(el) => { crystals.current[i] = el; }} visible={false}>
              <mesh>
                {i === 0 ? <icosahedronGeometry args={[10, 0]} /> : <octahedronGeometry args={[9, 0]} />}
                <meshStandardMaterial {...c.mat} emissive={c.col} emissiveIntensity={0.4} />
              </mesh>
              <Text ref={(t) => { labels.current[i] = t; }} font={FONT} position={[0, 19, 0]} fontSize={5.6} letterSpacing={0.1} color="#111311" fillOpacity={0} anchorX="center" anchorY="middle" renderOrder={10}>{c.label}</Text>
            </group>
          ))}
          {[0, 1].map((i) => (
            <mesh key={i} ref={(m) => { beamMesh.current[i] = m; }} material={beams[i]} visible={false} renderOrder={10}><planeGeometry args={[1, 1]} /></mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
