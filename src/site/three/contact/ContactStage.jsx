import { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor, Text, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ct, FR, layoutFor } from "./state";
import { FONT, clamp, smooth, nowS } from "./util";
import Certificate from "./Certificate";

class Boundary extends Component {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e) { console.error("Contact stage:", e); this.props.onFail?.(); }
  render() { return this.state.err ? null : this.props.children; }
}

// Everything below is in CSS px, y up, origin at the middle of the stage, camera `P` px away. That keeps the
// fresco, the transmitter and the DOM form on the same numbers.

// ------------------------------------------------------------------ paper that burns in
const PAPER_V = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const PAPER_F = /* glsl */ `
  uniform vec2 uRes, uOrigin;
  uniform float uArrive, uTime, uDpr, uMax;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  void main() {
    vec2 px = gl_FragCoord.xy / uDpr;
    // the same graph paper as the other sheets, with fibres and a soft vignette
    vec3 paper = vec3(0.910, 0.902, 0.882);
    paper = mix(paper, vec3(0.86, 0.84, 0.80), 0.4 * fbm(px * 0.011 + 3.0));
    vec2 q = mod(px, 28.0);
    paper = mix(paper, vec3(0.851, 0.843, 0.820), (step(q.x, 1.0) + step(q.y, 1.0)) * 0.85);
    paper *= 0.965 + 0.07 * fbm(px * 0.9) - 0.02 * h21(px);
    float vg = smoothstep(1.25, 0.25, length((px / uRes - 0.5) * vec2(1.1, 1.0)));
    paper *= mix(0.92, 1.0, vg);

    // burn: a ragged front spreading from the touch point
    float r = uArrive * uMax;
    float n = fbm(px * 0.011 + 11.0) - 0.5;
    float n2 = fbm(px * 0.055) - 0.5;
    float d = length(px - uOrigin) + n * 190.0 * min(1.0, uArrive * 3.0) + n2 * 34.0;
    float edge = d - r;
    float inside = 1.0 - smoothstep(-1.0, 1.6, edge);
    float scorch = smoothstep(-80.0, 0.0, edge) * step(edge, 0.0);
    paper = mix(paper, vec3(0.50, 0.30, 0.13), scorch * (0.55 + n2 * 0.7));
    paper = mix(paper, vec3(0.16, 0.08, 0.03), smoothstep(-14.0, 0.0, edge) * step(edge, 0.0) * 0.7);

    float charA = (1.0 - smoothstep(0.0, 70.0, edge)) * step(0.0, edge) * 0.92 * (0.55 + 0.45 * fbm(px * 0.05 + 5.0));
    vec3 charCol = vec3(0.055, 0.03, 0.015);
    float A = inside + charA * (1.0 - inside);
    vec3 C = (paper * inside + charCol * charA * (1.0 - inside)) / max(A, 1e-4);

    float live = step(0.001, uArrive) * (1.0 - smoothstep(0.96, 1.0, uArrive));
    float rim = exp(-pow(edge / 6.0, 2.0));
    float flick = 0.7 + 0.3 * vn(px * 0.18 + uTime * 3.0);
    vec3 ember = mix(vec3(1.0, 0.30, 0.05), vec3(1.0, 0.88, 0.45), smoothstep(0.4, 1.0, rim * flick));
    float glow = clamp(rim * flick * 1.5 + exp(-pow(edge / 28.0, 2.0)) * 0.3 * flick, 0.0, 1.0) * live;
    C = mix(C, ember, glow);
    A = max(A, glow);
    gl_FragColor = vec4(C, A);
  }
`;

// While the paper is still burning in, the full shader runs. Once it has covered the stage it never changes again,
// so it is rendered once into a texture and drawn as a single textured quad from then on.
const BLIT_F = "uniform sampler2D uMap; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(uMap, vUv).rgb, 1.0); }";
const BLIT_V = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

function Paper() {
  const { size, gl } = useThree();
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: PAPER_V, fragmentShader: PAPER_F, transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uOrigin: { value: new THREE.Vector2() }, uArrive: { value: 0 }, uTime: { value: 0 }, uDpr: { value: 1 }, uMax: { value: 1 } },
  }), []);
  const blit = useMemo(() => new THREE.ShaderMaterial({ vertexShader: BLIT_V, fragmentShader: BLIT_F, uniforms: { uMap: { value: null } }, depthTest: false, depthWrite: false }), []);
  const bakeScene = useMemo(() => {
    const sc = new THREE.Scene(), m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    m.frustumCulled = false; sc.add(m);
    return { sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, [mat]);
  const cache = useRef({ rt: null, key: "" }).current;
  const burn = useRef(), still = useRef();
  useEffect(() => () => { cache.rt?.dispose(); mat.dispose(); blit.dispose(); }, [cache, mat, blit]);

  useFrame((state) => {
    const u = mat.uniforms, w = size.width, h = size.height, L = layoutFor(w, h), dpr = gl.getPixelRatio();
    u.uRes.value.set(w, h);
    u.uOrigin.value.set(w / 2 + L.cp.x, h / 2 + L.cp.y);
    u.uDpr.value = dpr;
    u.uTime.value = state.clock.elapsedTime;
    const far = Math.hypot(Math.max(w / 2 + Math.abs(L.cp.x), w / 2 - L.cp.x), Math.max(h / 2 + L.cp.y, h / 2 - L.cp.y));
    u.uMax.value = (far + 260) * 1.04;
    const done = ct.arrive >= 0.999;
    if (done) {
      const key = `${w}x${h}@${dpr}`;
      if (cache.key !== key) {
        cache.rt?.dispose();
        cache.rt = new THREE.WebGLRenderTarget(Math.round(w * dpr), Math.round(h * dpr), { depthBuffer: false, generateMipmaps: false });
        u.uArrive.value = 1;
        const prev = gl.getRenderTarget();
        gl.setRenderTarget(cache.rt); gl.render(bakeScene.sc, bakeScene.cam); gl.setRenderTarget(prev);
        blit.uniforms.uMap.value = cache.rt.texture;
        cache.key = key;
      }
    } else u.uArrive.value = ct.arrive;
    const showStill = done && cache.key !== "";
    burn.current.visible = !showStill; still.current.visible = showStill;
  });
  return (
    <>
      <mesh ref={burn} material={mat} frustumCulled={false} renderOrder={-10}><planeGeometry args={[2, 2]} /></mesh>
      <mesh ref={still} material={blit} frustumCulled={false} renderOrder={-10} visible={false}><planeGeometry args={[2, 2]} /></mesh>
    </>
  );
}

// ------------------------------------------------------------------ the fresco, torn in two
// Michelangelo's picture is cut along a ragged seam that runs between the two fingertips. Each half is the
// whole picture drawn through its own mask, so the torn edges mate exactly when the halves meet. Near the
// touch the seam is straight, so the hands are never cut. When they meet the seam is mended with gold.
const FRESCO_V = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vW;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xy;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const NOISE = /* glsl */ `
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vn(p); p = p * 2.07 + 11.3; a *= 0.5; } return s; }
  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
`;

// The slow-changing half of the tear (where the seam wanders, how ragged the edge is) and the brush-work relief
// never change, so they are computed once into a half-resolution texture: x = seam offset from the touch column,
// y = edge wobble, zw = luminance gradient. Drawing the fresco then costs a few texture reads instead of dozens
// of noise evaluations per pixel, which is what made this section crawl.
const BAKE_V = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const BAKE_F = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uSize;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 q = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);
    float damp = smoothstep(40.0, 520.0, abs(q.y - ${FR.touch[1]}.0));
    float lean = smoothstep(850.0, 1560.0, q.y) * 270.0;
    float seamLow = lean + ((fbm(vec2(q.y * 0.011, 3.0)) - 0.5) * 150.0 + (fbm(q * 0.02 + 3.0) - 0.5) * 70.0) * damp;
    float edgeLow = (fbm(q * 0.016 + 9.0) - 0.5) * 80.0;
    vec2 px = vec2(1.6) / uSize;
    float gx = lum(texture2D(uMap, vUv + vec2(px.x, 0.0)).rgb) - lum(texture2D(uMap, vUv - vec2(px.x, 0.0)).rgb);
    float gy = lum(texture2D(uMap, vUv + vec2(0.0, px.y)).rgb) - lum(texture2D(uMap, vUv - vec2(0.0, px.y)).rgb);
    gl_FragColor = vec4(seamLow, edgeLow, gx, gy);
  }
`;

const FRESCO_F = /* glsl */ `
  uniform sampler2D uMap, uBake;
  uniform vec2 uSize, uTouch, uCandle;
  uniform float uSide, uMode, uPad, uBlur, uOpacity, uClose, uHeal, uDim, uRip, uTime, uS, uNorm, uView;
  varying vec2 vUv;
  varying vec2 vW;
  ${NOISE}

  // x: signed distance into this half from the seam, y: distance in from the plate edge (px of the picture).
  // B holds the baked low-frequency terms; the fine paper-fibre jitter is added here.
  vec2 field(vec2 q, vec4 B, out float seamLine) {
    float damp = smoothstep(40.0, 520.0, abs(q.y - ${FR.touch[1]}.0));
    seamLine = ${FR.touch[0]}.0 + B.x + ((vn(vec2(q.y * 0.08, 9.0)) - 0.5) * 22.0 + (vn(q * 0.28) - 0.5) * 9.0) * damp;
    float dSeam = (q.x - seamLine) * uSide;
    float eo = B.y + (vn(q * 0.3 + 4.0) - 0.5) * 9.0;
    float dEdge = min(min(q.x, uSize.x - q.x), min(q.y, uSize.y - q.y)) + eo;
    return vec2(dSeam, dEdge);
  }

  void main() {
    vec2 q = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);
    float seamLine;

    if (uMode > 0.5) {
      vec2 uvp = (vUv - 0.5) * uPad + 0.5;
      vec2 qc = vec2(uvp.x * uSize.x, (1.0 - uvp.y) * uSize.y);
      vec2 fs = field(qc, texture2D(uBake, clamp(uvp, 0.0, 1.0)), seamLine);
      gl_FragColor = vec4(0.10, 0.07, 0.04, smoothstep(-uBlur * 0.9, uBlur * 0.9, min(fs.x, fs.y)) * 0.40 * uOpacity);
      return;
    }

    vec4 B = texture2D(uBake, vUv);
    vec2 f = field(q, B, seamLine);
    float d = min(f.x, f.y);
    float aa = length(fwidth(q)) * 0.7 + 0.001;
    float ext = aa * uHeal;
    float alpha = smoothstep(-ext - aa, -ext + aa, d);
    if (alpha < 0.003) discard;

    // the spark of life runs through the picture as a ripple, split a little into colour
    vec2 uv0 = vUv;
    vec3 col;
    if (uRip >= 0.0 && uRip < 6.0) {
      float dd = length(q - uTouch) * uS;
      float rr = uRip * 1100.0;
      float wv = exp(-pow((dd - rr) / 70.0, 2.0)) * exp(-uRip * 1.8);
      vec2 off = normalize(q - uTouch + 0.001) * sin((dd - rr) * 0.09) * wv * 22.0;
      vec2 uvo = vec2(off.x, -off.y) / uSize;
      uv0 = vUv + uvo;
      col = vec3(texture2D(uMap, uv0 + uvo * 0.35).r, texture2D(uMap, uv0).g, texture2D(uMap, uv0 - uvo * 0.35).b);
    } else {
      col = texture2D(uMap, vUv).rgb;
    }

    // candle light that follows the pointer, raking across the cracks and brush work
    vec4 G = uv0 == vUv ? B : texture2D(uBake, uv0);
    vec3 n = normalize(vec3(-G.z * uNorm, -G.w * uNorm, 1.0));
    vec3 Ld = normalize(vec3(uCandle - vW, 240.0));
    float cd = length(uCandle - vW) / uView;
    float lit = exp(-cd * cd * 1.1);
    col *= 0.84 + 0.20 * lit + (dot(n, Ld) - Ld.z) * 1.7 * (0.35 + lit);
    col *= mix(vec3(1.0), vec3(1.07, 1.0, 0.90), lit * 0.7);

    // torn paper rim: pale fibres, a darker line just inside. The seam rim mends away when the halves meet
    float rimSeam = (1.0 - smoothstep(0.0, 24.0, f.x)) * (1.0 - uHeal);
    float rimEdge = 1.0 - smoothstep(0.0, 22.0, f.y);
    float rim = max(rimSeam, rimEdge);
    vec3 fibre = vec3(0.968, 0.958, 0.93) * (0.90 + 0.12 * vn(q * vec2(0.9, 0.35)));
    col = mix(col, fibre, rim * 0.92);
    float dm = min(mix(f.x, 1e3, uHeal), f.y);
    col *= 1.0 - 0.22 * exp(-pow((dm - 25.0) / 4.5, 2.0));

    // as the halves close in, the torn seam starts to glow
    float flick = 0.7 + 0.3 * vn(vec2(q.y * 0.05, uTime * 4.0));
    col = mix(col, vec3(1.0, 0.80, 0.30), rimSeam * uClose * 0.8 * flick);
    col += vec3(1.0, 0.58, 0.14) * exp(-pow(f.x / 12.0, 2.0)) * uClose * 0.6 * flick * (1.0 - uHeal);

    // the mended seam: gold poured along the crack, running out from the touch
    if (uRip >= 0.0) {
      float tY = abs(q.y - uTouch.y) * uS;
      float front = uRip * 1500.0;
      float on = smoothstep(front, front - 160.0, tY);
      float fade = 0.30 + 0.70 * exp(-uRip * 0.7);
      float sh = 0.65 + 0.35 * vn(vec2(q.y * 0.04, uTime * 3.0));
      float core = exp(-pow(f.x / 4.5, 2.0));
      float bloom = exp(-pow(f.x / 34.0, 2.0));
      col = mix(col, vec3(1.0, 0.82, 0.32), core * on * sh * 0.95 * fade);
      col += vec3(0.9, 0.55, 0.12) * bloom * on * 0.22 * fade;
      col += vec3(1.0, 0.9, 0.55) * exp(-pow((tY - front) / 26.0, 2.0)) * exp(-pow(f.x / 40.0, 2.0)) * 0.6 * exp(-uRip);
    }

    // once the certificate arrives the picture steps back
    col = mix(col, mix(col, vec3(0.92, 0.89, 0.82), 0.6), uDim);
    col += (h21(gl_FragCoord.xy) - 0.5) * 0.02;
    gl_FragColor = vec4(col, alpha * uOpacity);
  }
`;

const PAD = 1.3;

function Fresco() {
  const { size, gl } = useThree();
  const tex = useTexture(FR.src);
  useMemo(() => { tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy()); tex.needsUpdate = true; }, [tex, gl]);
  const bake = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(Math.round(FR.w / 2), Math.round(FR.h / 2), { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false });
    const mat = new THREE.ShaderMaterial({ vertexShader: BAKE_V, fragmentShader: BAKE_F, uniforms: { uMap: { value: tex }, uSize: { value: new THREE.Vector2(FR.w, FR.h) } }, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
    const scene = new THREE.Scene(); scene.add(quad);
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(rt); gl.render(scene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)); gl.setRenderTarget(prev);
    mat.dispose(); quad.geometry.dispose();
    return rt;
  }, [tex, gl]);
  useEffect(() => () => bake.dispose(), [bake]);
  const parts = useMemo(() => [-1, 1].map((side) => {
    const shared = {
      uMap: { value: tex }, uBake: { value: bake.texture }, uSize: { value: new THREE.Vector2(FR.w, FR.h) }, uSide: { value: side }, uOpacity: { value: 0 },
      uClose: { value: 0 }, uHeal: { value: 0 }, uDim: { value: 0 }, uRip: { value: -1 }, uTime: { value: 0 }, uS: { value: 1 },
      uNorm: { value: 7 }, uView: { value: 520 }, uTouch: { value: new THREE.Vector2(FR.touch[0], FR.touch[1]) }, uCandle: { value: new THREE.Vector2() },
    };
    const mk = (mode, extra) => new THREE.ShaderMaterial({
      vertexShader: FRESCO_V, fragmentShader: FRESCO_F, transparent: true, depthTest: false, depthWrite: false,
      uniforms: { ...shared, uMode: { value: mode }, uPad: { value: PAD }, uBlur: { value: 30 }, ...extra },
    });
    return { img: mk(0), shadow: mk(1), shared };
  }), [tex, bake]);
  const grp = useRef([]), shad = useRef([]), img = useRef([]);
  const candle = useRef({ x: 0, y: 0 });

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05);
    const t = state.clock.elapsedTime, w = size.width, h = size.height, L = layoutFor(w, h), s = L.s;
    const m = clamp(ct.meet), e = 1 - Math.pow(1 - m, 2.4), show = smooth(0.84, 1, ct.arrive);
    const heal = smooth(0.9, 1, m), close = smooth(0.55, 0.98, m) * (1 - heal);
    const rip = ct.touchAt < 0 ? -1 : nowS() - ct.touchAt;
    const px = state.pointer.x, py = state.pointer.y;
    const k = 1 - Math.exp(-dt * 6);
    candle.current.x += (px * w * 0.5 - candle.current.x) * k;
    candle.current.y += (py * h * 0.5 - candle.current.y) * k;
    const travel = L.portrait ? [-w * 0.95, w * 1.0] : [-w * 0.27, w * 0.38];
    const dim = smooth(0, 0.9, ct.cardT) * 0.8;

    parts.forEach((P, i) => {
      const g = grp.current[i], sm = shad.current[i], im = img.current[i];
      if (!g || !sm || !im) return;
      const apart = 1 - e;
      const bob = Math.sin(t * 0.9 + i * 2.1) * (1.5 + apart * 5);
      const dx = apart * travel[i];
      const dy = apart * h * (i === 0 ? -0.09 : 0.11) + bob;
      const rz = apart * (i === 0 ? 0.13 : -0.10);
      const ry = apart * (i === 0 ? 0.35 : -0.3) + px * 0.05 * (0.3 + e);
      const rx = -py * 0.04 * (0.3 + e) + apart * (i === 0 ? 0.08 : -0.06);
      const z = apart * (i === 0 ? -90 : 130);
      g.position.set(L.cp.x + dx, L.cp.y + dy, z);
      g.rotation.set(rx, ry, rz);
      g.scale.setScalar(s);
      g.visible = show > 0.001;

      const lift = apart + 0.35;
      im.position.set(FR.w / 2 - FR.touch[0], FR.touch[1] - FR.h / 2, 0);
      sm.position.set(FR.w / 2 - FR.touch[0] + (6 + 34 * lift) / s, FR.touch[1] - FR.h / 2 - (10 + 48 * lift) / s, -2);
      P.shadow.uniforms.uBlur.value = (6 + 28 * lift) / s * 1.6;

      const u = P.shared;
      u.uOpacity.value = show;
      u.uClose.value = close; u.uHeal.value = heal; u.uDim.value = dim; u.uRip.value = rip;
      u.uTime.value = t; u.uS.value = s;
      u.uCandle.value.set(candle.current.x, candle.current.y);
      u.uView.value = Math.max(320, w * 0.4);

      // the fingertips, in stage px, for the arcs
      const tip = i === 0 ? FR.tipA : FR.tipG;
      const lx = (tip[0] - FR.touch[0]) * s, ly = -(tip[1] - FR.touch[1]) * s, c = Math.cos(rz), sn = Math.sin(rz);
      ct.tip[i].set(L.cp.x + dx + lx * c - ly * sn, L.cp.y + dy + lx * sn + ly * c);
    });
  });

  return (
    <>
      {parts.map((P, i) => (
        <group key={i} ref={(el) => { grp.current[i] = el; }}>
          <mesh ref={(el) => { shad.current[i] = el; }} material={P.shadow} renderOrder={2} frustumCulled={false}><planeGeometry args={[FR.w * PAD, FR.h * PAD]} /></mesh>
          <mesh ref={(el) => { img.current[i] = el; }} material={P.img} renderOrder={3 + i} frustumCulled={false}><planeGeometry args={[FR.w, FR.h]} /></mesh>
        </group>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ gold motes drifting up through the stage
function Motes() {
  const { size, gl } = useThree();
  const { geo, mat } = useMemo(() => {
    const n = 170, a = new Float32Array(n * 4);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < n; i++) a.set([rnd(), rnd(), rnd(), 0.4 + rnd() * 1.2], i * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aR", new THREE.BufferAttribute(a, 4));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uAmt: { value: 0 }, uPx: { value: 1 }, uBurst: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec4 aR;
        uniform vec2 uRes;
        uniform float uTime, uAmt, uPx, uBurst;
        varying float vA;
        void main() {
          float t = uTime * aR.w * 0.028;
          vec2 p = vec2(fract(aR.x + sin(uTime * 0.2 * aR.w + aR.z * 6.28) * 0.02), fract(aR.y + t));
          vec2 xy = (p - 0.5) * uRes;
          gl_Position = projectionMatrix * viewMatrix * vec4(xy, 40.0, 1.0);
          float tw = 0.5 + 0.5 * sin(uTime * (1.0 + aR.z * 3.0) + aR.z * 40.0);
          gl_PointSize = (2.0 + 5.0 * aR.z) * uPx * (0.6 + 0.8 * tw) * (0.55 + uBurst * 0.8);
          vA = uAmt * smoothstep(0.0, 0.1, p.y) * (1.0 - smoothstep(0.85, 1.0, p.y)) * (0.35 + 0.65 * tw);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.05, d);
          gl_FragColor = vec4(mix(vec3(0.93, 0.62, 0.10), vec3(1.0, 0.86, 0.45), smoothstep(0.3, 0.0, d)), a * vA);
        }
      `,
    });
    return { geo: g, mat: m };
  }, []);
  useFrame((state) => {
    const u = mat.uniforms, rip = ct.touchAt < 0 ? 99 : nowS() - ct.touchAt;
    u.uRes.value.set(size.width, size.height);
    u.uTime.value = state.clock.elapsedTime;
    u.uPx.value = gl.getPixelRatio();
    u.uBurst.value = rip < 6 ? Math.exp(-rip * 0.6) : 0;
    u.uAmt.value = smooth(0.9, 1, ct.arrive) * (0.18 + 0.5 * smooth(0.4, 1, ct.meet) + 0.5 * u.uBurst.value);
  });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={4} />;
}

// ------------------------------------------------------------------ the touch: arcs, flash, rays, confetti
const FLASH_F = /* glsl */ `
  uniform float uT;
  varying vec2 vUv;
  void main() {
    if (uT < 0.0) discard;
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p), ang = atan(p.y, p.x), t = uT;
    float core = exp(-r * r * 46.0) * exp(-t * 5.0);
    float rays = pow(abs(cos(ang * 9.0 + sin(ang * 5.0) * 1.3)), 18.0) * smoothstep(1.0, 0.04, r) * exp(-t * 3.4) * smoothstep(0.0, 0.03, t);
    float rr = t * 1.3;
    float ring = exp(-pow((r - rr) / 0.03, 2.0)) * exp(-t * 1.9);
    float ring2 = exp(-pow((r - rr * 0.68) / 0.018, 2.0)) * exp(-t * 2.6) * 0.7;
    vec3 gold = vec3(0.95, 0.73, 0.12), red = vec3(0.90, 0.26, 0.17), ink = vec3(0.07, 0.07, 0.07);
    float a0 = clamp(core * 0.95, 0.0, 1.0), a1 = clamp(rays * 0.62, 0.0, 1.0), a2 = clamp(ring * 0.4, 0.0, 1.0), a3 = clamp(ring2 * 0.8, 0.0, 1.0);
    float a = 1.0 - (1.0 - a0) * (1.0 - a1) * (1.0 - a2) * (1.0 - a3);
    if (a < 0.003) discard;
    vec3 col = (gold * a0 + red * a1 + ink * a2 + red * a3) / max(a0 + a1 + a2 + a3, 1e-4);
    gl_FragColor = vec4(col, a);
  }
`;
const CONFETTI = ["#E5432D", "#111311", "#F2C94C", "#2F8F55", "#E5432D", "#F2C94C"];
const NC = 120;

function Burst() {
  const flash = useRef(), inst = useRef();
  const fm = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: FLASH_F, transparent: true, depthTest: false, depthWrite: false, uniforms: { uT: { value: -1 } },
  }), []);
  const st = useMemo(() => ({ x: new Float32Array(NC), y: new Float32Array(NC), vx: new Float32Array(NC), vy: new Float32Array(NC), rot: new Float32Array(NC), spin: new Float32Array(NC), flip: new Float32Array(NC), sz: new Float32Array(NC), t0: -1, ft0: -1 }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const c = new THREE.Color();
    for (let i = 0; i < NC; i++) inst.current.setColorAt(i, c.set(CONFETTI[i % CONFETTI.length]));
    inst.current.instanceColor.needsUpdate = true;
    ct.fire = (x, y, power = 1, withFlash = true) => {
      const t = nowS();
      st.t0 = t;
      if (withFlash) { st.ft0 = t; flash.current.position.set(x, y, 20); }
      for (let i = 0; i < NC; i++) {
        const a = Math.random() * Math.PI * 2, v = (180 + Math.random() * 760) * power;
        st.x[i] = x; st.y[i] = y; st.vx[i] = Math.cos(a) * v; st.vy[i] = Math.sin(a) * v + 140 * power;
        st.rot[i] = Math.random() * 6.28; st.spin[i] = (Math.random() - 0.5) * 14; st.flip[i] = 3 + Math.random() * 8; st.sz[i] = 6 + Math.random() * 9;
      }
    };
    return () => { ct.fire = null; };
  }, [st]);

  useFrame((_, dt) => {
    const t = nowS();
    fm.uniforms.uT.value = st.ft0 < 0 ? -1 : t - st.ft0 > 2.2 ? -1 : t - st.ft0;
    const age = st.t0 < 0 ? 99 : t - st.t0;
    inst.current.visible = age < 2.6;
    if (!inst.current.visible) return;
    dt = Math.min(dt, 0.05);
    const k = Math.exp(-dt * 1.6);
    for (let i = 0; i < NC; i++) {
      st.vx[i] *= k; st.vy[i] = st.vy[i] * k - 900 * dt;
      st.x[i] += st.vx[i] * dt; st.y[i] += st.vy[i] * dt; st.rot[i] += st.spin[i] * dt;
      const life = 1 - smooth(1.5, 2.6, age);
      dummy.position.set(st.x[i], st.y[i], 80);
      dummy.rotation.set(0, 0, st.rot[i]);
      dummy.scale.set(st.sz[i] * life, st.sz[i] * 1.7 * life * Math.abs(Math.cos(age * st.flip[i] + i)), 1);
      dummy.updateMatrix();
      inst.current.setMatrixAt(i, dummy.matrix);
    }
    inst.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh ref={flash} material={fm} renderOrder={12} frustumCulled={false}><planeGeometry args={[2200, 2200]} /></mesh>
      <instancedMesh ref={inst} args={[null, null, NC]} renderOrder={13} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial side={THREE.DoubleSide} depthTest={false} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

// Crackling arcs between the fingertips as they close in.
function Arcs() {
  const lines = useMemo(() => [0, 1, 2].map((i) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(28 * 3), 3));
    const m = new THREE.LineBasicMaterial({ color: i === 0 ? "#E5432D" : "#F2C94C", transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const l = new THREE.Line(g, m); l.renderOrder = 8; l.frustumCulled = false;
    return l;
  }), []);
  useFrame((state) => {
    const A = ct.tip[0], B = ct.tip[1], close = smooth(0.84, 0.995, ct.meet) * (1 - smooth(0, 0.3, ct.cardT));
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const tick = Math.floor(state.clock.elapsedTime * 24);
    lines.forEach((l, li) => {
      l.material.opacity = close * (0.6 + 0.4 * Math.sin(tick * 1.7 + li)) * smooth(0.0, 1, ct.arrive);
      if (close <= 0.001) return;
      const pos = l.geometry.attributes.position;
      for (let i = 0; i < 28; i++) {
        const f = i / 27, env = Math.sin(f * Math.PI);
        const j = (Math.sin(tick * 12.9898 + i * 78.233 + li * 37.7) * 43758.5453 % 1) * 2 - 1;
        const o = j * env * (14 + (1 - close) * 30);
        pos.setXYZ(i, A.x + dx * f + nx * o, A.y + dy * f + ny * o, 25);
      }
      pos.needsUpdate = true;
    });
  });
  return <>{lines.map((l, i) => <primitive key={i} object={l} />)}</>;
}

// ------------------------------------------------------------------ title, in the gap between the halves
function Title() {
  const { size } = useThree();
  const ref = useRef();
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const L = layoutFor(size.width, size.height);
    m.position.set(L.portrait ? 0 : L.cp.x + size.width * 0.055, L.portrait ? size.height * 0.3 : size.height * 0.04, -5);
    m.fillOpacity = 0;
    m.strokeOpacity = smooth(0.86, 1, ct.arrive) * (1 - smooth(0.3, 0.75, ct.meet));
  });
  const w = size.width, h = size.height, portrait = w / h < 0.85, fs = portrait ? w * 0.15 : Math.min(w * 0.09, h * 0.2);
  return (
    <Text ref={ref} font={FONT} fontSize={fs} maxWidth={portrait ? w * 0.94 : fs * 6} textAlign="center" lineHeight={0.95} anchorX="center" anchorY="middle" letterSpacing={-0.03} strokeWidth={Math.max(1.2, fs * 0.012)} strokeColor="#111311" renderOrder={1} material-depthTest={false}>
      {"LET'S\nCONNECT"}
    </Text>
  );
}

// ------------------------------------------------------------------ rig + scene
function Rig() {
  const { camera, size } = useThree();
  useFrame(() => {
    const P = size.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
    if (Math.abs(camera.position.z - P) > 0.01) {
      camera.position.set(0, 0, P);
      camera.near = P * 0.2; camera.far = P * 6;
      camera.updateProjectionMatrix();
    }
    ct.P = P;
  });
  return null;
}

// Reflections for the gold and the anodised metal, from three's own procedural room (no HDR download).
function Env() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl), room = new RoomEnvironment(), rt = pm.fromScene(room, 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.85;
    return () => { scene.environment = null; rt.dispose(); pm.dispose(); room.dispose(); };
  }, [gl, scene]);
  return null;
}

function Spark() {
  const armed = useRef(true);
  const { size } = useThree();
  useFrame(() => {
    if (ct.meet >= 0.995 && armed.current && ct.sentAt < 0) {
      armed.current = false;
      const L = layoutFor(size.width, size.height);
      ct.touchAt = nowS();
      ct.fire?.(L.cp.x, L.cp.y, 1, true);
    } else if (ct.meet < 0.9) { armed.current = true; ct.touchAt = -1; }
  });
  return null;
}

function Scene({ onDecline }) {
  return (
    <>
      <Rig />
      <Env />
      <PerformanceMonitor onDecline={onDecline} />
      <Paper />
      <Suspense fallback={null}>
        <Title />
        <Fresco />
      </Suspense>
      <Motes />
      <Arcs />
      <ambientLight intensity={0.7} />
      <directionalLight position={[-300, 520, 700]} intensity={1.5} />
      <Certificate />
      <Burst />
      <Spark />
    </>
  );
}

export default function ContactStage({ active, onFail }) {
  const [dpr, setDpr] = useState(2);
  useEffect(() => { ct.active = active; }, [active]);
  return (
    <Boundary onFail={onFail}>
      <Canvas
        flat
        dpr={[1, dpr]}
        frameloop={active ? "always" : "never"}
        camera={{ position: [0, 0, 1400], fov: 30, near: 200, far: 9000 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <Scene onDecline={() => setDpr(1)} />
      </Canvas>
    </Boundary>
  );
}
