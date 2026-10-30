import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import { pointer } from "../../lib/pointer";
import { setIntro } from "../../lib/intro";
import * as audio from "../../lib/audio";
import { stage, clamp, smooth, outBack } from "./state";
import { Cup, Spring, Key, Database, Services, Containers, RestCard, JwtCard, INK, PAPER, SIGNAL } from "./objects";

// What I do, drifting behind me. Every object is a small disc in the x/y plane with
// a mass (area), flies in a random direction and bounces off the walls and off the
// others with a proper elastic impulse (momentum is conserved, a hit also spins
// both a little). Hover or tap one and it leaves the crowd: it freezes, comes
// forward in front of me, grows, and a card says what it is. Grab and throw it
// and it rejoins the others with the speed you gave it.

const ITEMS = [
  { id: "java",   label: "Java 21",        info: "the language I live in",         C: Cup,        r: 0.62, spin: "turn", s: 1.0,  mobile: true },
  { id: "spring", label: "Spring Boot",    info: "services, security, data",       C: Spring,     r: 0.6,  spin: "turn", s: 1.0,  mobile: true },
  { id: "key",    label: "Keycloak · IAM", info: "identity and access",            C: Key,        r: 0.6,  spin: "turn", s: 1.0,  mobile: true },
  { id: "db",     label: "PostgreSQL",     info: "relational data, tuned",         C: Database,   r: 0.62, spin: "sway", s: 0.9,  mobile: true },
  { id: "svc",    label: "Microservices",  info: "small parts that talk",          C: Services,   r: 0.78, spin: "none", s: 1.0,  mobile: true },
  { id: "dock",   label: "Docker",         info: "ship it in a container",         C: Containers, r: 0.7,  spin: "sway", s: 0.95, mobile: true },
  { id: "rest",   label: "REST APIs",      info: "clean, versioned HTTP",          C: RestCard,   r: 0.8,  spin: "card", s: 0.95 },
  { id: "jwt",    label: "JWT · OAuth2",   info: "stateless, scoped tokens",       C: JwtCard,    r: 0.62, spin: "card", s: 1.0 },
];

const FONT = "/fonts/jetbrains-mono-500.ttf";
const Z_BACK = -1.3;     // behind the portrait (z 0) and the surname (z -0.9), in front of the ribbons
const Z_FRONT = 1.6;     // in front of everything
const GROW = 1.0;        // extra scale when lifted
const E_WALL = 0.98, E_ITEM = 0.96;

const cardW = (it) => Math.max(it.label.length * 0.066, it.info.length * 0.043) + 0.4;

function Label({ it, refEl }) {
  const w = cardW(it);
  return (
    <group ref={refEl} scale={0} visible={false}>
      <RoundedBox args={[w, 0.46, 0.03]} radius={0.05} smoothness={3}><meshBasicMaterial color={INK} toneMapped={false} /></RoundedBox>
      <mesh position={[-w / 2 + 0.07, 0, 0.02]}><planeGeometry args={[0.036, 0.32]} /><meshBasicMaterial color={SIGNAL} toneMapped={false} /></mesh>
      <Text font={FONT} fontSize={0.1} color={PAPER} anchorX="left" anchorY="middle" position={[-w / 2 + 0.17, 0.075, 0.02]}>{it.label}</Text>
      <Text font={FONT} fontSize={0.068} color="#9DB8A4" anchorX="left" anchorY="middle" position={[-w / 2 + 0.17, -0.085, 0.02]}>{it.info}</Text>
    </group>
  );
}

// Random start: positions that do not overlap, a random heading and a calm speed each.
function spawn(items, unit, box, fs) {
  const placed = [];
  return items.map((it, i) => {
    const r = it.r * unit * it.s;
    let x = 0, y = 0;
    for (let n = 0; n < 50; n++) {
      x = (Math.random() * 2 - 1) * (box.x - r);
      y = box.bottom + r + Math.random() * Math.max(0, box.top - box.bottom - 2 * r);
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + 0.06)) break;
    }
    placed.push({ x, y, r });
    const a = Math.random() * Math.PI * 2;
    const base = (0.32 + Math.random() * 0.26) * fs;
    return {
      x, y, z: Z_BACK + ((i % 3) - 1) * 0.07, vx: Math.cos(a) * base, vy: Math.sin(a) * base, base, r,
      lift: 0, hovered: false, grab: false, roll: 0, w: 0, tilt: new THREE.Vector2(), bob: Math.random() * 6.28,
      dz: Z_BACK, f: 1, v0x: 0, v0y: 0,
    };
  });
}

export default function Floaters({ layout, rig }) {
  const { camera, gl } = useThree();
  const items = useMemo(() => ITEMS.filter((it) => !layout.mobile || it.mobile), [layout.mobile]);
  const groups = useRef([]);
  const inner = useRef([]);
  const labels = useRef([]);
  const drag = useRef(null);
  const sel = useRef(-1);
  const hitFlag = useRef(false);
  const lastClink = useRef(0);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), n: new THREE.Vector3(0, 0, 1), plane: new THREE.Plane(), ndc: new THREE.Vector2() }), []);

  const unit = (layout.mobile ? 0.8 : 0.46) * layout.fs;   // world size of an object at scale 1
  // Where objects can roam, at their depth (a plane further away shows more of the world).
  const box = useMemo(() => {
    const k = (camera.position.z - Z_BACK) / camera.position.z;
    return { x: (layout.W / 2) * k, top: (layout.H / 2 - layout.topPad) * k, bottom: (-layout.H / 2 + 70 * layout.px) * k };
  }, [layout, camera]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sim = useMemo(() => spawn(items, unit, box, layout.fs), [items]);

  // World point under a screen position on the plane z = zWorld, in rig-local coordinates.
  const pointAt = (cx, cy, z, out) => {
    const r = gl.domElement.getBoundingClientRect();
    tmp.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(tmp.ndc, camera);
    tmp.plane.set(tmp.n, -z);
    if (!ray.ray.intersectPlane(tmp.plane, out)) return null;
    return rig.current ? rig.current.worldToLocal(out) : out;
  };

  const ready = () => stage.p < 0.03 && stage.t > 2.4;

  useEffect(() => {
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      d.cx = e.clientX; d.cy = e.clientY;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
    };
    const up = () => {
      const d = drag.current;
      if (!d) return;
      const s = sim[d.i];
      s.grab = false;
      stage.drag = false;
      drag.current = null;
      if (d.moved) {
        const sp = Math.hypot(s.vx, s.vy);
        if (sp > 4) { s.vx *= 4 / sp; s.vy *= 4 / sp; }
        audio.drop(sp / 4);
      } else {
        // a tap or click: pin the card open, or close it again; the object keeps its old heading
        s.vx = s.v0x; s.vy = s.v0y;
        sel.current = sel.current === d.i ? -1 : d.i;
      }
      document.body.style.cursor = s.hovered ? "grab" : "";
    };
    const away = () => {
      if (!hitFlag.current) sel.current = -1;
      hitFlag.current = false;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("pointerdown", away);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("pointerdown", away);
      document.body.style.cursor = "";
    };
  }, [sim]);

  const down = (e, i) => {
    e.stopPropagation();
    hitFlag.current = true;
    if (!ready()) return;
    const s = sim[i];
    s.grab = true;
    stage.drag = true;
    s.v0x = s.vx; s.v0y = s.vy;
    const hit = pointAt(e.nativeEvent.clientX, e.nativeEvent.clientY, s.dz, tmp.v);
    drag.current = {
      i, moved: false, sx: e.nativeEvent.clientX, sy: e.nativeEvent.clientY, cx: e.nativeEvent.clientX, cy: e.nativeEvent.clientY,
      ox: hit ? s.x - hit.x / s.f : 0, oy: hit ? s.y - hit.y / s.f : 0,
    };
    document.body.style.cursor = "grabbing";
    audio.grab();
    setIntro({ grabbed: true });
  };

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = clock.elapsedTime;
    const tf = smooth(0, 0.12, stage.p);
    const S = sim;
    if (tf >= 1) {
      sel.current = -1;
      items.forEach((_, i) => { if (groups.current[i]) groups.current[i].visible = false; if (labels.current[i]) labels.current[i].visible = false; });
      return;
    }
    if (stage.p > 0.03) sel.current = -1;
    const live = ready();
    const frozen = (i) => S[i].grab || (live && (S[i].hovered || sel.current === i));
    const camZ = camera.position.z;

    items.forEach((it, i) => { S[i].r = it.r * unit * it.s; });

    // dragged object follows the pointer
    const d = drag.current;
    if (d) {
      const s = S[d.i];
      const p = pointAt(d.cx, d.cy, s.dz, tmp.v);
      if (p) {
        const tx = clamp(p.x / s.f + d.ox, -box.x + s.r, box.x - s.r), ty = clamp(p.y / s.f + d.oy, box.bottom + s.r, box.top - s.r);
        const px = s.x, py = s.y, e = 1 - Math.exp(-dt * 22);
        s.x += (tx - s.x) * e; s.y += (ty - s.y) * e;
        const k = 1 - Math.exp(-dt * 16);
        s.vx += ((s.x - px) / Math.max(dt, 1e-3) - s.vx) * k;
        s.vy += ((s.y - py) / Math.max(dt, 1e-3) - s.vy) * k;
      }
    }

    // physics, in small fixed steps so fast objects cannot tunnel through each other
    const n = Math.min(6, Math.ceil(dt / 0.008)), h = dt / n;
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < items.length; i++) {
        const s = S[i];
        if (frozen(i)) continue;
        s.x += s.vx * h; s.y += s.vy * h;
        if (s.x < -box.x + s.r) { s.x = -box.x + s.r; s.vx = Math.abs(s.vx) * E_WALL; }
        else if (s.x > box.x - s.r) { s.x = box.x - s.r; s.vx = -Math.abs(s.vx) * E_WALL; }
        if (s.y < box.bottom + s.r) { s.y = box.bottom + s.r; s.vy = Math.abs(s.vy) * E_WALL; }
        else if (s.y > box.top - s.r) { s.y = box.top - s.r; s.vy = -Math.abs(s.vy) * E_WALL; }
      }
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = S[i], b = S[j];
          if (frozen(i) || frozen(j) || a.lift > 0.15 || b.lift > 0.15) continue;
          const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min) continue;
          const dist = Math.sqrt(d2) || 1e-4;
          const nx = dx / dist, ny = dy / dist;
          const ma = a.r * a.r, mb = b.r * b.r, inv = 1 / (ma + mb);
          // push apart along the normal, heavier objects move less
          const push = (min - dist) * 0.3;
          a.x -= nx * push * mb * inv; a.y -= ny * push * mb * inv;
          b.x += nx * push * ma * inv; b.y += ny * push * ma * inv;
          // impulse along the normal, only if they are closing in on each other
          const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (vn <= 0) continue;
          const j2 = ((1 + E_ITEM) * vn) / (1 / ma + 1 / mb);
          a.vx -= (j2 / ma) * nx; a.vy -= (j2 / ma) * ny;
          b.vx += (j2 / mb) * nx; b.vy += (j2 / mb) * ny;
          // glancing blows spin both, in the same sense, like rubbing surfaces
          const vt = (a.vx - b.vx) * -ny + (a.vy - b.vy) * nx;
          a.w = clamp(a.w + vt * 0.9, -6, 6); b.w = clamp(b.w + vt * 0.9, -6, 6);
          if (vn > 0.2 && t - lastClink.current > 0.07) { lastClink.current = t; audio.clink(vn / 1.6); }
        }
      }
    }

    // drift: keep things moving at a calm speed, and let a hard throw settle
    items.forEach((_, i) => {
      const s = S[i];
      if (frozen(i)) return;
      const sp = Math.hypot(s.vx, s.vy);
      if (sp < 1e-3) { const a = Math.random() * 6.28; s.vx = Math.cos(a) * s.base; s.vy = Math.sin(a) * s.base; }
      else if (sp < s.base * 0.75) { const k = 1 + dt * 1.2; s.vx *= k; s.vy *= k; }
      else if (sp > s.base * 1.7) { const k = Math.exp(-dt * 1.1); s.vx *= k; s.vy *= k; }
    });

    items.forEach((it, i) => {
      const g = groups.current[i], s = S[i];
      if (!g) return;
      const want = live && (s.hovered || s.grab || sel.current === i);
      s.lift += ((want ? 1 : 0) - s.lift) * (1 - Math.exp(-dt * 9));
      const le = s.lift * s.lift * (3 - 2 * s.lift);

      // appear, then leave with the rip
      const ap = outBack(clamp((stage.t - (2.15 + i * 0.12)) / 0.85), 1.7);
      const sc = unit * it.s * ap * (1 - tf) * (1 + le * GROW);
      s.dz = s.z + (Z_FRONT - s.z) * le;
      s.f = (camZ - s.z) / (camZ - s.dz);          // keeps the object under the same screen spot while it comes forward
      const ratio = (camZ - s.dz) / camZ;
      const dispR = it.r * sc;
      const bob = Math.sin(t * 0.9 + s.bob) * 0.025 * layout.fs;
      const gx = clamp(s.x * s.f, -(layout.W / 2) * ratio + dispR, (layout.W / 2) * ratio - dispR);
      const gy = clamp((s.y + bob) * s.f, (-layout.H / 2) * ratio + dispR + 0.1, (layout.H / 2 - layout.topPad * 0.6) * ratio - dispR);
      g.position.set(gx, gy, s.dz);
      g.scale.setScalar(Math.max(1e-4, sc));
      g.visible = sc > 0.002;

      s.tilt.x += (clamp(-s.vy * 0.5, -0.5, 0.5) - s.tilt.x) * (1 - Math.exp(-dt * 8));
      s.tilt.y += (clamp(s.vx * 0.5, -0.5, 0.5) - s.tilt.y) * (1 - Math.exp(-dt * 8));
      s.roll += s.w * dt;
      s.w *= Math.exp(-dt * 0.9);
      const nd = inner.current[i];
      if (nd) {
        const spin = it.spin;
        const th = t * 0.7 + i;
        const turn = ((th + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;     // unwinds to face front when lifted
        const free = spin === "turn" ? turn : spin === "sway" ? Math.sin(t * 0.6 + i) * 0.5 : spin === "card" ? Math.sin(t * 0.5 + i * 2) * 0.28 : 0;
        nd.rotation.y = free * (1 - le) + le * pointer.x * 0.3;
        nd.rotation.x = (s.tilt.x + (spin === "card" ? Math.sin(t * 0.4 + i) * 0.08 : 0)) * (1 - le) - le * pointer.y * 0.18;
        nd.rotation.z = (-s.tilt.y * 0.8 + s.roll) * (1 - le);
      }

      // the card sits under the object, or above it when there is no room below
      const lb = labels.current[i];
      if (lb) {
        const k = smooth(0.4, 1, s.lift);
        const ls = layout.mobile ? 0.85 : 1.1;
        lb.visible = k > 0.01;
        lb.scale.setScalar(Math.max(1e-4, k * ls));
        const half = (cardW(it) / 2) * ls;
        let ly = gy - dispR - 0.3 * ls;
        if (ly < (-layout.H / 2) * ratio + 0.3) ly = gy + dispR + 0.3 * ls;
        const ext = (layout.W / 2) * ratio - half - 0.06;
        lb.position.set(clamp(gx, -ext, ext), ly, s.dz + 0.4);
      }
    });
  });

  return (
    <>
      {items.map((it, i) => (
        <group key={it.id}>
          <group ref={(el) => (groups.current[i] = el)} visible={false}>
            <group ref={(el) => (inner.current[i] = el)}><it.C /></group>
            <mesh
              onPointerDown={(e) => down(e, i)}
              onPointerOver={(e) => {
                e.stopPropagation();
                sim[i].hovered = true;
                if (!drag.current && ready()) { document.body.style.cursor = "grab"; setIntro({ grabbed: true }); }
              }}
              onPointerOut={() => { sim[i].hovered = false; if (!drag.current) document.body.style.cursor = ""; }}
            >
              <sphereGeometry args={[it.r, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
          <Label it={it} refEl={(el) => (labels.current[i] = el)} />
        </group>
      ))}
    </>
  );
}
