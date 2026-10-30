import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Hand, X } from "lucide-react";
import { useSite } from "../SiteContext";
import { setHandPointer, releaseHandPointer, gesture } from "../lib/pointer";
import { HandTrack, TwoHand, describeHand } from "./gestures";
import { Synth } from "./synth";
import { Magnet } from "./target";

// Hand mode: off until the visitor asks for it. MediaPipe Hand Landmarker runs in the browser; no
// frames leave the device. Gestures are turned into ordinary pointer, click and scroll events on
// the same elements a mouse would use, plus a few two-hand gestures the 3D scenes read directly
// (the page tear in the hero, zoom and twist, the contact fingers).

const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

// One line per section: the gesture that does something special there.
const COACH = {
  hero: "🙌 pinch with both hands, pull apart to tear · 🤏 throw the objects",
  about: "✊ close, then open your fist to burst the particles",
  skills: "🙌 spread both hands to pull the trays out · twist to turn",
  experience: "✌ two fingers up / down to walk the commits",
  education: "✌ two fingers up / down to scroll",
  projects: "🤏 pinch a card · ✋ swipe left / right to flip",
  network: "🙌 spread to zoom · twist to orbit · pinch a node",
  resume: "🤏 pinch the button, then sit back",
  testimonials: "✌ two fingers up / down to scroll",
  contact: "🙌 bring your hands together · 🤏 draw to sign",
  page: "☝ point · 🤏 pinch to click · ✌ scroll",
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

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
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
      try { return await make("GPU"); } catch { return await make("CPU"); }
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; });
  }
  return landmarkerPromise;
}

// Where the pinned hero sits on the page, and how far through its scroll we are.
function heroGeometry() {
  const hero = document.getElementById("hero");
  const pin = hero?.querySelector(".hero-pin");
  if (!hero || !pin || !hero.classList.contains("stage-on")) return null;
  const r = pin.getBoundingClientRect();
  const D = Math.max(1, pin.offsetHeight - window.innerHeight);
  return { top: r.top + window.scrollY, D, p: clamp01(-r.top / D) };
}

export default function HandMode() {
  const { hand, setHand, scrollBy, scrollToY, go, setPaletteOpen, active } = useSite();
  const { pathname } = useLocation();
  const [error, setError] = useState("");
  const [steps, setSteps] = useState({ point: false, pinch: false, palm: false });
  const video = useRef(null);
  const overlay = useRef(null);
  const cursor = useRef(null);
  const readout = useRef(null);
  const panel = useRef(null);
  const ctx = useRef({ pathname });
  // Latest values for the tracking loop, which lives outside React renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { ctx.current = { pathname, scrollBy, scrollToY, go, setPaletteOpen, setHand, setSteps, active }; });

  // Release everything when hand mode turns off.
  useEffect(() => {
    if (hand !== "off" && hand !== "intro") return;
    releaseHandPointer();
  }, [hand]);

  useEffect(() => {
    if (hand !== "loading" && hand !== "on") return;
    let stream, raf = 0, stopped = false;
    const videoEl = video.current;
    const tracks = [new HandTrack(), new HandTrack()];   // by MediaPipe's left / right label
    const two = new TwoHand();
    const synth = new Synth();
    const magnet = new Magnet();
    let primary = -1;                                    // which track drives the cursor
    let down = null;                                     // the pinch in progress { target, x, y, mx, my, moved, scroll }
    let lastT = 0, lastDt = 0.033, hoverEl = null, lastSpread = null;
    let tear = null;                                     // two-hand page tear { g0, d0, g, top, D }
    let lastCursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

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
      if (!v || v.readyState < 2 || now - lastT < 30) return;
      lastDt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      const res = lm.detectForVideo(v, now);
      const labels = (res.handedness || res.handednesses || []).map((h) => h?.[0]?.categoryName);
      draw(res.landmarks);
      handle(res.landmarks, labels, now);
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
      if (hands.length > 1) {
        const [a, b] = hands;
        g.strokeStyle = "#F2C94C"; g.setLineDash([5, 4]);
        g.beginPath(); g.moveTo(a[9].x * c.width, a[9].y * c.height); g.lineTo(b[9].x * c.width, b[9].y * c.height); g.stroke(); g.setLineDash([]);
      }
    }

    // Camera frame → screen. The middle of the frame is the whole screen, so the corners are reachable
    // without stretching, and a pointing hand is not at the very edge of what the camera sees.
    const toX = (nx, W) => clamp01((1 - nx - 0.1) / 0.8) * W;
    const toY = (ny, H) => clamp01((ny - 0.08) / 0.7) * H;

    function finishTear(releaseNow) {
      if (!tear) return;
      const { g, top, D } = tear;
      tear = null;
      const to = g > 0.33 && releaseNow !== "cancel" ? top + 0.84 * D : top;
      ctx.current.scrollToY(to, { duration: g > 0.33 ? 0.9 : 0.7 });
    }

    function endPinch(x, y, click) {
      if (!down) return;
      synth.up(down.target, x, y);
      if (click && down.moved < 22 && !down.scrolled) synth.click(down.target, down.x, down.y);
      down = null;
    }

    function handle(hands, labels, now) {
      const cur = cursor.current;
      const { scrollBy: sb, setSteps: ss } = ctx.current;
      const W = window.innerWidth, H = window.innerHeight;

      // ---- who is in view ----
      const seen = new Set();
      const items = hands.map((lm, i) => {
        let slot = labels[i] === "Left" ? 0 : labels[i] === "Right" ? 1 : i;
        if (seen.has(slot)) slot = slot === 0 ? 1 : 0;   // both hands claimed the same label: split them by order
        seen.add(slot);
        const T = tracks[slot];
        T.alive = true;
        const d = describeHand(lm);
        return { slot, T, d, lm };
      });
      tracks.forEach((T, s) => { if (!seen.has(s) && T.alive) { T.lose(); if (primary === s) primary = -1; } });

      if (!items.length) {
        if (cur) cur.style.opacity = "0";
        if (down) endPinch(lastCursor.x, lastCursor.y, false);
        if (tear) finishTear();
        two.end();
        synth.leave(lastCursor.x, lastCursor.y);
        hoverEl?.classList?.remove("hand-hover"); hoverEl = null;
        magnet.clear();
        releaseHandPointer();
        gesture.zoom *= 0.9; gesture.twist *= 0.95;
        lastSpread = null;
        setReadout("no hand in view");
        return;
      }

      // pose and pinch for every hand, then the primary (the one that moves the cursor)
      items.forEach((it) => {
        it.pose = it.T.pose.update(it.d.pose);
        it.edge = it.T.pinch.update(it.d.pinchRatio);
        it.pinching = it.T.pinch.active;
      });
      if (!items.some((it) => it.slot === primary)) primary = items[0].slot;
      const P = items.find((it) => it.slot === primary);
      const T = P.T, d = P.d;

      // ---- two hands ----
      const both = items.length === 2;
      const grab2 = both && items[0].pinching && items[1].pinching;
      let tw = null;
      if (both) {
        const pt = (it) => { const p = grab2 ? it.d.mid : it.d.palm; return { x: 1 - p.x, y: p.y }; };
        tw = two.update(pt(items[0]), pt(items[1]), grab2 ? "grab" : "open");
        gesture.two = true;
        if (!tw.first) {
          gesture.zoom = Math.max(-1, Math.min(1, gesture.zoom + tw.dDist * 3.4));
          gesture.twist = Math.max(-2, Math.min(2, gesture.twist + tw.dAng));
          // the rack in Skills listens for the old event
          if (Math.abs(tw.dDist) > 0.004) window.dispatchEvent(new CustomEvent("dk:spread", { detail: { delta: tw.dDist } }));
        }
      } else {
        two.end();
        gesture.two = false;
        gesture.zoom *= Math.pow(0.18, lastDt);       // stretch eases back
        gesture.twist *= Math.pow(0.45, lastDt);
        if (Math.abs(gesture.zoom) < 0.002) gesture.zoom = 0;
      }

      const where = ctx.current.pathname === "/" ? ctx.current.active : "page";

      // Both hands grabbing the paper in the hero: pulling apart rips it, bringing them back mends it.
      if (grab2 && tw) {
        if (down) endPinch(lastCursor.x, lastCursor.y, false);   // the first hand's pinch was the start of this, not a click
        if (!tear && tw.first) {
          const geo = heroGeometry();
          if (geo && geo.p < 0.97) tear = { ...geo, g: clamp01((geo.p - 0.1) / 0.68), g0: clamp01((geo.p - 0.1) / 0.68), d0: tw.dist };
        }
        if (tear) {
          tear.g = clamp01(tear.g0 + (tw.dist - tear.d0) / 0.3);
          const g = tear.g;
          const p = 0.1 * Math.min(1, g * 6) + 0.68 * g;
          ctx.current.scrollToY(tear.top + p * tear.D, { lerp: 0.3 });
        }
      } else if (tear) finishTear();

      // Bringing the hands together in Contact scrubs the page toward the touch (and apart, back).
      if (both && where === "contact" && tw && !tw.first) sb(-tw.dDist * H * 4.5);

      // ---- cursor ----
      const tipX = T.fx.filter(toX(d.tip.x, W), now), tipY = T.fy.filter(toY(d.tip.y, H), now);
      const midX = T.mx.filter(toX(d.mid.x, W), now), midY = T.my.filter(toY(d.mid.y, H), now);
      T.trail.push(tipX, tipY, T.pinch.ratio ?? 1, now);

      let x = tipX, y = tipY, target = null;
      const single = !grab2;                 // two grabbing hands are a tear, not a click
      const speed = Math.hypot(T.fx.speed, T.fy.speed);

      if (T.pinch.active && down) {
        // Dragging: the cursor keeps the spot where the pinch began and follows how far the pinch point moves.
        x = down.x + (midX - down.mx); y = down.y + (midY - down.my);
        target = down.target;
      } else {
        if (P.pose !== "peace") magnet.refresh(now);
        if (P.pose === "peace") magnet.cur = null;
        const snap = P.pose === "peace" ? null : magnet.pick(tipX, tipY, speed < 900);
        if (snap) { x = snap.x; y = snap.y; target = snap.el; }
        else { target = document.elementFromPoint(x, y); }
      }
      lastCursor = { x, y };
      setHandPointer(clamp01(x / W) * 2 - 1, -(clamp01(y / H) * 2 - 1));

      if (single && P.edge === "start") {
        ss((s) => (s.pinch ? s : { ...s, pinch: true }));
        // Where the visitor aimed is the spot from just before the fingers closed, not where the fingertip is now.
        const aim = T.trail.aim(0.8) || { x, y };
        const snap = magnet.pick(aim.x, aim.y, true);
        const ax = snap ? snap.x : aim.x, ay = snap ? snap.y : aim.y;
        const hit = snap ? snap.el : document.elementFromPoint(ax, ay);
        down = { target: hit, x: ax, y: ay, mx: midX, my: midY, moved: 0, lastY: ay, scrolled: false, noScroll: !!hit?.closest?.("input, textarea, select, .mc-pad, .hero-canvas, [data-hand-drag]") };
        x = ax; y = ay; target = hit;
        synth.move(hit, ax, ay, 0);
        synth.down(hit, ax, ay);
      } else if (P.edge === "end" && down) {
        endPinch(x, y, true);
      } else if (T.pinch.active && down && single) {
        down.moved = Math.max(down.moved, Math.hypot(x - down.x, y - down.y));
        // Pinch-drag on plain page content drags the page, like paper; on a canvas it belongs to the scene.
        if (!down.noScroll && down.moved > 10) { sb(-(y - down.lastY) * 1.6); down.scrolled = true; }
        down.lastY = y;
      }

      // hover: the real target while free, the grabbed one while pinching (like pointer capture)
      if (target) {
        synth.move(target, x, y, down ? 1 : 0);
      }
      const hoverable = !down && magnet.cur ? magnet.cur.el : null;
      if (hoverable !== hoverEl) { hoverEl?.classList?.remove("hand-hover"); hoverEl = hoverable; hoverEl?.classList?.add("hand-hover"); }

      // The camera preview sits over the page: step aside when the cursor goes under it.
      const pn = panel.current;
      if (pn) {
        const r = pn.getBoundingClientRect();
        pn.classList.toggle("faded", x > r.left - 24 && x < r.right + 24 && y > r.top - 24 && y < r.bottom + 24);
      }

      if (cur) {
        cur.style.opacity = "1";
        cur.style.transform = `translate(${x}px, ${y}px)`;
        const state = grab2 ? "two pinch" : both ? "two" : T.pinch.active ? "pinch" : P.pose;
        cur.className = `hand-cursor ${state}${hoverEl ? " lock" : ""}`;
      }

      // ---- open palm: joystick scroll at the top / bottom of the frame, swipes sideways ----
      if (P.pose === "palm" && !T.pinch.active && !both) {
        ss((s) => (s.palm ? s : { ...s, palm: true }));
        const py = d.palm.y;
        if (py < 0.3) sb(-(0.3 - py) * 90);
        else if (py > 0.7) sb((py - 0.7) * 90);
      }
      if (P.pose === "point") ss((s) => (s.point ? s : { ...s, point: true }));
      const sw = T.swipe.update(1 - d.palm.x, now, P.pose === "palm" && !T.pinch.active && !both);
      if (sw) window.dispatchEvent(new CustomEvent("dk:swipe", { detail: { dir: sw } }));

      // ---- two fingers: scroll like a trackpad (hand moves up → page moves up) ----
      if (P.pose === "peace" && !T.pinch.active && !both) {
        if (T.peaceY != null) sb(-(tipY - T.peaceY) * 2.6);
        T.peaceY = tipY;
      } else T.peaceY = null;

      // ---- fist: quick close-and-open bursts; hold = back, longer = exit ----
      if (P.pose === "fist") {
        if (!T.fistAt) T.fistAt = now;
        const held = now - T.fistAt;
        if (cur) { cur.style.setProperty("--hold", Math.min(1, held / 2600)); cur.style.setProperty("--hold-on", held > 500 ? 1 : 0); }
        if (held > 1200 && !cur?.dataset.backDone) {
          if (cur) cur.dataset.backDone = "1";
          ctx.current.setPaletteOpen(false);
          if (ctx.current.pathname !== "/") ctx.current.go("/#projects", "var(--ink)");
        }
        if (held > 2600) { ctx.current.setHand("off"); return; }
      } else {
        if (T.fistAt) {
          const held = now - T.fistAt;
          if (held > 140 && held < 900 && !cur?.dataset.backDone && !both) {
            window.dispatchEvent(new CustomEvent("dk:burst", { detail: { x, y } }));
          }
        }
        T.fistAt = 0;
        if (cur) { cur.style.setProperty("--hold-on", 0); delete cur.dataset.backDone; }
      }

      setReadout(`${grab2 ? "TWO-HAND GRAB" : both ? "TWO HANDS" : T.pinch.active ? "PINCH" : P.pose.toUpperCase()} · ${hands.length} hand${hands.length > 1 ? "s" : ""}${magnet.cur ? " · locked" : ""}`);
    }

    function setReadout(t) { if (readout.current) readout.current.textContent = `> ${t}`; }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (down) endPinch(lastCursor.x, lastCursor.y, false);
      if (tear) finishTear("cancel");
      synth.leave(lastCursor.x, lastCursor.y);
      hoverEl?.classList?.remove("hand-hover");
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
          <p>Browse with your hands in front of the camera. Tracking runs entirely in this browser tab: no video is recorded or sent anywhere. The model is about 8 MB and loads only now.</p>
          <ul>
            <li><b>point</b> move the cursor (it sticks to buttons)</li>
            <li><b>pinch</b> click / grab / draw</li>
            <li><b>✌ two fingers</b> scroll up / down</li>
            <li><b>open palm</b> high = up, low = down</li>
            <li><b>palm swipe</b> next / previous</li>
            <li><b>fist, then open</b> burst</li>
            <li><b>both hands pinch + pull apart</b> tear the page, zoom</li>
            <li><b>both hands together / twist</b> bring close, orbit</li>
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
  const tip = COACH[pathname === "/" ? active : "page"] || COACH.page;
  return (
    <>
      <div className="hand-cursor" ref={cursor} style={{ opacity: 0 }} aria-hidden="true"><span className="ring" /></div>
      <aside className="hand-panel" ref={panel} aria-label="Hand mode camera">
        <header><span>cam0 · hand mode {hand === "loading" ? "· loading model…" : "● live"}</span><button onClick={() => setHand("off")} aria-label="Turn off hand mode"><X size={12} /></button></header>
        <div className="hand-cam">
          <video ref={video} playsInline muted />
          <canvas ref={overlay} />
        </div>
        <footer>
          <span className="readout" ref={readout}>&gt; starting camera…</span>
          <span className="hand-coach" aria-live="polite">{tip}</span>
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
