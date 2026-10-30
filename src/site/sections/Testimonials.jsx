import Sheet from "../components/Sheet";
import { traceFor, SECTION_META } from "./meta";

export default function Testimonials({ data, line, prev }) {
  return (
    <Sheet id="testimonials" variant="paper" prev={prev} trace={traceFor("testimonials", line)} cmd={SECTION_META.testimonials.cmd} label="Testimonials">
      <h2 className="display" style={{ fontSize: "clamp(2.4rem, 7vw, 5.5rem)", margin: "0 0 40px" }}>Kind words</h2>
      <div className="cork">
        {data.testimonials.map((t, i) => (
          <figure key={t.id ?? i} className="quote-note" style={{ "--r": `${[-3, 2, -1.5, 3][i % 4]}deg` }}>
            <blockquote>“{t.quote}”</blockquote>
            <figcaption>— {t.name}<br />{t.role}{t.company ? `, ${t.company}` : ""}</figcaption>
          </figure>
        ))}
      </div>
    </Sheet>
  );
}
