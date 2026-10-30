// Canvas-drawn security printing for the certificate: guilloche borders and rosettes, microprint, the issued
// back face (filled in when the message is signed), the seal imprint and the hex glyph atlas.
import * as THREE from "three";

const INK = "#111311", RED = "#B0261C", GOLD = "#B88A1E", BLUE = "#1B2A6B";
const DISPLAY = '900 {s}px Archivo, "Arial Black", Impact, sans-serif';
const HAND = '700 {s}px Caveat, "Comic Sans MS", cursive';
const MONO = '500 {s}px "JetBrains Mono", ui-monospace, Menlo, monospace';
const font = (tpl, s) => tpl.replace("{s}", s.toFixed(1));

const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

function makeCanvas(w, h, k) {
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const g = c.getContext("2d");
  g.scale(k, k);
  return [c, g];
}
const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; return t; };

function rectPoint(f, X0, Y0, X1, Y1, d) {
  const x0 = X0 + d, y0 = Y0 + d, x1 = X1 - d, y1 = Y1 - d, W = x1 - x0, H = y1 - y0, s = f * 2 * (W + H);
  if (s < W) return [x0 + s, y0];
  if (s < W + H) return [x1, y0 + s - W];
  if (s < 2 * W + H) return [x1 - (s - W - H), y1];
  return [x0, y1 - (s - 2 * W - H)];
}

// Interlaced sine waves round the border: the same trick banknotes use.
function guillocheBorder(g, w, h, seed) {
  const rnd = seeded(seed), X0 = 0, Y0 = 0, X1 = w, Y1 = h;
  const perim = 2 * (w + h), cycles = Math.round(perim / 64), n = 12, N = Math.round(perim / 1.6);
  const bands = [
    { inset: 24, amp: 7.5, cycles, cols: [["rgba(184,138,30,.85)", 3], ["rgba(17,19,17,.45)", 1], ["rgba(176,38,28,.5)", 2]] },
    { inset: 24, amp: 5, cycles: Math.round(cycles * 1.5), cols: [["rgba(17,19,17,.28)", 1]], phase: 0.5 },
  ];
  g.lineWidth = 0.65; g.lineJoin = "round";
  bands.forEach((b) => {
    for (let k = 0; k < n; k++) {
      if (b.phase && k % 2) continue;
      g.strokeStyle = b.cols[k % b.cols.length][0];
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const f = i / N, ph = f * b.cycles * 6.2831853 + (k / n) * 6.2831853 + (b.phase || 0);
        const env = 1 + 0.28 * Math.sin(f * 6.2831853 * 5 + k * 0.3);
        const [x, y] = rectPoint(f, X0, Y0, X1, Y1, b.inset + Math.sin(ph) * b.amp * env);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath(); g.stroke();
    }
  });
  g.strokeStyle = INK; g.lineWidth = 1.8; g.strokeRect(10, 10, w - 20, h - 20);
  g.strokeStyle = "rgba(176,38,28,.85)"; g.lineWidth = 0.8; g.strokeRect(14.5, 14.5, w - 29, h - 29);
  g.strokeStyle = "rgba(17,19,17,.55)"; g.lineWidth = 0.8; g.strokeRect(38, 38, w - 76, h - 76);
  rnd();
}

// A rosette is a ring of circles, each as wide as the ring is.
function rosette(g, cx, cy, size, n, col, lw = 0.6, twist = 0) {
  const a = size / 2.5;
  g.strokeStyle = col; g.lineWidth = lw;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 6.2831853 + twist;
    g.beginPath(); g.arc(cx + Math.cos(t) * a, cy + Math.sin(t) * a, a, 0, 6.2831853); g.stroke();
  }
}

function paperBase(g, w, h, rnd) {
  g.fillStyle = "#F7F1E0"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) {
    const x = rnd() * w, y = rnd() * h, r = 40 + rnd() * 150, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(168,138,84,0.08)"); gr.addColorStop(1, "rgba(168,138,84,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.lineWidth = 0.7;
  for (let i = 0; i < 1300; i++) {
    const x = rnd() * w, y = rnd() * h, a = rnd() * 6.28, l = 3 + rnd() * 9;
    g.strokeStyle = `rgba(110,90,60,${0.03 + rnd() * 0.05})`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}

function microprint(g, w, h) {
  g.fillStyle = "rgba(17,19,17,.55)"; g.font = font(MONO, 4.6);
  if ("letterSpacing" in g) g.letterSpacing = "0.6px";
  const s = "DHANUSH KARTHIK ROOT CA ❖ TRUSTED CHANNEL ❖ ".repeat(8);
  g.save(); g.beginPath(); g.rect(18, 17.5, w - 36, 5); g.clip(); g.fillText(s, 20, 21.5); g.restore();
  g.save(); g.beginPath(); g.rect(18, h - 22.5, w - 36, 5); g.clip(); g.fillText(s, 20, h - 18.5); g.restore();
  if ("letterSpacing" in g) g.letterSpacing = "0px";
}

export function frontPaper(w, h) {
  const [c, g] = makeCanvas(w, h, 1.5), rnd = seeded(23);
  paperBase(g, w, h, rnd);
  rosette(g, w * 0.5, h * 0.52, Math.min(w, h) * 0.78, 44, "rgba(17,19,17,.05)", 0.7);
  rosette(g, w * 0.5, h * 0.52, Math.min(w, h) * 0.56, 30, "rgba(176,38,28,.06)", 0.7, 0.1);
  guillocheBorder(g, w, h, 5);
  microprint(g, w, h);
  return tex(c);
}

// ----------------------------------------------------------------- the issued face
// One place decides where everything sits so the 3D signature and seal land on the printed line and the seal ring.
export function backLayout(w, h) {
  const wide = w / h > 1.2, f = Math.max(0.62, Math.min(1.15, Math.min(w / 760, h / 500) * (wide ? 1 : 1.18)));
  if (wide) {
    return { wide, f, title: 0.135, name: 0.38, who: 0.45, data: 0.52, cols: [0.09, 0.53], art: [0.5, 0.67], sig: { x0: 0.085, x1: 0.43, lineY: 0.865 }, stamp: { x: 0.81, y: 0.76, r: 56 * f } };
  }
  return { wide, f, title: 0.11, name: 0.26, who: 0.325, data: 0.38, cols: [0.1, 0.1], art: [0.7, 0.665], sig: { x0: 0.09, x1: 0.56, lineY: 0.9 }, stamp: { x: 0.74, y: 0.8, r: 50 * f } };
}

export function backBase(w, h) {
  const [c, g] = makeCanvas(w, h, 1.5), rnd = seeded(77);
  paperBase(g, w, h, rnd);
  rosette(g, w * 0.5, h * 0.5, Math.min(w, h) * 0.95, 56, "rgba(17,19,17,.06)", 0.7);
  rosette(g, w * 0.5, h * 0.5, Math.min(w, h) * 0.7, 40, "rgba(176,38,28,.07)", 0.7, 0.07);
  rosette(g, w * 0.5, h * 0.5, Math.min(w, h) * 0.45, 28, "rgba(184,138,30,.12)", 0.7);
  guillocheBorder(g, w, h, 9);
  microprint(g, w, h);
  return [c, g];
}

function fit(g, text, max, tpl, size) {
  let s = size;
  g.font = font(tpl, s);
  while (g.measureText(text).width > max && s > 10) { s -= 2; g.font = font(tpl, s); }
}
const mid = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function drawIssued(g, w, h, cert) {
  const L = backLayout(w, h), f = L.f, cx = w / 2;
  g.textBaseline = "alphabetic"; g.textAlign = "center";
  if ("letterSpacing" in g) g.letterSpacing = `${(2.6 * f).toFixed(1)}px`;
  g.fillStyle = RED; g.font = font(MONO, 10.5 * f);
  g.fillText("TLS CERTIFICATE · X.509 v3", cx, h * L.title - 24 * f);
  if ("letterSpacing" in g) g.letterSpacing = "0px";
  g.fillStyle = INK; fit(g, "CERTIFICATE OF CONTACT", w * 0.74, DISPLAY, 28 * f);
  g.fillText("CERTIFICATE OF CONTACT", cx, h * L.title + 6 * f);
  g.fillStyle = "rgba(17,19,17,.7)"; g.font = font(HAND, 19 * f);
  g.fillText("this certifies that", cx, h * L.name - 38 * f);
  g.fillStyle = BLUE; fit(g, cert.name, w * 0.74, HAND, 54 * f);
  g.fillText(cert.name, cx, h * L.name);
  g.strokeStyle = "rgba(17,19,17,.55)"; g.lineWidth = 1; g.beginPath(); g.moveTo(w * 0.16, h * L.name + 8 * f); g.lineTo(w * 0.84, h * L.name + 8 * f); g.stroke();
  g.fillStyle = "rgba(17,19,17,.78)"; g.font = font(MONO, 10.5 * f);
  const who = cert.email ? `<${mid(cert.email, 34)}>  has opened a trusted channel with Dhanush Karthik` : "has opened a trusted channel with Dhanush Karthik";
  fit(g, who, w * 0.82, MONO, 10.5 * f);
  g.fillText(who, cx, h * L.who);

  // data block
  g.textAlign = "left";
  const rows = [
    ["Serial", mid(cert.serial, L.wide ? 26 : 24)], ["Validity", `${cert.notBefore} → ${cert.notAfter}`],
    ["Signature", cert.sigAlg], ["Public key", `ECDSA P-256  ${mid(cert.pub.replace(/^04:/, ""), L.wide ? 17 : 12)}`],
  ];
  const lh = 15.5 * f, y0 = h * L.data;
  rows.forEach(([k, v], i) => {
    const x = L.wide ? w * L.cols[i % 2 ? 1 : 0] : w * L.cols[0], y = L.wide ? y0 + Math.floor(i / 2) * lh * 2.1 : y0 + i * lh;
    g.fillStyle = RED; g.font = font(MONO, 8 * f); g.fillText(k.toUpperCase(), x, y);
    g.fillStyle = INK; g.font = font(MONO, 9.6 * f);
    if (L.wide) g.fillText(v, x, y + lh * 0.95); else g.fillText(v, x + 62 * f, y);
  });
  const fy = L.wide ? y0 + lh * 4.35 : y0 + lh * 4.6;
  g.fillStyle = RED; g.font = font(MONO, 8 * f); g.fillText("SHA-256 FINGERPRINT", w * L.cols[0], fy);
  g.fillStyle = INK; g.font = font(MONO, 8.4 * f);
  cert.fpLines.forEach((s, i) => g.fillText(s, w * L.cols[0], fy + lh * (0.95 + i * 0.85)));

  // randomart
  const aw = 17 * 5.5 * f, ah = 9 * 10.6 * f, ax = w * L.art[0] - aw / 2 - (L.wide ? 0 : 0), ay = h * L.art[1] - (L.wide ? 0 : ah / 2) + (L.wide ? 0 : 0);
  g.fillStyle = "rgba(17,19,17,.06)"; g.fillRect(ax - 7 * f, ay - 4 * f, aw + 14 * f, ah + 8 * f);
  g.strokeStyle = "rgba(17,19,17,.6)"; g.lineWidth = 0.8; g.strokeRect(ax - 7 * f, ay - 4 * f, aw + 14 * f, ah + 8 * f);
  g.fillStyle = INK; g.font = font(MONO, 8.6 * f);
  cert.art.forEach((row, i) => g.fillText(row, ax, ay + 8 * f + i * 10.6 * f));
  g.fillStyle = RED; g.font = font(MONO, 6.6 * f); g.textAlign = "center";
  g.fillText("[ P-256 ]", ax + aw / 2, ay + ah + 12 * f);

  // signature line
  g.textAlign = "left";
  g.strokeStyle = INK; g.lineWidth = 1.1; g.beginPath(); g.moveTo(w * L.sig.x0, h * L.sig.lineY); g.lineTo(w * L.sig.x1, h * L.sig.lineY); g.stroke();
  g.fillStyle = "rgba(17,19,17,.7)"; g.font = font(MONO, 7.4 * f);
  g.fillText("SIGNED BY SUBJECT", w * L.sig.x0, h * L.sig.lineY + 11 * f);
  g.fillStyle = RED; g.font = font(HAND, 22 * f); g.fillText("✕", w * L.sig.x0 - 18 * f, h * L.sig.lineY - 2);
}

export function sealTexture(verified = true) {
  const S = 512, [c, g] = makeCanvas(S, S, 1), r = S / 2;
  g.translate(r, r);
  const col = verified ? "#B0261C" : "#6B6B6B";
  g.strokeStyle = col; g.fillStyle = col;
  g.lineWidth = 7; g.beginPath(); g.arc(0, 0, r - 12, 0, 6.2831853); g.stroke();
  g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, r - 28, 0, 6.2831853); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r - 120, 0, 6.2831853); g.stroke();
  // scalloped edge
  for (let i = 0; i < 48; i++) { const a = (i / 48) * 6.2831853; g.beginPath(); g.arc(Math.cos(a) * (r - 12), Math.sin(a) * (r - 12), 4.5, 0, 6.2831853); g.fill(); }
  const ring = (txt, rad, start, dir) => {
    g.font = font(MONO, 31).replace("500", "700");
    const step = (31 * 0.72 + 5) / rad;
    for (let i = 0; i < txt.length; i++) {
      const a = start + dir * (i - (txt.length - 1) / 2) * step;
      g.save(); g.rotate(a); g.translate(0, dir > 0 ? -rad : rad); g.textAlign = "center"; g.fillText(txt[i], 0, 0); g.restore();
    }
  };
  ring("DHANUSH KARTHIK · TRUSTED CHANNEL", r - 62, 0, 1);
  ring("SHA-256 · ECDSA P-256", r - 62, 0, -1);
  // padlock
  g.lineWidth = 15; g.lineCap = "round"; g.beginPath(); g.arc(0, -24, 40, Math.PI, 0); g.lineTo(40, -2); g.moveTo(-40, -24); g.lineTo(-40, -2); g.stroke();
  g.fillRect(-58, -6, 116, 84);
  g.globalCompositeOperation = "destination-out";
  g.beginPath(); g.arc(0, 26, 12, 0, 6.2831853); g.fill(); g.fillRect(-5, 30, 10, 28);
  const t = tex(c); t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function glyphAtlas() {
  const [c, g] = makeCanvas(512, 32, 1);
  g.fillStyle = "#fff"; g.font = '700 25px "JetBrains Mono", ui-monospace, monospace'; g.textAlign = "center"; g.textBaseline = "middle";
  "0123456789ABCDEF".split("").forEach((ch, i) => g.fillText(ch, i * 32 + 16, 17));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

export { makeCanvas };
