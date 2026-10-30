import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Hand, X } from "lucide-react";
import { useSite } from "../SiteContext";
import { setHandPointer, releaseHandPointer } from "../lib/pointer";
import { OneEuro, PinchState, SwipeDetector, describeHand } from "./gestures";

// Hand mode: off until the visitor asks for it. MediaPipe Hand Landmarker runs in
// the browser; no frames leave the device. Gestures are turned into ordinary
// pointer, click and scroll events on the same elements a mouse would use.

const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

let landmarkerPromise = null;
async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const make = (delegate) => HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/mediapipe/hand_landmarker.task", delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
      try { return await make("GPU"); } catch { return await make("CPU"); }
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; });
  }
  return landmarkerPromise;
}

function fire(target, type, x, y, extra = {}) {
  if (!target) return;
  const Ctor = type.startsWith("pointer") ? PointerEvent : MouseEvent;
  target.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 77, pointerType: "mouse", isPrimary: true, button: 0, buttons: type === "pointerup" || type === "click" ? 0 : 1, view: window, ...extra }));
}

export default function HandMode() {
  const { hand, setHand, scrollBy, go, setPaletteOpen } = useSite();
  const { pathname } = useLocation();
  const [error, setError] = useState("");
  const [steps, setSteps] = useState({ point: false, pinch: false, palm: false });
  const video = useRef(null);
  const overlay = useRef(null);
  const cursor = useRef(null);
  const readout = useRef(null);
  const ctx = useRef({ pathname });
  // Latest values for the tracking loop, which lives outside React renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { ctx.current = { pathname, scrollBy, go, setPaletteOpen, setHand, setSteps }; });

  // Release everything when hand mode turns off.
  useEffect(() => {
    if (hand !== "off" && hand !== "intro") return;
    releaseHandPointer();
  }, [hand]);

  useEffect(() => {
    if (hand !== "loading" && hand !== "on") return;
    let stream, raf = 0, stopped = false;
    const videoEl = video.current;
    const fx = new OneEuro(), fy = new OneEuro();
    const pinch = new PinchState();
    const swipe = new SwipeDetector();
    let down = null, fistAt = 0, lastSpread = null, lastT = 0, hoverEl = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false });
        const v = videoEl;
        v.srcObject = stream;
        await v.play();
        const lm = await getLandmarker();
        if (stopped) return;
        setHand("on");
        loop(lm);
      } catch (err) {
        if (stopped) return;
        const denied = err?.name === "NotAllowedError" || err?.name === "SecurityError";
        setError(denied ? "Camera permission was blocked. Allow the camera for this site in your browser settings, then try again." : `Hand tracking could not start (${err?.message || err}).`);
        setHand("error");
      }
    }

    function loop(lm) {
      raf = requestAnimationFrame(() => loop(lm));
      const now = performance.now();
      const v = videoEl;
      if (!v || v.readyState < 2 || now - lastT < 33) return;
      lastT = now;
      const res = lm.detectForVideo(v, now);
      draw(res.landmarks);
      handle(res.landmarks, now);
    }

    function draw(hands) {
      const c = overlay.current;
      if (!c) return;
      const g = c.getContext("2d");
      c.width = c.clientWidth; c.height = c.clientHeight;
      g.clearRect(0, 0, c.width, c.height);
      g.strokeStyle = "#4ADE80"; g.fillStyle = "#4ADE80"; g.lineWidth = 2;
      hands.forEach((lm) => {
        CONNECTIONS.forEach(([a, b]) => { g.beginPath(); g.moveTo(lm[a].x * c.width, lm[a].y * c.height); g.lineTo(lm[b].x * c.width, lm[b].y * c.height); g.stroke(); });
        lm.forEach((p, i) => { g.beginPath(); g.arc(p.x * c.width, p.y * c.height, i % 4 === 0 ? 3.5 : 2, 0, 7); g.fill(); });
      });
    }

    function handle(hands, now) {
      const cur = cursor.current;
      const { scrollBy: sb, setSteps: ss } = ctx.current;
      if (!hands.length) {
        if (cur) cur.style.opacity = "0";
        if (down) { fire(down.target, "pointerup", down.x, down.y); fire(window, "pointerup", down.x, down.y); down = null; pinch.active = false; }
        releaseHandPointer();
        lastSpread = null;
        fistAt = 0;
        setReadout("no hand in view");
        return;
      }
      const d = describeHand(hands[0]);
      const W = window.innerWidth, H = window.innerHeight;
      // Use the middle of the camera frame as the full screen, so corners are reachable.
      const nx = Math.min(1, Math.max(0, (1 - d.tip.x - 0.15) / 0.7));
      const ny = Math.min(1, Math.max(0, (d.tip.y - 0.12) / 0.62));
      const x = fx.filter(nx * W, now), y = fy.filter(ny * H, now);
      setHandPointer(nx * 2 - 1, -(ny * 2 - 1));
      if (cur) { cur.style.opacity = "1"; cur.style.transform = `translate(${x}px, ${y}px)`; cur.className = `hand-cursor ${pinch.active ? "pinch" : d.pose}`; }

      // Hover feedback for 3D scenes.
      const el = document.elementFromPoint(x, y);
      fire(el, "pointermove", x, y, { buttons: pinch.active ? 1 : 0 });
      if (pinch.active) fire(window, "pointermove", x, y);
      if (el !== hoverEl) { hoverEl?.classList?.remove("hand-hover"); hoverEl = el; }

      const p = pinch.update(d.pinchRatio);
      if (p === "start") {
        ss((s) => (s.pinch ? s : { ...s, pinch: true }));
        down = { target: el, x, y, sx: x, sy: y, moved: 0 };
        fire(el, "pointerdown", x, y);
      } else if (p === "end" && down) {
        fire(down.target, "pointerup", x, y);
        fire(window, "pointerup", x, y);
        if (down.moved < 28) {
          const t = down.target;
          if (t?.tagName === "CANVAS") fire(t, "click", x, y);
          else if (t) { const focusable = t.closest("input, textarea, select"); if (focusable) focusable.focus(); else (t.closest("a, button, [role=button], label") || t).click?.(); }
        }
        down = null;
      } else if (pinch.active && down) {
        down.moved = Math.max(down.moved, Math.hypot(x - down.sx, y - down.sy));
        // Pinch-drag outside a canvas scrolls the page, like dragging paper.
        if (down.target?.tagName !== "CANVAS") sb(-(y - down.y) * 1.6);
        down.x = x; down.y = y;
      }

      // Open palm: joystick scroll (top/bottom of frame) + horizontal swipes.
      if (d.pose === "palm" && !pinch.active) {
        ss((s) => (s.palm ? s : { ...s, palm: true }));
        const py = d.palm.y;
        if (py < 0.32) sb(-(0.32 - py) * 90);
        else if (py > 0.68) sb((py - 0.68) * 90);
      }
      if (d.pose === "point") ss((s) => (s.point ? s : { ...s, point: true }));
      const sw = swipe.update(1 - d.palm.x, now, d.pose === "palm" && !pinch.active);
      if (sw) window.dispatchEvent(new CustomEvent("dk:swipe", { detail: { dir: sw } }));

      // Fist hold: 1.2s = back / close, 2.6s = turn hand mode off.
      if (d.pose === "fist") {
        if (!fistAt) fistAt = now;
        const held = now - fistAt;
        if (cur) { cur.style.setProperty("--hold", Math.min(1, held / 2600)); cur.style.setProperty("--hold-on", 1); }
        if (held > 1200 && !cur?.dataset.backDone) {
          if (cur) cur.dataset.backDone = "1";
          ctx.current.setPaletteOpen(false);
          if (ctx.current.pathname !== "/") ctx.current.go("/#projects", "var(--ink)");
        }
        if (held > 2600) { ctx.current.setHand("off"); return; }
      } else {
        fistAt = 0;
        if (cur) { cur.style.setProperty("--hold-on", 0); delete cur.dataset.backDone; }
      }

      // Two hands: spread apart / bring together.
      if (hands.length > 1) {
        const b = describeHand(hands[1]);
        const sp = Math.hypot(d.palm.x - b.palm.x, d.palm.y - b.palm.y);
        if (lastSpread != null && Math.abs(sp - lastSpread) > 0.004) window.dispatchEvent(new CustomEvent("dk:spread", { detail: { delta: sp - lastSpread } }));
        lastSpread = sp;
      } else lastSpread = null;

      setReadout(`gesture: ${pinch.active ? "PINCH" : d.pose.toUpperCase()} · ${hands.length} hand${hands.length > 1 ? "s" : ""}`);
    }

    function setReadout(t) { if (readout.current) readout.current.textContent = `> ${t}`; }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoEl) videoEl.srcObject = null;
      releaseHandPointer();
    };
  }, [hand === "loading" || hand === "on"]); // eslint-disable-line react-hooks/exhaustive-deps


  if (hand === "off") return null;

  const onEsc = (e) => { if (e.key === "Escape") setHand("off"); };

  if (hand === "intro" || hand === "error") {
    return (
      <div className="hand-intro" role="dialog" aria-modal="true" aria-labelledby="hand-title" onKeyDown={onEsc} onMouseDown={(e) => e.target === e.currentTarget && setHand("off")}>
        <div className="hand-card">
          <span className="tape" aria-hidden="true" />
          <h2 id="hand-title">Hand mode</h2>
          <p>Browse with your hand in front of the camera. Tracking runs entirely in this browser tab: no video is recorded or sent anywhere. The model is about 8 MB and loads only now.</p>
          <ul>
            <li><b>point</b> move the cursor</li>
            <li><b>pinch</b> click / grab</li>
            <li><b>pinch + drag</b> scroll, spin cards</li>
            <li><b>open palm</b> high = up, low = down</li>
            <li><b>palm swipe</b> next / previous</li>
            <li><b>fist (hold)</b> back · longer = exit</li>
          </ul>
          <div className="actions">
            <button className="btn solid" autoFocus onClick={() => { setError(""); setHand("loading"); }}><Hand size={15} />{hand === "error" ? "Try again" : "Turn on camera"}</button>
            <button className="btn" onClick={() => setHand("off")}>Not now</button>
          </div>
          {error && <p className="err" role="alert">{error}</p>}
        </div>
      </div>
    );
  }

  const allDone = steps.point && steps.pinch && steps.palm;
  return (
    <>
      <div className="hand-cursor" ref={cursor} style={{ opacity: 0 }} aria-hidden="true"><span className="ring" /></div>
      <aside className="hand-panel" aria-label="Hand mode camera">
        <header><span>cam0 · hand mode {hand === "loading" ? "· loading model…" : "● live"}</span><button onClick={() => setHand("off")} aria-label="Turn off hand mode"><X size={12} /></button></header>
        <div className="hand-cam">
          <video ref={video} playsInline muted />
          <canvas ref={overlay} />
        </div>
        <footer>
          <span className="readout" ref={readout}>&gt; starting camera…</span>
          {!allDone && (
            <div className="hand-steps" aria-label="Tutorial">
              <span className={steps.point ? "done" : ""}>☝ point</span>
              <span className={steps.pinch ? "done" : ""}>🤏 pinch</span>
              <span className={steps.palm ? "done" : ""}>✋ palm</span>
            </div>
          )}
        </footer>
      </aside>
    </>
  );
}
