import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { stage, clamp, outCubic, readPalette } from "./state";

// The name, set in the display face and bent onto a cylinder that stands around
// the portrait. "Dhanush" is the front of that cylinder (in front of the photo);
// "Karthik" is the inside of the back wall (behind it). On load both words swing
// around from the sides and wrap the figure. Each word is a few stacked copies,
// darker toward the back, so it has real thickness when the scene turns.

const FONT = "/fonts/archivo-wide-black.ttf";
const LAYERS = 5;
const STEP = 0.016;

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.round(v * k).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

function Word({ text, color, radius, scale, depthSign, onMeasure, visible, mobile }) {
  const layers = mobile ? 3 : LAYERS;
  return (
    <group scale={scale} visible={visible}>
      {Array.from({ length: layers }, (_, i) => (
        <Text
          key={i}
          font={FONT}
          fontSize={1}
          letterSpacing={-0.045}
          anchorX="center"
          anchorY="middle"
          curveRadius={depthSign * radius / scale}
          position={[0, 0, -i * STEP / scale]}
          color={i === 0 ? color : shade(color, 0.78 - i * 0.1)}
          sdfGlyphSize={128}
          onSync={i === 0 ? (t) => onMeasure?.(t.textRenderInfo?.visibleBounds) : undefined}
        >
          {text}
        </Text>
      ))}
    </group>
  );
}

export default function NameWrap({ first, last, layout, onReady }) {
  const [m, setM] = useState({ a: null, b: null });
  const sent = useRef(false);
  const front = useRef();
  const back = useRef();
  const pal = useMemo(() => readPalette(), []);

  const wa = m.a ? m.a[2] - m.a[0] : 0, ha = m.a ? m.a[3] - m.a[1] : 0;
  const wb = m.b ? m.b[2] - m.b[0] : 0;
  const measured = wa > 0 && wb > 0;
  const widest = Math.max(wa, wb, 1e-3);

  const W = layout.W;
  const maxCap = layout.fh * (layout.mobile ? 0.12 : 0.2);
  const sc = measured ? Math.min((layout.mobile ? 0.82 : 0.78) * W / widest, maxCap / Math.max(ha, 1e-3)) : 1;
  const capH = ha * sc;
  const R = W * (layout.mobile ? 1.1 : 0.85);
  const yFront = layout.top - 0.285 * layout.fh - capH / 2;
  const yBack = yFront - capH * 1.12;
  // On a narrow screen the figure is wider than the word, so "behind" would hide the whole surname.
  const zFront = 0.9, zBack = layout.mobile ? 0.5 : -0.9;

  useFrame(() => {
    if (measured) stage.seam = 0.5 + (yFront + yBack) / 2 / layout.H;
    if (measured && !sent.current) { sent.current = true; onReady?.(); }
    const t = stage.t;
    const ka = outCubic(clamp((t - 1.5) / 1.5));
    const kb = outCubic(clamp((t - 1.2) / 1.5));
    if (front.current) { front.current.rotation.y = -1.62 * (1 - ka); front.current.visible = t > 1.45; }
    if (back.current) { back.current.rotation.y = -1.62 * (1 - kb); back.current.visible = t > 1.15; }
  });

  return (
    <>
      <group ref={back} position={[0, yBack, zBack + R]}>
        <group position={[0, 0, -R]}>
          <Word text={last.toUpperCase()} color={pal.signal} radius={R} scale={sc} depthSign={1} visible={measured} mobile={layout.mobile}
            onMeasure={(b) => b && setM((s) => (s.b && Math.abs(s.b[2] - b[2]) < 1e-4 ? s : { ...s, b }))} />
        </group>
      </group>
      <group ref={front} position={[0, yFront, zFront - R]}>
        <group position={[0, 0, R]}>
          <Word text={first.toUpperCase()} color={pal.signal} radius={R} scale={sc} depthSign={-1} visible={measured} mobile={layout.mobile}
            onMeasure={(b) => b && setM((s) => (s.a && Math.abs(s.a[2] - b[2]) < 1e-4 ? s : { ...s, a: b }))} />
        </group>
      </group>
    </>
  );
}
