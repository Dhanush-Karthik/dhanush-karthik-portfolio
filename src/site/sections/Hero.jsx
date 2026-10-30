import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, FileDown } from "lucide-react";
import Marquee from "../components/Marquee";
import { useSite } from "../SiteContext";
import { useProgress } from "../lib/useProgress";
import { seam } from "../lib/tear";

const PortraitScene = lazy(() => import("../three/PortraitScene"));

// Splits a display name like "Dhanush Karthik" (or the old "DhanushKarthik") into two words.
function splitName(name) {
  const clean = (name || "Dhanush Karthik").trim();
  if (clean.includes(" ")) { const [a, ...b] = clean.split(/\s+/); return [a, b.join(" ")]; }
  const m = clean.match(/^([A-Z][a-z]+)([A-Z].*)$/);
  return m ? [m[1], m[2]] : [clean, ""];
}

export default function Hero({ data, line }) {
  const { hero, skills, config, resume } = data;
  const { three } = useSite();
  const [first, last] = splitName(hero.name);
  const fullName = `${first} ${last}`.trim();
  const pinRef = useRef(null);
  const sheetRef = useRef(null);
  const tearRef = useRef(null);
  const [ready3d, setReady3d] = useState(false);
  const halves = useMemo(() => seam("hero-seam"), []);
  const tearState = useRef({ built: false });

  const marquee = useMemo(() => {
    const items = [config.site_subtitle || "Java Backend Engineer"];
    skills.slice(0, 3).forEach((s) => s.items?.slice(0, 2).forEach((i) => items.push(i)));
    items.push("Stack Trace 2026");
    return items;
  }, [skills, config.site_subtitle]);

  // Tear: when the pinned hero starts to scroll away, the sheet is cloned into two
  // halves along a jagged seam that peel apart and show the terminal underneath.
  useProgress(pinRef, "pin", (p) => {
    const sheet = sheetRef.current, layer = tearRef.current;
    if (!sheet || !layer) return;
    const t = Math.max(0, (p - 0.08) / 0.92);
    if (!three || t <= 0) {
      sheet.style.visibility = "";
      layer.style.display = "none";
      return;
    }
    if (!tearState.current.built) buildTear(sheet, layer, halves);
    tearState.current.built = true;
    layer.style.display = "block";
    sheet.style.visibility = "hidden";
    const e = t * t * (3 - 2 * t);
    const [a, b] = layer.children;
    a.style.transform = `translate3d(${-e * 18}vw, ${-e * 70}vh, 0) rotate(${-e * 14}deg)`;
    b.style.transform = `translate3d(${e * 14}vw, ${e * 75}vh, 0) rotate(${e * 9}deg)`;
  });

  useEffect(() => {
    const onResize = () => { tearState.current.built = false; };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <section id="hero" className="frame hero" aria-label="Introduction">
      <div className="hero-pin" ref={pinRef}>
        <div className="hero-stick">
          <div className="hero-sheet sheet paper" ref={sheetRef}>
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
                  <div className={`hero-portrait ${ready3d ? "has-3d" : ""}`}>
                    <img className="portrait-fallback" src={hero.cutout_url} alt={`Portrait of ${fullName}`} width="636" height="1605" fetchpriority="high" />
                    {three && (
                      <Suspense fallback={null}>
                        <PortraitScene cutout={hero.cutout_url} depth={hero.depth_url} onReady={() => setReady3d(true)} />
                      </Suspense>
                    )}
                  </div>
                  <div className="hero-front" aria-hidden="true">
                    <span className="hero-word w1">{first}</span>
                    <span className="hero-word w2">{last}</span>
                  </div>
                  <div className="note n-hero-1" aria-hidden="true">// TODO:<br />hire this guy</div>
                  <div className="note n-hero-2" aria-hidden="true">try ✋ hand mode<br />top right</div>
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
            <Marquee items={marquee} />
          </div>
          <div className="tear-layer" ref={tearRef} style={{ display: "none" }} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

function buildTear(sheet, layer, [upper, lower]) {
  layer.replaceChildren();
  [upper, lower].forEach((clip) => {
    const half = document.createElement("div");
    const copy = sheet.cloneNode(true);
    copy.style.visibility = "visible";
    copy.removeAttribute("id");
    copy.querySelectorAll("canvas").forEach((c) => c.remove());
    copy.querySelectorAll(".hero-portrait").forEach((p) => p.classList.remove("has-3d"));
    copy.querySelectorAll("a, button").forEach((n) => n.setAttribute("tabindex", "-1"));
    half.style.clipPath = clip;
    half.appendChild(copy);
    layer.appendChild(half);
  });
}
