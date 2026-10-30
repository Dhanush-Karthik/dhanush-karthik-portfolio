import { Component, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { pointer, gesture } from "../../lib/pointer";
import { smooth, readPalette, clamp } from "../hero/state";
import { deploy, setHot, setActive } from "./state";
import { CW, CH, makeFace, makeCardMaterial, cardGeometry } from "./card";
import { MOTIF_W, MOTIF_H, makeMotif } from "./motifs";

// Projects as a fan of cards, all of it in WebGL. Cards drop in from above the screen and land on
// the arc; pick one and it lifts out to the left while its spec sheet is set in 3D beside it.
//
// The three feature doing the work is render-to-texture: every card's window is a live model (see
// motifs.js), drawn into that card's own WebGLRenderTarget each frame and sampled by the card
// shader, which also turns the plane into flexing paper while it falls, rounds the corners with an
// SDF, adds a cursor-driven foil band and draws a patterned back for the tumble. Impact puffs are
// one shader-driven Points object, the soft shadows are shader quads. Scroll and selection arrive
// through `deploy` (written by the DOM section), so React does not re-render while it runs.

const DISPLAY = "/fonts/archivo-wide-black.ttf";
const MONO = "/fonts/jetbrains-mono-500.ttf";
const FOV = 36;
const MAXC = 12;
const DUST_PER = 12;
const noRay = () => null;

// the drop: each card falls for FALL_D seconds, LAND of that is the fall, the rest the bounce
const FALL_D = 0.95;
const STAG = 0.13;
const LAND = 0.62;

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error("[deploy stage]", err); }
  render() { return this.state.failed ? null : this.props.children; }
}

// ---- layout (world units; the camera is fitted so these always fit the screen) ----
function makeLayout(aspect, n) {
  const mobile = aspect < 0.85;
  const t = Math.tan((FOV * Math.PI) / 360);
  const halfW = mobile ? 2.1 : 5.3;
  const halfH = mobile ? 4.4 : 3.3;
  const dist = Math.max(halfW / (t * aspect), halfH / t);
  if (mobile) {
    return {
      mobile, dist, R: 5.2, STEP: 0.36, scale: 0.95, arcY: 0.05, titleY: 2.35, titleFs: 0.85, titleX: 0,
      selPos: [0, 1.75, 1], selScale: 0.66,
      shelf: (j, m) => ({ x: (j - (m - 1) / 2) * 0.74, y: -4.05, z: 0.4 + j * 0.01, s: 0.36, rz: (j - (m - 1) / 2) * -0.05 }),
      px: -1.9, top: 0.72, W: 3.8, cols: 1, col2X: 0, W2: 0, fs: 0.14, titleSize: 0.26, maxBullets: 3, maxChips: 5,
    };
  }
  const STEP = Math.min(0.215, 1.3 / Math.max(1, n - 1));
  return {
    mobile, dist, R: 7.5, STEP, scale: 0.96, arcY: -0.35, titleY: 1.35, titleFs: 1.55, titleX: 0,
    selPos: [-3.3, -0.12, 1], selScale: 1.38,
    shelf: (j, m) => ({ x: -4.55 + j * (m > 1 ? 2.6 / (m - 1) : 0), y: -2.72, z: 0.4 + j * 0.01, s: 0.4, rz: (j - (m - 1) / 2) * -0.05 }),
    px: -1.55, top: 2.1, W: 4.15, cols: 2, col2X: 4.5, W2: 2.15, fs: 0.125, titleSize: 0.3, maxBullets: 3, maxChips: 8,
  };
}

// ---- shaders for the dust puffs and the soft shadows ----
const DUST_VERT = /* glsl */ `
  uniform float uLand[${MAXC}];
  uniform vec3 uBase[${MAXC}];
  uniform float uPx;
  attribute float aCard;
  attribute vec3 aDir;
  attribute float aRnd;
  varying float vA;
  void main() {
    int c = int(aCard + 0.5);
    float t = uLand[c];
    float e = 1.0 - exp(-max(t, 0.0) * 3.2);
    vec3 p = uBase[c] + aDir * (0.25 + aRnd * 0.95) * e;
    p.y += e * 0.18 - max(t, 0.0) * 0.2;
    vA = step(0.0, t) * smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.3, 1.1, t));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPx * (0.07 + aRnd * 0.11) * (1.0 + max(t, 0.0) * 1.8) / -mv.z;
  }
`;
const DUST_FRAG = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.12, 0.5, d)) * vA * 0.3;
    if (a < 0.003) discard;
    gl_FragColor = vec4(0.07, 0.075, 0.07, a);
    #include <colorspace_fragment>
  }
`;
const SHADOW_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SHADOW_FRAG = /* glsl */ `
  uniform float uA;
  uniform vec2 uSize;
  varying vec2 vUv;
  float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float d = sdRound(p, vec2(${(CW / 2).toFixed(3)}, ${(CH / 2).toFixed(3)}), 0.11);
    float a = (1.0 - smoothstep(-0.1, 0.34, d)) * uA;
    gl_FragColor = vec4(0.07, 0.075, 0.07, a);
    #include <colorspace_fragment>
  }
`;

// ---- rounded plates for chips and buttons ----
const plates = new Map();
function plate(w, h, r = 0.06) {
  const key = `${w.toFixed(3)}x${h.toFixed(3)}`;
  let hit = plates.get(key);
  if (!hit) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    hit = { fill: new THREE.ShapeGeometry(s, 6), line: new THREE.BufferGeometry().setFromPoints(s.getPoints(6)) };
    plates.set(key, hit);
  }
  return hit;
}

// words laid left to right, wrapping at `width`; each is { label, w } -> adds x, y (down from 0)
function flow(words, width, h, gap) {
  let x = 0, y = 0;
  const out = words.map((wd) => {
    if (x > 0 && x + wd.w > width) { x = 0; y += h + gap; }
    const r = { ...wd, x: x + wd.w / 2, y: -(y + h / 2) };
    x += wd.w + gap;
    return r;
  });
  return { items: out, h: out.length ? y + h : 0 };
}

function Button({ w, h, label, kind, pal, onClick, userData }) {
  const fill = useRef();
  const txt = useRef();
  const hov = useRef(0);
  const want = useRef(0);
  const geo = useMemo(() => plate(w, h), [w, h]);
  const ink = useMemo(() => new THREE.Color(pal.ink), [pal]);
  const hot = useMemo(() => new THREE.Color(pal.signal), [pal]);
  const paper = useMemo(() => new THREE.Color("#F7F5EF"), []);
  const live = !!onClick;

  useFrame((_, dt) => {
    hov.current += (want.current - hov.current) * (1 - Math.exp(-dt * 14));
    const k = hov.current;
    if (fill.current) {
      if (kind === "primary") fill.current.material.color.copy(ink).lerp(hot, k);
      else fill.current.material.color.copy(paper).lerp(ink, k);
    }
    if (txt.current) txt.current.color = kind === "primary" || k > 0.5 ? "#F7F5EF" : pal.ink;
  });

  return (
    <group userData={userData}>
      <mesh
        ref={fill} geometry={geo.fill} userData={{ b: kind === "ghost" ? 0.55 : 1 }}
        onPointerOver={live ? (e) => { e.stopPropagation(); want.current = 1; document.body.style.cursor = "pointer"; } : undefined}
        onPointerOut={live ? () => { want.current = 0; document.body.style.cursor = ""; } : undefined}
        onClick={live ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      >
        <meshBasicMaterial transparent color="#F7F5EF" />
      </mesh>
      <lineLoop geometry={geo.line} position={[0, 0, 0.002]} userData={{ b: 1 }}>
        <lineBasicMaterial color={pal.ink} transparent />
      </lineLoop>
      <Text ref={txt} position={[0, 0, 0.01]} font={MONO} fontSize={0.105} color={pal.ink} anchorX="center" anchorY="middle" whiteSpace="nowrap" fillOpacity={0} userData={{ b: 1 }} raycast={noRay}>
        {label}
      </Text>
    </group>
  );
}

// The spec sheet of the selected project. Items are laid out down one or two columns each frame
// (text heights are measured from troika once it has typeset), and each fades and slides in by its
// place in the order.
function Detail({ p, L, rv, pal, total, open }) {
  const refs = useRef([]);
  const rule = useRef();
  const fs = L.fs;
  const chipFs = fs * 0.78;
  const cw = chipFs * 0.6;

  const chips = useMemo(() => {
    const words = p.tech.slice(0, L.maxChips).map((t) => ({ label: t, w: t.length * cw + 0.26 }));
    return flow(words, L.cols === 2 ? L.W2 : L.W, 0.27, 0.08);
  }, [p, L, cw]);

  const actions = useMemo(() => {
    const list = [];
    if (p.live) list.push({ label: "OPEN LIVE ->", kind: "primary", go: () => open(p, "live") });
    if (p.caseHref) list.push({ label: "CASE STUDY ->", kind: list.length ? "secondary" : "primary", go: () => open(p, "case") });
    if (p.source) list.push({ label: "SOURCE ->", kind: "secondary", go: () => open(p, "source") });
    if (!list.length) list.push({ label: p.kind === "client" ? "CLIENT WORK · PRIVATE" : "NO PUBLIC LINK", kind: "ghost", go: null });
    const words = list.map((a) => ({ ...a, w: a.label.length * (fs * 0.85) * 0.6 + 0.5 }));
    return flow(words, L.cols === 2 ? L.W2 : L.W, 0.36, 0.1);
  }, [p, L, open, fs]);

  const bullets = p.bullets.slice(0, L.maxBullets);
  const wide = L.cols === 2;
  const mw = wide ? L.W2 : L.W / 3;

  // order matters: it is the order things appear in
  const items = [];
  const push = (key, col, gap, h, node) => items.push({ key, col, gap, h, node });
  push("k", 0, 0.12, null, (
    <Text font={MONO} fontSize={fs * 0.8} color={pal.signal} anchorX="left" anchorY="top" maxWidth={L.W} whiteSpace="normal" fillOpacity={0} userData={{ measure: true, b: 1 }} raycast={noRay}>
      {`${p.num} / ${String(total).padStart(2, "0")}  ·  ${p.tag.toUpperCase()}`}
    </Text>
  ));
  push("t", 0, 0.14, null, (
    <Text font={DISPLAY} fontSize={L.titleSize} lineHeight={0.98} letterSpacing={-0.02} color={pal.ink} anchorX="left" anchorY="top" maxWidth={L.W} fillOpacity={0} userData={{ measure: true, b: 1 }} raycast={noRay}>
      {p.title.toUpperCase()}
    </Text>
  ));
  if (!L.mobile && (p.org || p.role)) {
    push("m", 0, 0.16, null, (
      <Text font={MONO} fontSize={fs * 0.9} color="#4B4F4B" anchorX="left" anchorY="top" maxWidth={L.W} fillOpacity={0} userData={{ measure: true, b: 1 }} raycast={noRay}>
        {[p.org, p.role].filter(Boolean).join("  ·  ")}
      </Text>
    ));
  }
  if (!L.mobile) {
    push("l", 0, 0.2, null, (
      <Text font={MONO} fontSize={fs} lineHeight={1.5} color={pal.ink} anchorX="left" anchorY="top" maxWidth={L.W} fillOpacity={0} userData={{ measure: true, b: 1 }} raycast={noRay}>
        {p.lead}
      </Text>
    ));
  }
  bullets.forEach((b, i) => {
    push(`b${i}`, 0, 0.12, null, (
      <group>
        <Text font={MONO} fontSize={fs} color={pal.signal} anchorX="left" anchorY="top" whiteSpace="nowrap" fillOpacity={0} userData={{ b: 1 }} raycast={noRay}>{">"}</Text>
        <Text position={[fs * 1.5, 0, 0]} font={MONO} fontSize={fs} lineHeight={1.42} color={pal.ink} anchorX="left" anchorY="top" maxWidth={L.W - fs * 1.5} fillOpacity={0} userData={{ measure: true, b: 1 }} raycast={noRay}>
          {b}
        </Text>
      </group>
    ));
  });
  const m = p.metrics.slice(0, 3);
  const metricCol = wide ? 1 : 0;
  if (m.length) {
    push("mx", metricCol, 0.22, wide ? m.length * 0.78 : 0.66, (
      <group>
        {m.map((x, i) => (
          <group key={x.l} position={wide ? [0, -i * 0.78, 0] : [i * mw, 0, 0]}>
            <Text font={DISPLAY} fontSize={wide ? 0.3 : 0.26} color={pal.ink} anchorX="left" anchorY="top" whiteSpace="nowrap" fillOpacity={0} userData={{ b: 1 }} raycast={noRay}>{x.v}</Text>
            <Text position={[0, wide ? -0.44 : -0.34, 0]} font={MONO} fontSize={0.092} color="#4B4F4B" anchorX="left" anchorY="top" maxWidth={mw - 0.1} fillOpacity={0} userData={{ b: 1 }} raycast={noRay}>{x.l}</Text>
          </group>
        ))}
      </group>
    ));
  }
  if (chips.items.length) {
    push("c", wide ? 1 : 0, 0.2, chips.h, (
      <group>
        {chips.items.map((c) => {
          const g = plate(c.w, 0.27, 0.05);
          return (
            <group key={c.label} position={[c.x, c.y, 0]}>
              <mesh geometry={g.fill} userData={{ b: 1 }}><meshBasicMaterial color="#FBFAF6" transparent /></mesh>
              <lineLoop geometry={g.line} position={[0, 0, 0.002]} userData={{ b: 0.8 }}><lineBasicMaterial color={pal.ink} transparent /></lineLoop>
              <Text position={[0, 0, 0.01]} font={MONO} fontSize={chipFs} color={pal.ink} anchorX="center" anchorY="middle" whiteSpace="nowrap" fillOpacity={0} userData={{ b: 1 }} raycast={noRay}>{c.label}</Text>
            </group>
          );
        })}
      </group>
    ));
  }
  push("a", wide ? 1 : 0, 0, actions.h, (
    <group>
      {actions.items.map((a) => (
        <group key={a.label} position={[a.x, a.y, 0]}>
          <Button w={a.w} h={0.36} label={a.label} kind={a.kind} pal={pal} onClick={a.go} />
        </group>
      ))}
    </group>
  ));

  useFrame(() => {
    const cur = [L.top, L.top];
    let lowest = L.top;
    refs.current.forEach((g, idx) => {
      if (!g) return;
      const it = items[idx];
      if (!it) return;
      let h = it.h;
      let ready = true;
      if (h == null) {
        let tx = null;
        g.traverse((o) => { if (!tx && o.userData?.measure) tx = o; });
        const bb = tx?.textRenderInfo?.blockBounds;
        ready = !!bb;
        h = bb ? bb[3] - bb[1] : 0.25;
      }
      const o = smooth(0, 1, (rv.current.t - idx * 0.07) / 0.4) * (ready ? 1 : 0);
      g.position.set((it.col ? L.col2X : 0) + (1 - o) * 0.3, cur[it.col], 0);
      g.visible = o > 0.004;
      g.traverse((c) => {
        const b = c.userData?.b;
        if (b === undefined) return;
        if ("fillOpacity" in c) c.fillOpacity = o * b;
        else if (c.material) c.material.opacity = o * b;
      });
      cur[it.col] -= h + it.gap;
      lowest = Math.min(lowest, cur[it.col] + it.gap);
    });
    if (rule.current) {
      const hgt = L.top - lowest;
      const o = smooth(0, 1, rv.current.t / 0.7);
      rule.current.scale.y = Math.max(0.0001, hgt * o);
      rule.current.position.y = L.top - (hgt * o) / 2;
    }
  });

  return (
    <group position={[L.px, 0, 0.5]}>
      <mesh ref={rule} position={[-0.22, 0, 0]}>
        <planeGeometry args={[0.012, 1]} />
        <meshBasicMaterial color={pal.ink} />
      </mesh>
      {items.map((it, i) => (
        <group key={it.key} ref={(g) => { refs.current[i] = g; }} visible={false}>
          {it.node}
        </group>
      ))}
    </group>
  );
}

// ---- the scene ----
function Scene({ projects, sel, onSelect, onOpen, drag }) {
  const { gl, camera, size } = useThree();
  const n = projects.length;
  const aspect = size.width / size.height;
  const L = useMemo(() => makeLayout(aspect, n), [aspect, n]);
  const pal = useMemo(() => readPalette(), []);
  const [shown, setShown] = useState(-1);
  const shownRef = useRef(-1);

  const motifs = useMemo(() => projects.map((p, i) => makeMotif(p.motif ?? i)), [projects]);
  const targets = useMemo(() => projects.map(() => new THREE.WebGLRenderTarget(MOTIF_W, MOTIF_H, { samples: 4 })), [projects]);
  const mats = useMemo(() => projects.map((p, i) => makeCardMaterial(targets[i].texture, i * 0.37)), [projects, targets]);
  const geo = useMemo(() => cardGeometry(), []);
  const shadowMats = useMemo(() => projects.map(() => new THREE.ShaderMaterial({
    vertexShader: SHADOW_VERT, fragmentShader: SHADOW_FRAG, transparent: true, depthWrite: false,
    uniforms: { uA: { value: 0 }, uSize: { value: new THREE.Vector2(CW + 0.7, CH + 0.7) } },
  })), [projects]);

  useEffect(() => {
    let alive = true;
    const made = [];
    projects.forEach((p, i) => {
      makeFace(p).then((t) => { if (!alive) { t.dispose(); return; } made.push(t); mats[i].uniforms.uFace.value = t; });
    });
    return () => { alive = false; made.forEach((t) => t.dispose()); };
  }, [projects, mats]);
  useEffect(() => () => {
    targets.forEach((t) => t.dispose());
    mats.forEach((m) => m.dispose());
    shadowMats.forEach((m) => m.dispose());
    geo.dispose();
  }, [targets, mats, shadowMats, geo]);

  // each card falls in its own order: from the middle out, so the arc builds symmetrically
  const order = useMemo(() => {
    const c = (n - 1) / 2;
    const idx = projects.map((_, i) => i).sort((a, b) => Math.abs(a - c) + a * 0.01 - (Math.abs(b - c) + b * 0.01));
    const rank = [];
    idx.forEach((i, r) => { rank[i] = r; });
    return rank;
  }, [projects, n]);
  const toss = useMemo(() => projects.map((_, i) => {
    const r = (k) => { const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
    return { dx: (r(1) - 0.5) * 3, dz: r(2) * 2.4, rx: (r(3) - 0.5) * 3.2, ry: (r(4) - 0.5) * 6, rz: (r(5) - 0.5) * 1.8 };
  }), [projects]);
  const TOTAL = (n - 1) * STAG + FALL_D;

  const dust = useMemo(() => {
    const total = n * DUST_PER;
    const aCard = new Float32Array(total), aDir = new Float32Array(total * 3), aRnd = new Float32Array(total);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < DUST_PER; k++) {
        const j = i * DUST_PER + k;
        const a = (k / DUST_PER) * Math.PI * 2 + i;
        aCard[j] = i;
        aDir.set([Math.cos(a) * 1.3, (Math.sin(a * 2.3) * 0.5 + 0.4) * 0.8, Math.sin(a) * 0.6], j * 3);
        aRnd[j] = (Math.sin(j * 91.7) * 0.5 + 0.5);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(total * 3), 3));
    g.setAttribute("aCard", new THREE.BufferAttribute(aCard, 1));
    g.setAttribute("aDir", new THREE.BufferAttribute(aDir, 3));
    g.setAttribute("aRnd", new THREE.BufferAttribute(aRnd, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false,
      uniforms: {
        uLand: { value: new Float32Array(MAXC).fill(-1) },
        uBase: { value: Array.from({ length: MAXC }, () => new THREE.Vector3()) },
        uPx: { value: 600 },
      },
    });
    return { g, m };
  }, [n]);
  useEffect(() => () => { dust.g.dispose(); dust.m.dispose(); }, [dust]);

  const meshes = useRef([]);
  const shadows = useRef([]);
  const pose = useRef([]);
  const fall = useRef(0);
  const rot = useRef({ v: 0, t: 0 });
  const rv = useRef({ t: 0 });
  const root = useRef();
  const title = useRef();
  const hov = useRef(projects.map(() => 0));
  const mouse = useRef(projects.map(() => new THREE.Vector2(0.5, 0.5)));
  const mouseT = useRef(projects.map(() => new THREE.Vector2(0.5, 0.5)));
  const frame = useRef(0);

  useEffect(() => { const c = Math.floor((n - 1) / 2); rot.current.v = rot.current.t = c; }, [n]);
  useEffect(() => { if (sel >= 0) { rv.current.t = 0; shownRef.current = sel; setShown(sel); } }, [sel]);

  // horizontal drags spin the arc on phones, where it does not all fit
  useEffect(() => {
    const el = gl.domElement;
    let start = null;
    const down = (e) => { if (!L.mobile || deploy.sel >= 0) return; start = { x: e.clientX, t: rot.current.t }; drag.current = 0; };
    const move = (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      drag.current = Math.max(drag.current, Math.abs(dx));
      rot.current.t = clamp(start.t - dx / 110, 0, n - 1);
    };
    const up = () => { if (start) { rot.current.t = Math.round(rot.current.t); start = null; setTimeout(() => { drag.current = 0; }, 0); } };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [gl, L.mobile, n, drag]);

  const arcPose = (i) => {
    const a = (i - rot.current.v) * L.STEP;
    return {
      x: Math.sin(a) * L.R, y: Math.cos(a) * L.R - L.R + L.arcY, z: -Math.abs(a) * 1.2,
      rx: 0, ry: -a * 0.35, rz: -a, s: L.scale,
    };
  };

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = state.clock.elapsedTime;
    frame.current++;
    const selNow = deploy.sel;
    const k = 1 - Math.exp(-dt * 9);

    // camera rides a little with the cursor and the scroll hold
    const h = deploy.hold;
    const cx = pointer.x * 0.35 + (h - 0.5) * 0.5;
    const cy = 0.15 + pointer.y * 0.2;
    camera.position.x += (cx - camera.position.x) * 0.06;
    camera.position.y += (cy - camera.position.y) * 0.06;
    camera.position.z = L.dist * (1 - h * 0.05) * (1 - gesture.zoom * 0.2);
    camera.lookAt(0, 0, 0);

    if (!L.mobile) rot.current.v = (n - 1) / 2;
    else rot.current.v += (rot.current.t - rot.current.v) * (1 - Math.exp(-dt * 8));

    // the cards land once the iris has opened; scrolling back up lifts them out again
    fall.current = deploy.arrive >= 0.985 ? Math.min(TOTAL + 1.6, fall.current + dt) : Math.max(0, Math.min(fall.current, TOTAL) - dt * 2.5);
    const ft = fall.current;

    // reveal of the spec sheet
    rv.current.t = clamp(rv.current.t + dt * (selNow >= 0 ? 1 : -2.6), 0, 2.6);
    if (selNow < 0 && rv.current.t <= 0.001 && shownRef.current !== -1) { shownRef.current = -1; setShown(-1); }

    const others = [];
    for (let i = 0; i < n; i++) if (i !== selNow) others.push(i);
    const unis = dust.m.uniforms;

    for (let i = 0; i < n; i++) {
      const m = meshes.current[i];
      const sh = shadows.current[i];
      if (!m) continue;
      const u = clamp((ft - order[i] * STAG) / FALL_D);
      const isSel = i === selNow;
      const isHot = deploy.hot === i;

      // where it wants to rest right now: arc, lifted out, or tucked on the shelf
      let tgt;
      if (selNow < 0) {
        tgt = arcPose(i);
        if (isHot && !L.mobile) { tgt.y += 0.22; tgt.z += 0.3; tgt.s *= 1.06; }
        else if (isHot && L.mobile && Math.round(rot.current.t) === i) { tgt.y += 0.1; }
        if (L.mobile) { const near = 1 - Math.min(1, Math.abs(i - rot.current.v)); tgt.s *= 0.92 + 0.12 * near; tgt.z += near * 0.6; }
      } else if (isSel) {
        tgt = { x: L.selPos[0], y: L.selPos[1] + Math.sin(t * 0.8) * 0.04, z: L.selPos[2], rx: -pointer.y * 0.07, ry: 0.1 + pointer.x * 0.1, rz: Math.sin(t * 0.6) * 0.012, s: L.selScale };
      } else {
        const sp = L.shelf(others.indexOf(i), others.length);
        tgt = { x: sp.x, y: sp.y + (isHot ? 0.3 : 0), z: sp.z + (isHot ? 0.3 : 0), rx: 0, ry: 0, rz: sp.rz, s: sp.s * (isHot ? 1.1 : 1) };
      }
      let P = pose.current[i];
      if (!P) P = pose.current[i] = { ...tgt };
      P.x += (tgt.x - P.x) * k; P.y += (tgt.y - P.y) * k; P.z += (tgt.z - P.z) * k;
      P.rx += (tgt.rx - P.rx) * k; P.ry += (tgt.ry - P.ry) * k; P.rz += (tgt.rz - P.rz) * k; P.s += (tgt.s - P.s) * k;

      // the drop: fall with a tumble that unwinds, hit, hop and settle
      let fy = 0, fx = 0, fz = 0, frx = 0, fry = 0, frz = 0, flutter = 0;
      const T = toss[i];
      if (u < 1) {
        const kk = Math.min(1, u / LAND);
        if (u < LAND) {
          const q = 1 - kk * kk;
          fy = 9.5 * q; fx = T.dx * (1 - kk); fz = T.dz * (1 - kk);
          const w = Math.pow(1 - kk, 1.3);
          frx = T.rx * w; fry = T.ry * w; frz = T.rz * w;
          flutter = Math.min(1, kk * 1.4);
        } else {
          const b = (u - LAND) / (1 - LAND);
          fy = 0.34 * Math.sin(Math.PI * b) * (1 - b);
          frz = 0.07 * Math.sin(b * 13) * (1 - b);
          flutter = 0.35 * (1 - b);
        }
      }
      m.visible = u > 0.001;
      m.position.set(P.x + fx, P.y + fy, P.z + fz);
      m.rotation.set(P.rx + frx, P.ry + fry, P.rz + frz);
      m.scale.setScalar(P.s);

      // uniforms
      const mat = mats[i];
      hov.current[i] += ((isHot || isSel ? 1 : 0) - hov.current[i]) * k;
      mouse.current[i].lerp(mouseT.current[i], 0.2);
      mat.uniforms.uTime.value = t;
      mat.uniforms.uFlutter.value = flutter;
      mat.uniforms.uHover.value = hov.current[i];
      mat.uniforms.uSel.value = isSel ? 1 : 0;
      mat.uniforms.uMouse.value.copy(mouse.current[i]);

      // contact shadow on the wall behind
      if (sh) {
        const land = smooth(0.55, 1, u);
        sh.visible = u > 0.55;
        sh.position.set(P.x + 0.1 * P.s, P.y - 0.12 * P.s + fy * 0.2, P.z - 0.5);
        sh.rotation.z = P.rz;
        sh.scale.setScalar(P.s);
        shadowMats[i].uniforms.uA.value = 0.09 * land * (isSel ? 1.2 : 1);
      }

      // impact puffs, positioned at the foot of the card's resting place
      const A = arcPose(i);
      unis.uLand.value[i] = ft - (order[i] * STAG + LAND * FALL_D);
      unis.uBase.value[i].set(A.x, A.y - CH * A.s * 0.5, A.z + 0.1);

      // the live motif on the card face: busy ones every frame, the rest every other
      if (u > 0.001 && (isHot || isSel || (frame.current + i) % 2 === 0)) {
        const mo = motifs[i];
        mo.update(t, 1 + hov.current[i] * 1.2);
        const prev = gl.getRenderTarget();
        gl.setRenderTarget(targets[i]);
        gl.render(mo.scene, mo.camera);
        gl.setRenderTarget(prev);
      }
    }
    unis.uPx.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan((FOV * Math.PI) / 360));

    if (root.current) root.current.rotation.y = (h - 0.5) * 0.1;
    if (title.current) {
      const intro = smooth(0, 1, ft / 0.7);
      title.current.strokeOpacity = intro * (selNow >= 0 ? 0.07 : 0.9);
      title.current.position.y = L.titleY + (1 - intro) * 0.6;
    }
  });

  const click = (i) => {
    if (drag.current > 6) return;
    if (fall.current < TOTAL * 0.9) return;
    const cur = deploy.sel;
    if (cur >= 0) { if (i !== cur) onSelect(i); return; }
    if (L.mobile && Math.round(rot.current.t) !== i) { rot.current.t = i; return; }
    onSelect(i);
  };

  return (
    <group ref={root}>
      <Text
        ref={title} position={[L.titleX, L.titleY, -2.8]} font={DISPLAY} fontSize={L.titleFs} letterSpacing={-0.03}
        color={pal.ink} anchorX="center" anchorY="middle" fillOpacity={0} strokeWidth="1.1%" strokeColor={pal.ink} strokeOpacity={0} whiteSpace="nowrap" raycast={noRay}
      >
        DEPLOY
      </Text>

      {projects.map((p, i) => (
        <mesh key={`s${p.id}`} ref={(m) => { shadows.current[i] = m; }} material={shadowMats[i]} renderOrder={-1} visible={false} raycast={noRay}>
          <planeGeometry args={[CW + 0.7, CH + 0.7]} />
        </mesh>
      ))}

      {projects.map((p, i) => (
        <mesh
          key={p.id} ref={(m) => { meshes.current[i] = m; }} geometry={geo} material={mats[i]} visible={false}
          onPointerOver={(e) => { e.stopPropagation(); setHot(i); document.body.style.cursor = "pointer"; }}
          onPointerMove={(e) => { if (e.uv) mouseT.current[i].copy(e.uv); }}
          onPointerOut={() => { if (deploy.hot === i) setHot(-1); document.body.style.cursor = ""; }}
          onClick={(e) => { e.stopPropagation(); click(i); }}
        />
      ))}

      <points geometry={dust.g} material={dust.m} frustumCulled={false} renderOrder={3} raycast={noRay} />

      {shown >= 0 && projects[shown] && (
        <Detail key={projects[shown].id} p={projects[shown]} L={L} rv={rv} pal={pal} total={n} open={onOpen} />
      )}
    </group>
  );
}

export default function DeployStage({ active, projects, sel, onSelect, onOpen }) {
  const drag = useRef(0);
  useEffect(() => { setActive(active); }, [active]);
  useEffect(() => () => { document.body.style.cursor = ""; }, []);
  return (
    <Boundary>
      <Canvas
        dpr={[1, 2]}
        frameloop={active ? "always" : "never"}
        camera={{ position: [0, 0.15, 12], fov: FOV, near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0, touchAction: "pan-y" }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        onPointerMissed={() => { if (drag.current <= 6 && deploy.sel >= 0) onSelect(-1); }}
      >
        <Scene projects={projects} sel={sel} onSelect={onSelect} onOpen={onOpen} drag={drag} />
      </Canvas>
    </Boundary>
  );
}
