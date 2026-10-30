import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Download, RotateCcw, SkipForward, X } from "lucide-react";
import Sheet from "../components/Sheet";
import { useInView } from "../lib/useInView";
import { useSite } from "../SiteContext";
import { onTick } from "../lib/ticker";
import { intro, subscribeIntro } from "../lib/intro";
import { clamp } from "../three/hero/state";
import { jny, setArrive, setActive, setGeo, start, skip, rewind, reset } from "../three/resume/state";
import { zoneGuess, locate } from "../three/resume/geo";
import { T, getRoute } from "../three/resume/route";
import { traceFor, SECTION_META } from "./meta";

const ResumeStage = lazy(() => import("../three/resume/ResumeStage"));

// Flat layout: print mode, no WebGL, and the server render.
function Flat({ data, line, prev }) {
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

// ---- the journey, as a rail and a log ----
const STOPS = [
  { k: "SERVER", at: 0 },
  { k: "ISP", at: T.AB[1] },
  { k: "DATA CENTER", at: T.BC[1] },
  { k: "SUBSEA", at: T.sea[0] + 0.9 },
  { k: "DATA CENTER", at: T.sea[1] },
  { k: "ISP", at: T.DE[1] },
  { k: "YOUR PC", at: T.EH[1] },
  { k: "PRINTER", at: T.toPr[1] },
];
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";

function hostOf(url) {
  try { return new URL(url).host; } catch { return "dhanushkarthik.com"; }
}

// Pinned stage on a terminal background. It arrives as a honeycomb that opens from the bottom while
// Projects is still pinned behind it. It waits as a plain button; the press fades in a globe and runs
// the whole route, time-driven, holding the scroll until it is done. Stops are named only on arrival.
function Stage({ data, line }) {
  const { lockScroll, scrollTo } = useSite();
  const { resume } = data;
  const file = resume?.file_name || "Resume.pdf";
  const host = hostOf(resume?.file_url);

  const sectionRef = useRef(null);
  const stickRef = useRef(null);
  const clipRef = useRef(null);
  const barRef = useRef(null);
  const dlRef = useRef(null);
  const geoRef = useRef(null);
  const blobRef = useRef(null);
  const loggedRef = useRef(0);
  const stopRef = useRef(-1);
  const aligning = useRef(false);
  const [dest, setDest] = useState(() => zoneGuess());
  const [phase, setPhase] = useState("idle");
  const [stop, setStop] = useState(-1);
  const [logs, setLogs] = useState([]);
  const [active, setActiveState] = useState(false);
  const [near, setNear] = useState(false);
  const [saved, setSaved] = useState("");
  const ready = useSyncExternalStore(subscribeIntro, () => intro.overlayIn || intro.played, () => false);

  const say = useCallback((l) => setLogs((a) => [...a.slice(-8), l]), []);
  useEffect(() => () => { reset(); lockScroll(false); }, [lockScroll]);

  const run = useCallback(() => {
    if (jny.run) return;
    start();
    lockScroll(true);
    loggedRef.current = 0; stopRef.current = -1;
    setPhase("run"); setStop(-1); setSaved("");
    setLogs([`$ curl -O https://${host}/${file}`, "  locating client ..."]);
    // start fetching the file now, so it is ready when the printer starts
    if (resume?.file_url && !blobRef.current) blobRef.current = fetch(resume.file_url).then((r) => (r.ok ? r.blob() : Promise.reject(new Error("bad status")))).catch(() => null);
    // the client's city stays secret until the packet gets there (see logFor)
    const known = geoRef.current;
    if (known) { setDest(known); setGeo(true); return; }
    locate().then((g) => { geoRef.current = g; setDest((p) => (p.lat === g.lat && p.lon === g.lon && p.city === g.city && p.isp === g.isp ? p : g)); setGeo(true); });
  }, [lockScroll, host, file, resume]);

  // The press works from anywhere the button is visible: if the stage is not sitting squarely in the
  // viewport yet (still dissolving in, or scrolled into the cover), glide it into place, then run.
  const begin = useCallback(() => {
    if (jny.run || aligning.current) return;
    const el = sectionRef.current;
    const top = el ? el.getBoundingClientRect().top : 0;
    const vh = window.innerHeight;
    if (top > 2 || top < -vh * 0.3) {
      aligning.current = true;
      let fired = false;
      const go = () => { if (fired) return; fired = true; aligning.current = false; run(); };
      scrollTo(window.scrollY + top, { duration: 0.7, onComplete: go });
      setTimeout(go, 1100);
      return;
    }
    run();
  }, [run, scrollTo]);

  const cancel = useCallback(() => { rewind(); lockScroll(false); stopRef.current = -1; setPhase("idle"); setStop(-1); setLogs([]); }, [lockScroll]);

  const save = useCallback(async () => {
    const url = resume?.file_url;
    if (!url) { say("! no file is published yet"); return false; }
    const blob = await (blobRef.current || Promise.resolve(null));
    const a = document.createElement("a");
    a.download = file; a.rel = "noopener";
    let revoke = null;
    if (blob) { revoke = URL.createObjectURL(blob); a.href = revoke; }
    else { a.href = url; a.target = "_blank"; }
    document.body.appendChild(a); a.click(); a.remove();
    if (revoke) setTimeout(() => URL.revokeObjectURL(revoke), 5000);
    setSaved(file);
    return true;
  }, [resume, file, say]);

  const onEvent = useCallback((kind) => {
    if (kind === "file") save();
  }, [save]);
  const onDone = useCallback(() => { setPhase("done"); lockScroll(false); }, [lockScroll]);

  // log lines follow the packet: one traceroute row per stop
  const route = useMemo(() => (near ? getRoute(dest, host) : null), [near, dest, host]);
  const km = route ? Math.round(route.km) : 0;
  const origin = route?.origin;
  const logFor = useCallback((idx) => {
    const ms = (v) => `${v.toFixed(1)} ms`;
    const row = (i, name, v) => `${String(i).padStart(2)}  ${name.padEnd(26)}${ms(v)}`;
    const sea = 1.9 + km * 0.0095;
    const entries = [
      `  origin: ${origin?.region} (${origin?.city})`,
      row(1, `isp-edge.${slug(origin?.city)}`, 0.4),
      row(2, `ix-gw.${origin?.region}`, 1.9),
      row(3, `${route?.cable === "SUBMARINE CABLE" ? "subsea" : "long-haul"} ${km.toLocaleString("en-US")} km`, sea),
      [`  client: ${dest.city}${dest.country ? `, ${dest.country}` : ""}${dest.approx ? " (approx.)" : ""}`, row(4, `dc-edge.${slug(dest.city)}`, sea + 1.1)],
      row(5, dest.isp ? slug(dest.isp) : "your-isp", sea + 3.4),
      row(6, `you@${slug(dest.city)}`, sea + 4.3),
      `> lp -d dk-lpt0 ${file}`,
    ];
    const lines = [];
    for (let i = loggedRef.current; i <= idx; i++) if (entries[i]) lines.push(...[].concat(entries[i]));
    loggedRef.current = Math.max(loggedRef.current, idx + 1);
    if (lines.length) setLogs((a) => [...a.slice(-(9 - lines.length)), ...lines]);
  }, [km, dest, file, origin, route]);
  const logRef = useRef(logFor);
  useEffect(() => { logRef.current = logFor; }, [logFor]);

  // The loop: gate the canvas, run the honeycomb, mirror the clock into the rail and the log.
  useEffect(() => {
    let a = null, b = null, was = false;
    return onTick(() => {
      const el = sectionRef.current, stick = stickRef.current, clip = clipRef.current;
      if (!el || !stick || !clip) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const act = r.top < vh * 1.1 && r.bottom > -vh * 0.1;
      const nr = r.top < vh * 2.5;
      if (act !== a) { a = act; setActiveState(act); setActive(act); }
      if (nr !== b) { b = nr; setNear(nr); }

      const hook = el.previousElementSibling?.classList.contains("pj-stage") ?? false;
      const top = r.top;
      const arrive = hook ? clamp(1 - top / vh) : top <= vh * 0.2 ? 1 : 0;
      setArrive(arrive);
      stick.style.transform = hook && top > 0 ? `translate3d(0, ${(-top).toFixed(1)}px, 0)` : "";
      clip.style.visibility = arrive <= 0.001 ? "hidden" : "visible";
      clip.style.pointerEvents = arrive >= 0.75 ? "auto" : "none";
      stick.style.setProperty("--arrive", arrive.toFixed(3));

      // leaving the section mid-way (it holds scroll while running, so only after done) rewinds it
      const away = r.bottom < vh * 0.5 || r.top > vh * 0.6;
      if (away && was && !jny.run) { was = false; if (jny.done || jny.t >= 0) { rewind(); stopRef.current = -1; setPhase("idle"); setStop(-1); setLogs([]); } }
      if (!away) was = true;

      if (jny.run || jny.done) {
        const t = jny.t;
        let idx = -1;
        STOPS.forEach((s, i) => { if (t >= s.at) idx = i; });
        if (idx !== stopRef.current) { stopRef.current = idx; setStop(idx); logRef.current(idx); }
        if (barRef.current) barRef.current.style.transform = `scaleX(${clamp(t / T.end).toFixed(4)})`;
        if (dlRef.current) dlRef.current.textContent = `${String(Math.round(jny.dl * 100)).padStart(3)}%`;
      }
    });
  }, []);

  useEffect(() => {
    const key = (e) => {
      if (e.key === "Escape" && jny.run) cancel();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [cancel]);

  const running = phase === "run";
  const done = phase === "done";
  const idle = phase === "idle";

  return (
    <section ref={sectionRef} id="resume" className="frame rs-stage" aria-label="Resume">
      <div className="rs-pin" style={{ "--pin": "40svh" }}>
        <div className="rs-stick" ref={stickRef}>
          <div className="rs-clip" ref={clipRef}>
            <div className="rs-canvas" aria-hidden="true">
              {ready && near && (
                <Suspense fallback={null}>
                  <ResumeStage active={active} dest={dest} host={host} file={file} onEvent={onEvent} onDone={onDone} />
                </Suspense>
              )}
            </div>
            <div className="rs-ui">
              <div className="wrap">
                <div className="frame-head">
                  <span className="frame-trace">{traceFor("resume", line)}</span>
                  <span className="frame-cmd">{SECTION_META.resume.cmd}</span>
                </div>
              </div>

              <div className={`rs-intro${idle ? " on" : ""}`}>
                <p className="rs-eyebrow">SEND · {file}</p>
                <h2 className="rs-title">{resume?.heading || "Download my résumé"}</h2>
                <p className="rs-sub">{resume?.subtext || "One file, from my server to your printer."}</p>
                <button type="button" className="rs-go" onClick={begin} tabIndex={idle ? 0 : -1}>
                  <Download size={19} strokeWidth={2.4} /><span>Download résumé</span><i aria-hidden="true">&rarr;</i>
                </button>
                <p className="rs-hint">press it, then follow the file across the internet.</p>
              </div>

              <div className={`rs-ctl${running ? " on" : ""}`}>
                <button type="button" className="rs-chip" onClick={() => skip(T.print[0])}><SkipForward size={13} />skip to print</button>
                <button type="button" className="rs-chip" onClick={cancel}><X size={13} />esc</button>
              </div>

              <div className={`rs-bottom${running || done ? " on" : ""}`}>
                <pre className="rs-log" aria-hidden="true">{logs.join("\n")}</pre>
                <div className="rs-rail" aria-hidden="true">
                  {STOPS.map((s, i) => (
                    <span key={i} className={`rs-stop${stop >= i ? " hit" : ""}${stop === i ? " now" : ""}`}><i /><u>{s.k}</u></span>
                  ))}
                  <div className="rs-track"><b ref={barRef} /></div>
                </div>
                <div className="rs-dl" aria-hidden="true">download <span ref={dlRef}>  0%</span></div>
              </div>

              <div className={`rs-done${done ? " on" : ""}`}>
                <p className="rs-done-h">{saved ? `✔ saved ${saved}` : resume?.file_url ? "✔ on its way to your downloads" : "✔ route complete"}</p>
                <p className="rs-done-p">{resume?.file_url ? "If your browser asked, that was it. Otherwise grab it here." : "The résumé file is still being uploaded. Check back soon."}</p>
                <div className="rs-done-row">
                  {resume?.file_url && <a className="btn solid" href={resume.file_url} download={file} target="_blank" rel="noopener"><Download size={15} />{file}</a>}
                  <button type="button" className="btn" onClick={begin}><RotateCcw size={14} />run it again</button>
                </div>
              </div>
            </div>
          </div>
          {/* the canvas is decorative; this is the plain way to the file */}
          <div className="sr-only">
            {resume?.file_url && <a href={resume.file_url} download={file}>Direct link to {file}</a>}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Resume(props) {
  const { three } = useSite();
  return three ? <Stage {...props} /> : <Flat {...props} />;
}
