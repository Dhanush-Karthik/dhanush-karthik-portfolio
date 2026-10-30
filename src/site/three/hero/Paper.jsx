import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { pointer } from "../../lib/pointer";
import { stage, clamp, inOutCubic, readPalette } from "./state";

// The page itself: a full-screen shader. It starts as the dark terminal ground
// (same colour as the boot screen, so the hand-off is invisible), draws a green
// grid, then paper floods in from the centre behind a glowing phosphor ring.

const vert = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;

const frag = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform float uIris;
uniform float uTime;
uniform vec2 uPointer;
uniform vec3 uPaper, uGrid, uDark, uTerm, uPhos;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float gridLine(vec2 cp, float cell) {
  vec2 f = fract(cp / cell);
  vec2 d = min(f, 1.0 - f) * cell;
  float w = 1.1;
  return 1.0 - smoothstep(0.0, w, min(d.x, d.y));
}

vec3 paperAt(vec2 cp, vec2 off) {
  vec3 pc = mix(uPaper, uGrid, gridLine(cp + off, 28.0) * 0.9);
  return pc * (0.985 + 0.03 * n2(cp * 0.012));
}

void main() {
  vec2 cp = gl_FragCoord.xy / uDpr;                    // css pixels, y up
  vec2 css = uRes / uDpr;
  vec2 c = css * vec2(0.5, 0.46);
  float hd = 0.5 * length(css);
  vec2 pv = cp - c;
  float rr = length(pv);
  vec2 dir = pv / max(rr, 1e-3);
  float ang = atan(pv.y, pv.x);
  float k = uIris;
  float env = smoothstep(0.0, 0.05, k) * (1.0 - smoothstep(0.9, 1.0, k));

  // The portal edge: a slow, smooth swell (angle-based, so no value-noise blocks).
  float amp = 0.014 * hd * smoothstep(0.0, 0.25, k) * (1.0 - smoothstep(0.82, 1.0, k));
  float wob = amp * (0.55 * sin(ang * 3.0 + uTime * 0.9) + 0.35 * sin(ang * 5.0 - uTime * 1.3) + 0.22 * sin(ang * 9.0 + uTime * 2.1));
  float R = k * 1.22 * hd;
  float sd = rr - (R + wob);                           // px: >0 outside the portal, <0 inside
  float aa = max(fwidth(sd), 0.75);
  float inside = 1.0 - smoothstep(-aa, aa, sd);

  // Space bends around the rim: the terminal grid is pushed outward, the paper is pulled in.
  float bend = exp(-pow(sd / (0.07 * hd + 8.0), 2.0)) * env;
  vec2 cpD = cp - dir * bend * 26.0;
  vec2 off = uPointer * 6.0;
  float zoom = 1.0 + 0.06 * (1.0 - k);
  vec2 cpP = c + pv * zoom + dir * 10.0 * exp(-pow(sd / 22.0, 2.0)) * env;

  // Paper, with a faint chromatic split right at the rim.
  float ca = 3.0 * exp(-pow(sd / 16.0, 2.0)) * env;
  vec3 paper = vec3(paperAt(cpP + dir * ca, off).r, paperAt(cpP, off).g, paperAt(cpP - dir * ca, off).b);
  paper *= 1.0 - 0.07 * pow(rr / hd, 2.0);
  float lit = exp(sd / 70.0) * (1.0 - step(0.0, sd)) * env;     // phosphor light spilling onto the paper
  paper = mix(paper, paper * vec3(0.8, 1.0, 0.84), lit * 0.55);

  // Terminal ground: green grid, lit from the rim.
  float g1 = gridLine(cpD, 28.0) * 0.55 + gridLine(cpD, 140.0) * 0.5;
  vec3 dark = uDark + uTerm * g1 * 0.9;
  dark += uPhos * g1 * 0.5 * exp(-max(sd, 0.0) / (0.16 * hd)) * env;
  dark += uPhos * 0.02 * smoothstep(0.35, 0.0, abs(rr / hd - 0.5));

  vec3 col = mix(dark, paper, inside);

  // The rim: a hot core with a sweeping highlight, bloom either side, and two
  // HUD rings (ticks and long dashes) turning in opposite directions.
  float sweep = pow(0.5 + 0.5 * cos(ang - uTime * 2.6), 5.0);
  float core = exp(-pow(sd / 2.6, 2.0)) * (1.2 + 2.0 * sweep);
  float bloom = (sd > 0.0 ? exp(-sd / 30.0) * 0.5 : exp(sd / 70.0) * 0.22);
  float tickMask = exp(-pow((sd - 30.0) / 2.2, 2.0));
  float tick = smoothstep(0.0, 0.1, fract(ang / 6.28318 * 90.0 + uTime * 0.35)) * (1.0 - smoothstep(0.38, 0.48, fract(ang / 6.28318 * 90.0 + uTime * 0.35)));
  float dashMask = exp(-pow((sd - 58.0) / 1.4, 2.0));
  float dash = smoothstep(0.0, 0.02, fract(ang / 6.28318 * 12.0 - uTime * 0.12)) * (1.0 - smoothstep(0.55, 0.58, fract(ang / 6.28318 * 12.0 - uTime * 0.12)));
  float fade = env * (1.0 - smoothstep(0.7, 0.96, k));
  vec3 hot = mix(uPhos, vec3(1.0), 0.45);
  col += hot * core * env * 1.5;
  col += uPhos * bloom * env * 0.9;
  col += uPhos * (tickMask * tick * 0.55 + dashMask * dash * 0.45) * fade;

  col -= (h21(gl_FragCoord.xy + 3.1) - 0.5) * (0.022 * inside + 0.006);   // grain / dither
  gl_FragColor = vec4(col, 1.0);
}
`;

export default function Paper() {
  const { gl } = useThree();
  const uniforms = useMemo(() => {
    const p = readPalette();
    const col = (v) => ({ value: new THREE.Color(v) });
    return {
      uRes: { value: new THREE.Vector2(1, 1) },
      uDpr: { value: 1 },
      uIris: { value: 0 },
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uPaper: col(p.paper), uGrid: col(p.paper2), uDark: col("#07110A"), uTerm: col(p.termLine), uPhos: col(p.phosphor),
    };
  }, []);

  useFrame(({ clock }) => {
    const t = stage.t;
    const k = inOutCubic(clamp((t - 0.05) / 1.7));
    uniforms.uIris.value = k;
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uDpr.value = gl.getPixelRatio();
    const s = gl.getDrawingBufferSize(new THREE.Vector2());
    uniforms.uRes.value.copy(s);
    uniforms.uPointer.value.set(pointer.x, pointer.y);
  });

  return (
    <mesh frustumCulled={false} renderOrder={-100}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} depthWrite={false} depthTest={false} />
    </mesh>
  );
}
