import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight } from "lucide-react";
import Sheet from "../components/Sheet";
import RibbonTitle from "../components/RibbonTitle";
import { useSite } from "../SiteContext";
import { onTick } from "../lib/ticker";
import { intro, subscribeIntro } from "../lib/intro";
import { clamp, inOutCubic } from "../three/hero/state";
import { buildProjects } from "../three/deploy/projects";
import { reset, setScroll, setSel } from "../three/deploy/state";
import { traceFor, SECTION_META } from "./meta";

const DeployStage = lazy(() => import("../three/deploy/DeployStage"));

// Pinned stage on the paper background. It arrives as an iris: while Experience is still pinned
// behind it, the stage holds still on screen and a circle of paper opens over the graph. Once the
// circle covers the screen the cards drop in (time, not scroll) and wait to be picked. A short
// scroll hold follows, then the stage leaves.
const HOLD_VH = 80;
const IRIS_Y = 0.62;

const open = (go, p, how) => {
  if (how === "live" && p.live) window.open(p.live, "_blank", "noopener");
  else if (how === "source" && p.source) window.open(p.source, "_blank", "noopener");
  else if (how === "case" && p.caseHref) go(p.caseHref, "var(--ink)");
};

// Flat layout: print mode, no WebGL, and the server render.
function Flat({ data, line, prev }) {
  const projects = useMemo(() => buildProjects(data), [data]);
  return (
    <Sheet id="projects" variant="paper" prev={prev} trace={traceFor("projects", line)} cmd={SECTION_META.projects.cmd} label="Projects">
      <RibbonTitle text="Deploy" />
      <div className="deck-toggle">
        <span className="eyebrow">index · {projects.length} projects</span>
      </div>
      <ul className="deck">
        {projects.map((p) => (
          <li key={p.id}>
            <article className="deck-card" style={{ "--c": p.style.bg, "--t": p.style.fg }}>
              <div className="row"><span>{p.num}</span><span>{p.tag}</span></div>
              <h3>{p.title}</h3>
              <p>{p.lead}</p>
              {p.bullets.length > 0 && <ul className="deck-points">{p.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
              <div className="stack">{p.tech.join(" · ")}</div>
              {(p.live || p.source) && (
                <div className="row">
                  {p.live && <a href={p.live} target="_blank" rel="noopener">live <ArrowUpRight size={14} /></a>}
                  {p.source && <a href={p.source} target="_blank" rel="noopener">source <ArrowUpRight size={14} /></a>}
                </div>
              )}
            </article>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function Stage({ data, line }) {
  const { go } = useSite();
  const projects = useMemo(() => buildProjects(data), [data]);
  const n = projects.length;

  const sectionRef = useRef(null);
  const pinRef = useRef(null);
  const stickRef = useRef(null);
  const clipRef = useRef(null);
  const ringRef = useRef(null);
  const [sel, setSelState] = useState(-1);
  const [active, setActive] = useState(false);
  const [near, setNear] = useState(false);
  const ready = useSyncExternalStore(subscribeIntro, () => intro.overlayIn || intro.played, () => false);

  const select = useCallback((i) => {
    const j = i < 0 ? -1 : Math.min(n - 1, i);
    setSel(j);
    setSelState(j);
  }, [n]);
  const openIt = useCallback((p, how) => open(go, p, how), [go]);
  useEffect(() => () => { reset(); document.body.style.cursor = ""; }, []);

  // One loop: gate the canvas, run the iris, and hand scroll to the stage.
  useEffect(() => {
    let a = null, b = null, was = false;
    return onTick(() => {
      const el = sectionRef.current, stick = stickRef.current, clip = clipRef.current, ring = ringRef.current;
      if (!el || !stick || !clip) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight, vw = window.innerWidth;
      const act = r.top < vh * 1.1 && r.bottom > -vh * 0.1;
      const nr = r.top < vh * 2.5;
      if (act !== a) { a = act; setActive(act); }
      if (nr !== b) { b = nr; setNear(nr); }

      // an iris only makes sense over the pinned Experience stage; otherwise it just slides in
      const iris = el.previousElementSibling?.classList.contains("xp-stage") ?? false;
      const top = r.top;
      const arrive = iris ? clamp(1 - top / vh) : top <= vh * 0.2 ? 1 : 0;
      const hold = clamp(-top / ((HOLD_VH * vh) / 100));
      const out = clamp(1 - r.bottom / vh);
      setScroll(arrive, hold, out);

      if (iris) {
        stick.style.transform = top > 0 ? `translate3d(0, ${(-top).toFixed(1)}px, 0)` : "";
        const maxR = Math.hypot(vw * 0.5, vh * Math.max(IRIS_Y, 1 - IRIS_Y)) * 1.04;
        const rad = inOutCubic(arrive) * maxR;
        clip.style.clipPath = arrive >= 1 ? "none" : `circle(${rad.toFixed(1)}px at 50% ${IRIS_Y * 100}%)`;
        if (ring) {
          ring.style.setProperty("--r", `${rad.toFixed(1)}px`);
          ring.style.opacity = arrive > 0.002 && arrive < 0.995 ? String(Math.min(1, Math.sin(arrive * Math.PI) * 2.2)) : "0";
        }
      } else {
        stick.style.transform = "";
        clip.style.clipPath = "";
      }
      stick.style.setProperty("--out", out.toFixed(3));

      const away = r.bottom < vh * 0.9 || r.top > vh * 0.5;
      if (away && was) { was = false; select(-1); }
      if (!away) was = true;
    });
  }, [select]);

  // Keys: Esc closes, arrows page through the projects while one is open.
  useEffect(() => {
    const seen = () => { const r = sectionRef.current?.getBoundingClientRect(); return r && r.top < innerHeight * 0.4 && r.bottom > innerHeight * 0.6; };
    const step = (d) => { if (sel >= 0) select((sel + d + n) % n); };
    const key = (e) => {
      if (/input|textarea/i.test(e.target.tagName) || !seen()) return;
      if (e.key === "Escape") select(-1);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    const swipe = (e) => { if (seen()) step(e.detail.dir === "left" ? 1 : -1); };
    window.addEventListener("keydown", key);
    window.addEventListener("dk:swipe", swipe);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("dk:swipe", swipe); };
  }, [sel, n, select]);

  const cur = sel >= 0 ? projects[sel] : null;

  return (
    <section ref={sectionRef} id="projects" className="frame pj-stage" aria-label="Projects">
      <div className="pj-pin" ref={pinRef} style={{ "--pin": `${HOLD_VH}svh` }}>
        <div className="pj-stick" ref={stickRef}>
          <div className="pj-clip" ref={clipRef}>
          <div className="pj-canvas" aria-hidden="true">
            {ready && near && (
              <Suspense fallback={null}>
                <DeployStage active={active} projects={projects} sel={sel} onSelect={select} onOpen={openIt} />
              </Suspense>
            )}
          </div>
          <div className="pj-ui">
            <div className="wrap">
              <div className="frame-head">
                <span className="frame-trace">{traceFor("projects", line)}</span>
                <span className="frame-cmd">{SECTION_META.projects.cmd}</span>
              </div>
            </div>
            <p className={`pj-hint${cur ? " open" : ""}`} aria-hidden="true">
              {cur ? "esc to close · ← → to switch" : `${n} projects · click a card${"ontouchstart" in globalThis ? " · drag to browse" : ""}`}
            </p>
          </div>
          </div>
          <div className="pj-ring" ref={ringRef} aria-hidden="true" />
          {/* the same content for screen readers and keyboards; the canvas is decorative */}
          <ul className="sr-only">
            {projects.map((p, i) => (
              <li key={p.id}>
                <button type="button" onClick={() => select(i)}>{p.title}. {p.lead}</button>
                {p.live && <a href={p.live} target="_blank" rel="noopener">{p.title} live</a>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function Projects(props) {
  const { three } = useSite();
  return three ? <Stage {...props} /> : <Flat {...props} />;
}
