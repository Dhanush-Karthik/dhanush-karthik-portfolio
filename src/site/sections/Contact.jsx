import { forwardRef, lazy, Suspense, useCallback, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
import { Copy, Lock } from "lucide-react";
import Sheet from "../components/Sheet";
import RibbonTitle from "../components/RibbonTitle";
import { useSite } from "../SiteContext";
import { onTick } from "../lib/ticker";
import { intro, subscribeIntro } from "../lib/intro";
import { clamp, smooth } from "../three/hero/state";
import { ct, layoutFor, reset, send, setActive as setCtActive, setScroll, unsend } from "../three/contact/state";
import { traceFor, SECTION_META } from "./meta";
import { autoSign, issueCert, ISSUER, newSerial, validity } from "../three/contact/cert";

const ContactStage = lazy(() => import("../three/contact/ContactStage"));

const headingOf = (contact) => (contact.heading?.length <= 14 ? contact.heading : "Say hello");

// A canvas you sign with finger or mouse. Strokes are kept as points normalised to the box, so the 3D scene can
// rebuild them as gold wire on the issued certificate.
const SigPad = forwardRef(function SigPad({ onInk }, ref) {
  const cv = useRef(null);
  const st = useRef({ strokes: [], cur: null, w: 1, h: 1 }).current;
  const paint = useCallback(() => {
    const c = cv.current;
    if (!c) return;
    const g = c.getContext("2d"), k = c.width / Math.max(1, st.w);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.strokeStyle = "#1B2A6B"; g.fillStyle = "#1B2A6B"; g.lineWidth = 2.4; g.lineCap = "round"; g.lineJoin = "round";
    st.strokes.forEach((s) => {
      const P = s.map(([x, y]) => [x * st.w, y * st.h]);
      if (P.length < 2) { g.beginPath(); g.arc(P[0][0], P[0][1], 1.4, 0, 6.3); g.fill(); return; }
      g.beginPath(); g.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < P.length - 1; i++) g.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
      g.lineTo(P[P.length - 1][0], P[P.length - 1][1]); g.stroke();
    });
  }, [st]);
  useEffect(() => {
    const c = cv.current;
    const fit = () => {
      const k = Math.min(2, window.devicePixelRatio || 1);
      st.w = c.clientWidth || 1; st.h = c.clientHeight || 1;
      c.width = Math.round(st.w * k); c.height = Math.round(st.h * k);
      paint();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, [paint, st]);
  useImperativeHandle(ref, () => ({
    get: () => ({ strokes: st.strokes.map((s) => s.map((p) => [p[0], p[1]])), ar: st.w / st.h }),
    set: (strokes) => { st.strokes = strokes.map((s) => s.slice()); paint(); onInk(st.strokes.length > 0); },
    clear: () => { st.strokes = []; st.cur = null; paint(); onInk(false); },
  }), [st, paint, onInk]);

  // offsetX/Y are in the canvas's own coordinates even when the whole card is tilted in 3D
  const at = (e) => [Math.max(0, Math.min(1, e.nativeEvent.offsetX / st.w)), Math.max(0, Math.min(1, e.nativeEvent.offsetY / st.h))];
  return (
    <canvas
      ref={cv}
      className="mc-pad"
      aria-label="Signature box: draw your signature"
      onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* hand mode's pointer is not a real one */ } st.cur = [at(e)]; st.strokes.push(st.cur); paint(); onInk(true); }}
      onPointerMove={(e) => {
        if (!st.cur) return;
        const p = at(e), q = st.cur[st.cur.length - 1];
        if (Math.hypot((p[0] - q[0]) * st.w, (p[1] - q[1]) * st.h) < 2) return;
        st.cur.push(p); paint();
      }}
      onPointerUp={() => { st.cur = null; }}
      onPointerCancel={() => { st.cur = null; }}
    />
  );
});

// The certificate face. Self-contained (props in, one callback out) so it can sit on the 3D slab or on a plain sheet.
// Name, e-mail and message are the Subject, the Alt Name and the payload; the drawn signature is what "signs" it.
function MailCard({ contact, socialLinks, onSend, flat = false, wide = false }) {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [out, setOut] = useState({ text: "", ok: false });
  const [copied, setCopied] = useState(false);
  const [inked, setInked] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [meta] = useState(() => ({ serial: newSerial(), ...validity() }));
  const pad = useRef(null);
  const busy = useRef(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    if (busy.current) return;
    if (!form.message.trim()) { setOut({ text: "x509: payload is empty — write a message first", ok: false }); return; }
    const { strokes, ar } = pad.current.get();
    if (!strokes.length) {
      setOut({ text: "x509: certificate is unsigned — draw your signature in the box", ok: false });
      setNudge(true); setTimeout(() => setNudge(false), 700);
      return;
    }
    busy.current = true;
    setOut({ text: "Signing with a fresh ECDSA P-256 key …", ok: true });
    const r = onSend({ ...form, ...meta, strokes, ar });
    if (flat) Promise.resolve(r).finally(() => { busy.current = false; });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(contact.email); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  }

  return (
    <form className={`mc${flat ? " flat" : ""}${wide ? " wide" : ""}`} onSubmit={submit} aria-label="Contact form">
      <div className="mc-hd"><span className="mc-tls"><Lock size={12} strokeWidth={2.6} />TLS Certificate</span><span className="mc-ver">X.509 v3 · P-256</span></div>
      <h3 className="mc-h">{headingOf(contact)}</h3>
      <p className="mc-sub">{contact.subtext}</p>
      <div className="mc-body">
        <div className="mc-fields">
          <div className="mc-row"><label htmlFor="mc-name">Subject</label><input id="mc-name" autoComplete="name" placeholder="your name" value={form.name} onChange={set("name")} /></div>
          <div className="mc-row"><label htmlFor="mc-email">Alt name</label><input id="mc-email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={set("email")} /></div>
          <div className="mc-row grow"><label htmlFor="mc-msg">Payload</label><textarea id="mc-msg" data-lenis-prevent placeholder="Tell me about the project, the role, or the bug." value={form.message} onChange={set("message")} /></div>
        </div>
        <div className="mc-side">
          <dl className="mc-meta">
            <div className="opt"><dt>Issuer</dt><dd>{ISSUER.replace("CN=", "")}</dd></div>
            <div><dt>Relying</dt><dd>{contact.email}<button type="button" className="mc-copy" onClick={copy}><Copy size={10} />{copied ? "copied" : "copy"}</button></dd></div>
            <div><dt>Serial</dt><dd>{meta.serial}</dd></div>
            <div className="opt"><dt>Valid</dt><dd>{meta.notBefore} → {meta.notAfter}</dd></div>
          </dl>
          <div className={`mc-sig${inked ? " has" : ""}${nudge ? " nudge" : ""}`}>
            <SigPad ref={pad} onInk={setInked} />
            <span className="mc-sig-x" aria-hidden="true">✕</span>
            <span className="mc-sig-hint" aria-hidden="true">sign here</span>
            <span className="mc-sig-tools">
              <button type="button" onClick={() => pad.current.set(autoSign(form.name))}>auto-sign</button>
              <button type="button" onClick={() => pad.current.clear()}>clear</button>
            </span>
          </div>
          <div className="mc-act">
            <button className="mc-send" type="submit" aria-label="Sign and send message">SIGN &amp; SEND</button>
            <span className={`mc-out${out.ok ? " ok" : ""}`} role="status">{out.text}</span>
          </div>
        </div>
      </div>
      <div className="mc-links">
        {socialLinks.map((s) => <a key={s.id} href={s.url} rel="me noopener" target={s.url.startsWith("mailto:") ? undefined : "_blank"}>{s.platform.toLowerCase()}</a>)}
      </div>
    </form>
  );
}

const mailto = (contact, f, cert) => {
  const subject = encodeURIComponent(`Portfolio contact from ${f.name || "someone"}`);
  const proof = cert
    ? `\n\n--\nTLS certificate (self-signed in the browser)\nSubject: CN=${cert.name}\nSerial: ${cert.serial}\nValidity: ${cert.notBefore} to ${cert.notAfter}\nSignature: ${cert.sigAlg}\nSHA-256 fingerprint: ${cert.fp}`
    : "";
  const body = encodeURIComponent(`Name: ${f.name}\nEmail: ${f.email}\n\n${f.message}${proof}`);
  return `mailto:${contact.email}?subject=${subject}&body=${body}`;
};

// Flat layout: print mode, no WebGL, and the server render.
function Flat({ data, line, prev }) {
  const { contact, socialLinks } = data;
  return (
    <Sheet id="contact" variant="paper" prev={prev} trace={traceFor("contact", line)} cmd={SECTION_META.contact.cmd} label="Contact">
      <RibbonTitle text={headingOf(contact)} />
      {contact.show_form !== false
        ? <div className="mc-wrap"><MailCard flat contact={contact} socialLinks={socialLinks} onSend={async (f) => { const cert = await issueCert(f); window.location.href = mailto(contact, f, cert); }} /></div>
        : <p className="lead" style={{ margin: "0 auto", textAlign: "center" }}>{contact.subtext} <a href={`mailto:${contact.email}`}>{contact.email}</a></p>}
    </Sheet>
  );
}

// ---- stage ----
// Paper burns in over the Network stage from the point where the fingertips will meet. Michelangelo's fresco
// is torn in two and the halves close in as you scroll; when the fingers touch, the seam is mended with gold
// and the spark condenses into a TLS certificate that assembles itself. You fill it in and sign it; the form is
// real DOM riding the certificate's front face.
const HOLD_VH = 300;

function Stage({ data, line, onFail }) {
  const { contact, socialLinks } = data;
  const sectionRef = useRef(null);
  const stickRef = useRef(null);
  const clipRef = useRef(null);
  const rootRef = useRef(null);
  const camRef = useRef(null);
  const cardRef = useRef(null);
  const faceRef = useRef(null);
  const [dim, setDim] = useState(() => layoutFor(1280, 720));
  const [active, setActive] = useState(false);
  const [near, setNear] = useState(false);
  const [sent, setSent] = useState(false);
  const [fp, setFp] = useState("");
  const [round, setRound] = useState(0);
  const timers = useRef([]);
  const ready = useSyncExternalStore(subscribeIntro, () => intro.overlayIn || intro.played, () => false);

  useEffect(() => {
    const fit = () => setDim(layoutFor(window.innerWidth, window.innerHeight));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    ct.dom = { root: rootRef.current, cam: camRef.current, card: cardRef.current, face: faceRef.current };
    const t = timers.current;
    return () => { ct.dom = { root: null, cam: null, card: null, face: null }; t.forEach(clearTimeout); reset(); };
  }, []);

  const onSend = useCallback(async (f) => {
    const cert = await issueCert(f);
    ct.cert = cert;
    send();
    timers.current.push(setTimeout(() => { window.location.href = mailto(contact, f, cert); }, 2800));
    timers.current.push(setTimeout(() => { setFp(cert.fp); setSent(true); }, 3700));
  }, [contact]);
  const again = useCallback(() => { setSent(false); setRound((r) => r + 1); unsend(); }, []);

  useEffect(() => {
    let a = null, b = null;
    return onTick(() => {
      const el = sectionRef.current, stick = stickRef.current, clip = clipRef.current;
      if (!el || !stick || !clip) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const act = r.top < vh * 1.1 && r.bottom > -vh * 0.1;
      const nr = r.top < vh * 2.5;
      if (act !== a) { a = act; setActive(act); setCtActive(act); }
      if (nr !== b) { b = nr; setNear(nr); }

      const hook = el.previousElementSibling?.classList.contains("nt-stage") ?? false;
      const top = r.top;
      const arrive = hook ? clamp(1 - top / vh) : 1;
      const hold = clamp(-top / ((HOLD_VH * vh) / 100));
      const meet = arrive < 1 ? 0 : smooth(0, 0.6, hold);
      setScroll(arrive, hold, meet);

      stick.style.transform = hook && top > 0 ? `translate3d(0, ${(-top).toFixed(1)}px, 0)` : "";
      clip.style.visibility = arrive <= 0.001 ? "hidden" : "visible";
      clip.style.pointerEvents = arrive >= 0.75 ? "auto" : "none";
      stick.style.setProperty("--arrive", arrive.toFixed(3));
      stick.style.setProperty("--meet", meet.toFixed(3));
    });
  }, []);

  return (
    <section ref={sectionRef} id="contact" className="frame ct-stage" aria-label="Contact">
      <div className="ct-pin" style={{ "--pin": `${HOLD_VH}svh` }}>
        <div className="ct-stick" ref={stickRef}>
          <div className="ct-clip" ref={clipRef}>
            <div className="ct-canvas" aria-hidden="true">
              {ready && near && (
                <Suspense fallback={null}>
                  <ContactStage active={active} onFail={onFail} />
                </Suspense>
              )}
            </div>
            <div className="ct-3d" ref={rootRef}>
              <div className="ct-cam" ref={camRef}>
                <div className="ct-card" ref={cardRef} style={{ width: dim.cw, height: dim.ch }}>
                  <div className="ct-face" ref={faceRef}>
                    <MailCard key={round} wide={dim.wide} contact={contact} socialLinks={socialLinks} onSend={onSend} />
                  </div>
                </div>
              </div>
            </div>
            <div className="ct-ui">
              <div className="wrap">
                <div className="frame-head">
                  <span className="frame-trace">{traceFor("contact", line)}</span>
                  <span className="frame-cmd">{SECTION_META.contact.cmd}</span>
                </div>
              </div>
              <p className="ct-hint" aria-hidden="true">scroll · bring them together</p>
              <div className={`ct-sent${sent ? " on" : ""}`} role="status">
                <p className="ct-sent-h">Certificate issued.</p>
                <p className="ct-sent-p">Signed, stamped and handed to your mail app, which should have opened with everything filled in. Hit send there and it lands in my inbox.</p>
                {fp && <p className="ct-sent-fp">SHA-256 {fp.slice(0, 29)}…</p>}
                <div className="ct-sent-row">
                  <a className="btn solid" href={`mailto:${contact.email}`}>{contact.email}</a>
                  <button type="button" className="btn" onClick={again} tabIndex={sent ? 0 : -1}>write another</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Contact(props) {
  const { three } = useSite();
  const [bad, setBad] = useState(false);
  return three && !bad ? <Stage {...props} onFail={() => setBad(true)} /> : <Flat {...props} />;
}
