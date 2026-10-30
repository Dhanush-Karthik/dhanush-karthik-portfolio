import * as THREE from "three";

export const CW = 1.9;
export const CARD_PX_W = 512;
export const CARD_PX_H = 704;
export const CH = CW * (CARD_PX_H / CARD_PX_W);

const P = 32;
const WIN = { x: P, y: 84, w: CARD_PX_W - P * 2, h: 280 };
// the window in uv space (v is up), where the card shader shows the live motif
export const WIN_UV = [WIN.x / CARD_PX_W, 1 - (WIN.y + WIN.h) / CARD_PX_H, (WIN.x + WIN.w) / CARD_PX_W, 1 - WIN.y / CARD_PX_H];

function wrap(ctx, text, maxW, maxLines) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "…");
  return lines;
}

// The typography of one card: everything but the window, which is left transparent.
export async function makeFace(p) {
  await Promise.all([
    document.fonts?.load("900 52px Archivo"),
    document.fonts?.load('500 20px "JetBrains Mono"'),
  ].filter(Boolean)).catch(() => {});
  const c = document.createElement("canvas");
  c.width = CARD_PX_W; c.height = CARD_PX_H;
  const ctx = c.getContext("2d");
  const { bg, fg, accent } = p.style;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_PX_W, CARD_PX_H);
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = fg;
  for (let x = 0; x < CARD_PX_W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CARD_PX_H); ctx.stroke(); }
  for (let y = 0; y < CARD_PX_H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_PX_W, y); ctx.stroke(); }
  ctx.globalAlpha = 1;

  ctx.textBaseline = "top";
  ctx.fillStyle = fg;
  ctx.font = '600 20px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText(p.num, P, P);
  const tag = (p.tag || "").toUpperCase();
  ctx.fillText(tag, CARD_PX_W - P - ctx.measureText(tag).width, P);
  ctx.fillStyle = accent;
  ctx.fillRect(P, P + 34, 36, 3);

  // window: punched out so the shader can show the live motif there
  ctx.clearRect(WIN.x, WIN.y, WIN.w, WIN.h);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 3;
  ctx.strokeRect(WIN.x - 1.5, WIN.y - 1.5, WIN.w + 3, WIN.h + 3);

  let y = WIN.y + WIN.h + 28;
  ctx.fillStyle = fg;
  ctx.font = '900 46px Archivo, "Arial Black", sans-serif';
  if ("fontStretch" in ctx) ctx.fontStretch = "expanded";
  const lines = wrap(ctx, (p.card || p.title).toUpperCase(), CARD_PX_W - P * 2, 3);
  lines.forEach((l, i) => ctx.fillText(l, P, y + i * 46));
  y += lines.length * 46 + 14;
  if ("fontStretch" in ctx) ctx.fontStretch = "normal";
  ctx.font = "400 21px Archivo, system-ui, sans-serif";
  ctx.globalAlpha = 0.88;
  wrap(ctx, p.tagline, CARD_PX_W - P * 2, lines.length > 2 ? 1 : 2).forEach((l, i) => ctx.fillText(l, P, y + i * 28));
  ctx.globalAlpha = 1;

  ctx.font = '500 16px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = fg;
  ctx.fillText((p.tech || []).slice(0, 3).join(" · "), P, CARD_PX_H - P - 52);
  for (let i = 0, x = CARD_PX_W - P - 120; i < 34; i++) {
    const w = (i * 7) % 3 + 1;
    if (i % 2 === 0) ctx.fillRect(x, CARD_PX_H - P - 26, w, 26);
    x += w + 2;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---- the card material ----
// One plane per card. The vertex shader makes it paper (a travelling flutter that grows with how
// fast it is falling, and a bow); the fragment shader rounds the corners with a signed-distance
// field (alpha-to-coverage keeps the edge smooth and depth-correct), samples the typography and the
// motif target, adds a foil band that follows the cursor, and draws the card's back when it is
// tumbling face-away.
const VERT = /* glsl */ `
  uniform float uTime, uFlutter, uSeed;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  vec3 bend(vec3 p) {
    float a = uFlutter;
    float w = sin(p.y * 2.3 + uTime * 10.0 + uSeed * 6.283) * 0.55 + sin(p.x * 3.4 - uTime * 8.0 + uSeed * 11.0) * 0.45;
    float edge = 0.35 + 0.65 * abs(p.x) / ${(CW / 2).toFixed(3)};
    p.z += w * a * 0.2 * edge;
    p.z += a * 0.26 * (1.0 - (p.y * p.y) / ${((CH / 2) ** 2).toFixed(3)});
    return p;
  }
  void main() {
    vUv = uv;
    vec3 p0 = bend(position);
    vec3 px = bend(position + vec3(0.02, 0.0, 0.0));
    vec3 py = bend(position + vec3(0.0, 0.02, 0.0));
    vec3 n = normalize(cross(px - p0, py - p0));
    vec4 wp = modelMatrix * vec4(p0, 1.0);
    vN = normalize(mat3(modelMatrix) * n);
    vV = cameraPosition - wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uFace, uMotif;
  uniform vec4 uWin;
  uniform vec2 uSize, uMouse;
  uniform float uHover, uSel, uTime, uDim;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  float sdRound(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float d = sdRound(p, uSize * 0.5, 0.11);
    float aa = max(fwidth(d), 0.0005);
    float mask = 1.0 - smoothstep(-aa, aa, d);
    if (mask < 0.01) discard;
    vec3 N = normalize(vN);
    vec3 V = normalize(vV);
    vec3 col;
    if (gl_FrontFacing) {
      vec4 f = texture2D(uFace, vUv);
      vec2 mv = clamp((vUv - uWin.xy) / (uWin.zw - uWin.xy), 0.0, 1.0);
      vec3 m = texture2D(uMotif, mv).rgb;
      col = mix(m, f.rgb, f.a);
      float fres = pow(1.0 - abs(dot(N, V)), 2.0);
      float band = dot(vUv - uMouse, normalize(vec2(1.0, 0.6)));
      float sheen = exp(-pow(band * 4.5, 2.0));
      vec3 hue = 0.5 + 0.5 * cos(6.283 * (vec3(0.0, 0.33, 0.67) + band * 1.6 + fres + uTime * 0.04));
      col += hue * sheen * 0.11 * uHover;
      col += hue * fres * 0.06 * (uHover + uSel);
      col *= 0.9 + 0.1 * dot(N, normalize(vec3(0.3, 0.6, 0.8)));
    } else {
      vec2 g = vUv * vec2(9.0, 12.0);
      float dia = abs(fract(g.x + g.y) - 0.5) + abs(fract(g.x - g.y) - 0.5);
      float line = 1.0 - smoothstep(0.46, 0.5, dia);
      float ring = 1.0 - smoothstep(0.0, 0.012, abs(length(p * vec2(1.0, 0.8)) - 0.55));
      col = mix(vec3(0.016, 0.02, 0.016), vec3(0.07, 0.4, 0.2), line * 0.35 + ring * 0.8);
    }
    col *= 1.0 - 0.2 * smoothstep(-0.07, 0.0, d);
    col = mix(col, vec3(0.62), uDim);
    gl_FragColor = vec4(col, mask);
    #include <colorspace_fragment>
  }
`;

export function makeCardMaterial(motifTex, seed) {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    alphaToCoverage: true,
    uniforms: {
      uFace: { value: null },
      uMotif: { value: motifTex },
      uWin: { value: new THREE.Vector4(...WIN_UV) },
      uSize: { value: new THREE.Vector2(CW, CH) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uTime: { value: 0 },
      uFlutter: { value: 0 },
      uSeed: { value: seed },
      uHover: { value: 0 },
      uSel: { value: 0 },
      uDim: { value: 0 },
    },
  });
  return m;
}

export function cardGeometry() {
  return new THREE.PlaneGeometry(CW, CH, 18, 26);
}
