import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight } from "lucide-react";
import Sheet from "../components/Sheet";
import RibbonTitle from "../components/RibbonTitle";
import { useSite } from "../SiteContext";
import { onTick } from "../lib/ticker";
import { intro, subscribeIntro } from "../lib/intro";
import { clamp, inOutCubic } from "../three/hero/state";
import { buildSlots, reset, setActive as setNetActive, setPings as setNetPings, setScroll, setSel } from "../three/network/state";
import { traceFor, SECTION_META } from "./meta";

const NetworkStage = lazy(() => import("../three/network/NetworkStage"));

const LEAD = "Other things I run on dhanushkarthik.com. Live response times are measured from your browser.";

// Rough reachability check: an opaque no-cors request resolves when the host answers.
function ping(host, ctl) {
  const t0 = performance.now();
  return fetch(`https://${host}/favicon.ico?ping=${Date.now()}`, { mode: "no-cors", cache: "no-store", signal: ctl.signal })
    .then(() => ({ status: "up", ms: Math.round(performance.now() - t0) }))
    .catch(() => ({ status: "down", ms: null }));
}

function usePing(host) {
  const [state, setState] = useState({ status: "checking", ms: null });
  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    ping(host, ctl).then((r) => alive && setState(r)).finally(() => clearTimeout(timer));
    return () => { alive = false; ctl.abort(); clearTimeout(timer); };
  }, [host]);
  return state;
}

function Unit({ d }) {
  const p = usePing(d.host);
  const [sub, ...rest] = d.host.split(".");
  return (
    <a className="unit" href={`https://${d.host}`} target="_blank" rel="noopener">
      <span className="screw l" aria-hidden="true" /><span className="screw r" aria-hidden="true" />
      <span className={`led ${p.status}`} aria-label={`status ${p.status}`} />
      <div>
        <div className="unit-host"><em>{sub}</em>.{rest.join(".")}</div>
        <div className="unit-desc">{d.title} — {d.description}</div>
        {d.tags?.length > 0 && <div className="unit-tags">{d.tags.map((t) => <span key={t}>{t}</span>)}</div>}
      </div>
      <div className="unit-meta">
        <b>{p.ms != null ? `${p.ms}ms` : p.status === "down" ? "—" : "…"}</b>
        {d.status || "live"} · ssh →
      </div>
      {d.screenshot_url && <img className="unit-shot" src={d.screenshot_url} alt="" loading="lazy" />}
    </a>
  );
}

// Flat layout: print mode, no WebGL, and the server render.
function Flat({ data, line, prev }) {
  const blanks = Math.max(1, 3 - data.subdomains.length);
  return (
    <Sheet id="network" variant="term" prev={prev} trace={traceFor("network", line)} cmd={SECTION_META.network.cmd} label="Network">
      <RibbonTitle text="Network" onPaper={false} />
      <p className="lead" style={{ margin: "0 auto 48px", textAlign: "center" }}>{LEAD}</p>
      <div className="rack-wrap">
        <div className="rack">
          {data.subdomains.map((d) => <Unit key={d.host} d={d} />)}
          {Array.from({ length: blanks }, (_, i) => (
            <div key={i} className="unit blank" aria-hidden="true"><span>slot {data.subdomains.length + i + 1} · reserved</span></div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

// ---- stage ----
// The stage opens over Resume like a rack: twelve slats slide in from alternating sides, each edge lit
// like a drive-bay LED. Once it is open the mesh builds itself, then the camera visits each host in turn
// as you scroll (or when you click one). When Contact burns in, the mesh collapses toward the middle.
const SLATS = 12;
const RANK = [3, 8, 1, 10, 5, 0, 7, 11, 2, 9, 4, 6];
const BAND_VH = 80;

function slatShape(a) {
  const ex = RANK.map((rk) => inOutCubic(clamp((a - (rk / SLATS) * 0.5) / 0.5)));
  const right = [], left = [];
  ex.forEach((e, i) => {
    const y0 = (i / SLATS) * 100, y1 = ((i + 1) / SLATS) * 100, fromLeft = i % 2 === 0;
    const r = fromLeft ? e * 100 : 100, l = fromLeft ? 0 : 100 - e * 100;
    right.push(`${r.toFixed(2)}% ${y0.toFixed(3)}%`, `${r.toFixed(2)}% ${y1.toFixed(3)}%`);
    left.unshift(`${l.toFixed(2)}% ${y1.toFixed(3)}%`, `${l.toFixed(2)}% ${y0.toFixed(3)}%`);
  });
  return { ex, clip: `polygon(${[...right, ...left].join(",")})` };
}

function useHostPings(slots, run) {
  const [pings, setPings] = useState(() => slots.map((s) => ({ status: s.kind === "ghost" ? "ghost" : "checking", ms: null })));
  useEffect(() => {
    if (!run) return undefined;
    let alive = true;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    slots.forEach((s, i) => {
      if (s.kind === "ghost") return;
      ping(s.host, ctl).then((r) => alive && setPings((a) => a.map((p, j) => (j === i ? r : p))));
    });
    return () => { alive = false; ctl.abort(); clearTimeout(timer); };
  }, [slots, run]);
  useEffect(() => { setNetPings(pings); }, [pings]);
  return pings;
}

function Stage({ data, line }) {
  const slots = useMemo(() => buildSlots(data.subdomains), [data.subdomains]);
  const n = slots.filter((s) => s.kind === "live").length;
  const holdVh = Math.max(200, BAND_VH * (n + 2));

  const sectionRef = useRef(null);
  const stickRef = useRef(null);
  const clipRef = useRef(null);
  const ledRefs = useRef([]);
  const selRef = useRef(-1);
  const manual = useRef({ on: false, y: 0 });
  const [sel, setSelState] = useState(-1);
  const [active, setActive] = useState(false);
  const [near, setNear] = useState(false);
  const ready = useSyncExternalStore(subscribeIntro, () => intro.overlayIn || intro.played, () => false);
  const pings = useHostPings(slots, near);

  const apply = useCallback((k) => {
    if (selRef.current === k) return;
    selRef.current = k;
    setSel(k);
    setSelState(k);
  }, []);
  const select = useCallback((k) => {
    manual.current = { on: true, y: window.scrollY };
    apply(selRef.current === k ? -1 : k);
  }, [apply]);
  useEffect(() => () => reset(), []);

  const labels = useMemo(() => slots.map((s, i) => (s.kind === "ghost" ? "reserved" : pings[i]?.ms != null ? `${pings[i].ms} ms` : pings[i]?.status === "down" ? "unreachable" : "pinging …")), [slots, pings]);

  useEffect(() => {
    let a = null, b = null, was = false;
    return onTick(() => {
      const el = sectionRef.current, stick = stickRef.current, clip = clipRef.current;
      if (!el || !stick || !clip) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const act = r.top < vh * 1.1 && r.bottom > -vh * 0.1;
      const nr = r.top < vh * 2.5;
      if (act !== a) { a = act; setActive(act); setNetActive(act); }
      if (nr !== b) { b = nr; setNear(nr); }

      const hook = el.previousElementSibling?.classList.contains("rs-stage") ?? false;
      const nextTop = el.nextElementSibling?.classList.contains("ct-stage") ? el.nextElementSibling.getBoundingClientRect().top : vh * 2;
      const top = r.top;
      const arrive = hook ? clamp(1 - top / vh) : 1;
      const hold = clamp(-top / ((holdVh * vh) / 100));
      const out = clamp(1 - nextTop / vh);
      setScroll(arrive, hold, out);

      stick.style.transform = hook && top > 0 ? `translate3d(0, ${(-top).toFixed(1)}px, 0)` : "";
      const slat = hook && arrive < 1 ? slatShape(arrive) : null;
      clip.style.clipPath = slat ? slat.clip : "none";
      clip.style.visibility = arrive <= 0.001 ? "hidden" : "visible";
      clip.style.pointerEvents = arrive >= 0.75 ? "auto" : "none";
      ledRefs.current.forEach((led, i) => {
        if (!led) return;
        const e = slat ? slat.ex[i] : 1;
        led.style.opacity = e > 0.002 && e < 0.998 ? String(Math.min(1, Math.sin(e * Math.PI) * 2.4)) : "0";
        led.style.left = `${(i % 2 === 0 ? e * 100 : 100 - e * 100).toFixed(2)}%`;
      });
      stick.style.setProperty("--arrive", arrive.toFixed(3));
      stick.style.setProperty("--out", out.toFixed(3));

      // scroll visits: whole mesh, each live host, whole mesh again. A click overrides until the page moves.
      if (manual.current.on && Math.abs(window.scrollY - manual.current.y) > 90) manual.current.on = false;
      if (!manual.current.on) {
        const band = Math.min(n + 1, Math.floor(hold * (n + 2) * 0.9999));
        apply(arrive < 1 || band === 0 || band > n ? -1 : band - 1);
      }
      const away = r.bottom < vh * 0.5 || r.top > vh * 0.6;
      if (away && was) { was = false; manual.current.on = false; apply(-1); }
      if (!away) was = true;
    });
  }, [apply, holdVh, n]);

  useEffect(() => {
    const key = (e) => {
      if (e.key !== "Escape" || selRef.current < 0) return;
      const r = sectionRef.current?.getBoundingClientRect();
      if (r && r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5) { manual.current = { on: true, y: window.scrollY }; apply(-1); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [apply]);

  return (
    <section ref={sectionRef} id="network" className="frame nt-stage" aria-label="Network">
      <div className="nt-pin" style={{ "--pin": `${holdVh}svh` }}>
        <div className="nt-stick" ref={stickRef}>
          <div className="nt-clip" ref={clipRef}>
            <div className="nt-canvas" aria-hidden="true">
              {ready && near && (
                <Suspense fallback={null}>
                  <NetworkStage active={active} slots={slots} labels={labels} onSelect={select} />
                </Suspense>
              )}
            </div>
            <div className="nt-ui">
              <div className="wrap">
                <div className="frame-head">
                  <span className="frame-trace">{traceFor("network", line)}</span>
                  <span className="frame-cmd">{SECTION_META.network.cmd}</span>
                </div>
              </div>
              <div className="nt-body">
                <div className="nt-side">
                  <h2 className="nt-h">Network</h2>
                  <p className="nt-sub">{LEAD}</p>
                  <ul className="nt-list">
                    {slots.map((s, k) => {
                      const ghost = s.kind === "ghost";
                      const p = pings[k] || { status: "checking", ms: null };
                      const [sub, ...rest] = s.host.split(".");
                      return (
                        <li key={`${s.host}-${k}`} className="nt-row" data-on={sel === k} data-ghost={ghost}>
                          <button type="button" className="nt-head" onClick={() => select(k)} aria-expanded={sel === k}>
                            <span className={`led ${ghost ? "" : p.status}`} aria-hidden="true" />
                            <span className="nt-name">{ghost ? s.host : <><em>{sub}</em>.{rest.join(".")}</>}</span>
                            <span className="nt-ms">{ghost ? "reserved" : p.ms != null ? `${p.ms}ms` : p.status === "down" ? "—" : "…"}</span>
                          </button>
                          <div className="nt-more">
                            <div>
                              <p>{ghost ? s.desc : `${s.title} — ${s.desc}`}</p>
                              {s.tags.length > 0 && <div className="nt-tags">{s.tags.map((t) => <span key={t}>{t}</span>)}</div>}
                              {s.shot && <img className="nt-shot" src={s.shot} alt="" loading="lazy" />}
                              {!ghost && <a className="nt-open" href={`https://${s.host}`} target="_blank" rel="noopener" tabIndex={sel === k ? 0 : -1}>{s.status || "live"} · ssh <ArrowUpRight size={13} /></a>}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
              <p className="nt-hint" aria-hidden="true">{sel >= 0 ? "esc · back to the whole mesh" : "scroll to visit each host · click a node"}</p>
            </div>
          </div>
          <div className="nt-leds" aria-hidden="true">
            {Array.from({ length: SLATS }, (_, i) => <i key={i} ref={(el) => { ledRefs.current[i] = el; }} style={{ top: `${(i / SLATS) * 100}%`, height: `${100 / SLATS}%` }} />)}
          </div>
          {/* the canvas is decorative; this is the plain way to the hosts */}
          <ul className="sr-only">
            {data.subdomains.map((d) => <li key={d.host}><a href={`https://${d.host}`}>{d.host}: {d.title}. {d.description}</a></li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function Network(props) {
  const { three } = useSite();
  return three ? <Stage {...props} /> : <Flat {...props} />;
}
