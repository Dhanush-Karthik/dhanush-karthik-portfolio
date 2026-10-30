import { Component, Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { pointer } from "../../lib/pointer";
import { smooth, outBack, readPalette } from "../hero/state";
import { rack } from "./state";

// Skills as a server cabinet. One tray per CMS category, stacked in the order of the stack (the
// edge at the top). The tray you pick, by scrolling, clicking it or hovering its row, slides out
// of the rack and its skills pop up on the deck as modules. Scroll position arrives through
// `rack.sel` (written by the DOM section), so React never re-renders while it runs.

const DISPLAY = "/fonts/archivo-wide-black.ttf";
const MONO = "/fonts/jetbrains-mono-500.ttf";

const CAM = { y: 4.6, z: 9.2, fov: 35 };
const RW = 2.5, RD = 3.0;          // cabinet width, depth
const POST = 0.1;
const PITCH = 0.62;                // one tray slot
const PLINTH = 0.22, CAP = 0.16;   // base, and top plate with the fans
const TW = 2.12, TD = 2.7;         // tray deck width, depth
const EXT = 2.3;                   // how far a tray slides out
const PANEL_W = RW - POST * 2 - 0.02;
const PANEL_H = PITCH - 0.05;
const DECK_Y = -PITCH / 2 + 0.11;  // deck height inside its slot
const MOD_H = 0.2;
const TAU = Math.PI * 2;

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20);
const PLANE = new THREE.PlaneGeometry(1, 1);

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error("[skills stage]", err); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Box({ p = [0, 0, 0], s = [1, 1, 1], m, ...rest }) {
  return <mesh geometry={BOX} position={p} scale={s} material={m} {...rest} />;
}

function canvasTex(w, h, draw) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeTextures(pal) {
  // front-panel vent slits
  const vent = canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = "#070d09"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#1c2b21";
    for (let y = 10; y < h - 8; y += 19) g.fillRect(14, y, w - 28, 8);
  });
  // radar floor under the cabinet
  const floor = canvasTex(512, 512, (g, w, h) => {
    const c = w / 2;
    const grad = g.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, "rgba(74,222,128,.34)");
    grad.addColorStop(0.55, "rgba(74,222,128,.08)");
    grad.addColorStop(1, "rgba(74,222,128,0)");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = pal.phosphor;
    [0.3, 0.52, 0.74, 0.96].forEach((r, i) => {
      g.globalAlpha = 0.34 - i * 0.07;
      g.lineWidth = i === 1 ? 2 : 1;
      g.beginPath(); g.arc(c, c, r * c, 0, TAU); g.stroke();
    });
    g.globalAlpha = 0.22;
    for (let a = 0; a < 24; a++) {
      const th = (a / 24) * TAU;
      g.beginPath();
      g.moveTo(c + Math.cos(th) * c * 0.92, c + Math.sin(th) * c * 0.92);
      g.lineTo(c + Math.cos(th) * c * 0.99, c + Math.sin(th) * c * 0.99);
      g.stroke();
    }
  });
  return { vent, floor };
}

function makeMaterials(pal, T) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    steel: std({ color: "#1b261f", roughness: 0.42, metalness: 0.7 }),
    frame: std({ color: "#2a3a2f", roughness: 0.38, metalness: 0.85 }),
    dark: std({ color: "#0a110c", roughness: 0.8, metalness: 0.2 }),
    deck: std({ color: "#0f1a13", roughness: 0.55, metalness: 0.5 }),
    rail: std({ color: "#aab5ad", roughness: 0.3, metalness: 0.9 }),
    handle: std({ color: "#c9d2cb", roughness: 0.3, metalness: 0.85 }),
    module: std({ color: "#1d2c22", roughness: 0.5, metalness: 0.45 }),
    glass: new THREE.MeshStandardMaterial({ color: "#7cf0aa", roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide }),
    vent: new THREE.MeshBasicMaterial({ map: T.vent }),
    floor: new THREE.MeshBasicMaterial({ map: T.floor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    hole: new THREE.MeshBasicMaterial({ color: "#020403" }),
    cableA: std({ color: pal.signal, roughness: 0.5, metalness: 0.1 }),
    cableB: std({ color: pal.tape, roughness: 0.5, metalness: 0.1 }),
    cableC: std({ color: pal.phosphor, roughness: 0.5, metalness: 0.1 }),
  };
}

// Skills as modules on a deck: two columns when the names are long, three when they are short,
// more columns rather than more than five rows.
function layoutItems(items) {
  const n = items.length;
  if (!n) return [];
  const longest = Math.max(...items.map((s) => Math.max(...String(s).split(/[\s/]+/).map((w) => w.length))));
  let cols = n <= 2 ? n : longest > 9 ? 2 : 3;
  while (Math.ceil(n / cols) > 5) cols += 1;
  const rows = Math.ceil(n / cols);
  const gap = 0.07;
  const availW = TW - 0.2;
  const availD = TD - 0.5;
  const w = Math.min(1.0, (availW - gap * (cols - 1)) / cols);
  const d = Math.min(0.6, (availD - gap * (rows - 1)) / rows);
  return items.map((label, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const off = ((cols - inRow) * (w + gap)) / 2;
    const text = String(label);
    const word = Math.max(...text.split(/[\s/]+/).map((x) => x.length));
    return {
      label: text, w, d,
      x: -((cols * w + (cols - 1) * gap) / 2) + w / 2 + c * (w + gap) + off,
      z: -0.4 - d / 2 - r * (d + gap),
      size: Math.max(0.062, Math.min(0.1, (w - 0.1) / (word * 0.62))),
    };
  });
}

function Tray({ i, n, row, accent, pal, M, onHover, onPick }) {
  const g = useRef(null);
  const mods = useRef([]);
  const panelMat = useRef(null);
  const barMat = useRef(null);
  const leds = useRef([]);
  const e = useRef(0);
  const items = useMemo(() => row.items || [], [row.items]);
  const lay = useMemo(() => layoutItems(items), [items]);
  const acc = useMemo(() => new THREE.Color(accent), [accent]);
  const ledOn = useMemo(() => new THREE.Color(pal.phosphor), [pal.phosphor]);
  const ledAct = useMemo(() => new THREE.Color(pal.tape), [pal.tape]);
  const ledWarn = useMemo(() => new THREE.Color(pal.signal), [pal.signal]);
  const y = PLINTH + n * PITCH - (i + 0.5) * PITCH;
  const label = String(row.category || "");
  const nameSize = Math.max(0.07, Math.min(0.15, 1.15 / (label.length * 0.8)));

  useFrame(({ clock }, dtRaw) => {
    const grp = g.current;
    if (!grp) return;
    const dt = Math.min(dtRaw, 0.05);
    const t = clock.elapsedTime;
    const hot = rack.hot === i;
    let tgt = smooth(0, 1, 1 - Math.abs(rack.sel - i) * 1.5);
    if (hot) tgt = Math.max(tgt, 0.16);
    tgt = Math.min(1, tgt + rack.spread * 0.9);
    e.current += (tgt - e.current) * (1 - Math.exp(-dt * 6.5));

    // boot: the trays start half open and slide home one after the other, top first
    const boot = rack.boot < 0 ? 0 : rack.boot;
    const bootE = 0.5 * (1 - smooth(0, 0.55, boot - 0.25 - i * 0.12));
    const ext = Math.max(e.current, bootE);
    grp.position.z = RD / 2 - 0.06 + EXT * ext;

    // skills pop up on the deck once the tray is most of the way out
    lay.forEach((m, j) => {
      const o = mods.current[j];
      if (!o) return;
      const start = 0.3 + 0.25 * (j / lay.length);
      const r = smooth(start, start + 0.4, ext);
      o.visible = r > 0.001;
      if (o.visible) o.scale.setScalar(Math.max(0.001, outBack(r, 1.3)));
    });

    const sel = Math.max(0, 1 - Math.abs(rack.sel - i) * 1.5);
    if (panelMat.current) panelMat.current.emissiveIntensity = 0.07 * sel + (hot ? 0.06 : 0);
    if (barMat.current) barMat.current.emissiveIntensity = 0.3 + 0.9 * sel + (hot ? 0.3 : 0);
    const on = smooth(0, 0.2, boot - 0.3 - i * 0.12) * (rack.boot < 0 ? 0 : 1);
    const L = leds.current;
    if (L[0]) L[0].color.copy(ledOn).multiplyScalar(0.12 + 0.88 * on);
    if (L[1]) L[1].color.copy(ledAct).multiplyScalar(on * (Math.sin(t * (2.3 + i * 0.41) + i * 1.7) > 0.25 ? 1 : 0.12));
    if (L[2]) L[2].color.copy(ledWarn).multiplyScalar(0.14 + 0.86 * sel);
  });

  const U = `U${String(i + 1).padStart(2, "0")}`;
  return (
    <group
      ref={g}
      position={[0, y, RD / 2 - 0.06]}
      onPointerOver={(ev) => { ev.stopPropagation(); onHover(i); }}
      onPointerOut={() => onHover(-1)}
      onClick={(ev) => { ev.stopPropagation(); onPick(i); }}
    >
      {/* front panel */}
      <mesh geometry={BOX} position={[0, 0, 0.03]} scale={[PANEL_W, PANEL_H, 0.06]}>
        <meshStandardMaterial ref={panelMat} color="#1c2c21" roughness={0.45} metalness={0.6} emissive={accent} emissiveIntensity={0} />
      </mesh>
      <mesh geometry={BOX} position={[0, PANEL_H / 2 - 0.018, 0.034]} scale={[PANEL_W, 0.036, 0.07]}>
        <meshStandardMaterial ref={barMat} color={accent} emissive={accent} emissiveIntensity={0.3} />
      </mesh>
      <mesh geometry={PLANE} position={[0.5, -0.02, 0.0615]} scale={[0.62, 0.34, 1]} material={M.vent} />
      {/* handle */}
      <Box p={[0.86, -0.15, 0.1]} s={[0.3, 0.032, 0.036]} m={M.handle} />
      <Box p={[0.74, -0.15, 0.078]} s={[0.03, 0.032, 0.03]} m={M.handle} />
      <Box p={[0.98, -0.15, 0.078]} s={[0.03, 0.032, 0.03]} m={M.handle} />
      {/* status leds: power, activity, selected */}
      {[0, 1, 2].map((k) => (
        <mesh key={k} geometry={BOX} position={[0.8 + k * 0.1, 0.1, 0.066]} scale={[0.05, 0.05, 0.02]}>
          <meshBasicMaterial ref={(el) => { leds.current[k] = el; }} color="#000" toneMapped={false} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        <Text font={MONO} fontSize={0.072} color="#7da089" anchorX="left" anchorY="middle" position={[-1.08, 0.18, 0.0625]}>{`${U} · L${i + 1}`}</Text>
        <Text font={DISPLAY} fontSize={nameSize} color="#EAF6EE" anchorX="left" anchorY="middle" position={[-1.08, -0.02, 0.0625]}>{label.toUpperCase()}</Text>
        <Text font={MONO} fontSize={0.072} color={accent} anchorX="left" anchorY="middle" position={[-1.08, -0.2, 0.0625]}>{`${items.length} deps`}</Text>
      </Suspense>

      {/* deck, side lips, rear connector */}
      <Box p={[0, DECK_Y, -TD / 2 - 0.03]} s={[TW, 0.035, TD]} m={M.deck} />
      <Box p={[-TW / 2 + 0.015, DECK_Y + 0.05, -TD / 2 - 0.03]} s={[0.03, 0.09, TD]} m={M.steel} />
      <Box p={[TW / 2 - 0.015, DECK_Y + 0.05, -TD / 2 - 0.03]} s={[0.03, 0.09, TD]} m={M.steel} />
      <Box p={[0, DECK_Y + 0.06, -TD - 0.0]} s={[TW - 0.2, 0.1, 0.06]} m={M.dark} />

      {/* skills as modules on the deck */}
      <Suspense fallback={null}>
        {lay.map((m, j) => (
          <group key={j} ref={(el) => { mods.current[j] = el; }} position={[m.x, DECK_Y + 0.0175, m.z]} visible={false}>
            <Box p={[0, MOD_H / 2, 0]} s={[m.w, MOD_H, m.d]} m={M.module} />
            <mesh geometry={BOX} position={[0, MOD_H + 0.004, 0]} scale={[m.w - 0.05, 0.008, m.d - 0.05]}>
              <meshStandardMaterial color="#0b1410" roughness={0.6} metalness={0.3} emissive={accent} emissiveIntensity={0.12} />
            </mesh>
            <mesh geometry={BOX} position={[0, MOD_H / 2, m.d / 2 + 0.002]} scale={[m.w - 0.12, 0.03, 0.008]}>
              <meshBasicMaterial color={accent} toneMapped={false} />
            </mesh>
            <Text
              font={MONO}
              fontSize={m.size}
              color="#E3F5E9"
              anchorX="center"
              anchorY="middle"
              textAlign="center"
              maxWidth={m.w - 0.08}
              lineHeight={1.15}
              position={[0, MOD_H + 0.012, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              {m.label}
            </Text>
          </group>
        ))}
      </Suspense>
    </group>
  );
}

function Frame({ n, M }) {
  const H = PLINTH + n * PITCH + CAP;
  const inner = n * PITCH;
  const fans = useRef([]);
  const holes = useMemo(() => {
    const list = [];
    for (let s = -1; s <= 1; s += 2) for (let k = 0; k < n * 3; k++) list.push([s * (RW / 2 - POST / 2), PLINTH + (k + 0.5) * (PITCH / 3), RD / 2 + 0.001]);
    return list;
  }, [n]);
  const px = RW / 2 - POST / 2, pz = RD / 2 - POST / 2;

  useFrame((_, dt) => {
    fans.current.forEach((f, k) => { if (f) f.rotation.z += Math.min(dt, 0.05) * (k ? -9 : 9); });
  });

  return (
    <>
      {/* posts */}
      {[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz], k) => (
        <Box key={k} p={[sx * px, H / 2, sz * pz]} s={[POST, H, POST]} m={M.frame} />
      ))}
      {/* rack-unit holes on the front posts */}
      {holes.map((p, k) => <Box key={k} p={p} s={[0.036, 0.034, 0.004]} m={M.hole} />)}
      {/* slide rails, one pair per slot */}
      {Array.from({ length: n }, (_, k) => {
        const yy = PLINTH + k * PITCH + 0.075;
        return [-1, 1].map((sx) => <Box key={`${k}${sx}`} p={[sx * (RW / 2 - POST - 0.02), yy, 0]} s={[0.03, 0.03, RD - 0.2]} m={M.rail} />);
      })}
      {/* plinth, casters */}
      <Box p={[0, 0.12, 0]} s={[RW + 0.14, PLINTH - 0.1, RD + 0.14]} m={M.steel} />
      {[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz], k) => (
        <mesh key={k} geometry={CYL} position={[sx * (RW / 2 - 0.1), 0.035, sz * (RD / 2 - 0.1)]} scale={[0.06, 0.07, 0.06]} material={M.dark} />
      ))}
      {/* back panel, glass sides */}
      <Box p={[0, PLINTH + inner / 2, -RD / 2 + 0.015]} s={[RW - POST, inner, 0.03]} m={M.dark} />
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={PLANE} position={[sx * (RW / 2 - 0.02), PLINTH + inner / 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[RD - POST, inner, 1]} material={M.glass} />
      ))}
      {/* cabling down the back corner */}
      {[["cableA", 0], ["cableB", 1], ["cableC", 2]].map(([key, k]) => (
        <mesh key={key} geometry={CYL} position={[-RW / 2 + 0.2 + k * 0.07, PLINTH + inner / 2, -RD / 2 + 0.2]} scale={[0.026, inner - 0.04, 0.026]} material={M[key]} />
      ))}
      {/* top plate and the fans */}
      <Box p={[0, H - CAP / 2, 0]} s={[RW, CAP, RD]} m={M.steel} />
      {[-1, 1].map((sx, k) => (
        <group key={sx} position={[sx * 0.58, H + 0.002, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh geometry={CYL} rotation={[Math.PI / 2, 0, 0]} scale={[0.4, 0.004, 0.4]} material={M.hole} />
          <group ref={(el) => { fans.current[k] = el; }}>
            {[0, 1, 2, 3, 4].map((b) => (
              <mesh key={b} geometry={BOX} rotation={[0, 0, (b / 5) * TAU]} position={[Math.cos((b / 5) * TAU) * 0.14, Math.sin((b / 5) * TAU) * 0.14, 0.012]} scale={[0.26, 0.07, 0.008]} material={M.rail} />
            ))}
            <mesh geometry={CYL} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.014]} scale={[0.06, 0.02, 0.06]} material={M.handle} />
          </group>
          <mesh position={[0, 0, 0.003]}>
            <ringGeometry args={[0.38, 0.43, 40]} />
            <meshStandardMaterial color="#3a5042" roughness={0.4} metalness={0.8} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Rig({ rows, onHover, onPick, mobile }) {
  const { size } = useThree();
  const pal = useMemo(() => readPalette(), []);
  const n = rows.length;
  const H = PLINTH + n * PITCH + CAP;
  const fit = Math.min(1, 4.0 / H);
  const root = useRef(null);
  const rig = useRef(null);
  const light = useRef(null);
  const st = useRef({ t0: -1, x: 0, y: 0, s: 1 });
  const T = useMemo(() => makeTextures(pal), [pal]);
  const M = useMemo(() => makeMaterials(pal, T), [pal, T]);
  const accents = useMemo(() => [pal.phosphor, pal.tape, pal.signal], [pal]);

  useEffect(() => () => {
    Object.values(T).forEach((t) => t.dispose());
    Object.values(M).forEach((m) => m.dispose());
  }, [T, M]);

  // hand mode: spreading both hands pulls every tray out
  useEffect(() => {
    const onSpread = (ev) => { rack.spread = Math.max(0, Math.min(1, rack.spread + ev.detail.delta * 2)); };
    window.addEventListener("dk:spread", onSpread);
    return () => window.removeEventListener("dk:spread", onSpread);
  }, []);

  useEffect(() => () => { document.body.style.cursor = ""; }, []);

  useFrame(({ clock, camera }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = clock.elapsedTime;
    const s = st.current;
    if (rack.seen && s.t0 < 0) s.t0 = t;
    rack.boot = s.t0 < 0 ? -1 : t - s.t0;
    rack.spread = Math.max(0, rack.spread - dt * 0.12);

    camera.position.set(0, CAM.y, CAM.z);
    camera.lookAt(0, 0, 0);

    // placement: the free part of the screen to the right of the list (centred on a phone)
    const dist = Math.hypot(CAM.y, CAM.z);
    const halfH = Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2)) * dist;
    const halfW = halfH * (size.width / size.height);
    const wpx = (2 * halfW) / size.width;
    const left = Math.max(24, size.width * 0.05) + Math.min(512, size.width * 0.36) + size.width * 0.02;
    const right = size.width * 0.985;
    const regionW = Math.max(1, (right - left) * wpx);
    const sc = mobile ? Math.min(fit, (2 * halfW * 1.02) / 4.4) : Math.min(fit, regionW / 5.7);
    const tx = mobile ? 0.3 * sc : ((left + right) / 2 - size.width / 2) * wpx + 0.75 * sc;
    // the rack drifts up as the pick moves down it, so the open tray stays near the middle
    const ty = (mobile ? halfH * 0.3 : halfH * 0.02) + (rack.sel - (n - 1) / 2) * PITCH * 0.38 * sc;
    s.x += (tx - s.x) * (1 - Math.exp(-dt * 4));
    s.y += (ty - s.y) * (1 - Math.exp(-dt * 4));
    s.s += (sc - s.s) * (1 - Math.exp(-dt * 4));
    const r = root.current;
    if (r) { r.position.set(s.x, s.y, 0); r.scale.setScalar(s.s); }
    const q = rig.current;
    if (q) {
      const yaw = (mobile ? -0.2 : -0.72) + pointer.x * 0.16 + Math.sin(t * 0.2) * 0.03;
      q.rotation.y += (yaw - q.rotation.y) * (1 - Math.exp(-dt * 3));
      q.rotation.x += (-pointer.y * 0.04 - q.rotation.x) * (1 - Math.exp(-dt * 3));
    }
    // a light that follows the open tray
    const l = light.current;
    if (l) {
      const yy = PLINTH + n * PITCH - (rack.sel + 0.5) * PITCH;
      l.position.set(0, yy + 0.55, RD / 2 + EXT * 0.55);
      l.intensity = 3.2 * smooth(0, 0.6, rack.boot < 0 ? 0 : rack.boot - 0.3);
    }
  });

  return (
    <group ref={root}>
      <group ref={rig}>
        <group position={[0, -H / 2, 0]}>
          <mesh geometry={PLANE} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} scale={[11, 11, 1]} material={M.floor} />
          <Frame n={n} M={M} />
          {rows.map((row, i) => (
            <Tray key={row.id ?? i} i={i} n={n} row={row} accent={accents[i % accents.length]} pal={pal} M={M} onHover={onHover} onPick={onPick} />
          ))}
          <pointLight ref={light} color={pal.phosphor} distance={7} decay={1.6} intensity={0} />
          <Suspense fallback={null}>
            <Text font={MONO} fontSize={0.075} color={pal.phosphor} anchorX="left" anchorY="middle" position={[-RW / 2 + 0.16, H - CAP / 2, RD / 2 + 0.004]}>
              {"DK-RACK-01  ● ONLINE"}
            </Text>
          </Suspense>
        </group>
      </group>
    </group>
  );
}

export default function SkillsStage({ rows, active, mobile, onHover, onPick }) {
  useEffect(() => { rack.active = active; }, [active]);
  const hover = useCallback((i) => {
    rack.hot = i;
    document.body.style.cursor = i >= 0 ? "pointer" : "";
    onHover?.(i);
  }, [onHover]);
  return (
    <Boundary>
      <Canvas
        dpr={[1, 2]}
        frameloop={active ? "always" : "never"}
        camera={{ position: [0, CAM.y, CAM.z], fov: CAM.fov, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0, touchAction: "pan-y" }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <ambientLight intensity={0.7} />
        <hemisphereLight args={["#cfeedd", "#07110a", 0.55]} />
        <directionalLight position={[4, 8, 6]} intensity={1.9} />
        <directionalLight position={[-6, 3, -4]} intensity={1.1} color="#4ADE80" />
        <directionalLight position={[6, 1, 2]} intensity={0.5} color="#E5432D" />
        <Rig rows={rows} onHover={hover} onPick={onPick} mobile={mobile} />
      </Canvas>
    </Boundary>
  );
}
