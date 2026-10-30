import * as THREE from "three";

export const CARD_W = 512, CARD_H = 704;

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

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

function setDisplay(ctx, px) {
  ctx.font = `900 ${px}px Archivo, "Arial Black", sans-serif`;
  if ("fontStretch" in ctx) ctx.fontStretch = "expanded";
}

function setMono(ctx, px, weight = 500) {
  if ("fontStretch" in ctx) ctx.fontStretch = "normal";
  ctx.font = `${weight} ${px}px "JetBrains Mono", ui-monospace, monospace`;
}

function cover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, 0, sw, sh, x, y, w, h);
}

// Draws one deck card (see sections/cards.js) into a CanvasTexture.
export async function makeCardTexture(card) {
  await Promise.all([
    document.fonts?.load("900 52px Archivo"),
    document.fonts?.load('500 20px "JetBrains Mono"'),
  ].filter(Boolean)).catch(() => {});
  const img = await loadImage(card.image);
  const c = document.createElement("canvas");
  c.width = CARD_W; c.height = CARD_H;
  const ctx = c.getContext("2d");
  const { bg, fg, accent } = card.style;
  const P = 34;

  roundRect(ctx, 4, 4, CARD_W - 8, CARD_H - 8, 30);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.clip();

  // Faint grid for paper-coloured cards, scanlines for dark ones.
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = fg;
  for (let x = 0; x < CARD_W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CARD_H); ctx.stroke(); }
  for (let y = 0; y < CARD_H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_W, y); ctx.stroke(); }
  ctx.globalAlpha = 1;

  ctx.fillStyle = fg;
  setMono(ctx, 20, 600);
  ctx.textBaseline = "top";
  ctx.fillText(card.num || "", P, P);
  const right = card.kind === "subdomain" ? "↗ external" : card.year || "";
  ctx.fillText(right, CARD_W - P - ctx.measureText(right).width, P);

  if (card.kind === "me") {
    if (img) {
      const h = CARD_H * 0.78, w = h * (img.width / img.height);
      ctx.drawImage(img, (CARD_W - w) / 2, CARD_H - h + 10, w, h);
    }
    setDisplay(ctx, 58);
    ctx.fillStyle = fg;
    ["DHANUSH", "KARTHIK"].forEach((t, i) => ctx.fillText(t, P, 80 + i * 56));
    setMono(ctx, 18);
    ctx.fillStyle = accent;
    ctx.fillText((card.sub || "").toUpperCase(), P, 200);
  } else {
    let y = 92;
    if (img) {
      cover(ctx, img, P, y, CARD_W - P * 2, 220);
      ctx.strokeStyle = fg; ctx.lineWidth = 2;
      ctx.strokeRect(P, y, CARD_W - P * 2, 220);
      y += 250;
    } else if (card.kind === "subdomain") {
      setMono(ctx, 30, 700);
      ctx.fillStyle = accent;
      wrap(ctx, card.year, CARD_W - P * 2, 2).forEach((l, i) => ctx.fillText(l, P, y + i * 38));
      y += 110;
    } else {
      // Decorative "build" bars when there is no screenshot.
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? accent : fg;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(P, y + i * 22, (CARD_W - P * 2) * (0.35 + ((i * 37) % 60) / 100), 10);
      }
      ctx.globalAlpha = 1;
      y += 160;
    }
    setDisplay(ctx, 50);
    ctx.fillStyle = fg;
    const lines = wrap(ctx, (card.title || "").toUpperCase(), CARD_W - P * 2, 3);
    lines.forEach((l, i) => ctx.fillText(l, P, y + i * 50));
    y += lines.length * 50 + 14;
    ctx.font = `400 20px Archivo, system-ui, sans-serif`;
    if ("fontStretch" in ctx) ctx.fontStretch = "normal";
    ctx.globalAlpha = 0.85;
    wrap(ctx, card.sub, CARD_W - P * 2, img ? 2 : 4).forEach((l, i) => ctx.fillText(l, P, y + i * 27));
    ctx.globalAlpha = 1;
  }

  // Footer: stack + barcode.
  setMono(ctx, 16);
  ctx.fillStyle = card.kind === "me" ? "#fff" : fg;
  if (card.kind !== "me") ctx.fillText((card.stack || []).slice(0, 4).join(" · "), P, CARD_H - P - 52);
  ctx.fillStyle = card.kind === "me" ? "#fff" : fg;
  for (let i = 0, x = CARD_W - P - 120; i < 34; i++) {
    const w = (i * 7) % 3 + 1;
    if (i % 2 === 0) ctx.fillRect(x, CARD_H - P - 26, w, 26);
    x += w + 2;
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
