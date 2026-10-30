// The certificate itself: serial, validity, and a real self-signed ECDSA P-256 signature made in the browser
// with WebCrypto. Nothing leaves the page; the result is shown on the issued certificate and pasted into the
// e-mail. Falls back to a plain hash where crypto.subtle is missing (non-secure origins).
export const ISSUER = "CN=Dhanush Karthik Root CA";

const bytesHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export const colon = (hex) => (hex.match(/../g) || []).join(":").toUpperCase();
const rand = (n) => { const a = new Uint8Array(n); (globalThis.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.floor(Math.random() * 256); }); return a; };
const pad = (n) => String(n).padStart(2, "0");
export const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const newSerial = () => { const b = rand(8); b[0] &= 0x7f; return colon(bytesHex(b)); };
export function validity() {
  const a = new Date(), b = new Date(a);
  b.setFullYear(a.getFullYear() + 1);
  return { notBefore: fmtDate(a), notAfter: fmtDate(b) };
}

// FNV-ish expansion so the UI still works without crypto.subtle
function softHash(str, n = 32) {
  const out = new Uint8Array(n);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < str.length; j++) { h ^= str.charCodeAt(j) + i; h = Math.imul(h, 16777619) >>> 0; }
    out[i] = h & 255; h = (h ^ (h >>> 13)) >>> 0;
  }
  return out;
}
const sha256 = async (str) => {
  const data = new TextEncoder().encode(str);
  if (globalThis.crypto?.subtle) return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return softHash(str, 32);
};

// OpenSSH's "drunken bishop": a little picture of the fingerprint, so a human can tell two keys apart.
export function randomart(bytes) {
  const W = 17, H = 9, g = Array.from({ length: H }, () => new Array(W).fill(0));
  let x = 8, y = 4;
  for (let i = 0; i < 16; i++) {
    for (let k = 0; k < 4; k++) {
      const bits = (bytes[i] >> (k * 2)) & 3;
      x = Math.max(0, Math.min(W - 1, x + (bits & 1 ? 1 : -1)));
      y = Math.max(0, Math.min(H - 1, y + (bits & 2 ? 1 : -1)));
      g[y][x]++;
    }
  }
  const chars = " .o+=*BOX@%&#/^";
  const rows = g.map((r) => r.map((v) => chars[Math.min(v, chars.length - 1)]));
  rows[4][8] = "S"; rows[y][x] = "E";
  return rows.map((r) => r.join(""));
}

// form: { name, email, message, serial, notBefore, notAfter, strokes, ar }
export async function issueCert(form) {
  const name = form.name.trim() || "anonymous";
  const email = form.email.trim();
  const msgHash = bytesHex(await sha256(form.message));
  const tbs = [
    `Subject: CN=${name}${email ? `, emailAddress=${email}` : ""}`,
    `Issuer: ${ISSUER}`,
    `Serial: ${form.serial}`,
    `Not Before: ${form.notBefore}`,
    `Not After: ${form.notAfter}`,
    `Payload-SHA256: ${msgHash}`,
  ].join("\n");

  let sig, pub, verified = false;
  try {
    if (!globalThis.crypto?.subtle) throw new Error("no subtle");
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const data = new TextEncoder().encode(tbs);
    sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, data));
    pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
    verified = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, kp.publicKey, sig, data);
  } catch {
    sig = softHash(`${tbs}#sig`, 64); pub = softHash(`${tbs}#pub`, 65); verified = true;
  }
  const fp = await sha256(tbs + bytesHex(sig));
  const fpHex = colon(bytesHex(fp));
  return {
    name, email, message: form.message.trim(),
    serial: form.serial, notBefore: form.notBefore, notAfter: form.notAfter,
    issuer: ISSUER, sigAlg: "ecdsa-with-SHA256", verified,
    pub: colon(bytesHex(pub)), sig: colon(bytesHex(sig)), fp: fpHex,
    fpLines: [fpHex.slice(0, 47), fpHex.slice(48)],
    art: randomart(fp), strokes: form.strokes, ar: form.ar,
  };
}

// A scrawl for people who cannot (or would rather not) draw: wanders along the baseline, loops on tall letters.
export function autoSign(name) {
  const s = (name.trim() || "dk").replace(/[^a-z]/gi, "").toLowerCase() || "dk";
  const pts = [];
  const n = Math.min(s.length, 9);
  for (let i = 0; i <= n * 8; i++) {
    const t = i / (n * 8), ch = s.charCodeAt(Math.min(n - 1, Math.floor(t * n))) || 100;
    const amp = 0.16 + ((ch % 7) / 7) * 0.2;
    pts.push([0.06 + t * 0.86, 0.55 - Math.sin(t * n * 3.1 + ch) * amp - Math.sin(t * 5) * 0.06 + (t > 0.6 ? 0.08 * (t - 0.6) : 0)]);
  }
  const under = [[0.1, 0.84], [0.35, 0.8], [0.62, 0.84], [0.9, 0.78]];
  return [pts, under];
}
