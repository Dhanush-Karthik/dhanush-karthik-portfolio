import { useEffect, useRef, useState } from "react";
import { useSite } from "../SiteContext";
import { intro, setIntro, subscribeIntro } from "../lib/intro";
import * as audio from "../lib/audio";

const LINES = [
  ["$ java -version", "ok"],
  ["openjdk 21.0.2 2024-01-16", "dim"],
  ["$ mvn spring-boot:run", "ok"],
  ["  :: Spring Boot ::  (v3.3.4)", "dim"],
  ["Mapping frames: hero about skills experience deploy etc/hosts …", "dim"],
  ["Tomcat started on port 8080", "dim"],
  ["Application ready ✓", "ok"],
  ["$ render hero", "ok"],
];

// Shown once per browser session. Any key, click or tap skips it.
// The hero canvas paints the same dark ground as this screen, so when the log
// finishes the overlay just lets go: the text lifts away over the live canvas and
// paper floods in from the centre. There is no cut, no blank frame in between.
export default function BootLoader() {
  const { mounted, three } = useSite();
  const [show, setShow] = useState(false);
  const [n, setN] = useState(0);
  const [out, setOut] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    const home = window.location.pathname === "/";
    // Not the 3D home page: nothing to hand off to.
    if (!three || !home || intro.played) {
      if (!home) intro.played = true;
      html.classList.remove("boot-pending");
      return;
    }
    let seen = false;
    try { seen = sessionStorage.getItem("dk_booted") === "1"; } catch { /* storage blocked */ }
    if (seen) return; // the dark cover stays until the stage is ready, then paper floods in
    // sessionStorage is browser-only, so the decision has to wait until after hydration.
    setShow(true);
    setIntro({ bootActive: true });
    html.classList.remove("boot-pending");
  }, [mounted, three]);

  useEffect(() => {
    if (!show) return;
    const finish = () => {
      if (done.current) return;
      done.current = true;
      try { sessionStorage.setItem("dk_booted", "1"); } catch { /* storage blocked */ }
      audio.enter();
      setIntro({ bootActive: false });
    };
    const t = setInterval(() => setN((v) => {
      if (v >= LINES.length) { clearInterval(t); setTimeout(finish, 320); return v; }
      audio.tick();
      return v + 1;
    }), 115);
    window.addEventListener("keydown", finish);
    window.addEventListener("pointerdown", finish);
    return () => { clearInterval(t); window.removeEventListener("keydown", finish); window.removeEventListener("pointerdown", finish); };
  }, [show]);

  // Let go once the boot log is done AND the stage has drawn its first frame. If the
  // stage never comes up, drop the overlay anyway after a few seconds.
  useEffect(() => {
    if (!show) return;
    let hold = 0;
    const check = () => {
      if (!intro.bootActive && intro.stageReady) { setOut(true); return true; }
      return false;
    };
    const off = subscribeIntro(check);
    check();
    const guard = setInterval(() => {
      if (!intro.bootActive && ++hold > 45) { setOut(true); setIntro({ stageReady: true }); }
    }, 100);
    return () => { off(); clearInterval(guard); };
  }, [show]);

  useEffect(() => {
    if (!out) return;
    const id = setTimeout(() => setShow(false), 1100);
    return () => clearTimeout(id);
  }, [out]);

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
