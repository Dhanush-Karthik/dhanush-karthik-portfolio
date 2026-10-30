import Sheet from "../components/Sheet";
import RibbonTitle from "../components/RibbonTitle";
import { traceFor, SECTION_META } from "./meta";

// Short, stable pseudo commit hash from the row content.
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(7, "0").slice(0, 7);
}

export default function Experience({ data, line, prev }) {
  const { experience } = data;
  return (
    <Sheet id="experience" variant="paper" prev={prev} trace={traceFor("experience", line)} cmd={SECTION_META.experience.cmd} label="Experience">
      <RibbonTitle text="Experience" />
      <ol className="gitlog">
        {experience.map((e, i) => {
          const current = /present/i.test(e.end_date || "");
          return (
            <li key={e.id ?? i} className={`commit ${current ? "head" : ""}`}>
              <div className="commit-graph" aria-hidden="true"><span className="commit-node" /></div>
              <div className="commit-body">
                <div className="commit-line">
                  <span className="hash">{hash(`${e.company}${e.role}${e.start_date}`)}</span>
                  {current && <span className="ref">HEAD -&gt; main</span>}
                  <span className="ref tag">{e.start_date} — {e.end_date}</span>
                  <span className="date">{e.location}</span>
                </div>
                <h3>{e.role}<small>@ {e.company}</small></h3>
                <p>{e.description}</p>
                {e.tech_stack?.length > 0 && (
                  <div className="files" aria-label="Tech stack">{e.tech_stack.map((t) => <span key={t}>{t}</span>)}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}
