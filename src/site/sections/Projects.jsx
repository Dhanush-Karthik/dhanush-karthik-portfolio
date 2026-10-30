import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import Sheet from "../components/Sheet";
import RibbonTitle from "../components/RibbonTitle";
import { useSite } from "../SiteContext";
import { traceFor, SECTION_META } from "./meta";
import { buildDeck } from "./cards";

const CardFan = lazy(() => import("../three/CardFan"));

export default function Projects({ data, line, prev }) {
  const { three, go } = useSite();
  const deck = useMemo(() => buildDeck(data), [data]);
  const fan = useRef(null);
  const [focus, setFocus] = useState(1);
  const projectsOnly = deck.filter((c) => c.kind === "project");

  function open(card) {
    if (card.external) { window.open(card.href, "_blank", "noopener"); return; }
    if (card.href.startsWith("#")) { document.querySelector(card.href)?.scrollIntoView(); return; }
    go(card.href, card.style.bg);
  }

  return (
    <Sheet id="projects" variant="paper" prev={prev} trace={traceFor("projects", line)} cmd={SECTION_META.projects.cmd} label="Projects">
      <RibbonTitle text="Deploy" />
      {three && (
        <div className="fan-stage" aria-hidden="true">
          <Suspense fallback={null}>
            <CardFan ref={fan} cards={deck} initial={1} onFocus={setFocus} onOpen={open} />
          </Suspense>
          <div className="fan-dial">ME</div>
          <div className="fan-ui">
            <button onClick={() => fan.current?.step(-1)} aria-label="Previous card" tabIndex={-1}><ChevronLeft size={18} /></button>
            <span>{String(focus + 1).padStart(2, "0")} / {String(deck.length).padStart(2, "0")} · drag, swipe or ←→ · click to open</span>
            <button onClick={() => fan.current?.step(1)} aria-label="Next card" tabIndex={-1}><ChevronRight size={18} /></button>
          </div>
        </div>
      )}
      <div className="deck-toggle">
        <span className="eyebrow">index · {projectsOnly.length} projects</span>
      </div>
      <ul className="deck">
        {projectsOnly.map((c) => (
          <li key={c.key}>
            <Link to={c.href} className="deck-card" style={{ "--c": c.style.bg, "--t": c.style.fg }}
              onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); open(c); }}>
              <div className="row"><span>{c.num}</span><span>{c.year}</span></div>
              {c.image && <img src={c.image} alt="" loading="lazy" />}
              <h3>{c.title}</h3>
              <p>{c.sub}</p>
              <div className="stack">{c.stack.join(" · ")}</div>
              <div className="row"><span>open case study</span><ArrowUpRight size={16} /></div>
            </Link>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
