import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { pointer } from "../lib/pointer";

// Skills as an exploded architecture stack: one slab per CMS category, first
// category at the bottom. Scrolling through the frame pulls the slabs apart;
// a two-hand spread (hand mode) does the same.

const DISPLAY = "/fonts/archivo-wide-black.ttf";
const MONO = "/fonts/jetbrains-mono-500.ttf";
const SKINS = [
  { slab: "#E8E6E1", text: "#111311", sub: "#4B4F4B" },
  { slab: "#111311", text: "#E8E6E1", sub: "#4ADE80" },
  { slab: "#E5432D", text: "#FFFFFF", sub: "#111311" },
  { slab: "#0E1D12", text: "#4ADE80", sub: "#CFE3D4" },
  { slab: "#F2C94C", text: "#111311", sub: "#4B4F4B" },
];

function Slab({ skill, index, total, explode, hot, onHover }) {
  const ref = useRef();
  const skin = SKINS[index % SKINS.length];
  const items = (skill.items || []).join("  ·  ");
  const W = 3.4, D = 2.1, T = 0.16;

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const gap = 0.24 + explode.current * 0.62;
    const target = (index - (total - 1) / 2) * gap;
    g.position.y += (target - g.position.y) * 0.12;
    const lift = hot === index ? 0.35 : 0;
    g.position.z += (lift - g.position.z) * 0.15;
  });

  return (
    <group ref={ref} onPointerOver={(e) => { e.stopPropagation(); onHover(index); }} onPointerOut={() => onHover(-1)}>
      <RoundedBox args={[W, T, D]} radius={0.03} smoothness={3}>
        <meshStandardMaterial color={skin.slab} roughness={0.85} metalness={0} emissive={hot === index ? "#E5432D" : "#000"} emissiveIntensity={hot === index ? 0.18 : 0} />
      </RoundedBox>
      <Text font={DISPLAY} fontSize={0.26} color={skin.text} anchorX="left" anchorY="middle" position={[-W / 2 + 0.16, T / 2 + 0.002, -0.62]} rotation={[-Math.PI / 2, 0, 0]} maxWidth={W - 0.3}>
        {skill.category.toUpperCase()}
      </Text>
      <Text font={MONO} fontSize={0.105} color={skin.sub} anchorX="left" anchorY="top" position={[-W / 2 + 0.16, T / 2 + 0.002, -0.3]} rotation={[-Math.PI / 2, 0, 0]} maxWidth={W - 0.3} lineHeight={1.4}>
        {items}
      </Text>
      <Text font={MONO} fontSize={0.09} color={skin.sub} anchorX="left" anchorY="middle" position={[-W / 2 + 0.12, 0, D / 2 + 0.002]}>
        {`L${index} · ${(skill.items || []).length} deps`}
      </Text>
    </group>
  );
}

function Rig({ children }) {
  const g = useRef();
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime;
    g.current.rotation.y += ((-0.62 + pointer.x * 0.35 + Math.sin(t * 0.25) * 0.05) - g.current.rotation.y) * 0.05;
    g.current.rotation.x += ((0.5 - pointer.y * 0.12) - g.current.rotation.x) * 0.05;
  });
  return <group ref={g}>{children}</group>;
}

function Scene({ skills, hot, onHover }) {
  const explode = useRef(0);
  const spread = useRef(0);
  const { gl, camera, size } = useThree();

  useEffect(() => {
    const onSpread = (e) => { spread.current = Math.max(0, Math.min(1, spread.current + e.detail.delta * 2)); };
    window.addEventListener("dk:spread", onSpread);
    return () => window.removeEventListener("dk:spread", onSpread);
  }, []);

  useEffect(() => {
    camera.position.set(0, 0.6, size.width < 500 ? 9.5 : 7.4);
    camera.lookAt(0, 0, 0);
  }, [camera, size.width]);

  useFrame(() => {
    const r = gl.domElement.getBoundingClientRect();
    const vh = window.innerHeight;
    const through = (vh - r.top) / (vh + r.height);
    const fromScroll = THREE.MathUtils.smoothstep(through, 0.25, 0.55);
    const target = Math.max(fromScroll, spread.current);
    explode.current += (target - explode.current) * 0.08;
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 8, 5]} intensity={1.6} />
      <directionalLight position={[-6, 2, -4]} intensity={0.4} color="#4ADE80" />
      <Rig>
        {skills.map((s, i) => (
          <Slab key={s.id ?? i} skill={s} index={i} total={skills.length} explode={explode} hot={hot} onHover={onHover} />
        ))}
      </Rig>
    </>
  );
}

export default function SkillsStack({ skills, hot, onHover }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0.6, 7.4], fov: 38 }} gl={{ alpha: true, antialias: true }}>
      <Scene skills={skills} hot={hot} onHover={onHover} />
    </Canvas>
  );
}
