import { useRef } from "react";
import { tornTop } from "../lib/tear";
import { useProgress } from "../lib/useProgress";
import { useSite } from "../SiteContext";

// One frame of the stack. Paper or terminal, with a torn top edge. As the frame
// scrolls out, its content sinks back (slower scroll + slight scale) so the next
// sheet visibly slides over it — the "dolly" through the stack.
export default function Sheet({ id, variant = "paper", prev, trace, cmd, children, className = "", innerClass = "", torn = true, label }) {
  const { three } = useSite();
  const frameRef = useRef(null);
  const sheetRef = useRef(null);

  useProgress(frameRef, "exit", (p) => {
    const el = sheetRef.current;
    if (!el) return;
    if (!three) { el.style.transform = ""; el.style.filter = ""; return; }
    const e = p * p;
    el.style.transform = p > 0 ? `translate3d(0, ${(e * 22).toFixed(2)}vh, 0) scale(${(1 - e * 0.07).toFixed(4)})` : "";
    el.style.filter = p > 0 ? `brightness(${(1 - e * 0.45).toFixed(3)})` : "";
  });

  const clip = torn ? tornTop(id) : undefined;
  return (
    <section id={id} ref={frameRef} className={`frame ${prev === "term" ? "on-term" : ""} ${className}`} aria-label={label}>
      {torn && <div className="sheet-rim" style={{ clipPath: tornTop(`${id}-rim`, 30) }} aria-hidden="true" />}
      <div ref={sheetRef} className={`sheet ${variant}`} style={{ clipPath: clip }}>
        <div className={`sheet-inner ${innerClass}`}>
          <div className="wrap">
            {(trace || cmd) && (
              <div className="frame-head">
                {trace && <span className="frame-trace">{trace}</span>}
                {cmd && <span className="frame-cmd">{cmd}</span>}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
