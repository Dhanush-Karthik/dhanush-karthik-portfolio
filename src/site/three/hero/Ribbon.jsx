import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { stage, readPalette, clamp, outCubic } from "./state";

// Replaces the flat marquee: two printed ribbons that cross in an X behind the
// portrait and twist in 3D. The twist is a vertex-shader rotation about the
// ribbon's own axis, so it catches the light, flips to show its back, and speeds
// up and winds tighter as you scroll. They sit behind the surname and the photo.

const vert = /* glsl */ `
uniform float uTime, uPhase, uTw, uWave;
varying vec2 vUv;
varying vec3 vN, vV;
void main() {
  vUv = uv;
  float x = position.x;
  float a = x * uTw + uPhase;
  float c = cos(a), s = sin(a);
  vec3 p = vec3(x, position.y * c, position.y * s);
  p.y += sin(x * 0.55 + uTime * 0.5) * uWave;
  p.z += cos(x * 0.42 + uTime * 0.35) * uWave * 0.9;
  vN = normalize(normalMatrix * vec3(0.0, -s, c));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const frag = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform float uScroll, uRepeat, uFade;
varying vec2 vUv;
varying vec3 vN, vV;
void main() {
  vec2 uv = vec2(vUv.x * uRepeat + uScroll, vUv.y);
  if (!gl_FrontFacing) uv.x = vUv.x * uRepeat * -1.0 + uScroll * -1.0;
  vec3 col = texture2D(uTex, uv).rgb;
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 L = normalize(vec3(-0.35, 0.65, 0.7));
  float d = max(dot(N, L), 0.0);
  vec3 H = normalize(L + normalize(vV));
  float sp = pow(max(dot(N, H), 0.0), 36.0) * 0.32;
  col = col * (0.5 + 0.62 * d) + sp;
  float edge = smoothstep(0.0, 0.03, vUv.y) * smoothstep(1.0, 0.97, vUv.y);
  col *= 0.8 + 0.2 * edge;
  gl_FragColor = vec4(col, 1.0);
}
`;

function useRibbonTexture(items, bg, fg, star) {
  const [state, setState] = useState(null);
  useEffect(() => {
    let alive = true, tex;
    const build = () => {
      if (!alive) return;
      const H = 128, size = 62;
      const c = document.createElement("canvas");
      const g = c.getContext("2d");
      const font = `900 ${size}px Archivo, "Arial Black", Impact, sans-serif`;
      g.font = font;
      try { g.fontStretch = "expanded"; } catch { /* unsupported */ }
      const gap = 64;
      const parts = items.flatMap((t) => [{ t: t.toUpperCase(), s: false }, { t: "✦", s: true }]);
      const widths = parts.map((p) => g.measureText(p.t).width);
      const total = Math.ceil(widths.reduce((a, b) => a + b + gap, 0));
      c.width = Math.min(total, 8192); c.height = H;
      const k = c.width / total;
      g.font = font;
      try { g.fontStretch = "expanded"; } catch { /* unsupported */ }
      g.fillStyle = bg; g.fillRect(0, 0, c.width, H);
      g.textBaseline = "middle";
      let x = 0;
      parts.forEach((p, i) => { g.fillStyle = p.s ? star : fg; g.fillText(p.t, x * k, H / 2 + 4); x += widths[i] + gap; });
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.anisotropy = 8;
      setState({ tex, ratio: c.width / H });
    };
    build();
    document.fonts?.load("900 62px Archivo").then(() => { tex?.dispose(); build(); }).catch(() => {});
    return () => { alive = false; tex?.dispose(); };
  }, [items, bg, fg, star]);
  return state;
}

function Strip({ items, layout, bg, fg, star, ang, y, z, len, h, dir, phase, tw, delay }) {
  const t = useRef();
  const inner = useRef();
  const info = useRibbonTexture(items, bg, fg, star);
  const uniforms = useMemo(() => ({
    uTex: { value: null }, uTime: { value: 0 }, uPhase: { value: phase }, uTw: { value: tw }, uWave: { value: layout.H * 0.016 },
    uScroll: { value: 0 }, uRepeat: { value: 1 }, uFade: { value: 1 },
  }), [phase, tw, layout.H]);
  const scroll = useRef(0);
  const last = useRef(stage.p);

  useEffect(() => {
    if (!info) return;
    uniforms.uTex.value = info.tex;
    // texture world width = ratio * ribbon height, so letters keep their proportions
    uniforms.uRepeat.value = len / (info.ratio * h);
  }, [info, uniforms, len, h]);

  useFrame(({ clock }, dt) => {
    const v = Math.abs(stage.p - last.current) / Math.max(dt, 1e-3);
    last.current = stage.p;
    uniforms.uTime.value = clock.elapsedTime;
    scroll.current += dir * dt * (0.03 + Math.min(1.2, v * 3.2) * 0.2);
    uniforms.uScroll.value = scroll.current;
    uniforms.uPhase.value = phase + clock.elapsedTime * 0.45 * dir + stage.p * 9;
    const g = t.current, i = inner.current;
    if (g && i) {
      // slides in along its own axis, from outside the frame
      const k = outCubic(clamp((stage.t - 1.9 - delay) / 1.2));
      i.position.x = -dir * (1 - k) * len * 0.4;
      g.visible = k > 0.001;
    }
  });

  if (!info) return null;
  return (
    <group ref={t} position={[0, y, z]} rotation={[0, 0, ang]}>
      <group ref={inner}>
        <mesh frustumCulled={false}>
          <planeGeometry args={[len, h, 520, 1]} />
          <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

export default function Ribbon({ items, layout }) {
  const pal = useMemo(() => readPalette(), []);
  const extra = useMemo(() => ["Spring Boot", "Keycloak", "Microservices", "REST APIs", "PostgreSQL", "Docker"], []);
  const { W, H, mobile } = layout;
  // The X crosses behind the chest, so the face stays clear.
  const ang = Math.min(1.05, Math.max(0.4, Math.atan2(H, W) * 0.8));
  const y = layout.figY + layout.fh * 0.12;
  const len = Math.hypot(W, H) * 1.45;
  const h1 = layout.ribbonH * (mobile ? 1.3 : 1.55);
  const h2 = h1 * 0.72;
  return (
    <>
      <Strip items={items} layout={layout} bg={pal.ink} fg={pal.paper} star={pal.phosphor} ang={ang} y={y} z={-1.6} len={len} h={h1} dir={1} phase={0} tw={0.5} delay={0} />
      <Strip items={extra} layout={layout} bg={pal.signal} fg={pal.ink} star={pal.paper} ang={-ang} y={y} z={-1.75} len={len} h={h2} dir={-1} phase={2.1} tw={0.42} delay={0.25} />
    </>
  );
}
