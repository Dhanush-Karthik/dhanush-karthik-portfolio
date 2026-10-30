import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { pointer } from "../lib/pointer";
import { SECTION_META } from "../sections/meta";

// L0 — the terminal substrate. A live server log drawn into a canvas texture and
// shown through a CRT shader (barrel warp, scanlines, phosphor bloom, flicker).
// Paper sheets cover it; it shows through terminal frames and the hero tear.

const W = 1024, H = 1024, LINE = 26, ROWS = Math.floor(H / LINE) - 2;
const ROUTES = ["/", "/projects", "/#about", "/#skills", "/etc/hosts", "/resume.pdf", "/#contact", "/api/health"];
const LEVELS = ["INFO", "INFO", "INFO", "DEBUG", "INFO", "WARN"];

function stamp() {
  const d = new Date();
  return d.toISOString().replace("T", " ").slice(0, 23);
}

function logLine(i) {
  const lvl = LEVELS[i % LEVELS.length];
  const route = ROUTES[(i * 7) % ROUTES.length];
  const ms = 3 + ((i * 37) % 41);
  return `${stamp()}  ${lvl.padEnd(5)} 8080 --- [nio-exec-${(i % 9) + 1}] d.k.Portfolio : GET ${route} 200 ${ms}ms`;
}

function useLogTexture(active) {
  const state = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const lines = [
      "  .   ____          _            __ _ _",
      " /\\\\ / ___'_ __ _ _(_)_ __  __ _ \\ \\ \\ \\",
      "( ( )\\___ | '_ | '_| | '_ \\/ _` | \\ \\ \\ \\",
      " \\\\/  ___)| |_)| | | | | || (_| |  ) ) ) )",
      "  '  |____| .__|_| |_|_| |_\\__, | / / / /",
      " =========|_|==============|___/=/_/_/_/",
      " :: Spring Boot ::                (v3.3.4)",
      "",
    ];
    return { canvas, ctx: canvas.getContext("2d"), tex, lines, n: 0 };
  }, []);

  useEffect(() => () => state.tex.dispose(), [state]);

  // Each frame change writes a stack-trace block; a steady log stream runs underneath.
  useEffect(() => {
    const m = SECTION_META[active];
    if (!m) return;
    state.lines.push("", `>>> frame entered: ${m.method}()`, `    at dk.Portfolio.${m.method}(${m.file}.java)`, "    at dk.Stack.next(Stack.java:42)", "    at dk.Main.main(Main.java:1)", `$ ${m.cmd}`);
  }, [active, state]);

  useEffect(() => {
    const id = setInterval(() => { state.lines.push(logLine(state.n++)); }, 420);
    return () => clearInterval(id);
  }, [state]);

  return state;
}

function draw(state) {
  const { ctx, lines, tex } = state;
  while (lines.length > ROWS) lines.shift();
  ctx.fillStyle = "#040a06";
  ctx.fillRect(0, 0, W, H);
  ctx.font = "500 17px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textBaseline = "top";
  lines.forEach((l, i) => {
    ctx.fillStyle = l.startsWith(">>>") || l.startsWith("$") ? "#b8ffcf" : l.includes("WARN") ? "#f2c94c" : l.startsWith("    at") ? "#ff8a78" : "#4ade80";
    ctx.globalAlpha = 0.35 + 0.65 * (i / lines.length);
    ctx.fillText(l, 28, 24 + i * LINE);
  });
  ctx.globalAlpha = 1;
  tex.needsUpdate = true;
}

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uText;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uPointer;

vec2 barrel(vec2 uv, float k) {
  vec2 c = uv * 2.0 - 1.0;
  c *= 1.0 + k * dot(c, c);
  return c * 0.5 + 0.5;
}

void main() {
  vec2 uv = barrel(vUv, 0.06);
  float aspect = uRes.x / uRes.y;
  // Text texture is square: tile it across wide screens, scaled by height.
  vec2 tuv = vec2(uv.x * aspect * 0.62, uv.y * 0.95 + 0.03);
  tuv += uPointer * 0.006;
  tuv.y = 1.0 - tuv.y;
  float ca = 0.0016;
  float r = texture2D(uText, fract(tuv + vec2(ca, 0.0))).r;
  float g = texture2D(uText, fract(tuv)).g;
  float b = texture2D(uText, fract(tuv - vec2(ca, 0.0))).b;
  vec3 col = vec3(r, g, b);
  // Cheap bloom: a few wide taps.
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0472;
    glow += texture2D(uText, fract(tuv + vec2(cos(a), sin(a)) * 0.004)).rgb;
  }
  col += glow / 6.0 * 0.55;
  // Scanlines and slow roll bar.
  float scan = 0.82 + 0.18 * sin(uv.y * uRes.y * 1.6);
  float roll = smoothstep(0.0, 0.08, abs(fract(uv.y * 0.6 - uTime * 0.05) - 0.5));
  col *= scan * (0.88 + 0.12 * roll);
  col *= 0.42; // keep it a substrate, not a light source
  // Vignette and bezel falloff.
  vec2 d = uv - 0.5;
  col *= smoothstep(0.82, 0.25, length(d * vec2(1.0, 1.15)));
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
  col += vec3(0.012, 0.03, 0.018);
  col *= 0.97 + 0.03 * sin(uTime * 60.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

function Screen({ active }) {
  const state = useLogTexture(active);
  const { size } = useThree();
  const mat = useRef();
  const uniforms = useMemo(() => ({
    uText: { value: state.tex },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPointer: { value: new THREE.Vector2() },
  }), [state]);
  const last = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;
    uniforms.uRes.value.set(size.width, size.height);
    uniforms.uPointer.value.set(pointer.x, pointer.y);
    if (t - last.current > 0.2) { last.current = t; draw(state); }
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} depthWrite={false} />
    </mesh>
  );
}

export default function CrtBackground({ active }) {
  return (
    <Canvas className="crt-canvas" dpr={[0.75, 1]} gl={{ antialias: false, powerPreference: "low-power", alpha: false }} frameloop="always" style={{ position: "fixed" }}>
      <Screen active={active} />
    </Canvas>
  );
}
