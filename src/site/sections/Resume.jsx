import { useRef, useState } from "react";
import { Download } from "lucide-react";
import Sheet from "../components/Sheet";
import { useInView } from "../lib/useInView";
import { traceFor, SECTION_META } from "./meta";

export default function Resume({ data, line, prev }) {
  const { resume, experience, skills } = data;
  const ref = useRef(null);
  const inView = useInView(ref);
  const [bar, setBar] = useState(null);
  const file = resume?.file_name || "Resume.pdf";

  function fakeProgress() {
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(100, p + 9 + Math.random() * 14);
      setBar(p);
      if (p >= 100) clearInterval(t);
    }, 70);
  }

  const bars = bar == null ? "" : `${"#".repeat(Math.round(bar / 4)).padEnd(25, ".")} ${Math.round(bar)}%`;
  return (
    <Sheet id="resume" variant="term" prev={prev} trace={traceFor("resume", line)} cmd={SECTION_META.resume.cmd} label="Resume">
      <div ref={ref} className={`printer ${inView ? "in-view" : ""}`}>
        <div className="printer-body"><span><span className="led up" />dk-lpt0 · online</span><span>dot-matrix · 132 col</span></div>
        <div className="printer-slot" />
        <div className="printout">
          <h3>{resume?.heading || "Resume"}</h3>
          <p>{resume?.subtext}</p>
          <p style={{ marginTop: 14 }}>
            DHANUSH KARTHIK ........ {data.config.site_subtitle}<br />
            CURRENT ................ {experience[0] ? `${experience[0].role} @ ${experience[0].company}` : "—"}<br />
            CORE ................... {skills.slice(0, 2).flatMap((s) => s.items?.slice(0, 3) || []).join(", ")}
          </p>
        </div>
        <div className="curl">
          {resume?.file_url ? (
            <a className="btn solid" href={resume.file_url} download={file} target="_blank" rel="noopener" onClick={fakeProgress}>
              <Download size={15} />curl -O {file}
            </a>
          ) : (
            <span className="btn" aria-disabled="true">resume uploading soon</span>
          )}
          {bar != null && <span className="bar" aria-hidden="true">{bars}</span>}
        </div>
      </div>
    </Sheet>
  );
}
