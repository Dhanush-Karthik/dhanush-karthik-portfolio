import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Lenis from "lenis";
import { gsap } from "gsap";
import { detectMode, saveMode } from "./lib/capability";
import { onTick } from "./lib/ticker";

const SiteContext = createContext(null);
export const useSite = () => useContext(SiteContext);

export function SiteProvider({ data, children }) {
  const navigate = useNavigate();
  // SSR and the first client render agree on "stack"; the real mode is decided after mount.
  const [mode, setModeState] = useState("stack");
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState("hero");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [hand, setHand] = useState("off"); // off | intro | loading | on | error
  const lenisRef = useRef(null);
  const wipeRef = useRef(null);

  useEffect(() => {
    // Must run after hydration: the mode depends on browser-only APIs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModeState(detectMode());
    setMounted(true);
    document.documentElement.classList.add("dk-site");
    return () => document.documentElement.classList.remove("dk-site");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  // Smooth scroll. Off in print mode and for reduced motion, where native scroll is better.
  useEffect(() => {
    if (!mounted || mode !== "stack") return;
    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95, smoothWheel: true });
    lenisRef.current = lenis;
    const off = onTick((t) => lenis.raf(t));
    return () => { off(); lenis.destroy(); lenisRef.current = null; };
  }, [mounted, mode]);

  const setMode = useCallback((m) => { saveMode(m); setModeState(m); }, []);

  const scrollTo = useCallback((target, opts = {}) => {
    const el = typeof target === "string" ? document.getElementById(target.replace(/^#/, "")) : target;
    if (el == null && typeof target !== "number") return;
    const offset = opts.offset ?? 0;
    if (lenisRef.current) lenisRef.current.scrollTo(el ?? target, { offset, duration: opts.duration ?? 1.4 });
    else if (typeof target === "number") window.scrollTo({ top: target });
    else el.scrollIntoView({ behavior: "auto" });
  }, []);

  const scrollBy = useCallback((dy) => {
    if (lenisRef.current) lenisRef.current.scrollTo(lenisRef.current.targetScroll + dy, { lerp: 0.18 });
    else window.scrollBy(0, dy);
  }, []);

  // Route change with a colour wipe: the panel rises, the route swaps, the panel drops away.
  const go = useCallback((to, color = "var(--signal)") => {
    const el = wipeRef.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!el || reduce) { navigate(to); window.scrollTo(0, 0); return; }
    el.style.setProperty("--wipe", color);
    gsap.timeline()
      .set(el, { transformOrigin: "50% 100%" })
      .to(el, { scaleY: 1, duration: 0.45, ease: "power3.in" })
      .add(() => { navigate(to); lenisRef.current?.scrollTo(0, { immediate: true }); window.scrollTo(0, 0); })
      .set(el, { transformOrigin: "50% 0%" })
      .to(el, { scaleY: 0, duration: 0.6, ease: "power3.out", delay: 0.08 });
  }, [navigate]);

  // Anchor links scroll through Lenis.
  useEffect(() => {
    function onClick(e) {
      const a = e.target.closest?.('a[href^="#"], a[href^="/#"]');
      if (!a || e.metaKey || e.ctrlKey) return;
      const id = a.getAttribute("href").replace(/^\/?#/, "");
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      scrollTo(el, { offset: id === "hero" ? 0 : -20 });
      history.replaceState(null, "", `#${id}`);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [scrollTo]);

  const value = useMemo(() => ({
    data, mode, setMode, mounted, active, setActive, paletteOpen, setPaletteOpen,
    hand, setHand, scrollTo, scrollBy, go, three: mounted && mode === "stack",
  }), [data, mode, setMode, mounted, active, paletteOpen, hand, scrollTo, scrollBy, go]);

  return (
    <SiteContext.Provider value={value}>
      {children}
      <div className="wipe" ref={wipeRef} aria-hidden="true" />
    </SiteContext.Provider>
  );
}
