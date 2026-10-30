import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { gesture } from "../../lib/pointer";
import { net, setHover, slotPos } from "./state";

const FOV = 40;
const MONO = "/fonts/jetbrains-mono-500.ttf";
const PHOS = new THREE.Color("#4ADE80");
const AMBER = new THREE.Color("#F2C94C");
const RED = new THREE.Color("#E5432D");
const DIM = new THREE.Color("#4F6156");
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

class Boundary extends Component {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e) { console.error("Network stage:", e); }
  render() { return this.state.err ? null : this.props.children; }
}

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// The far mesh: a shell of nodes around the hosts, each tied to its two nearest neighbours.
function makeField() {
  const r = rng(11), N = 170, P = [];
  for (let i = 0; i < N; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, rad = 7 + Math.pow(r(), 0.8) * 12, s = Math.sqrt(1 - u * u);
    P.push([rad * s * Math.cos(a) * 1.25, rad * u * 0.62, rad * s * Math.sin(a) * 0.9 - 2]);
  }
  const E = [], seen = new Set();
  for (let i = 0; i < N; i++) {
    const d = [];
    for (let j = 0; j < N; j++) if (j !== i) d.push([(P[i][0] - P[j][0]) ** 2 + (P[i][1] - P[j][1]) ** 2 + (P[i][2] - P[j][2]) ** 2, j]);
    d.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < 2; k++) {
      const j = d[k][1], key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) { seen.add(key); E.push([i, j]); }
    }
  }
  return { P, E };
}

// ------------------------------------------------------------------ shaders
// Every far-mesh vertex is lifted by the same function of its own position, so points, lines and
// packets always agree. uBuild flies the whole thing in from far out; the pointer ray lights it up.
const CHUNK = /* glsl */ `
  uniform float uTime, uBuild, uShow, uPx;
  uniform vec3 uRayO, uRayD;
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  vec3 disp(vec3 p) {
    float s = hash3(p);
    float b = smoothstep(0.0, 1.0, clamp(uBuild * 1.5 - s * 0.5, 0.0, 1.0));
    vec3 q = mix(p * 2.6 + vec3(sin(s * 40.0) * 4.0, cos(s * 30.0) * 4.0, sin(s * 20.0) * 4.0), p, b);
    return q + 0.14 * vec3(sin(uTime * 0.6 + s * 20.0), cos(uTime * 0.5 + s * 17.0), sin(uTime * 0.4 + s * 9.0));
  }
  float glowAt(vec3 wp) { return smoothstep(3.4, 0.0, length(cross(wp - uRayO, uRayD))); }
`;
const POINT_V = /* glsl */ `
  ${CHUNK}
  varying float vGlow, vFog;
  void main() {
    vec3 p = disp(position);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vGlow = glowAt(wp.xyz);
    vec4 mv = viewMatrix * wp;
    gl_PointSize = clamp((0.05 + vGlow * 0.16 + hash3(position) * 0.04) * uPx / max(-mv.z, 0.1), 1.0, 16.0);
    vFog = clamp(1.0 - (-mv.z - 8.0) / 30.0, 0.15, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const POINT_F = /* glsl */ `
  uniform vec3 uCol;
  uniform float uShow;
  varying float vGlow, vFog;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.12, d);
    vec3 col = mix(uCol * 0.6, vec3(0.86, 1.0, 0.9), vGlow);
    gl_FragColor = vec4(col, a * (0.4 + vGlow * 0.6) * vFog * uShow);
    #include <colorspace_fragment>
  }
`;
const LINE_V = /* glsl */ `
  ${CHUNK}
  varying float vGlow, vFog;
  void main() {
    vec3 p = disp(position);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vGlow = glowAt(wp.xyz);
    vec4 mv = viewMatrix * wp;
    vFog = clamp(1.0 - (-mv.z - 8.0) / 30.0, 0.1, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const LINE_F = /* glsl */ `
  uniform vec3 uCol;
  uniform float uShow;
  varying float vGlow, vFog;
  void main() {
    gl_FragColor = vec4(mix(uCol, vec3(0.7, 1.0, 0.8), vGlow * 0.6), (0.07 + vGlow * 0.55) * vFog * uShow);
    #include <colorspace_fragment>
  }
`;
const STREAM_V = /* glsl */ `
  ${CHUNK}
  attribute vec3 aB;
  attribute float aSeed;
  varying float vGlow, vFog;
  void main() {
    float t = fract(uTime * (0.12 + aSeed * 0.2) + aSeed * 9.0);
    vec3 p = mix(disp(position), disp(aB), t);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vGlow = glowAt(wp.xyz);
    vec4 mv = viewMatrix * wp;
    gl_PointSize = clamp((0.09 + vGlow * 0.1) * uPx / max(-mv.z, 0.1), 1.5, 12.0);
    vFog = clamp(1.0 - (-mv.z - 8.0) / 30.0, 0.15, 1.0) * sin(t * 3.14159);
    gl_Position = projectionMatrix * mv;
  }
`;
const STREAM_F = /* glsl */ `
  uniform vec3 uCol;
  uniform float uShow;
  varying float vGlow, vFog;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(uCol, smoothstep(0.5, 0.0, d) * vFog * uShow);
    #include <colorspace_fragment>
  }
`;
const LINK_V = /* glsl */ `
  varying float vU;
  void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const LINK_F = /* glsl */ `
  uniform float uTime, uDraw, uSpeed, uShow, uBase;
  uniform vec3 uCol;
  varying float vU;
  void main() {
    float dash = smoothstep(0.55, 0.95, fract(vU * 14.0 - uTime * uSpeed));
    float a = (uBase + dash * 0.75) * step(vU, uDraw) * uShow;
    gl_FragColor = vec4(uCol, a);
    #include <colorspace_fragment>
  }
`;
const GLOW_V = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const GLOW_F = /* glsl */ `
  uniform vec3 uCol;
  uniform float uA;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2) * uA;
    gl_FragColor = vec4(uCol, a);
    #include <colorspace_fragment>
  }
`;

const mat = (vertexShader, fragmentShader, uniforms, extra = {}) =>
  new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...extra });

// ------------------------------------------------------------------ pieces
function Mesh({ U }) {
  const f = useMemo(() => {
    const { P, E } = makeField();
    const r = rng(3);
    const pts = new THREE.BufferGeometry();
    pts.setAttribute("position", new THREE.Float32BufferAttribute(P.flat(), 3));
    const ln = new THREE.BufferGeometry();
    ln.setAttribute("position", new THREE.Float32BufferAttribute(E.flatMap(([a, b]) => [...P[a], ...P[b]]), 3));
    const sE = E.filter((_, i) => i % 2 === 0).slice(0, 110);
    const st = new THREE.BufferGeometry();
    st.setAttribute("position", new THREE.Float32BufferAttribute(sE.flatMap(([a]) => P[a]), 3));
    st.setAttribute("aB", new THREE.Float32BufferAttribute(sE.flatMap(([, b]) => P[b]), 3));
    st.setAttribute("aSeed", new THREE.Float32BufferAttribute(sE.map(() => r()), 1));
    return {
      pts, ln, st,
      mPts: mat(POINT_V, POINT_F, { ...U, uCol: { value: PHOS } }),
      mLn: mat(LINE_V, LINE_F, { ...U, uCol: { value: PHOS } }),
      mSt: mat(STREAM_V, STREAM_F, { ...U, uCol: { value: AMBER } }),
    };
  }, [U]);
  return (
    <group>
      <lineSegments geometry={f.ln} material={f.mLn} frustumCulled={false} />
      <points geometry={f.pts} material={f.mPts} frustumCulled={false} />
      <points geometry={f.st} material={f.mSt} frustumCulled={false} />
    </group>
  );
}

// The apex: a glowing core in two counter-rotating cages, three tilted orbits with satellites.
function Core({ U }) {
  const cage = useRef(), cage2 = useRef(), rings = useRef([]), sats = useRef([]), glow = useRef();
  const glowMat = useMemo(() => mat(GLOW_V, GLOW_F, { uCol: { value: PHOS }, uA: { value: 0.9 } }), []);
  const iso = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.25, 1)), []);
  const oct = useMemo(() => new THREE.EdgesGeometry(new THREE.OctahedronGeometry(1.9, 0)), []);
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ color: PHOS, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const lineMat2 = useMemo(() => new THREE.LineBasicMaterial({ color: PHOS, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const tilts = useMemo(() => [[1.1, 0.2, 0], [0.4, 0, 1.0], [-0.7, 0.8, 0.3]], []);
  useFrame((state) => {
    const t = state.clock.elapsedTime, b = smooth(0.0, 0.5, U.uBuild.value);
    cage.current.rotation.set(t * 0.31, t * 0.42, 0);
    cage2.current.rotation.set(-t * 0.17, -t * 0.23, t * 0.1);
    const s = b * (1 + Math.sin(t * 2.2) * 0.025);
    cage.current.scale.setScalar(s); cage2.current.scale.setScalar(b);
    glow.current.scale.setScalar(b * 3.8 * (1 + Math.sin(t * 1.6) * 0.04));
    lineMat.opacity = 0.8 * U.uShow.value; lineMat2.opacity = 0.28 * U.uShow.value; glowMat.uniforms.uA.value = 0.75 * U.uShow.value;
    rings.current.forEach((r, i) => { if (r) r.scale.setScalar(b); });
    sats.current.forEach((s2, i) => {
      if (!s2) return;
      const a = t * (0.55 + i * 0.17) + i * 2.1, R = 2.4 + i * 0.5;
      s2.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      s2.scale.setScalar(b);
    });
  });
  return (
    <group>
      <Billboard ref={glow}><mesh material={glowMat}><planeGeometry args={[1, 1]} /></mesh></Billboard>
      <lineSegments ref={cage} geometry={iso} material={lineMat} />
      <lineSegments ref={cage2} geometry={oct} material={lineMat2} />
      <mesh><sphereGeometry args={[0.42, 24, 16]} /><meshBasicMaterial color="#D6FFE3" transparent opacity={0.95} /></mesh>
      {tilts.map((t, i) => (
        <group key={i} rotation={t}>
          <mesh ref={(el) => { rings.current[i] = el; }}><torusGeometry args={[2.4 + i * 0.5, 0.006, 6, 160]} /><meshBasicMaterial color="#4ADE80" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
          <mesh ref={(el) => { sats.current[i] = el; }}><sphereGeometry args={[0.07, 10, 8]} /><meshBasicMaterial color="#F2C94C" /></mesh>
        </group>
      ))}
      <Suspense fallback={null}>
        <Billboard position={[0, -2.9, 0]}>
          <Text font={MONO} fontSize={0.3} color="#FFFFFF" anchorX="center" anchorY="top" outlineWidth={0.03} outlineColor="#03100a">dhanushkarthik.com</Text>
          <Text font={MONO} fontSize={0.17} color="#6E8A76" anchorX="center" anchorY="top" position={[0, -0.42, 0]}>apex · A / AAAA</Text>
        </Billboard>
      </Suspense>
    </group>
  );
}

// One host: a node on the shell, a flowing link to the core, two packets running the round trip at the
// speed the real ping suggests, and a ring that goes off when one lands.
function Host({ k, m, slot, U, label, onSelect }) {
  const P = useMemo(() => V(...slotPos(k, m)), [k, m]);
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(V(), V(P.x * 0.45, P.y * 0.5 + 1.5, P.z * 0.45), P.clone()), [P]);
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 56, 0.016, 5, false), [curve]);
  const ghost = slot.kind === "ghost";
  const linkMat = useMemo(() => mat(LINK_V, LINK_F, { ...U, uDraw: { value: 0 }, uSpeed: { value: ghost ? 0 : 0.9 }, uBase: { value: ghost ? 0.1 : 0.22 }, uCol: { value: ghost ? DIM.clone() : PHOS.clone() } }), [U, ghost]);
  const wire = useMemo(() => new THREE.EdgesGeometry(ghost ? new THREE.BoxGeometry(0.9, 0.9, 0.9) : new THREE.OctahedronGeometry(0.62, 0)), [ghost]);
  const wireMat = useMemo(() => new THREE.LineBasicMaterial({ color: PHOS.clone(), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const faceMat = useMemo(() => new THREE.MeshBasicMaterial({ color: PHOS.clone(), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), []);
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: PHOS.clone() }), []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: PHOS.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), []);
  const glowMat = useMemo(() => mat(GLOW_V, GLOW_F, { uCol: { value: PHOS.clone() }, uA: { value: 0.5 } }), []);
  const node = useRef(), ring = useRef(), pk = useRef([]), body = useRef(), glow = useRef();
  const st = useRef({ pulse: 0, hov: 0, prev: [0, 0], col: PHOS.clone() });

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime, b = U.uBuild.value, s = st.current;
    const pg = net.ping[k], status = ghost ? "ghost" : pg?.status || "checking";
    const target = status === "up" ? PHOS : status === "down" ? RED : status === "checking" ? AMBER : DIM;
    s.col.lerp(target, 1 - Math.exp(-dt * 5));
    wireMat.color.copy(s.col); faceMat.color.copy(s.col); coreMat.color.copy(s.col); ringMat.color.copy(s.col); glowMat.uniforms.uCol.value.copy(s.col);
    linkMat.uniforms.uCol.value.copy(s.col);
    linkMat.uniforms.uDraw.value = smooth(0.18 + k * 0.05, 0.85, b);
    linkMat.uniforms.uSpeed.value = ghost ? 0 : status === "down" ? 0 : 0.9;
    const on = net.sel === k, hov = net.hover === k;
    s.hov += ((on ? 1 : hov ? 0.6 : 0) - s.hov) * (1 - Math.exp(-dt * 8));
    const nb = smooth(0.32 + k * 0.06, 0.95, b) * U.uShow.value;
    node.current.scale.setScalar(Math.max(0.0001, nb) * (1 + s.hov * 0.28));
    body.current.rotation.set(t * 0.5 + k, t * 0.7, 0);
    wireMat.opacity = (ghost ? 0.4 : 0.95) * U.uShow.value; faceMat.opacity = (ghost ? 0.03 : 0.1 + s.hov * 0.12) * U.uShow.value;
    glow.current.scale.setScalar(2.4 + s.hov * 1.2); glowMat.uniforms.uA.value = (ghost ? 0.12 : 0.45 + s.hov * 0.3) * U.uShow.value;

    // packets: apex -> host -> apex. A leg takes longer the slower the real ping is; a down host stalls them
    const ms = pg?.ms ?? 80, leg = clamp(1.3 + ms / 140, 1.4, 4.5);
    pk.current.forEach((p, i) => {
      if (!p) return;
      if (ghost) { p.visible = false; return; }
      const u = ((t / (leg * 2)) + i * 0.5) % 1, x = u * 2;
      let f = x < 1 ? x : 2 - x;
      if (status === "down") f *= 0.5;
      curve.getPoint(smooth(0, 1, f) * 0.999, p.position);
      p.visible = U.uBuild.value > 0.85;
      p.scale.setScalar(0.9 + (status === "checking" ? 0.4 : 0));
      if (i === 0 && x >= 1 && s.prev[0] < 1 && status !== "down") s.pulse = 1;
      if (i === 0) s.prev[0] = x;
    });
    s.pulse = Math.max(0, s.pulse - dt * 0.9);
    ring.current.scale.setScalar(1 + (1 - s.pulse) * 2.8);
    ringMat.opacity = s.pulse * 0.75 * U.uShow.value;
  });

  return (
    <group>
      <mesh geometry={tube} material={linkMat} frustumCulled={false} />
      <group ref={node} position={P}>
        <Billboard ref={glow}><mesh material={glowMat}><planeGeometry args={[1, 1]} /></mesh></Billboard>
        <group ref={body}>
          <lineSegments geometry={wire} material={wireMat} />
          <mesh><octahedronGeometry args={[ghost ? 0.5 : 0.62, 0]} />{<primitive object={faceMat} attach="material" />}</mesh>
          {!ghost && <mesh material={coreMat}><sphereGeometry args={[0.12, 12, 10]} /></mesh>}
        </group>
        <Billboard><mesh ref={ring} material={ringMat}><ringGeometry args={[0.7, 0.74, 64]} /></mesh></Billboard>
        <mesh
          onPointerOver={(e) => { e.stopPropagation(); setHover(k); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { if (net.hover === k) setHover(-1); document.body.style.cursor = ""; }}
          onClick={(e) => { e.stopPropagation(); onSelect(k); }}
        >
          <sphereGeometry args={[1.05, 12, 10]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <Suspense fallback={null}>
          <Billboard position={[0, -1.05, 0]}>
            <Text font={MONO} fontSize={0.17} color={ghost ? "#6E8A76" : "#FFFFFF"} anchorX="center" anchorY="top" outlineWidth={0.025} outlineColor="#03100a">{slot.host}</Text>
            <Text font={MONO} fontSize={0.15} color={ghost ? "#4F6156" : "#F2C94C"} anchorX="center" anchorY="top" position={[0, -0.26, 0]} outlineWidth={0.02} outlineColor="#03100a">{label}</Text>
          </Billboard>
        </Suspense>
      </group>
      {[0, 1].map((i) => (
        <mesh key={i} ref={(el) => { pk.current[i] = el; }} visible={false}><sphereGeometry args={[0.075, 10, 8]} /><meshBasicMaterial color="#F2C94C" /></mesh>
      ))}
    </group>
  );
}

// Drives the shared clock-ish uniforms: build (time, eased toward the arrive gate), the pointer ray, the
// collapse as Contact burns in, and the camera.
function Rig({ slots, U, root }) {
  const { camera, size, gl } = useThree();
  const s = useRef({ pos: V(0, 5, 40), look: V(), build: 0, az: 0.5 });
  const tmp = useMemo(() => ({ a: V(), b: V(), c: V() }), []);
  const m = slots.length;

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05);
    const t = state.clock.elapsedTime, r = s.current;
    const gate = net.arrive > 0.5 ? 1 : 0;
    r.build += clamp(gate - r.build, -dt * 0.9, dt * 0.45);
    const out = smooth(0, 1, net.out);
    U.uTime.value = t; U.uBuild.value = r.build; U.uShow.value = 1 - out * 0.9;
    U.uPx.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan((FOV * Math.PI) / 360));
    root.current.scale.setScalar(1 - out * 0.5);

    // pointer ray for the plexus glow
    const px = state.pointer.x, py = state.pointer.y;
    tmp.b.set(px, py, 0.5).unproject(camera).sub(camera.position).normalize();
    U.uRayO.value.copy(camera.position); U.uRayD.value.copy(tmp.b);

    // camera
    r.az += dt * 0.05;
    const dolly = 1 - smooth(0, 1, r.build);
    let tp = tmp.a, tl = tmp.c;
    if (net.sel < 0) {
      // hand mode: twisting both hands orbits the mesh, pulling them apart moves in
      const a = r.az + px * 0.4 + gesture.twist * 1.3, R = (25 + dolly * 22) * (1 - out * 0.3) * (size.width / size.height < 0.85 ? 1.45 : 1) * (1 - gesture.zoom * 0.32);
      tp.set(Math.sin(a) * R * 0.55 + 1.2, 2.6 + py * 1.3 + dolly * 5, Math.cos(a) * R);
      tl.set(0, 0, 0);
    } else {
      const p = slotPos(net.sel, m);
      const n = Math.hypot(p[0], p[2]) || 1;
      tp.set(p[0] + (p[0] / n) * 7 - (p[2] / n) * 6 + px * 0.9, p[1] + 2.4 + py * 0.6, p[2] + (p[2] / n) * 7 + (p[0] / n) * 6);
      tl.set(p[0] * 0.5, p[1] * 0.5, p[2] * 0.5);
    }
    const k = 1 - Math.exp(-dt * 2.2);
    r.pos.lerp(tp, k); r.look.lerp(tl, k);
    camera.position.copy(r.pos); camera.lookAt(r.look);

    // the scene sits right of the list on wide screens, in the top half on tall ones
    const w = size.width, h = size.height, wide = w / h > 0.85;
    camera.setViewOffset(w, h, wide ? -w * 0.13 : 0, wide ? 0 : h * 0.12, w, h);
  });
  return null;
}

function Scene({ slots, labels, onSelect }) {
  const root = useRef();
  const U = useMemo(() => ({
    uTime: { value: 0 }, uBuild: { value: 0 }, uShow: { value: 1 }, uPx: { value: 600 },
    uRayO: { value: V() }, uRayD: { value: V(0, 0, -1) },
  }), []);
  useEffect(() => () => { document.body.style.cursor = ""; }, []);
  return (
    <>
      <Rig slots={slots} U={U} root={root} />
      <group ref={root}>
        <Mesh U={U} />
        <Core U={U} />
        {slots.map((s, k) => <Host key={`${s.host}-${k}`} k={k} m={slots.length} slot={s} U={U} label={labels[k]} onSelect={onSelect} />)}
      </group>
    </>
  );
}

export default function NetworkStage({ active, slots, labels, onSelect }) {
  return (
    <Boundary>
      <Canvas
        dpr={[1, 2]}
        frameloop={active ? "always" : "never"}
        camera={{ position: [0, 5, 40], fov: FOV, near: 0.1, far: 120 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0, touchAction: "pan-y" }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <Scene slots={slots} labels={labels} onSelect={onSelect} />
      </Canvas>
    </Boundary>
  );
}
