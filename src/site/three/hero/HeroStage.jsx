import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { pointer } from "../../lib/pointer";
import { intro, setIntro, introTime } from "../../lib/intro";
import * as audio from "../../lib/audio";
import { stage, clamp, smooth, heroLayout } from "./state";
import { PaperRip } from "./rip";
import Paper from "./Paper";
import Portrait from "./Portrait";
import NameWrap from "./NameWrap";
import Floaters from "./Floaters";
import Ribbon from "./Ribbon";

// The whole hero is one WebGL scene (page background, 3D name, portrait,
// floating objects, ribbons). It is rendered into a texture every frame; a
// second pass draws that texture on two sheets of paper that can tear apart.
// Scroll progress (stage.p) drives the tear; the intro clock (stage.t) drives
// the boot → paper hand-off and everything popping in.

const CAM_Z = 10, FOV = 30;

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error("[hero stage]", err); this.props.onFail?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Pipeline({ children }) {
  const { gl, size, camera, setDpr } = useThree();
  const dpr = useThree((s) => s.viewport.dpr);
  const heroScene = useMemo(() => new THREE.Scene(), []);
  const rip = useMemo(() => new PaperRip(), []);
  const rt = useMemo(() => {
    const half = gl.capabilities.isWebGL2 && (gl.extensions.has("EXT_color_buffer_float") || gl.extensions.has("EXT_color_buffer_half_float"));
    return new THREE.WebGLRenderTarget(size.width, size.height, { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 4, depthBuffer: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);
  const fired = useRef({});
  const prevTt = useRef(0);
  const smoothSpeed = useRef(0);
  const perf = useRef({ acc: 0, n: 0 });

  useEffect(() => {
    const v = gl.getDrawingBufferSize(new THREE.Vector2());
    rt.setSize(v.x, v.y);
    rip.resize(size.width, size.height);
  }, [size, dpr, gl, rt, rip]);

  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    heroScene.environment = env;
    heroScene.environmentIntensity = 0.85;
    pm.dispose();
    return () => { env.dispose(); heroScene.environment = null; };
  }, [gl, heroScene]);

  useEffect(() => () => { rt.dispose(); rip.dispose(); }, [rt, rip]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    // Render at up to 2x for a crisp photo and type; step the resolution down if the GPU can't keep up.
    const pf = perf.current;
    if (intro.played && document.visibilityState === "visible") {
      pf.acc += dtRaw; pf.n++;
      if (pf.n >= 90) {
        const cur = gl.getPixelRatio();
        if (pf.acc / pf.n > 0.026 && cur > 1) setDpr(Math.max(1, cur - 0.5));
        pf.acc = 0; pf.n = 0;
      }
    }
    const t = introTime();
    stage.t = t;
    const f = fired.current;
    if (!intro.played) {
      if (t > 0.05 && !f.flood) { f.flood = true; audio.flood(); }
      if (t > 0.9 && !f.pop) { f.pop = true; audio.pop(); }
      if (t > 1.25 && !f.s1) { f.s1 = true; audio.swoosh(); }
      if (t > 1.5 && !f.s2) { f.s2 = true; audio.swoosh(); }
      if (t > 2.0 && !intro.overlayIn) setIntro({ overlayIn: true });
      if (t > 4.5) intro.played = true;
    } else if (!intro.overlayIn) setIntro({ overlayIn: true });

    const p = stage.p;
    const tt = clamp((p - 0.1) / 0.68);
    stage.tear = tt;

    // sound follows how fast the paper is being pulled
    const speed = Math.min(1, (Math.abs(tt - prevTt.current) / Math.max(dt, 1e-3)) * 1.1);
    smoothSpeed.current += (speed - smoothSpeed.current) * Math.min(1, dt * 14);
    if (tt > 0.012 && prevTt.current <= 0.012) audio.crack();
    if (tt > 0.004 && tt < 0.97 && smoothSpeed.current > 0.03) audio.rip(smoothSpeed.current, dt);
    else audio.ripEnd();
    prevTt.current = tt;

    camera.position.z = CAM_Z - 1.5 * smooth(0, 0.14, p);

    gl.setRenderTarget(rt);
    gl.clear();
    gl.render(heroScene, camera);
    gl.setRenderTarget(null);
    gl.clear();
    rip.update(tt, dt, rt.texture, stage.seam);
    gl.render(rip.scene, rip.camera);
  }, 1);

  return createPortal(children, heroScene);
}

function Scene({ items, cutout, first, last }) {
  const { size } = useThree();
  const rig = useRef();
  const bits = useRef({ portrait: false, name: false, frames: 0, sent: false });

  const layout = useMemo(() => {
    const H = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    return heroLayout({ width: H * (size.width / size.height), height: H }, size);
  }, [size]);

  useFrame((_, dt) => {
    const r = rig.current;
    if (r) {
      const e = 1 - Math.exp(-dt * 3.5);
      r.rotation.y += (pointer.x * 0.07 - r.rotation.y) * e;
      r.rotation.x += (-pointer.y * 0.03 - r.rotation.x) * e;
    }
    const b = bits.current;
    b.frames++;
    if (!b.sent && b.portrait && b.name && b.frames > 4) { b.sent = true; setIntro({ stageReady: true }); }
  });

  return (
    <>
      <Paper />
      <ambientLight intensity={0.5} />
      <directionalLight position={[-3, 4, 5]} intensity={1.7} />
      <group ref={rig}>
        <Suspense fallback={null}>
          <Portrait url={cutout} layout={layout} onLoaded={() => { bits.current.portrait = true; }} />
        </Suspense>
        <NameWrap first={first} last={last} layout={layout} onReady={() => { bits.current.name = true; }} />
        <Floaters layout={layout} rig={rig} />
        <Ribbon items={items} layout={layout} />
      </group>
    </>
  );
}

export default function HeroStage({ items, cutout, first, last, paused, onFail }) {
  return (
    <Boundary onFail={onFail}>
      <Canvas
        flat
        dpr={[1, 2]}
        frameloop={paused ? "never" : "always"}
        camera={{ position: [0, 0, CAM_Z], fov: FOV, near: 0.1, far: 80 }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0, touchAction: "pan-y" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          // If the GPU drops the context and it does not come back, fall back to the flat hero.
          let timer = 0;
          gl.domElement.addEventListener("webglcontextlost", () => { timer = setTimeout(() => onFail?.(), 4000); });
          gl.domElement.addEventListener("webglcontextrestored", () => clearTimeout(timer));
        }}
      >
        <Pipeline>
          <Scene items={items} cutout={cutout} first={first} last={last} />
        </Pipeline>
      </Canvas>
    </Boundary>
  );
}
