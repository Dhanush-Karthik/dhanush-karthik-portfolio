import { Component, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { pointer } from "../../lib/pointer";
import * as audio from "../../lib/audio";
import { smooth, readPalette } from "../hero/state";
import { makeHello, makeWords, makeStats } from "./targets";
import { about } from "./state";

// About as one living point cloud. Every particle belongs to a scene per chapter (a greeting,
// the words that matter in each paragraph, the numbers) and flies to the next one as the page
// scrolls. The cursor pushes particles aside, a click sends a shockwave through them, and on the
// way out the whole cloud falls and piles up along the edge of the next section.
// Scroll position arrives through `about.beat` / `about.out` (written by the DOM section),
// so React never re-renders while it runs.

const CAM_Z = 9, FOV = 35;
const MAX_BEATS = 5;

const VERT = /* glsl */ `
attribute vec4 aT0, aT1, aT2, aT3, aT4;
attribute vec3 aRnd;
uniform float uBeat, uTime, uPx, uSize, uOut, uFloor, uHalfW;
uniform vec3 uPtr;      // xy world, z strength 0..1
uniform vec4 uPulse;    // xy origin, z age (s), w strength
uniform vec3 uC0, uC1, uC2, uC3;
varying vec3 vCol;
varying float vA;

vec4 target(int i) {
  if (i <= 0) return aT0;
  if (i == 1) return aT1;
  if (i == 2) return aT2;
  if (i == 3) return aT3;
  return aT4;
}
vec3 pal(float t) {
  if (t < 0.5) return uC0;
  if (t < 1.5) return uC1;
  if (t < 2.5) return uC2;
  return uC3;
}

void main() {
  float fl = floor(uBeat);
  float f = uBeat - fl;
  int i0 = int(fl);
  int i1 = int(min(fl + 1.0, 4.0));
  vec4 a = target(i0);
  vec4 b = target(i1);

  // every particle leaves a little later or earlier than its neighbours
  float m = smoothstep(aRnd.x * 0.38, 0.62 + aRnd.x * 0.38, f);
  vec3 d = b.xyz - a.xyz;
  vec3 p = mix(a.xyz, b.xyz, m);
  float fly = sin(m * 3.14159);
  vec3 side = normalize(cross(d, vec3(0.3, 1.0, 0.2)) + 1e-4);
  p += side * fly * length(d) * 0.2 * (aRnd.y * 2.0 - 1.0);
  p.z += fly * (aRnd.z - 0.5) * 3.0;

  // always breathing a little
  // (only a shimmer once the words have formed, or the edges of the letters blur)
  p += (0.006 + 0.05 * fly) * vec3(sin(uTime * 0.8 + aRnd.x * 40.0), cos(uTime * 0.6 + aRnd.y * 37.0), sin(uTime * 0.7 + aRnd.z * 29.0));

  vec4 wp = modelMatrix * vec4(p, 1.0);

  // cursor: push away and swirl
  vec2 dd = wp.xy - uPtr.xy;
  float dist = length(dd);
  float infl = uPtr.z * exp(-dist * dist / 1.5);
  vec2 dn = dd / (dist + 1e-3);
  wp.xy += dn * infl * 0.7 + vec2(-dn.y, dn.x) * infl * 0.35;
  wp.z += infl * 1.1 * (aRnd.z + 0.2);

  // click: a ring that runs outward and shoves everything it passes
  float ring = 0.0;
  if (uPulse.w > 0.0) {
    vec2 pd = wp.xy - uPulse.xy;
    float pl = length(pd);
    ring = exp(-pow((pl - uPulse.z * 7.0) / 0.7, 2.0)) * uPulse.w;
    wp.xy += pd / (pl + 1e-3) * ring * 0.9;
    wp.z += ring * 1.2 * (aRnd.y - 0.2);
  }

  // leaving: everything drops, a little later or sooner each, and settles in a glowing line
  // along the bottom edge (the top edge of the section that follows)
  float g = 0.0;
  if (uOut > 0.0) {
    float k = clamp(uOut * 1.6 - aRnd.x * 0.6, 0.0, 1.0);
    g = k * k;
    float rest = uFloor + pow(aRnd.y, 4.0) * 0.5;
    float spread = (aRnd.z * 2.0 - 1.0) * uHalfW * 1.02;
    wp.x = mix(wp.x, spread, smoothstep(0.3, 1.0, k)) + sin(uTime * 2.0 + aRnd.x * 30.0) * 0.18 * g * (1.0 - g);
    wp.y = mix(wp.y, rest, g);
    wp.z = mix(wp.z, 0.0, g);
  }

  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  // size is in world units, so a bigger screen gets bigger particles instead of a thinner cloud
  gl_PointSize = uSize * uPx * (0.8 + aRnd.z * 0.5) * (1.0 + infl * 1.2 + ring * 1.6) / -mv.z;

  vec3 col = mix(pal(a.w), pal(b.w), m);
  vCol = col * (0.7 + 0.5 * aRnd.y) + col * (infl * 0.8 + ring * 1.2 + g * 0.9);
  vA = 0.78 + 0.22 * aRnd.x;
}`;

const FRAG = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.18, r);      // a hard-edged little disc: soft dots smear into a fog
  gl_FragColor = vec4(vCol * a * vA * 0.62, a * vA);
}`;

const hex = (h) => {
  const n = parseInt(h.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error("[about stage]", err); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Cloud({ scenes, count }) {
  const { size } = useThree();
  const dpr = useThree((x) => x.viewport.dpr);
  const group = useRef();
  const mat = useRef();
  const [targets, setTargets] = useState(null);
  const s = useRef({ beat: 0, px: 0, py: 0, on: 0, seen: false, hw: 5, hh: 2.8, pulseAge: 99, pulseX: 0, pulseY: 0, gx: 0, gy: 0 });
  const key = JSON.stringify(scenes);

  // Targets need the display font for the opening word, so they are built once it loads.
  useEffect(() => {
    let dead = false;
    const make = () => {
      if (dead) return;
      const fam = getComputedStyle(document.querySelector(".dk") || document.body).getPropertyValue("--display").trim() || "Archivo, sans-serif";
      setTargets(scenes.map((sc, i) => {
        if (sc.kind === "hello") return makeHello(count, sc.word, fam);
        if (sc.kind === "stats") return makeStats(count, sc.values, fam);
        return makeWords(count, sc.lines, fam, 11 + i * 7);
      }));
    };
    const ready = document.fonts?.load ? Promise.race([document.fonts.load("900 120px Archivo"), new Promise((r) => setTimeout(r, 1800))]) : Promise.resolve();
    ready.then(make, make);
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, count]);

  const geo = useMemo(() => {
    if (!targets) return null;
    const n = targets[0].length / 4;   // the targets may still be for the previous count while new ones build
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    for (let i = 0; i < MAX_BEATS; i++) g.setAttribute(`aT${i}`, new THREE.BufferAttribute(targets[Math.min(i, targets.length - 1)], 4));
    const rnd = new Float32Array(n * 3);
    let a = 12345;
    for (let i = 0; i < rnd.length; i++) { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; rnd[i] = a / 4294967296; }
    g.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
    return g;
  }, [targets]);

  const uniforms = useMemo(() => {
    const pal = readPalette();
    return {
      uBeat: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 }, uSize: { value: 0.0125 }, uOut: { value: 0 }, uFloor: { value: -2.8 }, uHalfW: { value: 5 },
      uPtr: { value: new THREE.Vector3(99, 99, 0) },
      uPulse: { value: new THREE.Vector4(0, 0, 9, 0) },
      uC0: { value: hex("#6F8F7A") }, uC1: { value: hex(pal.phosphor) },
      uC2: { value: hex(pal.signal) }, uC3: { value: hex(pal.tape) },
    };
  }, []);

  // The cursor only pushes particles once it has actually moved over the page; a click or
  // tap sends a pulse from where it landed.
  useEffect(() => {
    const st = s.current;
    const move = (e) => { if (e.pointerType !== "touch") st.seen = true; };
    const leave = () => { st.seen = false; };
    const down = (e) => {
      if (!about.active || e.target.closest?.("a,button")) return;
      st.pulseAge = 0;
      st.pulseX = (e.clientX / window.innerWidth * 2 - 1) * st.hw;
      st.pulseY = -(e.clientY / window.innerHeight * 2 - 1) * st.hh;
      audio.drop(0.35);
    };
    // hand mode: opening a fist throws a bigger shockwave from the hand
    const burst = (e) => {
      if (!about.active) return;
      st.pulseAge = 0;
      st.pulseX = (e.detail.x / window.innerWidth * 2 - 1) * st.hw;
      st.pulseY = -(e.detail.y / window.innerHeight * 2 - 1) * st.hh;
      audio.drop(0.6);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("dk:burst", burst);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("dk:burst", burst);
      document.documentElement.removeEventListener("mouseleave", leave);
    };
  }, []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const st = s.current;
    const g = group.current, m = mat.current;
    if (!g || !m) return;
    const u = m.uniforms;

    // chase the scroll position with a little inertia
    st.beat += (about.beat - st.beat) * (1 - Math.exp(-dt * 5));
    u.uBeat.value = Math.max(0, Math.min(MAX_BEATS - 1.0001, st.beat));
    u.uTime.value += dt;
    // pixels per world unit at distance 1, so particle size follows the screen
    const tanH = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    u.uPx.value = (dpr * size.height) / (2 * tanH);
    u.uOut.value = about.out;

    // pointer on the z=0 plane
    const halfH = tanH * CAM_Z;
    const halfW = halfH * (size.width / size.height);
    st.hw = halfW; st.hh = halfH;
    u.uFloor.value = -halfH - 0.04;
    u.uHalfW.value = halfW;
    const tx = pointer.x * halfW, ty = pointer.y * halfH;
    st.px += (tx - st.px) * (1 - Math.exp(-dt * 14));
    st.py += (ty - st.py) * (1 - Math.exp(-dt * 14));
    st.on += ((st.seen || pointer.source === "hand" ? 1 : 0) - st.on) * (1 - Math.exp(-dt * 4));
    u.uPtr.value.set(st.px, st.py, st.on);

    st.pulseAge += dt;
    u.uPulse.value.set(st.pulseX, st.pulseY, st.pulseAge, Math.max(0, 1 - st.pulseAge / 2.6));

    // placement: centred for the opening word, then into the free part of the screen to the
    // right of the copy (or above it on a phone)
    const mobile = size.width / size.height < 0.85;
    const mv = smooth(0, 1, st.beat);
    const wpx = (2 * halfW) / size.width;                      // world units per css px
    const left = Math.max(24, size.width * 0.05) + Math.min(528, size.width * 0.34) + size.width * 0.03;
    const right = size.width * 0.975;
    const regionW = Math.max(1, (right - left) * wpx);
    const regionX = ((left + right) / 2 - size.width / 2) * wpx;
    const fitHello = Math.min(1, (halfW * 2 * 0.94) / 8.8);
    const fitRegion = mobile ? fitHello * 0.96 : Math.min(1, regionW / 8.8);
    const sc = fitHello + (fitRegion - fitHello) * mv;
    const tgtX = mobile ? 0 : regionX * mv;
    const tgtY = mobile ? halfH * 0.3 : halfH * (0.12 - 0.1 * mv);
    st.gx += (tgtX - st.gx) * (1 - Math.exp(-dt * 4));
    st.gy += (tgtY - st.gy) * (1 - Math.exp(-dt * 4));
    g.position.set(st.gx, st.gy, 0);
    g.scale.setScalar(sc);
    const t = u.uTime.value;
    g.rotation.y += ((Math.sin(t * 0.22) * 0.05 + pointer.x * 0.14) - g.rotation.y) * (1 - Math.exp(-dt * 3));
    g.rotation.x += ((-pointer.y * 0.08 + Math.sin(t * 0.17) * 0.02) - g.rotation.x) * (1 - Math.exp(-dt * 3));
  });

  if (!geo) return null;
  return (
    <group ref={group}>
      <points geometry={geo} frustumCulled={false}>
        <shaderMaterial
          ref={mat}
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default function AboutStage({ scenes, active, mobile }) {
  useEffect(() => { about.active = active; }, [active]);
  const wide = typeof window !== "undefined" && window.innerWidth >= 1700;
  return (
    <Boundary>
      <Canvas
        flat
        dpr={[1, 2]}
        frameloop={active ? "always" : "never"}
        camera={{ position: [0, 0, CAM_Z], fov: FOV, near: 0.1, far: 60 }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0, touchAction: "pan-y" }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <Cloud scenes={scenes} count={mobile ? 36000 : wide ? 120000 : 90000} />
      </Canvas>
    </Boundary>
  );
}
