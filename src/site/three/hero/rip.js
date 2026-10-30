import * as THREE from "three";
import { clamp, smooth } from "./state";

// The hero page is rendered to a texture, then drawn on two sheets of "paper" that
// tear apart along a ragged seam. This file is the paper: fibrous torn edges
// (white core fibres peeking out past the printed layer), a roll-curl in the
// vertex shader, a paper-back with the print ghosting through, a soft shadow
// per half, and flecks of paper flying off the seam.
// Units: css pixels, origin at the screen centre, y up.

const COMMON = /* glsl */ `
uniform vec2 uRes;
uniform vec2 uSeam;
uniform float uSide;
`;

const vert = /* glsl */ `
${COMMON}
uniform float uInvR;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec2 p = position.xy * uRes;
  vec2 p0 = vec2(-0.5 * uRes.x, (uSeam.x - 0.5) * uRes.y);
  vec2 p1 = vec2( 0.5 * uRes.x, (uSeam.y - 0.5) * uRes.y);
  vec2 dir = normalize(p1 - p0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float dd = dot(p - p0, nrm);
  float q = dd * uSide;
  vec2 foot = p - nrm * dd;
  vec2 along = nrm * uSide;
  vec3 pos = vec3(p, 0.0);
  if (q > 0.0 && uInvR > 1e-5) {
    float R = 1.0 / uInvR;
    float th = q * uInvR;
    float thc = min(th, 3.14159);
    float extra = max(th - 3.14159, 0.0) * R;
    pos.xy = foot + along * (R * sin(thc) - extra);
    pos.z = R * (1.0 - cos(thc));
  }
  vec4 w = modelMatrix * vec4(pos, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const frag = /* glsl */ `
precision highp float;
${COMMON}
uniform sampler2D uTex;
uniform float uOpen, uSeed, uWhole, uShadow, uBlur, uShadowA;
varying vec2 vUv;
varying vec3 vWorld;

float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }
float fbm1(float x) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n1(x); x = x * 2.03 + 11.7; a *= 0.5; } return s; }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm2(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.07 + 5.3; a *= 0.5; } return s; }
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }

void main() {
  float xpx = vUv.x * uRes.x, ypx = vUv.y * uRes.y;
  float line = mix(uSeam.x, uSeam.y, vUv.x) * uRes.y;
  float jag = (fbm1(xpx / 110.0 + uSeed) - 0.5) * 84.0
            + (fbm1(xpx / 19.0 + uSeed * 3.0) - 0.5) * 18.0
            + (n1(xpx / 4.7 + uSeed * 7.0) - 0.5) * 5.0;
  float sd = (ypx - (line + jag)) * uSide;

  if (uShadow > 0.5) {
    // Cast shadow: only the broad swell of the edge, no fibres, so the blur stays smooth.
    float sdS = (ypx - (line + (fbm1(xpx / 110.0 + uSeed) - 0.5) * 84.0)) * uSide;
    float m = smoothstep(-uBlur, uBlur * 0.35, sdS);
    gl_FragColor = vec4(0.0, 0.0, 0.0, m * uShadowA);
    #include <colorspace_fragment>
    return;
  }

  // How far the white fibres reach past the printed layer, per half.
  float fw = (2.0 + fbm1(xpx / 26.0 + uSeed * 5.1) * 13.0 + pow(n1(xpx / 58.0 + uSeed * 9.0), 5.0) * 34.0) * uOpen;
  float rag = fbm2(vec2(xpx, ypx) * 0.38 + uSeed * 11.0);
  float outer = smoothstep(-0.8, 0.8, sd - rag * 4.5 * uOpen + 0.5 * uOpen);
  float alpha = mix(outer, 1.0, uWhole);

  vec3 print = texture2D(uTex, vUv).rgb;
  float lift = (1.0 - smoothstep(fw, fw + 5.0 + 5.0 * n1(xpx / 9.0), sd)) * uOpen;
  print = mix(print, lin(vec3(0.955, 0.94, 0.9)), lift * 0.45);

  float fib = fbm2(vec2(xpx * 0.33, sd * 0.9) + uSeed * 3.0);
  float hair = smoothstep(0.62, 0.9, n2(vec2(xpx * 0.7, sd * 0.2) + uSeed * 5.0));
  vec3 fcol = mix(lin(vec3(0.86, 0.83, 0.77)), lin(vec3(0.985, 0.975, 0.94)), fib);
  fcol = mix(fcol, lin(vec3(0.76, 0.72, 0.65)), hair * 0.35);
  fcol *= 0.9 + 0.12 * (1.0 - smoothstep(0.0, max(fw, 1.0), sd));

  float pm = mix(smoothstep(fw - 0.7, fw + 0.7, sd), 1.0, uWhole);
  vec3 col = mix(fcol, print, pm);

  if (!gl_FrontFacing) {
    vec3 back = lin(vec3(0.925, 0.91, 0.875)) * (0.93 + 0.07 * fbm2(vec2(xpx, ypx) * 0.05));
    float lum = dot(print, vec3(0.3, 0.59, 0.11));
    back = mix(back, back * (0.72 + 0.28 * lum), 0.22);
    col = mix(back, fcol, 1.0 - pm);
  }

  vec3 N = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  vec3 L = normalize(vec3(-0.35, 0.55, 0.75));
  float dif = max(dot(N, L), 0.0);
  float sheen = pow(max(dot(reflect(-L, N), V), 0.0), 24.0) * 0.05 * uOpen;
  col = col * (0.62 + 0.5 * dif) + sheen;

  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

const pvert = /* glsl */ `
attribute float aSize;
attribute float aLife;
attribute float aSeed;
varying float vLife;
varying float vSeed;
void main() {
  vLife = aLife; vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (1000.0 / -mv.z) * aLife;
  gl_Position = projectionMatrix * mv;
}
`;

const pfrag = /* glsl */ `
precision highp float;
varying float vLife;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = atan(c.y, c.x) + vSeed * 6.28;
  float r = length(c) * 2.0;
  float shape = 0.62 + 0.3 * sin(a * 3.0 + vSeed * 9.0) + 0.14 * sin(a * 7.0);
  float m = smoothstep(shape, shape - 0.12, r);
  if (m < 0.02) discard;
  vec3 col = pow(vec3(0.95, 0.93, 0.88), vec3(2.2));
  gl_FragColor = vec4(col * (0.85 + 0.15 * vSeed), m * clamp(vLife * 1.6, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

const MAX = 260;

export class PaperRip {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 10, 8000);
    this.res = new THREE.Vector2(1, 1);
    this.seam = new THREE.Vector2(0.46, 0.54);
    this.shared = {
      uTex: { value: null },
      uRes: { value: this.res },
      uSeam: { value: this.seam },
      uOpen: { value: 0 },
    };
    const geo = new THREE.PlaneGeometry(1, 1, 90, 56);
    const mat = (side, seed, extra = {}) => new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        ...this.shared,
        uSide: { value: side }, uSeed: { value: seed }, uWhole: { value: 0 }, uInvR: { value: 0 },
        uShadow: { value: 0 }, uBlur: { value: 20 }, uShadowA: { value: 0.4 },
      },
      side: THREE.DoubleSide,
      transparent: true,
      ...extra,
    });
    // The halves never need a depth test against each other: the lower sheet is a whole
    // page for the first few frames, and a depth test let it hide the upper half
    // (a tilt of a fraction of a degree puts its top edge in front). Draw order decides.
    this.upper = new THREE.Mesh(geo, mat(1, 1.7, { depthTest: false, depthWrite: false }));
    this.lower = new THREE.Mesh(geo, mat(-1, 6.3, { depthTest: false, depthWrite: false }));
    this.shUp = new THREE.Mesh(geo, mat(1, 1.7, { depthTest: false, depthWrite: false }));
    this.shLo = new THREE.Mesh(geo, mat(-1, 6.3, { depthTest: false, depthWrite: false }));
    this.shUp.material.uniforms.uShadow.value = 1;
    this.shLo.material.uniforms.uShadow.value = 1;
    this.shUp.renderOrder = 0; this.shLo.renderOrder = 0;
    this.lower.renderOrder = 1; this.upper.renderOrder = 2;
    [this.shUp, this.shLo, this.lower, this.upper].forEach((m) => { m.frustumCulled = false; this.scene.add(m); });

    // paper flecks
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.life = new Float32Array(MAX);
    this.seed = new Float32Array(MAX);
    this.ttl = new Float32Array(MAX);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    g.setAttribute("aLife", new THREE.BufferAttribute(this.life, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(this.seed, 1));
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: pvert, fragmentShader: pfrag, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.scene.add(this.points);
    this.cursor = 0;
    this.prevTt = 0;
    this.spawnAcc = 0;
  }

  resize(w, h) {
    this.res.set(w, h);
    this.camera.aspect = w / h;
    const d = (h / 2) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camera.position.set(0, 0, d);
    this.camera.far = d * 6;
    this.camera.updateProjectionMatrix();
  }

  // Tear progress tt: 0 = whole sheet, 1 = both halves gone.
  update(tt, dt, tex, seamY) {
    const W = this.res.x, H = this.res.y;
    this.shared.uTex.value = tex;
    this.seam.set(seamY - 0.035, seamY + 0.04);
    const whole = tt <= 0.0005;
    this.upper.visible = tt < 0.995;
    this.lower.visible = !whole && tt < 0.995;
    this.shUp.visible = this.shLo.visible = !whole && tt < 0.99;

    const c = smooth(0, 0.34, tt);
    const f = Math.pow(smooth(0.18, 1.0, tt), 1.55);
    this.shared.uOpen.value = smooth(0, 0.05, tt);
    this.upper.material.uniforms.uWhole.value = whole ? 1 : 0;
    this.lower.material.uniforms.uWhole.value = whole ? 1 : 1 - smooth(0, 0.07, tt);
    const invR = (a) => a / 360 + (1 - a) / 90000;
    const uInvR = invR(smooth(0, 0.6, tt) * 0.92 + c * 0.08);
    this.upper.material.uniforms.uInvR.value = uInvR;
    this.lower.material.uniforms.uInvR.value = uInvR * 0.8;

    // Upper half peels up and back; lower half drops toward the viewer.
    this.upper.position.set(-W * (0.014 * c + 0.16 * f), H * (0.03 * c + 1.1 * f), 70 * c + 240 * f);
    this.upper.rotation.set(-(0.2 * c + 0.7 * f), 0.06 * f, 0.03 * c + 0.34 * f);
    this.lower.position.set(W * (0.012 * c + 0.13 * f), -H * (0.035 * c + 1.2 * f), 110 * c + 430 * f);
    this.lower.rotation.set(0.22 * c + 0.58 * f, -0.05 * f, -(0.03 * c + 0.3 * f));
    this.lower.position.z -= 0.4;

    // Shadows are flat and ride just behind their half, pushed a little into the gap.
    // (Curling them with the paper stretched the blur into dark streaks.)
    const blur = 12 + 40 * (c * 0.7 + f * 0.8);
    const push = 6 + 34 * c + 70 * f;
    [[this.shUp, this.upper, -1], [this.shLo, this.lower, 1]].forEach(([sh, src, dir]) => {
      sh.position.set(src.position.x, src.position.y + dir * push, src.position.z - 5);
      sh.rotation.set(0, 0, src.rotation.z);
      sh.material.uniforms.uInvR.value = 0;
      sh.material.uniforms.uBlur.value = blur;
      sh.material.uniforms.uShadowA.value = 0.3 * (1 - smooth(0.45, 0.9, tt)) * smooth(0, 0.05, tt);
    });

    this.fleck(tt, dt, W, H, seamY);
    this.prevTt = tt;
  }

  fleck(tt, dt, W, H, seamY) {
    const speed = Math.abs(tt - this.prevTt) / Math.max(dt, 1e-3);
    if (tt > 0.004 && tt < 0.9) {
      this.spawnAcc += Math.min(1.2, speed) * dt * 150;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        const i = this.cursor++ % MAX;
        const u = Math.random();
        const x = (u - 0.5) * W;
        const y = (seamY - 0.5 + 0.075 * (u - 0.5) + 0.0025) * H + (Math.random() - 0.5) * 24;
        this.pos.set([x, y, (Math.random() - 0.3) * 60], i * 3);
        this.vel.set([(Math.random() - 0.5) * 260, (Math.random() - 0.35) * 300, (Math.random() - 0.2) * 320], i * 3);
        this.size[i] = 3 + Math.random() * 9;
        this.seed[i] = Math.random();
        this.ttl[i] = 1.4 + Math.random() * 1.2;
        this.life[i] = 1;
      }
    }
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.ttl[i] -= dt;
      if (this.ttl[i] <= 0) { this.life[i] = 0; continue; }
      this.life[i] = Math.min(1, this.ttl[i]);
      const o = i * 3;
      this.vel[o + 1] -= 260 * dt;
      this.vel[o] *= 1 - dt * 0.8; this.vel[o + 2] *= 1 - dt * 0.8;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.aLife.needsUpdate = a.aSize.needsUpdate = a.aSeed.needsUpdate = true;
  }

  dispose() {
    [this.upper, this.lower, this.shUp, this.shLo].forEach((m) => m.material.dispose());
    this.upper.geometry.dispose();
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

export { clamp };
