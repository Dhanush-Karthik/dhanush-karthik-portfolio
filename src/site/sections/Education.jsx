import Sheet from "../components/Sheet";
import { traceFor, SECTION_META } from "./meta";

export default function Education({ data, line, prev }) {
  return (
    <Sheet id="education" variant="paper" prev={prev} trace={traceFor("education", line)} cmd={SECTION_META.education.cmd} label="Education">
      <h2 className="display" style={{ fontSize: "clamp(2.4rem, 7vw, 5.5rem)", margin: "0 0 40px" }}>Education</h2>
      <div className="receipts">
        {data.education.map((e, i) => (
          <article key={e.id ?? i} className="receipt" style={{ "--r": `${i % 2 ? 1.4 : -1.6}deg` }}>
            <span className="tape" style={{ top: -10, left: "36%", transform: "rotate(-3deg)" }} aria-hidden="true" />
            <h3>{e.university}</h3>
            <div className="center">{e.location}</div>
            <hr />
            <div className="row"><span>DEGREE</span><span>{e.degree}</span></div>
            <div className="row"><span>PERIOD</span><span>{e.start_date} – {e.end_date}</span></div>
            {e.description && <><hr /><div>{e.description}</div></>}
            <hr />
            {e.grade && <div className="row total"><span>TOTAL</span><span>{e.grade}</span></div>}
            <div className="barcode" aria-hidden="true" />
            <div className="center" style={{ marginTop: 10 }}>** TRANSACTION COMPLETE **</div>
          </article>
        ))}
      </div>
    </Sheet>
  );
}
