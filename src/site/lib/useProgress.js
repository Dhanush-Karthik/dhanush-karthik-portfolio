import { useEffect, useRef } from "react";
import { onTick } from "./ticker";

const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Scroll progress of an element, written to a ref every frame (no re-renders).
//  "pin":     0 when the top reaches the viewport top, 1 when the bottom reaches the viewport bottom.
//  "through": 0 when the top enters at the bottom, 1 when the bottom leaves at the top.
//  "exit":    0 while the bottom is below the viewport bottom, 1 when it reaches the viewport top.
export function useProgress(ref, kind = "through", onChange) {
  const p = useRef(0);
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; });

  useEffect(() => {
    let last = -1;
    return onTick(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      let v;
      if (kind === "pin") v = clamp(-r.top / Math.max(1, r.height - vh));
      else if (kind === "exit") v = clamp(1 - r.bottom / vh);
      else v = clamp((vh - r.top) / (vh + r.height));
      p.current = v;
      if (cb.current && Math.abs(v - last) > 0.0005) { last = v; cb.current(v); }
    });
  }, [ref, kind]);

  return p;
}
