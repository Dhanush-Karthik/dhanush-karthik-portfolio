import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { jny, advance, finish, setDl } from "./state";
import { buildMask, landDots, frameAt } from "./geo";
import { SITE_S, T, HOLD, getRoute, makeRig, packetAt } from "./route";
import { buildServer, buildIsp, buildDc, buildRoom, pageTexture } from "./models";

const FOV = 38;
const MONO = "/fonts/jetbrains-mono-500.ttf";
const PHOS = new THREE.Color("#4ADE80");
const LIGHT = new THREE.Vector3(0.3, 0.4, -0.8).normalize();
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

class Boundary extends Component {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e) { console.error("Resume stage:", e); }
  render() { return this.state.err ? null : this.props.children; }
}

// ------------------------------------------------------------------ shaders
const GLOBE_V = /* glsl */ `
  varying vec3 vP;
  varying vec3 vV;
  void main() {
    vP = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vV = cameraPosition - wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const GLOBE_F = /* glsl */ `
  uniform sampler2D uLand;
  uniform vec3 uLight, uPhos;
  uniform float uAlt, uTime, uShow;
  varying vec3 vP;
  varying vec3 vV;
  float grid(vec2 g, float step, float w) {
    vec2 q = g / step;
    vec2 d = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2(1e-5));
    return 1.0 - clamp(min(d.x, d.y) / w, 0.0, 1.0);
  }
  void main() {
    vec3 n = normalize(vP);
    float lat = asin(clamp(n.y, -1.0, 1.0));
    float lon = atan(-n.z, n.x);
    vec2 uv = vec2(lon / 6.2831853 + 0.5, lat / 3.1415926 + 0.5);
    float land = texture2D(uLand, uv).r;
    float lit = dot(n, normalize(uLight));
    float day = smoothstep(-0.3, 0.6, lit);
    vec3 sea = mix(vec3(0.004, 0.014, 0.009), vec3(0.009, 0.036, 0.022), day);
    vec3 ground = mix(vec3(0.007, 0.03, 0.017), vec3(0.016, 0.06, 0.032), day);
    vec3 col = mix(sea, ground, land);
    // coastline: a thin glowing contour wherever the mask crosses one half
    float pw = length(vec2(dFdx(land), dFdy(land)));
    float coast = 1.0 - smoothstep(0.0, pw * 1.6 + 0.02, abs(land - 0.5));
    col += uPhos * coast * (0.04 + 0.1 * day);
    // graticules that sharpen as the camera comes down
    vec2 g = vec2(lon, lat) * 57.29578;
    float a15 = grid(g, 15.0, 0.9) * 0.05 * smoothstep(0.25, 1.2, uAlt);
    float a5 = grid(g, 5.0, 0.9) * 0.05 * (1.0 - smoothstep(1.2, 2.2, uAlt)) * smoothstep(0.2, 0.6, uAlt);
    float a1 = grid(g, 1.0, 0.9) * 0.05 * (1.0 - smoothstep(0.35, 0.8, uAlt)) * smoothstep(0.06, 0.2, uAlt);
    float a02 = grid(g, 0.2, 0.9) * 0.08 * (1.0 - smoothstep(0.07, 0.16, uAlt));
    col += uPhos * (a15 + a5 + a1 + a02) * (0.5 + land * 0.6);
    float fr = pow(1.0 - clamp(dot(n, normalize(vV)), 0.0, 1.0), 3.0);
    col += uPhos * fr * 0.1 * smoothstep(0.1, 0.8, uAlt);
    gl_FragColor = vec4(mix(vec3(0.0015, 0.0033, 0.0021), col, uShow), 1.0);
    #include <colorspace_fragment>
  }
`;
const DOT_V = /* glsl */ `
  uniform float uPx;
  uniform vec3 uLight;
  varying float vL;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(0.0175 * uPx / max(-mv.z, 0.01), 1.0, 8.0);
    vL = dot(normalize(position), normalize(uLight));
    gl_Position = projectionMatrix * mv;
  }
`;
const DOT_F = /* glsl */ `
  uniform vec3 uPhos;
  uniform float uAlt, uShow;
  varying float vL;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.25, d) * smoothstep(0.08, 0.7, uAlt) * uShow;
    vec3 c = uPhos * (0.18 + 0.5 * smoothstep(-0.2, 0.7, vL));
    gl_FragColor = vec4(c, a);
    #include <colorspace_fragment>
  }
`;
const ATMO_V = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = cameraPosition - wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const ATMO_F = /* glsl */ `
  uniform vec3 uPhos;
  uniform float uAlt, uShow;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float d = -dot(normalize(vN), normalize(vV));
    float a = pow(clamp(d / 0.34, 0.0, 1.0), 2.2) * 0.55 * smoothstep(0.2, 1.0, uAlt) * uShow;
    gl_FragColor = vec4(uPhos * a, a);
    #include <colorspace_fragment>
  }
`;

// screen-space ribbons: constant pixel width at any zoom, soft edges, pulses along the length
const RIB_V = /* glsl */ `
  uniform float uPx, uW;
  attribute float aSide, aT;
  attribute vec3 aTan;
  varying float vT, vS;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 tv = normalize(mat3(modelViewMatrix) * aTan);
    vec2 sd = length(tv.xy) < 1e-4 ? vec2(1.0, 0.0) : normalize(vec2(-tv.y, tv.x));
    mv.xy += sd * aSide * uW * max(-mv.z, 0.0005) / uPx;
    gl_Position = projectionMatrix * mv;
    vT = aT; vS = aSide;
  }
`;
const RIB_F = /* glsl */ `
  uniform vec3 uCol;
  uniform float uProg, uTime, uDash, uOp, uBase;
  varying float vT, vS;
  void main() {
    float edge = 1.0 - smoothstep(0.2, 1.0, abs(vS));
    float lit = 1.0 - smoothstep(uProg - 0.004, uProg + 0.004, vT);
    float p = fract(vT * uDash - uTime * 0.35);
    float pulse = smoothstep(0.0, 0.05, p) * (1.0 - smoothstep(0.05, 0.4, p));
    float head = exp(-abs(vT - uProg) * 70.0) * step(0.001, uProg) * step(uProg, 0.999);
    vec3 c = uCol * (0.55 + 1.3 * pulse * lit + 1.6 * head);
    float a = edge * (uBase + lit * 0.7 + head * 0.6) * uOp;
    gl_FragColor = vec4(c * a, a);
    #include <colorspace_fragment>
  }
`;
const GLOW_V = /* glsl */ `
  uniform float uDpr;
  attribute float aA, aS;
  varying float vA;
  void main() {
    vA = aA;
    gl_PointSize = aS * uDpr;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const GLOW_F = /* glsl */ `
  uniform vec3 uCol;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = (exp(-d * d * 5.0) * 0.8 + exp(-d * d * 40.0)) * vA;
    gl_FragColor = vec4(mix(uCol, vec3(1.0), exp(-d * d * 30.0) * 0.7) * a, a);
    #include <colorspace_fragment>
  }
`;
const DIS_V = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
// A honeycomb that opens from the bottom: each cell grows a hexagon of the new scene, edged in phosphor.
const DIS_F = /* glsl */ `
  uniform float uP, uTime, uCell;
  uniform vec2 uRes;
  uniform vec3 uCol;
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float hexDist(vec2 p) { p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x); }
  void main() {
    vec2 q = gl_FragCoord.xy / uCell;
    const vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(q, r) - h;
    vec2 b = mod(q - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    vec2 id = q - gv;
    vec2 c = id * uCell / uRes;
    float d0 = (1.0 - c.y) * 0.55 + abs(c.x - 0.5) * 0.25 + hash(id) * 0.2;
    float k = clamp((uP * 1.4 - d0) / 0.34, 0.0, 1.0);
    float ke = k * k * (3.0 - 2.0 * k);
    float R = ke * 0.64;
    float hd = hexDist(gv);
    float rev = (1.0 - smoothstep(R - 0.014, R + 0.014, hd)) * step(0.001, k);
    #ifdef GLOW
      float ring = (1.0 - smoothstep(0.0, 0.05, abs(hd - R))) * step(0.001, k) * (1.0 - smoothstep(0.9, 1.0, k));
      float front = exp(-pow((d0 - (uP * 1.4 - 0.08)) * 9.0, 2.0)) * (1.0 - step(0.995, uP));
      float g = clamp(ring * 0.95 + front * 0.22 * (1.0 - rev), 0.0, 1.0);
      gl_FragColor = vec4(uCol * g, g);
    #else
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - rev);
    #endif
  }
`;

// ------------------------------------------------------------------ pieces
function Stars({ rush }) {
  const geo = useMemo(() => {
    const n = 1400, p = new Float32Array(n * 3);
    let a = 0x9e3779b9;
    const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < n; i++) {
      const z = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z), d = 26 + rnd() * 6;
      p.set([r * Math.cos(th) * d, z * d, r * Math.sin(th) * d], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); return g;
  }, []);
  return <points ref={rush} geometry={geo}><pointsMaterial color="#9DB8A4" size={1.3} sizeAttenuation={false} transparent opacity={0.55} depthWrite={false} /></points>;
}

function Globe({ mask, ticks }) {
  const { gl, size } = useThree();
  const uni = useMemo(() => ({
    land: { uLand: { value: mask.tex }, uLight: { value: LIGHT }, uPhos: { value: PHOS }, uAlt: { value: 3 }, uTime: { value: 0 }, uShow: { value: 0 } },
    dots: { uPx: { value: 600 }, uLight: { value: LIGHT }, uPhos: { value: PHOS }, uAlt: { value: 3 }, uShow: { value: 0 } },
    atmo: { uPhos: { value: PHOS }, uAlt: { value: 3 }, uShow: { value: 0 } },
  }), [mask]);
  const dotGeo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(landDots(1.3), 3)); return g; }, []);
  useEffect(() => {
    const f = (c) => {
      const alt = Math.max(0.0005, c.camera.position.length() - 1);
      const px = (size.height * gl.getPixelRatio()) / (2 * Math.tan((FOV * Math.PI) / 360));
      uni.land.uAlt.value = uni.dots.uAlt.value = uni.atmo.uAlt.value = alt;
      uni.land.uTime.value = c.time; uni.dots.uPx.value = px;
      uni.land.uShow.value = uni.dots.uShow.value = uni.atmo.uShow.value = smooth(0.1, 1.25, c.t);
    };
    ticks.current.push(f);
    return () => { ticks.current = ticks.current.filter((x) => x !== f); };
  }, [ticks, uni, gl, size]);
  return (
    <group>
      <mesh><sphereGeometry args={[1, 160, 112]} /><shaderMaterial vertexShader={GLOBE_V} fragmentShader={GLOBE_F} uniforms={uni.land} /></mesh>
      <points geometry={dotGeo} renderOrder={2}><shaderMaterial vertexShader={DOT_V} fragmentShader={DOT_F} uniforms={uni.dots} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></points>
      <mesh scale={1.07}><sphereGeometry args={[1, 64, 48]} /><shaderMaterial vertexShader={ATMO_V} fragmentShader={ATMO_F} uniforms={uni.atmo} transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} /></mesh>
    </group>
  );
}

function ribbonGeo(pts) {
  const n = pts.length;
  const pos = new Float32Array(n * 6), side = new Float32Array(n * 2), t = new Float32Array(n * 2), tan = new Float32Array(n * 6);
  const idx = [];
  const d = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    d.copy(pts[Math.min(n - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
    for (let s = 0; s < 2; s++) {
      const j = i * 2 + s;
      pos.set([pts[i].x, pts[i].y, pts[i].z], j * 3);
      tan.set([d.x, d.y, d.z], j * 3);
      side[j] = s ? 1 : -1; t[j] = i / (n - 1);
    }
    if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  g.setAttribute("aT", new THREE.BufferAttribute(t, 1));
  g.setAttribute("aTan", new THREE.BufferAttribute(tan, 3));
  g.setIndex(idx);
  return g;
}

function makeRibbon(pts, { color = "#4ADE80", width = 2, dash = 12, base = 0.3 } = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: RIB_V, fragmentShader: RIB_F, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    uniforms: { uCol: { value: new THREE.Color(color) }, uProg: { value: 0 }, uTime: { value: 0 }, uDash: { value: dash }, uOp: { value: 1 }, uBase: { value: base }, uPx: { value: 600 }, uW: { value: width } },
  });
  const mesh = new THREE.Mesh(ribbonGeo(pts), mat);
  mesh.frustumCulled = false; mesh.renderOrder = 5;
  return mesh;
}

function Dissolve({ ticks }) {
  const { size, gl } = useThree();
  const common = useMemo(() => ({ uP: { value: 0 }, uTime: { value: 0 }, uCell: { value: 60 }, uRes: { value: new THREE.Vector2(1, 1) }, uCol: { value: PHOS } }), []);
  const hole = useRef(), glow = useRef();
  useEffect(() => {
    const f = (c) => {
      const dpr = gl.getPixelRatio();
      common.uRes.value.set(size.width * dpr, size.height * dpr);
      common.uCell.value = Math.max(46, size.width / 22) * dpr;
      common.uP.value = jny.arrive; common.uTime.value = c.time;
      const on = jny.arrive < 0.999;
      if (hole.current) hole.current.visible = on;
      if (glow.current) glow.current.visible = on;
    };
    ticks.current.push(f);
    return () => { ticks.current = ticks.current.filter((x) => x !== f); };
  }, [ticks, common, size, gl]);
  return (
    <>
      <mesh ref={hole} renderOrder={9990} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial vertexShader={DIS_V} fragmentShader={DIS_F} uniforms={common} transparent depthTest={false} depthWrite={false}
          blending={THREE.CustomBlending} blendEquation={THREE.AddEquation} blendSrc={THREE.ZeroFactor} blendDst={THREE.OneMinusSrcAlphaFactor} blendSrcAlpha={THREE.ZeroFactor} blendDstAlpha={THREE.OneMinusSrcAlphaFactor} />
      </mesh>
      <mesh ref={glow} renderOrder={9991} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial vertexShader={DIS_V} fragmentShader={DIS_F} defines={{ GLOW: "" }} uniforms={common} transparent depthTest={false} depthWrite={false}
          blending={THREE.CustomBlending} blendEquation={THREE.AddEquation} blendSrc={THREE.OneFactor} blendDst={THREE.OneFactor} blendSrcAlpha={THREE.OneFactor} blendDstAlpha={THREE.OneFactor} />
      </mesh>
    </>
  );
}

// label windows [from, to], seconds since the click. A stop is named only once the packet gets there.
const LABEL_WIN = [
  [[0.9, T.BC[1] + 0.2]],
  [[T.AB[1] - 0.1, T.AB[1] + 3.2]],
  [[T.BC[1] - 0.1, T.BC[1] + 3.2]],
  [[T.sea[1] - 0.1, T.sea[1] + 3.6]],
  [[T.DE[1] - 0.1, T.DE[1] + 3.0]],
  [[T.EH[1] - 0.1, T.EH[1] + 4.6]],
];
// when each building starts to rise out of the ground
const APPEAR = [0.35, T.AB[1] - 0.45, T.BC[1] - 0.45, T.sea[1] - 0.6, T.DE[1] - 0.45, T.EH[0] + 0.05];
const LABEL_Y = [4.8, 9.6, 4.8, 4.8, 9.6, 4.8];
const popOf = (t, at) => {
  const x = clamp((t - at) / 0.65);
  const c1 = 1.9, c3 = c1 + 1;
  return x <= 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const win = (t, ws) => {
  let a = 0;
  for (const [s, e] of ws) a = Math.max(a, smooth(s, s + 0.55, t) * (1 - smooth(e - 0.55, e, t)));
  return a;
};

// ------------------------------------------------------------------ the scene
function Scene({ dest, host, file, onEvent, onDone }) {
  const { gl, camera, size } = useThree();
  const ticks = useRef([]);
  const mask = useMemo(() => buildMask(), []);
  const route = useMemo(() => getRoute(dest, host), [dest, host]);
  const rig = useMemo(() => makeRig(route, size.width / size.height), [route, size.width, size.height]);
  const models = useMemo(() => {
    const m = [buildServer(), buildIsp(), buildDc(), buildDc(), buildIsp(), buildRoom(file)];
    route.sites.forEach((s, i) => {
      const g = m[i].group;
      g.position.copy(s.at(0, 0, 0));
      g.quaternion.setFromRotationMatrix(s.basis);
      g.scale.setScalar(SITE_S);
    });
    return m;
  }, [route, file]);
  const docTex = useMemo(() => pageTexture(file), [file]);

  const longName = route.cable;
  const ribbons = useMemo(() => route.legs.map((l, i) => makeRibbon(l.curve.getPoints(l.long ? 360 : 44), { width: l.long ? 3 : 2.2, dash: l.long ? 30 : 5, base: 0, color: i === 2 ? "#4ADE80" : "#7CF2AA" })), [route]);
  const beams = useMemo(() => [route.sites[0]].map((s) => makeRibbon([s.at(0, 0, 0), s.at(0, 0, 0).addScaledVector(s.up, 0.16)], { width: 1.6, dash: 3, base: 0.55 })), [route]);

  // the packet: a document up close, a glowing point from far away, and a short trail
  const pk = useMemo(() => {
    const group = new THREE.Group();
    const doc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.34), new THREE.MeshBasicMaterial({ map: docTex, side: THREE.DoubleSide, toneMapped: false, transparent: true }));
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1.34)), new THREE.LineBasicMaterial({ color: "#4ADE80", transparent: true }));
    doc.add(frame);
    group.add(doc);
    const N = 56;
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    trailGeo.setAttribute("aA", new THREE.BufferAttribute(new Float32Array(N), 1));
    trailGeo.setAttribute("aS", new THREE.BufferAttribute(new Float32Array(N), 1));
    const mat = new THREE.ShaderMaterial({ vertexShader: GLOW_V, fragmentShader: GLOW_F, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, uniforms: { uCol: { value: PHOS }, uDpr: { value: 1 } } });
    const trail = new THREE.Points(trailGeo, mat);
    trail.frustumCulled = false; trail.renderOrder = 8;
    return { group, doc, frame, trail, N, hist: Array.from({ length: N }, () => new THREE.Vector3()), mat };
  }, [docTex]);

  const refs = useRef({ labels: [], cable: null });
  const st = useRef({ t: -1, press: 0, hover: false, pulse: -1, feed: 0, near: false, recv: 0, print: 0, dl: 0, file });
  const cam = useRef({ init: false, nx: 0, ny: 0, nz: 1, rf: 1, la: 0, el: 0, hd: 0 });
  const tmp = useMemo(() => ({ pkt: { pos: new THREE.Vector3(), tan: new THREE.Vector3(), leg: -1, u: 0 }, shot: {}, n: new THREE.Vector3(), G: new THREE.Vector3(), P: new THREE.Vector3(), L: new THREE.Vector3(), up: new THREE.Vector3(), q: new THREE.Quaternion(), q2: new THREE.Vector3(), sample: 0, downloaded: false, done: false, hist: 0, last: -1 }), []);
  const rush = useRef(null);
  const scene = useThree((x) => x.scene);
  useEffect(() => {
    if (import.meta.env.DEV) window.__rs = { scene, camera, gl, jny, route, models };
  }, [scene, camera, gl, route, models]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const time = state.clock.elapsedTime;
    if (advance(dt, HOLD, T.end) && !tmp.done) { tmp.done = true; finish(); onDone?.(); }
    if (jny.t < 0.2) { tmp.done = false; tmp.downloaded = false; }
    const raw = jny.t;
    if (raw < tmp.last - 1) cam.current.init = false; // replay or cancel: snap back to the opening shot
    tmp.last = raw;
    const tt = Math.max(0, raw);
    const pkt = packetAt(route, tt, tmp.pkt);

    // ---- progress numbers the models and the DOM read
    const s = st.current;
    s.t = raw; s.hover = jny.hover; s.file = file;
    s.press = raw >= 0 ? smooth(0, 0.25, raw) : 0;
    s.feed = raw >= T.print[0] ? clamp((raw - T.print[0]) / (T.print[1] - T.print[0])) : 0;
    s.recv = clamp((raw - T.EH[1]) / (T.toPC[1] - T.EH[1]));
    s.print = s.feed;
    s.dl = raw >= T.print[0] ? clamp((raw - T.print[0]) / (T.print[1] - T.print[0] - 1.2)) : 0;
    if (Math.abs(jny.dl - s.dl) > 0.004) setDl(s.dl);
    if (raw >= T.print[0] && !tmp.downloaded) { tmp.downloaded = true; onEvent("file"); }

    // ---- camera
    const sh = rig(tt, pkt, tmp.shot);
    const c = cam.current;
    const idle = 1 - smooth(0, 0.6, tt);
    const arr = jny.arrive;
    const settle = 1 - smooth(0, 1, arr);
    const tgtHd = sh.hd + Math.sin(time * 0.25) * 0.17 * idle + settle * 0.35;
    const tgtEl = sh.el + Math.sin(time * 0.33) * 0.035 * idle;
    const tgtLa = Math.log(sh.alt) + settle * 0.5;
    if (!c.init) { c.init = true; c.nx = sh.n.x; c.ny = sh.n.y; c.nz = sh.n.z; c.rf = sh.rf; c.la = tgtLa; c.el = tgtEl; c.hd = tgtHd; }
    else {
      const k = 1 - Math.exp(-dt * 11);
      c.nx += (sh.n.x - c.nx) * k; c.ny += (sh.n.y - c.ny) * k; c.nz += (sh.n.z - c.nz) * k;
      c.rf += (sh.rf - c.rf) * k; c.la += (tgtLa - c.la) * k; c.el += (tgtEl - c.el) * k; c.hd += (tgtHd - c.hd) * k;
    }
    tmp.n.set(c.nx, c.ny, c.nz).normalize();
    const f = frameAt(tmp.n);
    const fwd = tmp.up.copy(f.north).multiplyScalar(Math.cos(c.hd)).addScaledVector(f.east, Math.sin(c.hd));
    const alt = Math.exp(c.la);
    tmp.G.copy(tmp.n).multiplyScalar(c.rf);
    tmp.P.copy(tmp.G).addScaledVector(tmp.n, Math.cos(c.el) * alt).addScaledVector(fwd, -Math.sin(c.el) * alt);
    const w = smooth(0.7, 2.4, alt);
    tmp.L.copy(tmp.G).multiplyScalar(1 - w);
    camera.position.copy(tmp.P);
    camera.up.copy(fwd);
    camera.lookAt(tmp.L);
    const near = Math.max(0.0004, alt * 0.03);
    if (Math.abs(camera.near - near) > near * 0.05 || camera.fov !== FOV) {
      camera.near = near; camera.far = 40; camera.fov = FOV;
      camera.updateProjectionMatrix();
    }
    if (rush.current) rush.current.scale.setScalar(0.6 + 0.4 * (1 - Math.pow(1 - clamp(tt / 1.6), 3)));

    // ---- sites
    const hits = [T.AB[0], T.AB[1], T.BC[1], T.sea[1], T.DE[1], T.EH[1]];
    models.forEach((m, i) => {
      s.pulse = raw >= hits[i] ? raw - hits[i] : -1;
      s.near = i === 5 && camera.position.distanceTo(route.sites[5].pos) < 0.5;
      const pop = raw < 0 ? 0 : popOf(raw, APPEAR[i]);
      m.group.visible = pop > 0.002;
      m.group.scale.setScalar(SITE_S * Math.max(0.0001, pop));
      if (m.group.visible) m.tick(time, s);
    });

    // ---- cables
    const px = (size.height * gl.getPixelRatio()) / (2 * Math.tan((FOV * Math.PI) / 360));
    const dpr = gl.getPixelRatio();
    const show = 1;
    ribbons.forEach((r, i) => {
      const leg = route.legs[i];
      const u = raw < leg.win[0] ? 0 : raw >= leg.win[1] ? 1.001 : clamp((raw - leg.win[0]) / (leg.win[1] - leg.win[0]));
      const un = u > 1 ? 1.001 : pkt.leg === i ? pkt.u : u;
      const U = r.material.uniforms;
      U.uProg.value = un; U.uTime.value = time; U.uPx.value = px; U.uOp.value = show;
      U.uW.value = (leg.long ? 3 : 2.2) * dpr;
    });
    beams.forEach((r, i) => {
      const U = r.material.uniforms;
      U.uTime.value = time; U.uPx.value = px; U.uW.value = 1.6 * dpr;
      U.uOp.value = win(tt, [[0.6, T.AB[0] + 0.4]]) * 0.8; U.uProg.value = 1.001;
    });

    // ---- packet
    const dist = camera.position.distanceTo(pkt.pos);
    pk.group.position.copy(pkt.pos);
    const docS = clamp(dist * 0.08, 0.001, 0.0038);
    const docA = 1 - smooth(0.12, 0.34, dist);
    const parked = pkt.leg < 0;
    const gone = raw >= T.toPr[1] || (raw >= T.EH[1] && raw < T.toPr[0] && false);
    pk.doc.scale.setScalar(docS * (parked ? 1 + 0.06 * Math.sin(time * 2) : 1));
    pk.doc.position.y = parked ? Math.sin(time * 1.6) * docS * 0.18 : 0;
    if (parked) { const site = route.sites[0]; pk.doc.quaternion.setFromRotationMatrix(site.basis).multiply(tmp.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), time * 0.9)); }
    else pk.doc.quaternion.copy(camera.quaternion);
    pk.doc.visible = docA > 0.02 && !(raw >= T.toPr[1] - 0.05);
    pk.doc.material.opacity = docA;
    pk.frame.material.opacity = docA;
    pk.group.visible = raw >= 0 && raw < T.toPr[1] + 0.2;
    // trail: a short history of where the packet has been
    tmp.hist += dt;
    if (tmp.hist > 0.028) {
      tmp.hist = 0;
      const h = pk.hist;
      for (let i = pk.N - 1; i > 0; i--) h[i].copy(h[i - 1]);
      h[0].copy(pkt.pos);
    }
    const pos = pk.trail.geometry.attributes.position, aa = pk.trail.geometry.attributes.aA, ss = pk.trail.geometry.attributes.aS;
    const run = raw >= T.AB[0] - 0.05 && raw < T.toPr[1];
    for (let i = 0; i < pk.N; i++) {
      const h = pk.hist[i];
      pos.setXYZ(i, pkt.pos.x + (h.x - pkt.pos.x), pkt.pos.y + (h.y - pkt.pos.y), pkt.pos.z + (h.z - pkt.pos.z));
      const fall = 1 - i / pk.N;
      aa.setX(i, run ? fall * fall * (i === 0 ? 1 : 0.75) : 0);
      ss.setX(i, (i === 0 ? 30 : 4 + 14 * fall) * (parked ? 0 : 1));
    }
    if (parked && raw >= 0) aa.setX(0, 0.85 + 0.15 * Math.sin(time * 5));
    else if (!run) aa.setX(0, 0);
    pos.needsUpdate = aa.needsUpdate = ss.needsUpdate = true;
    pk.mat.uniforms.uDpr.value = dpr;
    // the glow fades to the document when close
    ss.setX(0, 30 * (1 - docA * 0.85) + 6);

    // ---- labels
    const lab = refs.current.labels;
    route.sites.forEach((site, i) => {
      const g = lab[i];
      if (!g) return;
      const a = raw < 0 ? 0 : win(tt, LABEL_WIN[i]);
      g.visible = a > 0.01 && g.children.every((c) => c.userData.ok);
      if (!g.visible) return;
      g.position.copy(site.at(0, LABEL_Y[i], 0));
      g.quaternion.copy(camera.quaternion);
      const sc = Math.max(0.0004, camera.position.distanceTo(g.position) * 0.0165);
      g.scale.setScalar(sc);
      g.children.forEach((t) => { t.fillOpacity = a; t.outlineOpacity = a; });
    });
    const cab = refs.current.cable;
    if (cab) {
      const a = win(tt, [[T.sea[0] + 0.3, T.sea[1] - 0.4]]) * (tt > T.sea[0] ? 1 : 0);
      cab.visible = a > 0.01 && cab.children.every((c) => c.userData.ok);
      if (cab.visible) {
        const curve = route.legs[2].curve;
        cab.position.copy(curve.getPointAt(Math.min(1, Math.max(0.02, pkt.u))));
        cab.position.addScaledVector(cab.position.clone().normalize(), 0.05);
        cab.quaternion.copy(camera.quaternion);
        cab.scale.setScalar(Math.max(0.0004, camera.position.distanceTo(cab.position) * 0.0165));
        cab.children.forEach((t) => { t.fillOpacity = a; t.outlineOpacity = a; });
      }
    }

    // ---- everything that listens
    const ctx = { camera, time, dt, t: tt };
    ticks.current.forEach((fn) => fn(ctx));
  });

  const km = Math.round(route.km);
  // troika text has no bounds until its first sync; drawing it earlier throws in the frustum test
  const sync = (t) => { t.userData.ok = true; };
  return (
    <>
      <color attach="background" args={["#050b07"]} />
      <hemisphereLight args={["#9DD9B0", "#06110a", 0.9]} />
      <directionalLight position={LIGHT.clone().multiplyScalar(5)} intensity={2.2} color="#F4FFF7" />
      <Stars rush={rush} />
      <Globe mask={mask} ticks={ticks} />
      {models.map((m, i) => <primitive key={`m${i}-${route.sites[i].id}`} object={m.group} />)}
      {ribbons.map((r, i) => <primitive key={`r${i}`} object={r} />)}
      {beams.map((r, i) => <primitive key={`b${i}`} object={r} />)}
      <primitive object={pk.group} />
      <primitive object={pk.trail} />
      <Suspense fallback={null}>
        {route.sites.map((s, i) => (
          <group key={`${s.id}-${s.label}`} ref={(el) => { refs.current.labels[i] = el; }} visible={false}>
            <Text onSync={sync} renderOrder={20} font={MONO} fontSize={1} color="#4ADE80" anchorX="center" anchorY="bottom" outlineWidth={0.09} outlineColor="#03100a" depthOffset={-1} material-depthTest={false}>{s.label}</Text>
            <Text onSync={sync} renderOrder={20} font={MONO} fontSize={0.72} color="#9DB8A4" anchorX="center" anchorY="top" position={[0, -0.12, 0]} outlineWidth={0.09} outlineColor="#03100a" material-depthTest={false}>{s.sub}</Text>
          </group>
        ))}
        <group ref={(el) => { refs.current.cable = el; }} visible={false}>
          <Text onSync={sync} renderOrder={20} font={MONO} fontSize={1} color="#F2C94C" anchorX="center" anchorY="bottom" outlineWidth={0.09} outlineColor="#03100a" material-depthTest={false}>{longName}</Text>
          <Text onSync={sync} renderOrder={20} font={MONO} fontSize={0.72} color="#9DB8A4" anchorX="center" anchorY="top" position={[0, -0.12, 0]} outlineWidth={0.09} outlineColor="#03100a" material-depthTest={false}>{`${km.toLocaleString("en-US")} km · ~${Math.max(2, Math.round(route.km / 200 + 4))} ms`}</Text>
        </group>
      </Suspense>
      <Dissolve ticks={ticks} />
    </>
  );
}

export default function ResumeStage({ active, dest, host, file, onEvent, onDone }) {
  const frameloop = active ? "always" : "never";
  return (
    <Boundary>
      <Canvas
        dpr={[1, 2]}
        flat
        frameloop={frameloop}
        camera={{ fov: FOV, near: 0.001, far: 40, position: [0, 0, 5] }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Scene dest={dest} host={host} file={file} onEvent={onEvent} onDone={onDone} />
      </Canvas>
    </Boundary>
  );
}
