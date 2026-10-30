import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Sheet from "../components/Sheet";
import RibbonTitle from "../components/RibbonTitle";
import { useSite } from "../SiteContext";
import { useProgress } from "../lib/useProgress";
import { onTick } from "../lib/ticker";
import { intro, subscribeIntro } from "../lib/intro";
import { smooth, clamp } from "../three/hero/state";
import { rack, setHot as railHot } from "../three/skills/state";
import { stackOrder } from "../three/skills/order";
import { traceFor, SECTION_META } from "./meta";

const SkillsStage = lazy(() => import("../three/skills/SkillsStage"));

// Scroll length of the pinned stage: one step per tray, then a short hold on the last one.
const STEP_VH = 34;
const TAIL_VH = 28;
const ACCENTS = ["var(--phosphor)", "var(--tape)", "var(--signal)"];

// Flat layout: print mode, no WebGL, and the server render.
function Flat({ data, line, prev }) {
  const rows = useMemo(() => stackOrder(data.skills || []), [data.skills]);
  return (
    <Sheet id="skills" variant="term" prev={prev} trace={traceFor("skills", line)} cmd={SECTION_META.skills.cmd} label="Skills">
      <RibbonTitle text="Stack" onPaper={false} />
      <div className="skills-grid">
        <ul className="dep-tree" aria-label="Skills by category">
          <li className="cat" style={{ border: 0, color: "#6E8A76" }}>com.dhanushkarthik:engineer:jar:2026</li>
          {rows.map((s, i) => (
            <li key={s.id ?? i}>
              <div className="cat">{i === rows.length - 1 ? "└─" : "├─"} {s.category}<span>{s.items?.length ?? 0} deps</span></div>
              <div className="items">{(s.items || []).map((it, j) => <span key={j}><b>{it}</b>{j < s.items.length - 1 ? " · " : ""}</span>)}</div>
            </li>
          ))}
        </ul>
        <div className="skills-canvas" aria-hidden="true">
          <div className="skills-static">{rows.map((s, i) => <div key={i}>{s.category}</div>)}</div>
        </div>
      </div>
    </Sheet>
  );
}

// With WebGL on, Skills is one pinned stage: a server cabinet whose trays are the layers of the
// stack. Scrolling, clicking a tray or hovering its row slides that tray out, and its skills pop
// up on the deck. The list on the left carries the same content as real text.
function Stage({ data, line }) {
  const { scrollTo } = useSite();
  const rows = useMemo(() => stackOrder(data.skills || []), [data.skills]);
  const n = rows.length;
  const pinVh = Math.max(0, n - 1) * STEP_VH + TAIL_VH;
  const tail = TAIL_VH / pinVh;

  const sectionRef = useRef(null);
  const pinRef = useRef(null);
  const countRef = useRef(null);
  const curRef = useRef(0);
  const [cur, setCur] = useState(0);
  const [hot, setHot] = useState(-1);
  const [active, setActive] = useState(false);
  const [near, setNear] = useState(false);
  const [mobile, setMobile] = useState(false);
  const ready = useSyncExternalStore(subscribeIntro, () => intro.overlayIn || intro.played, () => false);

  useEffect(() => {
    const mq = window.matchMedia("(max-aspect-ratio: 17/20)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Build the rack once it is a couple of screens away, render only while it can be seen, and
  // start the boot sequence when it comes into view.
  useEffect(() => {
    let a = null, b = null;
    return onTick(() => {
      const el = sectionRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const act = r.top < vh * 1.1 && r.bottom > -vh * 0.1;
      const nr = r.top < vh * 2.5;
      if (act !== a) { a = act; setActive(act); }
      if (nr !== b) { b = nr; setNear(nr); }
      if (r.top < vh * 0.6) rack.seen = true;
    });
  }, []);

  useEffect(() => () => { rack.sel = 0; rack.hot = -1; rack.spread = 0; rack.seen = false; rack.boot = -1; rack.active = false; }, []);

  useProgress(pinRef, "pin", (P) => {
    const last = n - 1;
    const x = clamp(P / (1 - tail)) * last;
    const k = Math.min(Math.max(last - 1, 0), Math.floor(x));
    const sel = last <= 0 ? 0 : k + smooth(0.25, 0.7, x - k);
    rack.sel = sel;
    const i = Math.min(last, Math.max(0, Math.round(sel)));
    if (i !== curRef.current) { curRef.current = i; setCur(i); }
    if (countRef.current) {
      countRef.current.textContent = `${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
      countRef.current.style.setProperty("--bar", clamp(P / (1 - tail)).toFixed(3));
    }
  });

  // Once the pin ends the stage lifts off like a lid, the experience graph already sitting under it.
  useProgress(sectionRef, "exit", (p) => { sectionRef.current?.style.setProperty("--lift", p.toFixed(3)); });

  // Picking a tray scrolls the page to where that tray is the open one.
  const pick = (i) => {
    const el = pinRef.current;
    if (!el || n < 1) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const range = el.offsetHeight - window.innerHeight;
    const frac = n > 1 ? (i / (n - 1)) * (1 - tail) : 0;
    scrollTo(top + frac * range + 2, { duration: 1.2 });
  };
  const over = (i) => { railHot(i); setHot(i); };

  return (
    <section id="skills" ref={sectionRef} className="frame skills-stage" aria-label="Skills">
      <div className="rk-pin" ref={pinRef} style={{ "--pin": `${pinVh}svh` }}>
        <div className="rk-stick">
          <div className="rk-canvas" aria-hidden="true">
            {ready && near && (
              <Suspense fallback={null}>
                <SkillsStage rows={rows} active={active} mobile={mobile} onHover={setHot} onPick={pick} />
              </Suspense>
            )}
          </div>
          <div className="rk-ui">
            <div className="wrap">
              <div className="frame-head">
                <span className="frame-trace">{traceFor("skills", line)}</span>
                <span className="frame-cmd">{SECTION_META.skills.cmd}</span>
              </div>
            </div>
            <div className="wrap rk-body">
              <div className="rk-side">
                <h2 className="rk-h">The stack</h2>
                <p className="rk-sub">com.dhanushkarthik:engineer:jar:2026</p>
                <ul className="rk-list" aria-label="Skills by layer of the stack">
                  {rows.map((s, i) => (
                    <li key={s.id ?? i} className="rk-row" data-on={cur === i} data-hot={hot === i} style={{ "--a": ACCENTS[i % ACCENTS.length] }}>
                      <button
                        type="button"
                        className="rk-head"
                        aria-expanded={cur === i}
                        onClick={() => pick(i)}
                        onMouseEnter={() => over(i)}
                        onMouseLeave={() => over(-1)}
                        onFocus={() => over(i)}
                        onBlur={() => over(-1)}
                      >
                        <span className="rk-u">U{String(i + 1).padStart(2, "0")}</span>
                        <span className="rk-name">{s.category}</span>
                        <span className="rk-n">{s.items?.length ?? 0} deps</span>
                      </button>
                      <div className="rk-items">
                        <div>
                          {(s.items || []).map((it, j) => <span key={j} className="rk-chip">{it}</span>)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="about-hint" aria-hidden="true">click a tray · it slides out</p>
            <div className="about-count" aria-hidden="true">
              <span ref={countRef}>{`01 / ${String(n).padStart(2, "0")}`}</span>
              <i />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Skills(props) {
  const { three } = useSite();
  return three ? <Stage {...props} /> : <Flat {...props} />;
}
