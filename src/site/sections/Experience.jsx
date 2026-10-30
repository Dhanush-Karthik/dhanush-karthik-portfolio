import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Sheet from "../components/Sheet";
import RibbonTitle from "../components/RibbonTitle";
import { useSite } from "../SiteContext";
import { onTick } from "../lib/ticker";
import { intro, subscribeIntro } from "../lib/intro";
import { clamp } from "../three/hero/state";
import { HISTORY, STATS } from "../three/trace/history";
import { reset, setFilter, setHot as traceHot, setScroll, setTech } from "../three/trace/state";
import { traceFor, SECTION_META } from "./meta";

const GraphStage = lazy(() => import("../three/trace/GraphStage"));

// Pinned stage: the résumé as a git graph. The first screen of scroll uncovers it from under Skills
// (it is already sitting there, stuck, while Skills lifts away), then every commit gets a short
// step, then a short hold on the root commit.
const ARR_VH = 100;
const STEP_VH = 15;
const TAIL_VH = 30;

const { nodes, techs, N, eduRow } = HISTORY;
const matches = (n, filter, tech) => (filter === "all" || n.group === filter) && (!tech || n.tech.includes(tech));

// Flat layout: print mode, no WebGL, and the server render. The same history, as a plain log.
function Flat({ line, prev }) {
  const work = nodes.filter((n) => n.group === "work" && n.kind === "commit");
  const streams = [
    { key: "ibm", title: "IBM · Identity Provider Platform (IDP) for IBM e-Health" },
    { key: "migros", title: "Migros · Consumer Identity Platform" },
    { key: "shiftpen", title: "Product PoC · ShiftPen, multi-signer digital e-signing platform" },
  ].map((s) => ({ ...s, items: work.filter((n) => n.lane === s.key) }));
  const intern = work.filter((n) => n.lane === "main");
  const award = nodes.find((n) => n.award);
  const head = nodes[0];
  return (
    <Sheet id="experience" variant="paper" prev={prev} trace={traceFor("experience", line)} cmd={SECTION_META.experience.cmd} label="Experience">
      <RibbonTitle text="Experience" />
      <ol className="gitlog">
        <li className="commit head">
          <div className="commit-graph" aria-hidden="true"><span className="commit-node" /></div>
          <div className="commit-body">
            <div className="commit-line">
              <span className="hash">{head.hash}</span>
              <span className="ref">HEAD -&gt; main</span>
              <span className="ref tag">May 2024 — Present</span>
              <span className="date">Chennai</span>
            </div>
            <h3>Software Engineer<small>@ Grootan Technologies</small></h3>
            <p>{head.body}</p>
            {streams.map((s) => (
              <div key={s.key} className="xp-stream">
                <h4>{s.title}</h4>
                <ul>{s.items.map((n) => <li key={n.id}>{n.body}</li>)}</ul>
              </div>
            ))}
            {award && <p className="xp-award"><b>GROOT OF THE QUARTER – Q3 2024.</b> {award.body.replace(/^GROOT OF THE QUARTER – Q3 2024\.\s*/, "")}</p>}
          </div>
        </li>
        <li className="commit">
          <div className="commit-graph" aria-hidden="true"><span className="commit-node" /></div>
          <div className="commit-body">
            <div className="commit-line">
              <span className="hash">{intern[0].hash}</span>
              <span className="ref tag">Jun 2023 — May 2024</span>
              <span className="date">Chennai</span>
            </div>
            <h3>Junior Software Engineer – Intern<small>@ Grootan Technologies</small></h3>
            <ul>{intern.map((n) => <li key={n.id}>{n.body}</li>)}</ul>
          </div>
        </li>
      </ol>
    </Sheet>
  );
}

function Stage({ data, line }) {
  const { scrollTo } = useSite();
  const hasEdu = data.sectionOrder?.some((s) => s.id === "education" && s.visible) ?? true;
  const pinVh = ARR_VH + (N - 1) * STEP_VH + TAIL_VH;

  const sectionRef = useRef(null);
  const pinRef = useRef(null);
  const sideRef = useRef(null);
  const countRef = useRef(null);
  const curRef = useRef(0);
  const [cur, setCur] = useState(0);
  const [filter, setFilterState] = useState("all");
  const [lock, setLock] = useState(null);
  const [hoverTech, setHoverTech] = useState(null);
  const [active, setActive] = useState(false);
  const [near, setNear] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [inset, setInset] = useState(0);
  const ready = useSyncExternalStore(subscribeIntro, () => intro.overlayIn || intro.played, () => false);
  const tech = hoverTech ?? lock;

  useEffect(() => {
    const mq = window.matchMedia("(max-aspect-ratio: 17/20)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // How much of the left of the screen the text column covers: the graph is centred in the rest.
  useEffect(() => {
    const measure = () => {
      const el = sideRef.current;
      setInset(!el || mobile ? 0 : el.getBoundingClientRect().right);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [mobile]);

  useEffect(() => { setTech(tech); }, [tech]);
  useEffect(() => { setFilter(filter); }, [filter]);
  useEffect(() => () => { reset(); document.body.style.cursor = ""; }, []);

  // One loop: gate the canvas, and turn scroll into the camera's position on the graph.
  useEffect(() => {
    let a = null, b = null;
    return onTick(() => {
      const el = sectionRef.current, pin = pinRef.current;
      if (!el || !pin) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const act = r.top < vh * 1.1 && r.bottom > -vh * 0.1;
      const nr = r.top < vh * 2.5;
      if (act !== a) { a = act; setActive(act); }
      if (nr !== b) { b = nr; setNear(nr); }

      const off = -pin.getBoundingClientRect().top;
      const arr = (ARR_VH * vh) / 100;
      const arrive = clamp(off / arr);
      const f = clamp((off - arr) / (((N - 1) * STEP_VH * vh) / 100)) * (N - 1);
      const out = clamp((off - (pinVh * vh) / 100) / vh);
      setScroll(f, arrive, out);

      const i = Math.min(N - 1, Math.max(0, Math.round(f)));
      if (i !== curRef.current) { curRef.current = i; setCur(i); }
      if (countRef.current) {
        countRef.current.textContent = `${String(i + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")}`;
        countRef.current.style.setProperty("--bar", clamp(f / (N - 1)).toFixed(3));
      }
      pin.style.setProperty("--out", out.toFixed(3));
    });
  }, [pinVh]);

  // Picking a commit scrolls to where the camera sits on it.
  const pick = useCallback((i) => {
    const el = pinRef.current;
    if (!el) return;
    const j = Math.min(N - 1, Math.max(0, i));
    const vh = window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    scrollTo(top + (ARR_VH * vh) / 100 + (j * STEP_VH * vh) / 100 + 2, { duration: 1.2 });
  }, [scrollTo]);

  const hoverNode = useCallback((i) => {
    traceHot(i);
    document.body.style.cursor = i >= 0 ? "pointer" : "";
  }, []);

  // A filter that hides the commit you are on moves you to the nearest one it keeps.
  const refocus = (nextFilter, nextTech) => {
    const here = curRef.current;
    if (matches(nodes[here], nextFilter, nextTech)) return;
    let best = -1;
    nodes.forEach((n, i) => {
      if (matches(n, nextFilter, nextTech) && (best < 0 || Math.abs(i - here) < Math.abs(best - here))) best = i;
    });
    if (best >= 0) pick(best);
  };
  const setTab = (f) => { setFilterState(f); refocus(f, lock); };
  const toggleTech = (t) => { const next = lock === t ? null : t; setLock(next); refocus(filter, next); };

  const n = nodes[cur];
  const tabs = [["all", "All"], ["work", "Work"], ["edu", "Education"]];
  const pills = [...n.refs];

  return (
    <section ref={sectionRef} className="frame xp-stage" aria-label="Experience and education">
      <div className="xp-pin" ref={pinRef} style={{ "--pin": `${pinVh}svh` }}>
        <div className="xp-stick">
          <div className="xp-canvas" aria-hidden="true">
            {ready && near && (
              <Suspense fallback={null}>
                <GraphStage active={active} mobile={mobile} inset={inset} onHover={hoverNode} onPick={pick} />
              </Suspense>
            )}
          </div>
          <div className="xp-ui">
            <div className="wrap">
              <div className="frame-head">
                <span className="frame-trace">{traceFor("experience", line)}</span>
                <span className="frame-cmd">{SECTION_META.experience.cmd}</span>
              </div>
            </div>
            <div className="wrap xp-body">
              <div className="xp-side" ref={sideRef}>
                <h2 className="xp-h">Experience <span>&amp; education</span></h2>
                <ul className="xp-stats" aria-label="At a glance">
                  {STATS.map((s) => <li key={s.label}><b>{s.value}</b><span>{s.label}</span></li>)}
                </ul>
                <div className="xp-tabs" role="group" aria-label="Filter the graph">
                  {tabs.map(([k, label]) => (
                    <button key={k} type="button" className="xp-tab" aria-pressed={filter === k} onClick={() => setTab(k)}>{label}</button>
                  ))}
                </div>
                <article className="xp-card" key={cur} aria-live="polite">
                  <div className="xp-ref">
                    <span className="xp-hash">commit {n.hash}</span>
                    {pills.map((r) => <span key={r} className="xp-pill" data-kind={n.award ? "award" : r.startsWith("HEAD") ? "head" : "tag"}>{r}</span>)}
                  </div>
                  <h3 className="xp-subject">{n.subject}</h3>
                  <p className="xp-line"><span>{n.branch}</span><span>{n.when}</span></p>
                  <p className="xp-where">{n.where}</p>
                  <p className="xp-text">{n.body}</p>
                  {n.tech.length > 0 && (
                    <div className="xp-tech" aria-label="Skills used">
                      {n.tech.map((t) => <span key={t} className="xp-tchip">{t}</span>)}
                    </div>
                  )}
                </article>
                <div className="xp-skills">
                  <span className="xp-label">filter by skill</span>
                  <div className="xp-chips">
                    {techs.slice(0, 14).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="xp-chip"
                        aria-pressed={lock === t}
                        onClick={() => toggleTech(t)}
                        onMouseEnter={() => setHoverTech(t)}
                        onMouseLeave={() => setHoverTech(null)}
                        onFocus={() => setHoverTech(t)}
                        onBlur={() => setHoverTech(null)}
                      >{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="about-hint" aria-hidden="true">scroll · click a commit</p>
            <div className="xp-nav">
              <button type="button" className="xp-step" aria-label="Newer commit" disabled={cur === 0} onClick={() => pick(cur - 1)}>↑</button>
              <button type="button" className="xp-step" aria-label="Older commit" disabled={cur === N - 1} onClick={() => pick(cur + 1)}>↓</button>
              <div className="about-count xp-count" aria-hidden="true">
                <span ref={countRef}>{`01 / ${String(N).padStart(2, "0")}`}</span>
                <i />
              </div>
            </div>
          </div>
        </div>
        {/* nav targets for #experience and #education, placed where the camera reaches them */}
        <div id="experience" className="xp-anchor" style={{ top: `${ARR_VH}svh`, height: `${hasEdu ? eduRow * STEP_VH : (N - 1) * STEP_VH + TAIL_VH + 100}svh` }} />
        {hasEdu && <div id="education" className="xp-anchor" style={{ top: `${ARR_VH + eduRow * STEP_VH}svh`, height: `${(N - 1 - eduRow) * STEP_VH + TAIL_VH + 100}svh` }} />}
      </div>
    </section>
  );
}

export default function Experience(props) {
  const { three } = useSite();
  return three ? <Stage {...props} /> : <Flat {...props} />;
}
