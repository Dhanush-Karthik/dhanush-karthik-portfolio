import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { pointer } from "../lib/pointer";

// L3 — the hero portrait. A transparent cutout on a finely subdivided plane,
// pushed forward by a depth map so it turns with the pointer (or your hand) like
// a 2.5D figure. A die-cut red rim is traced from the alpha in the shader, and it
// "prints" in as dot-matrix halftone on first load.

const vert = /* glsl */ `
uniform sampler2D uDepth;
uniform sampler2D uMap;
uniform float uDepthAmt;
uniform float uHasDepth;
uniform float uPad;
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vec2 iuv = (uv - 0.5) * uPad + 0.5;
  float d = uHasDepth > 0.5 ? texture2D(uDepth, iuv).r : texture2D(uMap, iuv).a;
  d = pow(clamp(d, 0.0, 1.0), 2.2);
  vDepth = d;
  vec3 p = position;
  p.z += d * uDepthAmt;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const frag = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform float uPad;
uniform float uAspect;
uniform float uReveal;
uniform float uTime;
uniform vec3 uRim;
uniform vec3 uInk;
uniform vec3 uPhosphor;
varying vec2 vUv;
varying float vDepth;

float alphaAt(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(uMap, uv).a;
}

void main() {
  vec2 iuv = (vUv - 0.5) * uPad + 0.5;
  vec4 c = texture2D(uMap, iuv);
  float a = alphaAt(iuv);

  // Die-cut rim: dilate the alpha by sampling a ring around the pixel.
  float rim = 0.0;
  vec2 r = vec2(0.018 / uAspect, 0.018);
  for (int i = 0; i < 16; i++) {
    float t = float(i) * 0.3927;
    rim = max(rim, alphaAt(iuv + vec2(cos(t), sin(t)) * r));
  }

  // Dot-matrix print reveal, top to bottom.
  float edge = 1.0 - uReveal * 1.25;
  float y = vUv.y;
  float shown = smoothstep(edge - 0.02, edge + 0.02, y);
  float band = smoothstep(edge + 0.18, edge, y) * shown;
  vec2 cell = gl_FragCoord.xy / 5.0;
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  float dotMask = step(length(fract(cell) - 0.5), (1.0 - lum) * 0.62);
  vec3 halftone = mix(vec3(0.96, 0.95, 0.92), uInk, dotMask);
  vec3 col = mix(c.rgb, halftone, band);
  float scan = smoothstep(0.012, 0.0, abs(y - edge - 0.004)) * (1.0 - step(1.0, uReveal));
  col = mix(col, uPhosphor, scan);

  // Subtle relief light from the depth map.
  col *= 0.94 + vDepth * 0.1;

  // Fade out where the photo is cropped at the bottom so the rim doesn't draw a hard edge.
  float foot = smoothstep(0.0, 0.1, iuv.y);
  vec3 outCol = a > 0.5 ? col : uRim;
  float outA = max(a, rim * step(0.06, iuv.y)) * shown * foot;
  outA = max(outA, scan * rim);
  if (outA < 0.02) discard;
  gl_FragColor = vec4(outCol, outA);
}
`;

function Portrait({ cutout, depth, onReady }) {
  const [map, depthTex] = useLoader(THREE.TextureLoader, [cutout, depth || cutout]);
  const { viewport, invalidate } = useThree();
  const group = useRef();
  const started = useRef(null);
  const readyFired = useRef(false);

  const img = map.image;
  const aspect = img.width / img.height;
  const pad = 1.08;

  const uniforms = useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return {
      uMap: { value: map },
      uDepth: { value: depthTex },
      uHasDepth: { value: depth ? 1 : 0 },
      uDepthAmt: { value: 0.55 },
      uPad: { value: pad },
      uAspect: { value: aspect },
      uReveal: { value: 0 },
      uTime: { value: 0 },
      uRim: { value: new THREE.Color("#E5432D") },
      uInk: { value: new THREE.Color("#111311") },
      uPhosphor: { value: new THREE.Color("#4ADE80") },
    };
  }, [map, depthTex, depth, aspect]);

  // Fit the plane to the canvas height, anchored to the bottom.
  const h = viewport.height * 0.98;
  const w = Math.min(h * aspect, viewport.width * 0.98);
  const fittedH = w / aspect;

  useEffect(() => { invalidate(); }, [invalidate]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (started.current == null) {
      // Wait for the boot loader to finish so the print reveal is visible.
      if (document.documentElement.classList.contains("boot-pending") || document.querySelector(".boot")) return;
      started.current = t;
    }
    const k = Math.min(1, (t - started.current) / 1.6);
    uniforms.uReveal.value = k * k * (3 - 2 * k);
    uniforms.uTime.value = t;
    const g = group.current;
    if (g) {
      g.rotation.y += (pointer.x * 0.42 - g.rotation.y) * 0.06;
      g.rotation.x += (-pointer.y * 0.12 - g.rotation.x) * 0.06;
      g.position.y = -viewport.height / 2 + fittedH / 2 + Math.sin(t * 1.2) * 0.012;
    }
    if (!readyFired.current) { readyFired.current = true; onReady?.(); }
  });

  return (
    <group ref={group}>
      <mesh>
        <planeGeometry args={[w, fittedH, 96, 220]} />
        <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function PortraitScene({ cutout, depth, onReady }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6], fov: 32 }} gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}>
      <Portrait cutout={cutout} depth={depth} onReady={onReady} />
    </Canvas>
  );
}
