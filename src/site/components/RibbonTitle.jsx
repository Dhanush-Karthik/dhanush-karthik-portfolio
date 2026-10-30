import { useRef } from "react";
import { useProgress } from "../lib/useProgress";

// Section title on a waving ribbon. Letters are outlined, and fill in only
// while they pass through the red bar. Scroll scrubs the ribbon sideways.
export default function RibbonTitle({ text, onPaper = true, as: Tag = "h2" }) {
  const ref = useRef(null);
  const trackRefs = useRef([]);
  useProgress(ref, "through", (p) => {
    const x = (0.5 - p) * 34;
    trackRefs.current.forEach((t) => t && t.style.setProperty("--rx", `${x.toFixed(2)}%`));
  });
  const letters = [...text].map((ch, i) => (
    <span key={i} style={{ "--i": i }}>{ch === " " ? " " : ch}</span>
  ));
  return (
    <div ref={ref} className={`ribbon ${onPaper ? "on-paper" : "on-term"}`} style={{ "--len": text.length }}>
      <div className="ribbon-bar" aria-hidden="true" />
      <Tag aria-label={text}><span className="ribbon-track" ref={(el) => (trackRefs.current[0] = el)} aria-hidden="true">{letters}</span></Tag>
      <div className="ribbon-fill" aria-hidden="true">
        <div className="ribbon-fill-track"><span className="ribbon-track" ref={(el) => (trackRefs.current[1] = el)}>{letters}</span></div>
      </div>
    </div>
  );
}
