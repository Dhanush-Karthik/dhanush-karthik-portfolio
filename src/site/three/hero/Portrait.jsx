import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { pointer } from "../../lib/pointer";
import { stage, clamp, lerp, outBack, smooth } from "./state";

// The photo stays a flat 2D cutout; it just lives in 3D space. Three stacked
// planes give it presence: a soft contact shadow, a die-cut paper rim, and the
// photo itself. It tilts with the pointer, so the name wrapped behind and in
// front of it separates by parallax.

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const frag = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform float uOpacity;
uniform float uMode;          // 0 photo, 1 rim, 2 shadow
uniform float uAspect;
uniform float uRimW;
uniform vec3 uRim;
uniform vec3 uShadow;
varying vec2 vUv;

float alphaAt(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(uMap, uv).a;
}

void main() {
  vec4 c = texture2D(uMap, vUv);
  if (uMode < 0.5) {
    float a = smoothstep(0.3, 0.8, c.a) * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(c.rgb, a);
    return;
  }
  vec2 r = vec2(uRimW / uAspect, uRimW);
  if (uMode < 1.5) {
    float m = 0.0;
    for (int i = 0; i < 20; i++) {
      float t = float(i) * 0.31416;
      m = max(m, alphaAt(vUv + vec2(cos(t), sin(t)) * r));
    }
    float a = m * uOpacity;
    if (a < 0.02) discard;
    gl_FragColor = vec4(uRim, a);
    return;
  }
  // Soft shadow: average alpha over a wide disc.
  float s = 0.0;
  for (int i = 0; i < 24; i++) {
    float t = float(i) * 0.2618;
    float rad = 0.3 + 0.7 * fract(float(i) * 0.618);
    s += alphaAt(vUv + vec2(cos(t), sin(t)) * r * 4.0 * rad);
  }
  s /= 24.0;
  float a = s * 0.34 * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uShadow, a);
}
`;

export default function Portrait({ url, layout, onLoaded }) {
  const map = useLoader(THREE.TextureLoader, url);
  const group = useRef();
  const loaded = useRef(false);

  const aspect = map.image.width / map.image.height;
  const h = layout.fh, w = h * aspect;

  const shared = useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    return { uMap: { value: map }, uOpacity: { value: 0 }, uAspect: { value: aspect } };
  }, [map, aspect]);

  const mats = useMemo(() => {
    const make = (mode, extra = {}) => new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag,
      uniforms: { ...shared, uMode: { value: mode }, uRimW: { value: 0.012 }, uRim: { value: new THREE.Color("#F7F5EF") }, uShadow: { value: new THREE.Color("#0C0E0C") }, ...extra },
      alphaToCoverage: mode < 2, transparent: mode === 2, depthWrite: mode < 2,
    });
    return { photo: make(0), rim: make(1), shadow: make(2, { uRimW: { value: 0.03 } }) };
  }, [shared]);

  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    if (!loaded.current) { loaded.current = true; onLoaded?.(); }
    // stage.t is the intro clock and jumps to 99 the moment the intro ends, so anything that keeps
    // moving afterwards (the idle bob) must run on the real clock or the photo hops when it does.
    const t = stage.t;
    const k = clamp((t - 0.85) / 1.05);
    const pop = outBack(k, 1.45);
    shared.uOpacity.value = smooth(0.85, 1.25, t);
    const s = lerp(0.78, 1, pop);
    g.scale.setScalar(s);
    g.position.y = layout.figY + (1 - pop) * -h * 0.22 + Math.sin(clock.elapsedTime * 1.1) * 0.005 * layout.H * smooth(1.9, 2.6, t);
    const ease = 1 - Math.exp(-dt * 4.5);
    g.rotation.y += (pointer.x * 0.2 - g.rotation.y) * ease;
    g.rotation.x += (-pointer.y * 0.06 - g.rotation.x) * ease;
  });

  return (
    <group ref={group} position={[0, layout.figY, 0]}>
      <mesh position={[0.05, -0.07, -0.08]} material={mats.shadow}><planeGeometry args={[w * 1.1, h * 1.1]} /></mesh>
      <mesh position={[0, 0, -0.03]} scale={1.0} material={mats.rim}><planeGeometry args={[w, h]} /></mesh>
      <mesh material={mats.photo}><planeGeometry args={[w, h]} /></mesh>
    </group>
  );
}
