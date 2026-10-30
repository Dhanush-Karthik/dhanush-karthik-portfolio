// Point-cloud targets for the About stage. Every scene fills the same number of
// particles (x, y, z, tone) so the shader can fly each particle from one scene to the
// next. Tone picks the palette slot: 0 dim, 1 phosphor, 2 signal, 3 tape.
// A scene is words (lines of text, each with its own size) or a grid of big numbers;
// both are drawn on a canvas, then sampled. Scenes sit inside roughly ±4.3 × ±2.4 world units.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 1500;               // canvas width in px; 8.6 world units wide
const UNIT = 8.6 / W;
const MAX_H = 4.5 / UNIT;     // tallest block of text that still fits the stage
const TONES = [2, 1, 3, 1];   // signal, phosphor, tape, phosphor — per line
const DUST = 0.025;           // share of particles left drifting around the words

function canvas(h, stretch = "expanded") {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = h;
  const g = cv.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  try { g.fontStretch = stretch; } catch { /* older browsers */ }
  return { cv, g };
}

// Lay lines out as a poster: every line as large as fits the width, stacked, then the
// whole block scaled down if it is too tall. Returns the sampled pixels and their line.
function layout(lines, fontFamily, cap, stretch) {
  const probe = canvas(10, stretch).g;
  const sized = lines.map((text) => {
    probe.font = `900 100px ${fontFamily}`;
    const w = Math.max(1, probe.measureText(text).width);
    return { text, size: Math.min(cap, (100 * W * 0.94) / w) };
  });
  const gap = 0.22;
  let total = sized.reduce((s, l) => s + l.size * (0.72 + gap), 0);
  const k = total > MAX_H ? MAX_H / total : 1;
  total *= k;
  const H = Math.ceil(total + 40);
  const { g } = canvas(H, stretch);
  let y = 20;
  const rows = [];
  sized.forEach((l, i) => {
    const size = l.size * k;
    g.font = `900 ${size}px ${fontFamily}`;
    y += size * 0.72;                       // cap height ≈ .72 em
    g.fillText(l.text, W / 2, y);
    rows.push({ i, from: y - size * 0.8, to: y + size * 0.1 });
    y += size * gap;
  });
  const d = g.getImageData(0, 0, W, H).data;
  return { d, H, cell: (_, yy) => { const row = rows.find((r) => yy >= r.from && yy <= r.to); return row ? row.i : 0; } };
}

// Lit pixels of a drawn canvas, thinned on a regular grid just enough that there are no more of
// them than particles. Every lit cell then gets at least one particle, so the letters come out
// solid with crisp edges instead of a random speckle with holes in it.
function gather({ d, H, cell }, n) {
  const lit = (x, y) => d[(y * W + x) * 4 + 3] > 110;
  let all = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (lit(x, y)) all++;
  const step = Math.max(1, Math.ceil(Math.sqrt(all / Math.max(1, n * 0.97))));
  const px = [];
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (lit(x, y)) px.push(x, y, cell(x, y));
  return { px, H, step };
}

function sample(n, seed, src, toneOf) {
  const r = rng(seed);
  const { px, H, step } = gather(src, n);
  const out = new Float32Array(n * 4);
  const cnt = px.length / 3;
  // cells are handed out in a shuffled order, so every one is covered before any is used twice
  const order = new Uint32Array(cnt);
  for (let i = 0; i < cnt; i++) order[i] = i;
  for (let i = cnt - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
  let next = 0;
  for (let i = 0; i < n; i++) {
    if (r() < DUST || cnt === 0) {
      out[i * 4] = (r() * 2 - 1) * 5.2;
      out[i * 4 + 1] = (r() * 2 - 1) * 2.7;
      out[i * 4 + 2] = (r() - 0.5) * 3;
      out[i * 4 + 3] = 0;
      continue;
    }
    const k = order[next++ % cnt] * 3;
    out[i * 4] = (px[k] - W / 2 + r() * step) * UNIT;
    out[i * 4 + 1] = -(px[k + 1] - H / 2 + r() * step) * UNIT;
    out[i * 4 + 2] = (r() - 0.5) * 0.12;
    out[i * 4 + 3] = toneOf(px[k + 2], r);
  }
  return out;
}

// The opening word: one line, mostly signal red with a few bright flecks.
export function makeHello(n, word, fontFamily) {
  return sample(n, 7, layout([word], fontFamily, 250, "expanded"), (_, r) => (r() < 0.88 ? 2 : 3));
}

// The words that matter in a paragraph, written large. Long phrases are broken into one word
// per line so every letter stays big enough to read; each phrase keeps its own colour.
export function makeWords(n, phrases, fontFamily, seed = 11) {
  const split = phrases.some((p) => p.length > 13);
  const lines = [], group = [];
  phrases.forEach((p, pi) => {
    const parts = split ? p.split(" ") : [p];
    if (lines.length + parts.length > 6 && lines.length) return;
    parts.forEach((w) => { lines.push(w); group.push(pi); });
  });
  return sample(n, seed, layout(lines, fontFamily, 300, "semi-condensed"), (line, r) => (r() < 0.05 ? 3 : TONES[group[line] % TONES.length]));
}

// The stats: big numbers in a grid (a row for one or two, 2 × 2 for up to four).
export function makeStats(n, values, fontFamily) {
  const vals = values.slice(0, 4);
  const cols = vals.length > 2 ? 2 : vals.length;
  const rowsN = Math.ceil(vals.length / cols);
  const cellW = W / cols;
  const H = Math.min(MAX_H, rowsN * 330) + 40;
  const { g } = canvas(H);
  const rowH = (H - 40) / rowsN;
  const probe = g;
  // one size for every number, so none looks smaller than the rest
  probe.font = `900 100px ${fontFamily}`;
  const fit = vals.map((v) => (100 * cellW * 0.8) / Math.max(1, probe.measureText(String(v)).width));
  const size = Math.min(rowH * 1.05, ...fit);
  vals.forEach((v, i) => {
    const text = String(v);
    const sz = /\d/.test(text) ? size : size * 1.7;   // a lone symbol (∞) draws small
    g.font = `900 ${sz}px ${fontFamily}`;
    const cx = (i % cols) * cellW + cellW / 2;
    const cy = 20 + Math.floor(i / cols) * rowH + rowH / 2 + size * 0.36;
    g.fillText(text, cx, cy);
  });
  const d = g.getImageData(0, 0, W, H).data;
  const cell = (x, y) => Math.min(rowsN - 1, Math.floor(Math.max(0, y - 20) / rowH)) * cols + Math.min(cols - 1, Math.floor(x / cellW));
  return sample(n, 19, { d, H, cell }, (c, r) => (r() < 0.05 ? 3 : [2, 3, 1, 2][c % 4]));
}

// ---- which words to write for a paragraph ----

// Phrases worth writing out, on top of whatever the CMS lists as skills.
const PHRASES = [
  "spring boot", "microservices", "rest apis", "rest api", "restful", "keycloak", "oauth2", "oauth", "jwt", "iam", "sso", "kafka", "rabbitmq",
  "docker", "kubernetes", "aws", "azure", "gcp", "ci/cd", "devops", "postgresql", "postgres", "mysql", "mongodb", "redis", "graphql", "grpc",
  "java", "kotlin", "python", "typescript", "react", "clean code", "robust testing", "testing", "api contracts", "system design", "systems thinking",
  "backend architecture", "distributed systems", "open-source", "open source", "computer science", "event-driven", "domain-driven design",
  "solid foundations", "system design patterns", "design patterns", "scalability", "observability",
];
const STOP = new Set("about after again also always and any are because been before being between both build building but can could crafting day each even ever every for from gets great have having into its just like love make many more most much must not now one only other our out over own same she should some such than that the their them then there these they this those through too under until very want was were what when where which while who why will with within would you your when's it's i'm i've where's".split(" "));

export function highlights(text, skills = [], max = 4) {
  const lower = text.toLowerCase();
  const vocab = [...new Set([...skills.map((s) => String(s).toLowerCase()), ...PHRASES])].filter((v) => v.length > 1);
  const hits = [];
  for (const v of vocab) {
    const esc = v.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    const m = new RegExp(`(^|[^\\w-])${esc}(?![\\w-])`, "i").exec(lower);
    if (m) hits.push({ at: m.index + m[1].length, end: m.index + m[1].length + v.length, v });
  }
  // longer phrases win when they overlap ("spring boot" over "spring")
  hits.sort((a, b) => (b.end - b.at) - (a.end - a.at));
  const kept = [];
  hits.forEach((h) => { if (!kept.some((k) => h.at < k.end && h.end > k.at)) kept.push(h); });
  kept.sort((a, b) => a.at - b.at);
  let words = kept.map((h) => text.slice(h.at, h.end));

  if (words.length < 2) {
    // nothing recognised: fall back to the longest plain words
    const plain = (text.match(/[A-Za-z][A-Za-z-]{4,}/g) || []).filter((w) => !STOP.has(w.toLowerCase()));
    const pick = [...new Set(plain.map((w) => w.toLowerCase()))].sort((a, b) => b.length - a.length).slice(0, 3);
    words = [...words, ...pick.map((w) => plain.find((p) => p.toLowerCase() === w))].slice(0, 3);
  }
  return words.slice(0, max).map((w) => w.toUpperCase());
}
