import { lazy, Suspense, useState } from "react";
import Sheet from "../components/Sheet";
import RibbonTitle from "../components/RibbonTitle";
import { useSite } from "../SiteContext";
import { traceFor, SECTION_META } from "./meta";

const SkillsStack = lazy(() => import("../three/SkillsStack"));

export default function Skills({ data, line, prev }) {
  const { skills } = data;
  const { three } = useSite();
  const [hot, setHot] = useState(-1);
  // Bottom of the architecture stack first: infra → data → frameworks → languages → architecture.
  return (
    <Sheet id="skills" variant="term" torn={!three} prev={prev} trace={traceFor("skills", line)} cmd={SECTION_META.skills.cmd} label="Skills">
      <RibbonTitle text="Stack" onPaper={false} />
      <div className="skills-grid">
        <ul className="dep-tree" aria-label="Skills by category">
          <li className="cat" style={{ border: 0, color: "#6E8A76" }}>com.dhanushkarthik:engineer:jar:2026</li>
          {skills.map((s, i) => (
            <li key={s.id ?? i} data-active={hot === i} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(-1)}>
              <div className="cat">{i === skills.length - 1 ? "└─" : "├─"} {s.category}<span>{s.items?.length ?? 0} deps</span></div>
              <div className="items">{(s.items || []).map((it, j) => <span key={j}><b>{it}</b>{j < s.items.length - 1 ? " · " : ""}</span>)}</div>
            </li>
          ))}
        </ul>
        <div className="skills-canvas" aria-hidden="true">
          {three ? (
            <Suspense fallback={null}>
              <SkillsStack skills={skills} hot={hot} onHover={setHot} />
            </Suspense>
          ) : (
            <div className="skills-static">{skills.map((s, i) => <div key={i}>{s.category}</div>)}</div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
