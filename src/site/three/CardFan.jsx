import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import * as THREE from "three";
import { makeCardTexture, CARD_W, CARD_H } from "./cardTexture";
import { pointer } from "../lib/pointer";

// Projects as a fan of cards on a 3D arc (after video 2). Drag, swipe, arrows or
// a palm swipe spin it; clicking the centred card flies it at the camera and opens it.

const R = 7.5;
const STEP = 0.27;
const CW = 1.75, CH = CW * (CARD_H / CARD_W);

function Card({ card, index, rot, focus, onPick, flying }) {
  const mesh = useRef();
  const [tex, setTex] = useState(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    let alive = true, t;
    makeCardTexture(card).then((x) => { t = x; if (alive) setTex(x); else x.dispose(); });
    return () => { alive = false; t?.dispose(); };
  }, [card]);

  useFrame(() => {
    const m = mesh.current;
    if (!m || flying.current === index) return;
    const a = (index - rot.current) * STEP;
    const isFocus = focus === index;
    const lift = (hover ? 0.22 : 0) + (isFocus ? 0.18 : 0);
    const tx = Math.sin(a) * R;
    const ty = Math.cos(a) * R - R + lift;
    const tz = -Math.abs(a) * 1.2 + (isFocus ? 0.35 : 0);
    m.position.x += (tx - m.position.x) * 0.16;
    m.position.y += (ty - m.position.y) * 0.16;
    m.position.z += (tz - m.position.z) * 0.16;
    m.rotation.z += (-a - m.rotation.z) * 0.16;
    m.rotation.y += (-a * 0.35 - m.rotation.y) * 0.16;
    m.rotation.x += (0 - m.rotation.x) * 0.16;
    const s = isFocus ? 1.08 : 1;
    m.scale.x += (s - m.scale.x) * 0.16;
    m.scale.y = m.scale.x;
    m.visible = Math.abs(a) < 1.9;
  });

  return (
    <mesh ref={mesh} name={`card-${index}`}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}
      onClick={(e) => { e.stopPropagation(); if (e.delta < 6) onPick(index, mesh.current); }}>
      <planeGeometry args={[CW, CH]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} side={THREE.DoubleSide} color={tex ? "#fff" : card.style.bg} />
    </mesh>
  );
}

function Fan({ cards, api, onFocus, onOpen, initial }) {
  const rot = useRef(initial);
  const target = useRef(initial);
  const flying = useRef(-1);
  const [focus, setFocus] = useState(initial);
  const { camera, gl, size } = useThree();
  const drag = useRef(null);

  const clampT = (v) => Math.max(0, Math.min(cards.length - 1, v));
  const setTarget = (v) => {
    target.current = clampT(v);
    const f = Math.round(target.current);
    setFocus((old) => { if (old !== f) onFocus?.(f); return f; });
  };

  useImperativeHandle(api, () => ({ step: (d) => setTarget(Math.round(target.current) + d) }));

  useEffect(() => {
    camera.position.set(0, size.width < 640 ? -0.2 : 0.35, size.width < 640 ? 9.6 : 7.6);
    camera.lookAt(0, -0.2, 0);
  }, [camera, size.width]);

  // Drag anywhere on the canvas to spin; release snaps to the nearest card.
  useEffect(() => {
    const el = gl.domElement;
    const down = (e) => { drag.current = { x: e.clientX, t: target.current, moved: 0 }; };
    const move = (e) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x;
      drag.current.moved = Math.max(drag.current.moved, Math.abs(dx));
      target.current = clampT(drag.current.t - dx / 140);
    };
    const up = () => { if (drag.current) { setTarget(Math.round(target.current)); drag.current = null; } };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  });

  // Keyboard arrows and hand-mode palm swipes, only while the fan is on screen.
  useEffect(() => {
    const visible = () => { const r = gl.domElement.getBoundingClientRect(); return r.top < innerHeight * 0.7 && r.bottom > innerHeight * 0.3; };
    const key = (e) => {
      if (/input|textarea/i.test(e.target.tagName) || !visible()) return;
      if (e.key === "ArrowRight") setTarget(Math.round(target.current) + 1);
      if (e.key === "ArrowLeft") setTarget(Math.round(target.current) - 1);
    };
    const swipe = (e) => { if (visible()) setTarget(Math.round(target.current) + (e.detail.dir === "left" ? 1 : -1)); };
    window.addEventListener("keydown", key);
    window.addEventListener("dk:swipe", swipe);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("dk:swipe", swipe); };
  });

  useFrame(() => {
    rot.current += (target.current - rot.current) * 0.1;
  });

  function pick(i, mesh) {
    if (drag.current?.moved > 6) return;
    if (i !== focus) { setTarget(i); return; }
    flying.current = i;
    const to = camera.position.clone().add(new THREE.Vector3(0, 0, -2.2));
    gsap.timeline({ onComplete: () => { onOpen(cards[i]); setTimeout(() => { flying.current = -1; }, 900); } })
      .to(mesh.rotation, { x: 0, y: 0, z: 0, duration: 0.35, ease: "power2.out" }, 0)
      .to(mesh.position, { x: to.x, y: to.y, z: to.z, duration: 0.5, ease: "power3.in" }, 0)
      .to(mesh.scale, { x: 1.4, y: 1.4, duration: 0.5, ease: "power3.in" }, 0);
  }

  const g = useRef();
  useFrame(() => {
    if (!g.current) return;
    g.current.rotation.y += (pointer.x * 0.08 - g.current.rotation.y) * 0.05;
    g.current.rotation.x += (-pointer.y * 0.04 - g.current.rotation.x) * 0.05;
  });

  return (
    <group ref={g} position={[0, 0.2, 0]}>
      {cards.map((c, i) => <Card key={c.key} card={c} index={i} rot={rot} focus={focus} onPick={pick} flying={flying} />)}
    </group>
  );
}

const CardFan = forwardRef(function CardFan({ cards, onFocus, onOpen, initial = 0 }, ref) {
  const deck = useMemo(() => cards, [cards]);
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0.35, 7.6], fov: 36 }} gl={{ alpha: true, antialias: true }}>
      <Fan cards={deck} api={ref} onFocus={onFocus} onOpen={onOpen} initial={initial} />
    </Canvas>
  );
});

export default CardFan;
