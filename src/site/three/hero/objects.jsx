import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

// Procedural stand-ins for the things I work with. No model files: each is a few
// primitives, so the whole set costs a handful of draw calls.

export const INK = "#161815";
export const PAPER = "#F1EFE9";
export const SIGNAL = "#E5432D";
export const PHOS = "#4ADE80";
export const TAPE = "#F2C94C";

const std = (color, extra = {}) => <meshStandardMaterial color={color} roughness={0.38} metalness={0.08} {...extra} />;

// Draws a small UI card into a canvas and returns a texture. Fonts are awaited so
// the mono face is used instead of the fallback.
function useCanvasTexture(draw, w, h) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [w, h]);
  useEffect(() => {
    let alive = true;
    const paint = () => { if (!alive) return; draw(tex.image.getContext("2d"), w, h); tex.needsUpdate = true; };
    paint();
    document.fonts?.load("600 28px 'JetBrains Mono'").then(paint).catch(() => {});
    return () => { alive = false; tex.dispose(); };
  }, [tex, draw, w, h]);
  return tex;
}

/* ------------------------------------------------------------------ Java */
export function Cup() {
  const steam = useRef();
  const lathe = useMemo(() => {
    const p = [[0, 0], [0.22, 0], [0.26, 0.03], [0.33, 0.45], [0.37, 0.62], [0.345, 0.62], [0.31, 0.5], [0.23, 0.08], [0, 0.08]];
    return p.map(([x, y]) => new THREE.Vector2(x, y));
  }, []);
  const curves = useMemo(() => [-0.12, 0.02, 0.15].map((x, i) => {
    const pts = [];
    for (let k = 0; k <= 12; k++) pts.push(new THREE.Vector3(x + Math.sin(k * 0.9 + i * 1.7) * 0.05, 0.7 + k * 0.05, Math.cos(k * 0.7 + i) * 0.04));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 6);
  }), []);
  useFrame(({ clock }) => {
    const s = steam.current;
    if (!s) return;
    s.children.forEach((c, i) => { c.material.opacity = 0.22 + 0.2 * Math.sin(clock.elapsedTime * 1.6 + i * 1.9); c.position.y = ((clock.elapsedTime * 0.05 + i * 0.03) % 0.09); });
  });
  return (
    <group position={[0, -0.2, 0]} rotation={[0.55, 0, 0]} scale={1.0}>
      <mesh><latheGeometry args={[lathe, 40]} />{std(PAPER, { side: THREE.DoubleSide })}</mesh>
      <mesh position={[0, 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.315, 32]} /><meshStandardMaterial color="#3a2012" roughness={0.25} /></mesh>
      <mesh position={[0.37, 0.33, 0]} rotation={[0, 0, -0.1]}><torusGeometry args={[0.15, 0.04, 12, 28, Math.PI * 1.25]} />{std(PAPER)}</mesh>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.3, 0.27, 0.07, 40, 1, true]} />{std(SIGNAL, { side: THREE.DoubleSide })}</mesh>
      <mesh position={[0, -0.02, 0]}><cylinderGeometry args={[0.56, 0.46, 0.05, 48]} />{std(SIGNAL)}</mesh>
      <group ref={steam}>{curves.map((g, i) => <mesh key={i} geometry={g}><meshBasicMaterial color="#fff" transparent opacity={0.3} depthWrite={false} /></mesh>)}</group>
    </group>
  );
}

/* ---------------------------------------------------------------- Spring */
export function Spring() {
  const leaf = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.26, -0.3);
    s.bezierCurveTo(-0.42, 0.05, -0.12, 0.38, 0.3, 0.34);
    s.bezierCurveTo(0.34, -0.02, 0.18, -0.34, -0.26, -0.3);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 3, curveSegments: 18 });
    return g;
  }, []);
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.52, 0.52, 0.14, 56]} />{std("#58C46B", { roughness: 0.3 })}</mesh>
      <mesh position={[0, 0, 0.09]} rotation={[0, 0, 0.15]} scale={1.15}><primitive object={leaf} attach="geometry" />{std(PAPER)}</mesh>
      <mesh position={[0.04, -0.03, 0.17]}><torusGeometry args={[0.09, 0.022, 10, 28]} />{std(INK)}</mesh>
    </group>
  );
}

/* -------------------------------------------------------------- Keycloak */
export function Key() {
  const teeth = [0.34, 0.5, 0.64];
  return (
    <group rotation={[0, 0, 0.5]} scale={1.15}>
      <mesh position={[0, 0.42, 0]}><torusGeometry args={[0.2, 0.075, 18, 36]} />{std(TAPE, { metalness: 0.85, roughness: 0.22 })}</mesh>
      <mesh position={[0, -0.12, 0]}><cylinderGeometry args={[0.05, 0.05, 0.82, 18]} />{std(TAPE, { metalness: 0.85, roughness: 0.22 })}</mesh>
      {teeth.map((y, i) => <mesh key={i} position={[0.1 + (i % 2) * 0.03, -y + 0.1, 0]}><boxGeometry args={[0.2 - (i % 2) * 0.04, 0.08, 0.08]} />{std(TAPE, { metalness: 0.85, roughness: 0.22 })}</mesh>)}
      <mesh position={[0, 0.42, 0]}><torusGeometry args={[0.09, 0.02, 10, 24]} />{std(INK)}</mesh>
    </group>
  );
}

/* -------------------------------------------------------------- Database */
export function Database() {
  return (
    <group rotation={[0.22, 0, 0]}>
      {[0.36, 0, -0.36].map((y, i) => (
        <group key={i} position={[0, y, 0]}>
          <mesh><cylinderGeometry args={[0.48, 0.48, 0.28, 48]} />{std(i === 0 ? "#2B2F2C" : INK, { roughness: 0.3, metalness: 0.2 })}</mesh>
          <mesh position={[0, 0.141, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.48, 0.012, 8, 64]} /><meshBasicMaterial color={PHOS} /></mesh>
          <mesh position={[0.3, 0, 0.38]}><sphereGeometry args={[0.028, 10, 10]} /><meshBasicMaterial color={i === 1 ? SIGNAL : PHOS} /></mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------- Microservices */
const NODES = (() => {
  const a = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 7; i++) {
    const y = 1 - (i / 6) * 2, r = Math.sqrt(1 - y * y);
    a.push(new THREE.Vector3(Math.cos(g * i) * r, y, Math.sin(g * i) * r).multiplyScalar(0.62));
  }
  return a;
})();
const NODE_COLORS = [SIGNAL, PAPER, PHOS, TAPE, PAPER, SIGNAL, PHOS];

function Link({ to }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().normalize()), [to]);
  return <mesh position={to.clone().multiplyScalar(0.5)} quaternion={q}><cylinderGeometry args={[0.01, 0.01, to.length(), 6]} /><meshBasicMaterial color={INK} /></mesh>;
}

export function Services() {
  const g = useRef();
  useFrame((_, dt) => { if (g.current) { g.current.rotation.y += dt * 0.45; g.current.rotation.x += dt * 0.12; } });
  return (
    <group ref={g}>
      <mesh><icosahedronGeometry args={[0.26, 0]} />{std(INK, { flatShading: true })}</mesh>
      {NODES.map((n, i) => (
        <group key={i}>
          <Link to={n} />
          <mesh position={n}><sphereGeometry args={[0.1, 20, 20]} />{std(NODE_COLORS[i], { roughness: 0.28 })}</mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- Docker */
function Container({ color, y, x = 0 }) {
  return (
    <group position={[x, y, 0]}>
      <mesh><boxGeometry args={[1.0, 0.3, 0.38]} />{std(color, { roughness: 0.5, metalness: 0.15 })}</mesh>
      {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[-0.4 + i * 0.1, 0, 0.192]}><boxGeometry args={[0.03, 0.26, 0.012]} />{std(color, { color: new THREE.Color(color).multiplyScalar(0.72) })}</mesh>)}
    </group>
  );
}
export function Containers() {
  return (
    <group rotation={[0.18, -0.4, 0]}>
      <Container color={SIGNAL} y={-0.32} />
      <Container color={INK} y={0} x={0.14} />
      <Container color={PAPER} y={0.32} x={-0.1} />
    </group>
  );
}

/* ------------------------------------------------------------- Cards (UI) */
function drawRest(g, w, h) {
  g.fillStyle = "#0A140D"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#13261A"; g.fillRect(0, 0, w, 54);
  ["#E5432D", "#F2C94C", "#4ADE80"].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(34 + i * 30, 27, 9, 0, 7); g.fill(); });
  g.font = "500 24px 'JetBrains Mono', ui-monospace, monospace";
  g.fillStyle = "#6E8A76"; g.fillText("zsh — dk-api", 150, 35);
  g.font = "600 30px 'JetBrains Mono', ui-monospace, monospace";
  g.fillStyle = "#4ADE80"; g.fillText("$ curl -i /api/v1/me", 34, 118);
  g.fillStyle = "#CFE3D4"; g.fillText("HTTP/1.1", 34, 172);
  g.fillStyle = "#4ADE80"; g.fillText("200 OK", 190, 172);
  g.fillStyle = "#9DB8A4"; g.fillText('{ "role": "backend",', 34, 226);
  g.fillText('  "stack": "spring" }', 34, 264);
  g.fillStyle = "#F2C94C"; g.fillText("⏱ 12ms", 34, 322);
  g.fillStyle = "#4ADE80"; g.fillRect(190, 300, 16, 28);
}

export function RestCard() {
  const tex = useCanvasTexture(drawRest, 640, 400);
  return (
    <group>
      <RoundedBox args={[1.5, 0.94, 0.05]} radius={0.04} smoothness={4}>{std("#0A140D", { roughness: 0.4 })}</RoundedBox>
      <mesh position={[0, 0, 0.027]}><planeGeometry args={[1.44, 0.9]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
    </group>
  );
}

function drawJwt(g, w, h) {
  g.fillStyle = "#F1EFE9"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#161815"; g.beginPath(); g.arc(w / 2, 46, 17, 0, 7); g.fill();
  g.font = "700 30px 'JetBrains Mono', ui-monospace, monospace";
  g.fillStyle = "#161815"; g.fillText("ACCESS TOKEN", 34, 128);
  g.font = "500 24px 'JetBrains Mono', ui-monospace, monospace";
  g.fillStyle = "#4B4F4B"; g.fillText("issued by keycloak · RS256", 34, 164);
  const parts = [["#E5432D", "eyJhbGciOiJSUzI1NiJ9"], ["#2F8F55", "eyJyb2xlIjoiYmFja2VuZCJ9"], ["#C99A12", "k3hX9pQ2vL0aM7"]];
  g.font = "600 24px 'JetBrains Mono', ui-monospace, monospace";
  parts.forEach(([c, t], i) => { g.fillStyle = c; g.fillText(t + (i < 2 ? "." : ""), 34, 230 + i * 40); });
  g.fillStyle = "#161815"; g.fillRect(34, 350, 220, 3);
  g.font = "500 20px 'JetBrains Mono', ui-monospace, monospace";
  g.fillStyle = "#4B4F4B"; g.fillText("valid · expires in 5m", 34, 384);
}

export function JwtCard() {
  const tex = useCanvasTexture(drawJwt, 480, 420);
  return (
    <group>
      <RoundedBox args={[1.1, 0.96, 0.04]} radius={0.05} smoothness={4}>{std(PAPER, { roughness: 0.55 })}</RoundedBox>
      <mesh position={[0, 0, 0.022]}><planeGeometry args={[1.06, 0.92]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
    </group>
  );
}
