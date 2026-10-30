import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDown, FileDown } from "lucide-react";
import Marquee from "../components/Marquee";
import { useSite } from "../SiteContext";
import { useProgress } from "../lib/useProgress";
import { intro, setIntro, subscribeIntro } from "../lib/intro";
import { stage, smooth } from "../three/hero/state";

const HeroStage = lazy(() => import("../three/hero/HeroStage"));

// Splits a display name like "Dhanush Karthik" (or the old "DhanushKarthik") into two words.
function splitName(name) {
  const clean = (name || "Dhanush Karthik").trim();
  if (clean.includes(" ")) { const [a, ...b] = clean.split(/\s+/); return [a, b.join(" ")]; }
  const m = clean.match(/^([A-Z][a-z]+)([A-Z].*)$/);
  return m ? [m[1], m[2]] : [clean, ""];
}

// With WebGL on, the canvas draws the page (paper, name, portrait, floating objects,
// ribbons) and rips it open on scroll. The DOM below stays for text, links, screen
// readers and the flat layout; it fades out just before the rip starts.
export default function Hero({ data, line }) {
  const { hero, skills, config, resume } = data;
  const { three } = useSite();
  const [first, last] = splitName(hero.name);
  const fullName = `${first} ${last}`.trim();
  const sectionRef = useRef(null);
  const pinRef = useRef(null);
  const uiRef = useRef(null);
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const on = three && !failed;
  const overlayIn = useSyncExternalStore(subscribeIntro, () => intro.overlayIn || intro.played, () => true);
  const grabbed = useSyncExternalStore(subscribeIntro, () => intro.grabbed, () => false);

  const marquee = useMemo(() => {
    const items = [config.site_subtitle || "Java Backend Engineer"];
    skills.slice(0, 3).forEach((s) => s.items?.slice(0, 2).forEach((i) => items.push(i)));
    items.push("Stack Trace 2026");
    return items;
  }, [skills, config.site_subtitle]);

  // If WebGL never comes up, fall back to the flat hero instead of leaving a dark screen.
  useEffect(() => {
    if (!on) return;
    let id = 0;
    const arm = () => {
      id = setTimeout(() => {
        if (intro.stageReady) return;
        // A background tab renders at a crawl; only give up while the page is actually visible.
        if (document.visibilityState !== "visible") { arm(); return; }
        setFailed(true);
        document.documentElement.classList.remove("boot-pending");
        setIntro({ bootActive: false });
      }, 9000);
    };
    arm();
    return () => clearTimeout(id);
  }, [on]);

  // Scroll progress through the pinned hero → the rip, the text fade, and holding the next
  // section still underneath so it is revealed in place rather than scrolling up.
  useProgress(pinRef, "pin", (p) => {
    const q = on ? p : 0;
    stage.p = q;
    const ui = uiRef.current;
    if (ui) {
      const ov = on ? 1 - smooth(0, 0.1, q) : 1;
      ui.style.setProperty("--ov", String(ov));
      ui.classList.toggle("dead", ov < 0.5);
    }
    // once the page is tearing, the canvas is only an overlay with a gap in it: let clicks through
    canvasRef.current?.classList.toggle("thru", on && q > 0.1);
    const next = sectionRef.current?.nextElementSibling;
    if (next) {
      const hold = on && q > 0.1 && q < 1;
      if (hold) {
        const D = pinRef.current.offsetHeight - window.innerHeight;
        next.style.transform = `translate3d(0, ${(-(1 - q) * D).toFixed(1)}px, 0)`;
      } else if (next.style.transform) next.style.transform = "";
      // While held under the rip, the section must not run its own scroll "dolly"
      // (scale + brightness), or it dims and shifts while being revealed.
      next.classList.toggle("held", hold);
    }
    setPaused(on && q > 0.985);
  });

  useEffect(() => () => {
    stage.p = 0;
    const next = sectionRef.current?.nextElementSibling;
    if (next) { next.style.transform = ""; next.classList.remove("held"); }
  }, []);

  return (
    <section
      id="hero"
      ref={sectionRef}
      className={`frame hero ${on ? "stage-on" : ""} ${on && !overlayIn ? "stage-wait" : ""} ${grabbed ? "grabbed" : ""}`}
      aria-label="Introduction"
    >
      <div className="hero-pin" ref={pinRef}>
        <div className="hero-stick">
          <div className="hero-sheet sheet paper">
            {on && (
              <div ref={canvasRef} className={`hero-canvas ${paused ? "off" : ""}`}>
                <Suspense fallback={null}>
                  <HeroStage items={marquee} cutout={hero.cutout_url} first={first} last={last} paused={paused} onFail={() => setFailed(true)} />
                </Suspense>
              </div>
            )}
            <div className="hero-ui" ref={uiRef}>
              <div className="sheet-inner">
                <div className="wrap" style={{ display: "flex", flexDirection: "column", flex: 1, width: "100%" }}>
                  <div className="hero-meta">
                    <span>{config.site_subtitle || "Java Backend Engineer"}</span>
                    <span className="frame-trace">{`at dk.Portfolio.whoami(Hero.java:${line})`}</span>
                    <span>Portfolio — 2026</span>
                  </div>
                  <div className="hero-stage">
                    <h1 className="hero-name">
                      <span className="hero-word w1">{first}</span>{" "}
                      <span className="hero-word w2">{last}</span>
                    </h1>
                    <div className="hero-portrait">
                      <img className="portrait-fallback" src={hero.cutout_url} alt={`Portrait of ${fullName}`} width="616" height="1556" fetchpriority="high" />
                    </div>
                    <div className="hero-front" aria-hidden="true">
                      <span className="hero-word w1">{first}</span>
                      <span className="hero-word w2">{last}</span>
                    </div>
                    {on && <p className="hero-hint" aria-hidden="true">hover one, or grab and throw it ✋</p>}
                    <div className="hero-arrow" aria-hidden="true">
                      <svg viewBox="0 0 70 34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M68 8 C 48 2, 22 4, 6 24" /><path d="M6 24 L 8 12 M6 24 L 17 21" /></svg>
                      that's me
                    </div>
                  </div>
                  <div className="hero-foot">
                    <div className="hero-code" aria-hidden="true">
                      <span className="kw">{hero.greeting || "public class"}</span> <span className="cls">{`${first}${last}`.replace(/\s/g, "")}</span><br />
                      &nbsp;&nbsp;<span className="kw">{hero.tagline_prefix || "extends"}</span> {hero.tagline || "BackendEngineer"} {"{"} <span className="cm">{"/* scroll ↓ */"}</span> {"}"}
                    </div>
                    <p className="hero-desc">{hero.description}</p>
                    <div className="hero-ctas">
                      <a className="btn solid" href={hero.cta_link || "#projects"}><ArrowDown size={15} />{hero.cta_text || "View my work"}</a>
                      {resume?.file_url && <a className="btn" href={resume.file_url} target="_blank" rel="noopener"><FileDown size={15} />Resume</a>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {!on && <Marquee items={marquee} />}
          </div>
        </div>
      </div>
    </section>
  );
}
