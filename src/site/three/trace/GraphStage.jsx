import { Component, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { pointer, gesture } from "../../lib/pointer";
import { smooth, outCubic, readPalette, clamp, lerp } from "../hero/state";
import { HISTORY, LANES, ROW } from "./history";
import { trace } from "./state";

// Experience and education as a git graph in 3D. The résumé is the history (history.js): lanes are
// branches, commits are nodes, and the camera rides down the graph as the page scrolls. The whole
// edge network is ONE merged tube mesh with a custom shader — each edge fills with light as the
// camera passes it, energy pulses flow up the lanes (time runs upward, like a push), and the
// build-in sweeps up the graph while the section is uncovered from under Skills. Nodes, halos and
// the row hit-areas are instanced. Scroll arrives through `trace` (written by the DOM section),
// so React never re-renders while it runs.

const DISPLAY = "/fonts/archivo-wide-black.ttf";
const MONO = "/fonts/jetbrains-mono-500.ttf";

const { nodes: NODES, edges: EDGES, tips: TIPS, N } = HISTORY;
const LABEL_X = 3.7;     // x of the label column, right of the last lane
const RANGE = 4.6;       // how far from the camera the graph fades out
const MAXE = 64;         // edge slots in the shader's uniform arrays
const FOV = 35;
const TUBE_R = 0.03;
const CAM = { x: 3.2, y: 2.4, z: 12 };

// Additive light on a transparent canvas. Plain additive blending writes alpha 1 under every glow,
// which shows up as a black box; here colour and alpha both just add up.
const ADD = {
  transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
};

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error("[trace stage]", err); }
  render() { return this.state.failed ? null : this.props.children; }
}

// ---- edges: one merged tube geometry ----

// An edge runs from the newer commit (top) to its parent (below). Lane changes bend inside one
// and a half rows: a merge leaves its commit and curves at once, a fork curves into its parent.
function edgeCurve(a, b, bend) {
  const A = new THREE.Vector3(a.x, a.y, a.z);
  const B = new THREE.Vector3(b.x, b.y, b.z);
  if (bend === "none") return new THREE.LineCurve3(A, B);
  const span = A.y - B.y;
  const h = Math.min(span, ROW * 1.5);
  const path = new THREE.CurvePath();
  if (bend === "top") {
    const m = new THREE.Vector3(B.x, A.y - h, B.z);
    path.add(new THREE.CubicBezierCurve3(A, new THREE.Vector3(A.x, A.y - h * 0.6, A.z), new THREE.Vector3(B.x, A.y - h * 0.4, B.z), m));
    if (span - h > 0.001) path.add(new THREE.LineCurve3(m, B));
  } else {
    const m = new THREE.Vector3(A.x, B.y + h, A.z);
    if (span - h > 0.001) path.add(new THREE.LineCurve3(A, m));
    path.add(new THREE.CubicBezierCurve3(m, new THREE.Vector3(A.x, B.y + h * 0.4, A.z), new THREE.Vector3(B.x, B.y + h * 0.6, B.z), B));
  }
  return path;
}

function makeEdgeGeometry(tones) {
  const parts = EDGES.map((e) => {
    const curve = edgeCurve(NODES[e.from], NODES[e.to], e.bend);
    const len = curve.getLength();
    const g = new THREE.TubeGeometry(curve, Math.max(8, Math.round(len * 20)), TUBE_R, 6, false);
    const n = g.attributes.position.count;
    const uv = g.attributes.uv;
    const aS = new Float32Array(n), aLen = new Float32Array(n).fill(len), aEdge = new Float32Array(n).fill(e.id);
    const aColor = new Float32Array(n * 3);
    const c = tones[e.tone];
    for (let i = 0; i < n; i++) {
      aS[i] = uv.getX(i) * len;
      aColor[i * 3] = c.r; aColor[i * 3 + 1] = c.g; aColor[i * 3 + 2] = c.b;
    }
    g.setAttribute("aS", new THREE.BufferAttribute(aS, 1));
    g.setAttribute("aLen", new THREE.BufferAttribute(aLen, 1));
    g.setAttribute("aEdge", new THREE.BufferAttribute(aEdge, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(aColor, 3));
    return g;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return merged;
}

const EDGE_VERT = /* glsl */ `
  uniform float uFill[${MAXE}];
  uniform float uDim[${MAXE}];
  attribute float aS;
  attribute float aLen;
  attribute float aEdge;
  attribute vec3 aColor;
  varying float vS; varying float vLen; varying float vFill; varying float vDim;
  varying float vY; varying vec3 vColor; varying vec3 vN; varying vec3 vV;
  void main() {
    int e = int(aEdge + 0.5);
    vFill = uFill[e]; vDim = uDim[e];
    vS = aS; vLen = aLen; vColor = aColor;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vY = wp.y;
    vec4 mv = viewMatrix * wp;
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const EDGE_FRAG = /* glsl */ `
  uniform float uTime; uniform float uFocus; uniform float uRange; uniform float uBuild;
  varying float vS; varying float vLen; varying float vFill; varying float vDim;
  varying float vY; varying vec3 vColor; varying vec3 vN; varying vec3 vV;
  void main() {
    float t = vS / vLen;
    float core = pow(abs(dot(normalize(vN), normalize(vV))), 1.4);
    // the part of the edge the camera has already passed is lit; a bright head marks the front
    float seen = step(0.001, vFill);
    float passed = (1.0 - smoothstep(vFill - 0.02, vFill + 0.02, t)) * seen;
    float head = exp(-pow((t - vFill) * vLen / 0.32, 2.0)) * seen * (1.0 - step(0.999, vFill));
    // pushes: bands of light travel up the lane, towards the present
    float ph = fract(vS / 2.7 + uTime * 0.3);
    float pulse = smoothstep(0.0, 0.07, ph) * (1.0 - smoothstep(0.07, 0.3, ph));
    float I = (0.2 + 0.8 * passed) * (0.5 + 0.5 * core) + pulse * (0.15 + 0.85 * passed) * 0.9 + head * 1.5;
    I *= mix(0.12, 1.0, vDim);
    float fade = exp(-pow(abs(vY - uFocus) / uRange, 2.0));
    float rev = 1.0 - smoothstep(uBuild - 0.6, uBuild + 0.6, vY);
    I *= (0.06 + 0.94 * fade) * rev;
    vec3 c = vColor * I;
    gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
    #include <colorspace_fragment>
  }
`;

const DUST_VERT = /* glsl */ `
  uniform float uTime; uniform float uFocus; uniform float uPx; uniform float uBuild;
  attribute float aSeed;
  varying float vA;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.2 + aSeed * 40.0) * 0.18;
    p.y += sin(uTime * 0.15 + aSeed * 90.0) * 0.25;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (0.012 + aSeed * 0.02) * uPx / -mv.z;
    float fade = exp(-pow(abs(p.y - uFocus) / 7.0, 2.0));
    vA = fade * (0.25 + 0.75 * aSeed) * (1.0 - smoothstep(uBuild - 0.6, uBuild + 0.6, p.y));
    gl_Position = projectionMatrix * mv;
  }
`;
const DUST_FRAG = /* glsl */ `
  uniform vec3 uColor; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.1, d) * vA * 0.7;
    gl_FragColor = vec4(uColor * a, a);
    #include <colorspace_fragment>
  }
`;

const HALO_VERT = /* glsl */ `
  uniform float uPx;
  attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vColor = aColor; vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPx / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const HALO_FRAG = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.4) * vAlpha;
    gl_FragColor = vec4(vColor * a, a * max(vColor.r, max(vColor.g, vColor.b)));
    #include <colorspace_fragment>
  }
`;

const LEAD_VERT = /* glsl */ `
  attribute vec3 aCol; varying vec3 vC;
  void main() { vC = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const LEAD_FRAG = /* glsl */ `
  varying vec3 vC;
  void main() {
    gl_FragColor = vec4(vC, max(vC.r, max(vC.g, vC.b)));
    #include <colorspace_fragment>
  }
`;

// ---- the graph ----

const SPHERE = new THREE.SphereGeometry(0.1, 20, 14);
const DIAMOND = new THREE.OctahedronGeometry(0.16, 0);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const ARC = new THREE.RingGeometry(0.27, 0.295, 56, 1, 0, Math.PI * 1.55);
const COMMITS = NODES.filter((n) => n.kind === "commit").map((n) => n.i);
const SPECIAL = NODES.filter((n) => n.kind !== "commit").map((n) => n.i);
const rowY = (f) => -f * ROW;

function Graph({ mobile, inset, onHover, onPick }) {
  const { size } = useThree();
  const pal = useMemo(() => readPalette(), []);
  const tones = useMemo(() => ({
    paper: new THREE.Color(pal.paper), phosphor: new THREE.Color(pal.phosphor),
    tape: new THREE.Color(pal.tape), signal: new THREE.Color(pal.signal), blue: new THREE.Color("#6EA8FF"),
  }), [pal]);
  const nodeTone = useMemo(() => NODES.map((n) => tones[LANES[n.lane].tone]), [tones]);

  const edgeGeo = useMemo(() => makeEdgeGeometry(tones), [tones]);
  const edgeMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uFill: { value: new Float32Array(MAXE) }, uDim: { value: new Float32Array(MAXE).fill(1) },
      uTime: { value: 0 }, uFocus: { value: 0 }, uRange: { value: RANGE }, uBuild: { value: -9 },
    },
    vertexShader: EDGE_VERT, fragmentShader: EDGE_FRAG,
    ...ADD,
  }), []);

  const dust = useMemo(() => {
    const n = 650;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    let s = 7;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -3.5 + r() * 13; pos[i * 3 + 1] = 5 - r() * (N * ROW + 8); pos[i * 3 + 2] = -5 + r() * 9;
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFocus: { value: 0 }, uPx: { value: 1 }, uBuild: { value: -9 }, uColor: { value: tones.phosphor.clone() } },
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, ...ADD,
    });
    return { g, m };
  }, [tones]);

  const halo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NODES.flatMap((n) => [n.x, n.y, n.z])), 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(N), 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(N), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(2, -N * ROW / 2, 0), N * ROW);
    const m = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: 1 } }, vertexShader: HALO_VERT, fragmentShader: HALO_FRAG,
      ...ADD,
    });
    return { g, m };
  }, []);

  // leader lines from every node out to its label
  const leaders = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NODES.flatMap((n) => [n.x + 0.16, n.y, n.z, LABEL_X - 0.12, n.y, 0])), 3));
    g.setAttribute("aCol", new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(2, -N * ROW / 2, 0), N * ROW);
    const m = new THREE.ShaderMaterial({
      vertexShader: LEAD_VERT, fragmentShader: LEAD_FRAG, ...ADD,
    });
    return { g, m };
  }, []);

  useEffect(() => () => {
    edgeGeo.dispose(); edgeMat.dispose(); dust.g.dispose(); dust.m.dispose(); halo.g.dispose(); halo.m.dispose(); leaders.g.dispose(); leaders.m.dispose();
  }, [edgeGeo, edgeMat, dust, halo, leaders]);

  const commitsRef = useRef(null), specialRef = useRef(null), hitRef = useRef(null);
  const ringRef = useRef(null), nowRef = useRef(null);
  const subj = useRef([]), meta = useRef([]), badge = useRef([]), place = useRef([]);
  const st = useRef({ f: 0, lit: new Float32Array(N).fill(1), hot: new Float32Array(N), t: 0, built: false });
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const white = useMemo(() => new THREE.Color("#ffffff"), []);

  useFrame(({ clock, camera }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    const t = clock.elapsedTime;
    const px = (size.height * Math.min(window.devicePixelRatio || 1, 2)) / (2 * Math.tan((FOV * Math.PI) / 360));

    // the camera follows the scroll with a little weight
    s.f += (trace.f - s.f) * (1 - Math.exp(-dt * 7));
    const f = s.f;
    const A = outCubic(trace.arrive);
    const i0 = Math.min(N - 1, Math.floor(f)), i1 = Math.min(N - 1, i0 + 1);
    const k = smooth(0, 1, f - i0);
    const fx = lerp(NODES[i0].x, NODES[i1].x, k), fz = lerp(NODES[i0].z, NODES[i1].z, k);
    const yF = rowY(f);
    // the build sweeps up the graph while the section is uncovered
    const build = trace.arrive >= 1 ? 60 : -6 + 11 * A;

    // ---- camera ----
    // Stand far enough back that the lanes and the label column fit the free part of the screen.
    const asp = size.width / size.height;
    const span = mobile ? 4.9 : 8.4;
    const free = mobile ? 0.94 : clamp((size.width - inset - 32) / size.width, 0.4, 1);
    const dist = clamp(span / (free * 2 * Math.tan((FOV * Math.PI) / 360) * asp), 8, 24);
    const away = (1 - A) * 3.2 + trace.out * 2.5;
    const lookX = mobile ? 1.0 : 2.95;
    camera.position.set(lookX + 2.1 + fx * 0.25 + pointer.x * 0.55 + gesture.twist * 2.2, yF + 1.5 + (1 - A) * 2.2 + pointer.y * 0.3, (dist + away) * (1 - gesture.zoom * 0.28));
    camera.lookAt(lookX + fx * 0.25, yF - 0.35, fz * 0.3);
    if (mobile) camera.setViewOffset(size.width, size.height, 0, size.height * 0.1, size.width, size.height);
    else camera.setViewOffset(size.width, size.height, -inset * 0.5, 0, size.width, size.height);
    camera.updateMatrixWorld();

    // ---- which commits are in focus ----
    const tech = trace.tech, filter = trace.filter;
    for (let i = 0; i < N; i++) {
      const n = NODES[i];
      const ok = (filter === "all" || n.group === filter) && (!tech || n.tech.includes(tech));
      s.lit[i] += ((ok ? 1 : 0) - s.lit[i]) * (1 - Math.exp(-dt * 8));
      s.hot[i] += ((trace.hot === i ? 1 : 0) - s.hot[i]) * (1 - Math.exp(-dt * 12));
    }

    // ---- edges ----
    const u = edgeMat.uniforms;
    u.uTime.value = t; u.uFocus.value = yF; u.uBuild.value = build;
    EDGES.forEach((e) => {
      u.uFill.value[e.id] = clamp((f - e.from) / (e.to - e.from));
      u.uDim.value[e.id] = Math.max(s.lit[e.from], s.lit[e.to]);
    });
    dust.m.uniforms.uTime.value = t; dust.m.uniforms.uFocus.value = yF; dust.m.uniforms.uPx.value = px; dust.m.uniforms.uBuild.value = build;
    halo.m.uniforms.uPx.value = px;

    // ---- nodes, halos, leaders, labels ----
    const aCol = halo.g.attributes.aColor, aSize = halo.g.attributes.aSize, aAlpha = halo.g.attributes.aAlpha;
    const lc = leaders.g.attributes.aCol;
    const commitsM = commitsRef.current, specialM = specialRef.current;
    let ci = 0, si = 0;
    for (let i = 0; i < N; i++) {
      const n = NODES[i];
      const d = Math.abs(i - f);
      const sel = Math.exp(-d * d * 1.8);
      const passed = 1 - smooth(f, f + 0.6, i);
      const hot = s.hot[i];
      const lit = s.lit[i];
      const rev = 1 - smooth(build - 0.6, build + 0.6, n.y);
      const fade = Math.exp(-Math.pow((n.y - yF) / RANGE, 2)) * 0.94 + 0.06;
      const bright = ((0.38 + 0.62 * passed) * (0.18 + 0.82 * lit) + sel * 0.45 + hot * 0.3) * rev;
      const sc = (n.kind === "commit" ? 1 : 1.2) * (1 + sel * 0.85 + hot * 0.35) * rev;

      tmp.position.set(n.x, n.y, n.z);
      tmp.rotation.set(0, n.kind === "commit" ? 0 : t * 0.6 + i, n.kind === "commit" ? 0 : t * 0.35);
      tmp.scale.setScalar(Math.max(sc, 0.0001));
      tmp.updateMatrix();
      col.copy(nodeTone[i]).lerp(white, sel * 0.5 + hot * 0.2).multiplyScalar(Math.min(1.25, bright) * (0.35 + 0.65 * fade));
      const m = n.kind === "commit" ? commitsM : specialM;
      const idx = n.kind === "commit" ? ci++ : si++;
      if (m) { m.setMatrixAt(idx, tmp.matrix); m.setColorAt(idx, col); }

      aCol.setXYZ(i, nodeTone[i].r * bright * fade, nodeTone[i].g * bright * fade, nodeTone[i].b * bright * fade);
      aSize.setX(i, (0.3 + 0.62 * sel + 0.25 * hot) * (0.5 + 0.5 * passed) * rev);
      aAlpha.setX(i, 0.55 + 0.45 * sel);

      const lo = fade * rev * (0.12 + 0.88 * lit) * (0.4 + 0.6 * Math.max(sel, passed)) * 0.5;
      const tc = nodeTone[i];
      lc.setXYZ(i * 2, tc.r * lo, tc.g * lo, tc.b * lo);
      lc.setXYZ(i * 2 + 1, tc.r * lo * 0.25, tc.g * lo * 0.25, tc.b * lo * 0.25);

      const base = fade * rev * (0.2 + 0.8 * lit);
      const sj = subj.current[i], mt = meta.current[i], bg = badge.current[i], pl = place.current[i];
      if (pl) pl.position.x = LABEL_X + sel * 0.14 + hot * 0.08;
      const so = base * (0.66 + 0.34 * Math.max(sel, passed)) * (0.8 + 0.2 * sel + 0.2 * hot);
      if (sj) { sj.fillOpacity = Math.min(1, so); sj.visible = so > 0.01; }
      if (mt) { mt.fillOpacity = Math.min(1, base * 0.7); mt.visible = base > 0.01; }
      if (bg) { bg.fillOpacity = Math.min(1, base); bg.visible = base > 0.01; }
    }
    if (commitsM) { commitsM.instanceMatrix.needsUpdate = true; if (commitsM.instanceColor) commitsM.instanceColor.needsUpdate = true; }
    if (specialM) { specialM.instanceMatrix.needsUpdate = true; if (specialM.instanceColor) specialM.instanceColor.needsUpdate = true; }
    aCol.needsUpdate = aSize.needsUpdate = aAlpha.needsUpdate = lc.needsUpdate = true;

    // ---- the cursor: a ring gliding down the graph, and a row bar under it ----
    const ring = ringRef.current;
    if (ring) {
      ring.position.set(fx, yF, fz + 0.05);
      ring.quaternion.copy(camera.quaternion);
      ring.rotateZ(t * 1.1);
      ring.scale.setScalar(0.9 + Math.sin(t * 2.4) * 0.05 + (1 - A) * 0.6);
      ring.visible = A > 0.2;
    }
    const now = nowRef.current;
    if (now) {
      now.position.set(lookX + 0.4, yF, 0);
      now.material.opacity = 0.06 + 0.05 * Math.sin(t * 2);
      now.visible = A > 0.5;
    }
  });

  const hover = (e) => {
    e.stopPropagation();
    if (e.instanceId == null) return;
    onHover(e.instanceId);
  };

  return (
    <>
      <lineSegments geometry={leaders.g} material={leaders.m} frustumCulled={false} />
      <mesh geometry={edgeGeo} material={edgeMat} frustumCulled={false} />
      <points geometry={dust.g} material={dust.m} frustumCulled={false} />
      <points geometry={halo.g} material={halo.m} frustumCulled={false} />

      <instancedMesh ref={commitsRef} args={[SPHERE, undefined, COMMITS.length]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={specialRef} args={[DIAMOND, undefined, SPECIAL.length]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* the row under the cursor: a faint bar, and a ring that rides the graph */}
      <mesh ref={nowRef} geometry={BOX} scale={[8.8, 0.5 * ROW, 0.02]}>
        <meshBasicMaterial color={pal.phosphor} transparent opacity={0.08} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={ringRef} geometry={ARC}>
        <meshBasicMaterial color={pal.phosphor} transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* a hit area per row, from the first lane to the end of the label */}
      <instancedMesh
        ref={(m) => {
          hitRef.current = m;
          if (!m) return;
          NODES.forEach((n, i) => {
            tmp.position.set((-1.7 + LABEL_X + 4.2) / 2, n.y, 0);
            tmp.rotation.set(0, 0, 0);
            tmp.scale.set(LABEL_X + 4.2 + 1.7, ROW * 0.92, 1.8);
            tmp.updateMatrix();
            m.setMatrixAt(i, tmp.matrix);
          });
          m.instanceMatrix.needsUpdate = true;
        }}
        args={[BOX, undefined, N]}
        frustumCulled={false}
        onPointerMove={hover}
        onPointerOut={() => onHover(-1)}
        onClick={(e) => { e.stopPropagation(); if (e.instanceId != null) onPick(e.instanceId); }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>

      {/* lane names at the newest commit of each branch */}
      {Object.entries(TIPS).map(([lane, i]) => {
        const n = NODES[i];
        const c = tones[LANES[lane].tone];
        return (
          <Text key={lane} position={[n.x, n.y + (lane === "edu" ? -0.42 : 0.4), n.z]} font={MONO} fontSize={0.1} color={`#${c.getHexString()}`} anchorX="center" anchorY="middle" outlineWidth={0.012} outlineColor="#07110A">
            {LANES[lane].name}
          </Text>
        );
      })}

      {!mobile && NODES.map((n, i) => (
        <group key={n.id} position={[LABEL_X, n.y, 0]} ref={(g) => { place.current[i] = g; }}>
          {n.refs.length > 0 && (
            <Text ref={(r) => { badge.current[i] = r; }} position={[0, 0.5, 0]} font={MONO} fontSize={0.092} color={n.award ? pal.tape : pal.signal} anchorX="left" anchorY="bottom" whiteSpace="nowrap" fillOpacity={0}>
              {n.refs.map((r) => (n.award || r.startsWith("HEAD") ? `● ${r}` : `◆ ${r}`)).join("   ")}
            </Text>
          )}
          <Text ref={(r) => { meta.current[i] = r; }} position={[0, 0.31, 0]} font={MONO} fontSize={0.1} color={pal.tape} anchorX="left" anchorY="bottom" whiteSpace="nowrap" fillOpacity={0}>
            {`${n.hash}  ${n.when}`}
          </Text>
          <Text ref={(r) => { subj.current[i] = r; }} position={[0, 0.25, 0]} font={MONO} fontSize={0.142} lineHeight={1.12} maxWidth={3.5} color="#ffffff" anchorX="left" anchorY="top" fillOpacity={0}>
            {n.subject}
          </Text>
        </group>
      ))}
    </>
  );
}

export default function GraphStage({ active, mobile, inset, onHover, onPick }) {
  useEffect(() => { trace.active = active; }, [active]);
  return (
    <Boundary>
      <Canvas
        dpr={[1, 2]}
        frameloop={active ? "always" : "never"}
        camera={{ position: [CAM.x, CAM.y, CAM.z], fov: FOV, near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0, touchAction: "pan-y" }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <Graph mobile={mobile} inset={inset} onHover={onHover} onPick={onPick} />
      </Canvas>
    </Boundary>
  );
}
