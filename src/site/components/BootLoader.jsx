import { useEffect, useRef, useState } from "react";

const LINES = [
  ["$ java -version", "ok"],
  ["openjdk 21.0.2 2024-01-16", "dim"],
  ["$ mvn spring-boot:run", "ok"],
  ["  :: Spring Boot ::  (v3.3.4)", "dim"],
  ["Mapping frames: hero about skills experience deploy etc/hosts …", "dim"],
  ["Tomcat started on port 8080", "dim"],
  ["Application ready ✓", "ok"],
  ["$ print hero.sheet", "ok"],
];

// Shown once per browser session. Any key, click or tap skips it.
export default function BootLoader() {
  const [show, setShow] = useState(false);
  const [n, setN] = useState(0);
  const [out, setOut] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const html = document.documentElement;
    let seen = false;
    try { seen = sessionStorage.getItem("dk_booted") === "1"; } catch { /* storage blocked */ }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) { html.classList.remove("boot-pending"); return; }
    // sessionStorage is browser-only, so the decision has to wait until after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true);
    html.classList.remove("boot-pending");
  }, []);

  useEffect(() => {
    if (!show) return;
    const finish = () => {
      if (done.current) return;
      done.current = true;
      try { sessionStorage.setItem("dk_booted", "1"); } catch { /* storage blocked */ }
      setOut(true);
      const html = document.documentElement;
      setTimeout(() => { setShow(false); html.classList.add("printing"); }, 480);
      setTimeout(() => html.classList.remove("printing"), 2400);
    };
    const t = setInterval(() => setN((v) => { if (v >= LINES.length) { clearInterval(t); setTimeout(finish, 260); return v; } return v + 1; }), 115);
    window.addEventListener("keydown", finish);
    window.addEventListener("pointerdown", finish);
    return () => { clearInterval(t); window.removeEventListener("keydown", finish); window.removeEventListener("pointerdown", finish); };
  }, [show]);

  if (!show) return null;
  return (
    <div className={`boot ${out ? "out" : ""}`} role="status" aria-label="Loading">
      <div className="boot-log">
        {LINES.slice(0, n).map(([t, c], i) => <div key={i} className={c}>{t}</div>)}
        <span className="hud-cursor" />
      </div>
      <div className="boot-skip">press any key to skip</div>
    </div>
  );
}
