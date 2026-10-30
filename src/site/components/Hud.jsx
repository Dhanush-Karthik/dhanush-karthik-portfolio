import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Hand, Command, Menu, X, Layers, FileText } from "lucide-react";
import { useSite } from "../SiteContext";
import { SECTION_META } from "../sections/meta";

export default function Hud({ sections }) {
  const { active, mode, setMode, hand, setHand, setPaletteOpen } = useSite();
  const { pathname } = useLocation();
  // The drawer belongs to the path it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState(null);
  const open = openOn === pathname;
  const setOpen = (v) => setOpenOn(v ? pathname : null);
  const onHome = pathname === "/";
  const dir = onHome ? (SECTION_META[active]?.dir ?? "") : pathname.replace(/^\//, "");

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handOn = hand === "on" || hand === "loading";
  const href = (id) => (onHome ? `#${id}` : `/#${id}`);

  return (
    <header className="hud">
      <div className="hud-bar">
        <Link to="/" className="hud-logo" aria-label="Dhanush Karthik — home">DK</Link>
        <div className="hud-path" aria-live="polite">
          <span className="user">dhanush@dk</span><span>:</span><span className="dir">~/{dir}</span><span>$</span><span className="hud-cursor" aria-hidden="true" />
        </div>
        <nav className="hud-nav" aria-label="Sections">
          {sections.filter((s) => s.id !== "hero").map((s) => (
            <a key={s.id} href={href(s.id)} aria-current={onHome && active === s.id}>{SECTION_META[s.id]?.nav ?? s.label}</a>
          ))}
        </nav>
        <div className="hud-actions">
          <button className="hud-btn" onClick={() => setPaletteOpen(true)} aria-label="Open command line" title="Command line ( / )">
            <Command size={14} /><span className="lbl">cmd</span><kbd className="lbl">/</kbd>
          </button>
          <button className="hud-btn" aria-pressed={handOn} onClick={() => setHand(handOn ? "off" : "intro")} title="Control the site with hand gestures">
            <Hand size={14} /><span className="lbl">{hand === "loading" ? "loading" : "hand"}</span>
          </button>
          <button className="hud-btn" onClick={() => setMode(mode === "stack" ? "print" : "stack")} title={mode === "stack" ? "Switch to the flat 2D layout" : "Switch to the 3D layout"}>
            {mode === "stack" ? <Layers size={14} /> : <FileText size={14} />}<span className="lbl">{mode === "stack" ? "3d" : "2d"}</span>
          </button>
          <button className="hud-btn hud-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="hud-drawer" aria-label="Sections">
          {sections.map((s) => (
            <a key={s.id} href={href(s.id)} onClick={() => setOpen(false)}>{SECTION_META[s.id]?.nav ?? s.label}<span>{SECTION_META[s.id]?.cmd}</span></a>
          ))}
        </nav>
      )}
    </header>
  );
}
