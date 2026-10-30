import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Sheet from "../components/Sheet";
import { useSite } from "../SiteContext";
import { useProgress } from "../lib/useProgress";
import { onTick } from "../lib/ticker";
import { intro, subscribeIntro } from "../lib/intro";
import { stage, smooth, clamp } from "../three/hero/state";
import { about as cloud } from "../three/about/state";
import { highlights } from "../three/about/targets";
import { traceFor, SECTION_META } from "./meta";

const AboutStage = lazy(() => import("../three/about/AboutStage"));

// Scroll length of the pinned stage: one step per chapter, then a tail in which the particles
// fall away onto the edge of the next section.
const BEAT_VH = 42;
const TAIL_VH = 60;

function Stat({ value, label, on }) {
  const ref = useRef(null);
  const parsed = useMemo(() => {
    const m = /^(\d+(?:\.\d+)?)(.*)$/.exec(String(value));
    return m ? { n: parseFloat(m[1]), dec: (m[1].split(".")[1] || "").length, rest: m[2] } : null;
  }, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!parsed) { el.textContent = String(value); return undefined; }
    const fmt = (v) => v.toFixed(parsed.dec) + parsed.rest;
    if (!on) { el.textContent = fmt(0); return undefined; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t) => {
      const k = clamp((t - t0) / 1100);
      el.textContent = fmt(parsed.n * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [on, parsed, value]);
  return (
    <div className="about-stat">
      <b ref={ref} aria-label={String(value)} />
      <span>{label}</span>
    </div>
  );
}

// Flat layout: print mode, no WebGL, and the server render.
function Flat({ data, line, prev }) {
  const { about, config } = data;
  const paragraphs = (about.bio || "").split(/\n\s*\n/).filter(Boolean);
  const stats = Array.isArray(about.stats) ? about.stats : [];
  return (
    <Sheet id="about" variant="term" prev={prev} trace={traceFor("about", line)} cmd={SECTION_META.about.cmd} label="About">
      <div className="about-flat">
        <div>
          <h2 className="about-hello">Hello</h2>
          <div className="about-bio">
            <p>Hi, I'm {config.site_title || "Dhanush Karthik"}.</p>
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
        <div className="stamps">
          {stats.map((s, i) => (
            <div key={i} className="stamp" style={{ "--r": `${[-4, 3, 2, -3][i % 4]}deg` }}>
              <b>{s.value}</b><span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

// With WebGL on, About is one pinned stage: the torn hero page opens onto a dark field of
// particles that write a greeting, then the words that matter in each paragraph, then the
// numbers, and finally fall away onto the next section. The real text sits on top, one
// paragraph per chapter.
function Stage({ data, line }) {
  const { about, config, skills } = data;
  const paragraphs = useMemo(() => {
    const ps = (about.bio || "").split(/\n\s*\n/).filter(Boolean);
    return ps.length > 3 ? [ps[0], ps[1], ps.slice(2).join("\n\n")] : ps;
  }, [about.bio]);
  const stats = useMemo(() => (Array.isArray(about.stats) ? about.stats : []), [about.stats]);

  // One chapter per paragraph; the particles write the words that matter in it.
  const chapters = useMemo(() => {
    const names = (skills || []).flatMap((s) => s.items || []);
    const list = [{ key: "hello", tag: "// whoami", scene: { kind: "hello", word: "HELLO" } }];
    paragraphs.forEach((text, i) => list.push({ key: `p${i}`, tag: `// about.md:${i + 1}`, text, scene: { kind: "words", lines: highlights(text, names) } }));
    if (stats.length) list.push({ key: "stats", tag: "// key facts", stats: true, scene: { kind: "stats", values: stats.map((s) => String(s.value)) } });
    return list;
  }, [paragraphs, stats, skills]);
  const B = chapters.length;
  const scenes = useMemo(() => chapters.map((c) => c.scene), [chapters]);
  const pinVh = (B - 1) * BEAT_VH + TAIL_VH;
  const tail = TAIL_VH / pinVh;

  const sectionRef = useRef(null);
  const pinRef = useRef(null);
  const panels = useRef([]);
  const countRef = useRef(null);
  const [active, setActive] = useState(false);
  const [statsOn, setStatsOn] = useState(false);
  const statsRef = useRef(false);
  const [mobile, setMobile] = useState(false);
  const ready = useSyncExternalStore(subscribeIntro, () => intro.overlayIn || intro.played, () => false);
  const [mount, setMount] = useState(false);

  // Build the cloud after the hero has settled, so the two never compete during the intro.
  useEffect(() => {
    if (!ready) return undefined;
    const id = setTimeout(() => setMount(true), 700);
    return () => clearTimeout(id);
  }, [ready]);

  useEffect(() => {
    const mq = window.matchMedia("(max-aspect-ratio: 17/20)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Render only while the section can be seen (or is about to be revealed by the burn).
  useEffect(() => {
    let last = null;
    return onTick(() => {
      const el = sectionRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const act = (r.top < vh * 1.1 && r.bottom > -vh * 0.1) || (stage.p > 0.05 && stage.p < 1);
      if (act !== last) { last = act; setActive(act); }
    });
  }, []);

  useEffect(() => () => { cloud.beat = 0; cloud.out = 0; cloud.active = false; }, []);

  useProgress(pinRef, "pin", (P) => {
    const n = B - 1;
    const x = clamp(P / (1 - tail)) * n;
    const k = Math.min(Math.max(n - 1, 0), Math.floor(x));
    const beat = n <= 0 ? 0 : k + smooth(0.18, 0.6, x - k);
    const out = smooth(0, 1, (P - (1 - tail)) / tail);
    cloud.beat = beat;
    cloud.out = out;
    pinRef.current?.style.setProperty("--out", out.toFixed(3));
    panels.current.forEach((el, i) => {
      if (!el) return;
      const d = i - beat;
      const op = clamp(1 - Math.abs(d) * 2.4) * (1 - smooth(0, 0.55, out));
      el.style.opacity = op.toFixed(3);
      el.style.transform = `translate3d(0, ${(d * 34).toFixed(1)}px, 0)`;
      el.style.visibility = op < 0.01 ? "hidden" : "visible";
    });
    if (countRef.current) {
      const i = Math.min(B - 1, Math.round(beat));
      countRef.current.textContent = `${String(i + 1).padStart(2, "0")} / ${String(B).padStart(2, "0")}`;
      countRef.current.style.setProperty("--bar", clamp(P / (1 - tail)).toFixed(3));
    }
    const so = stats.length > 0 && beat > B - 1.55;
    if (so !== statsRef.current) { statsRef.current = so; setStatsOn(so); }
  });

  return (
    <section id="about" ref={sectionRef} className="frame about-stage" aria-label="About">
      <div className="about-pin" ref={pinRef} style={{ "--pin": `${pinVh}svh` }}>
        <div className="about-stick">
          <div className="about-canvas" aria-hidden="true">
            {mount && (
              <Suspense fallback={null}>
                <AboutStage scenes={scenes} active={active} mobile={mobile} />
              </Suspense>
            )}
          </div>
          <div className="about-ui">
            <div className="wrap">
              <div className="frame-head">
                <span className="frame-trace">{traceFor("about", line)}</span>
                <span className="frame-cmd">{SECTION_META.about.cmd}</span>
              </div>
            </div>
            <div className="wrap about-body">
              <div className="about-copy">
                {chapters.map((c, i) => (
                  <div key={c.key} className="about-panel" ref={(el) => { panels.current[i] = el; }} style={i === 0 ? undefined : { opacity: 0, visibility: "hidden" }}>
                    <p className="about-tag">{c.tag}</p>
                    {i === 0 && (
                      <>
                        <h2 className="about-h">Hi, I'm {config.site_title || "Dhanush Karthik"}.</h2>
                        <p className="about-sub">{config.site_subtitle || "Java Backend Engineer"} <span aria-hidden="true">· scroll ↓</span></p>
                      </>
                    )}
                    {c.text && <p>{c.text}</p>}
                    {c.stats && (
                      <div className="about-stats">
                        {stats.map((s, j) => <Stat key={j} value={s.value} label={s.label} on={statsOn} />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <p className="about-hint" aria-hidden="true">move your cursor · click</p>
            <div className="about-count" aria-hidden="true">
              <span ref={countRef}>{`01 / ${String(B).padStart(2, "0")}`}</span>
              <i />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function About(props) {
  const { three } = useSite();
  return three ? <Stage {...props} /> : <Flat {...props} />;
}
