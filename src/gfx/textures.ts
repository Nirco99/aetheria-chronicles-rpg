// Procedural PBR detail library. Sixteen tileable materials (grass, soil, cobbles, masonry, bark,
// shingles...) are synthesised on the GPU into two texture arrays the first time the 3D renderer
// starts: A = colour modulation (rgb, 0.5 is neutral) + height, N = tangent normal + roughness + AO.
// Nothing is loaded from disk.
import * as THREE from 'three';

export const LAYER = {
  grass: 0, dirt: 1, sand: 2, cobble: 3, slab: 4, planks: 5, flag: 6, carpet: 7,
  ice: 8, marble: 9, rock: 10, brick: 11, snow: 12, bark: 13, roof: 14, plaster: 15,
} as const;
export const LAYERS = 16;

export interface DetailLib {
  albedo: THREE.Texture;
  normal: THREE.Texture;
  size: number;
  /** small tileable RGBA noise (value / fbm / worley / hash) for shaders */
  noise: THREE.Texture;
  dispose(): void;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const NOISE_LIB = /* glsl */ `
float hash1(vec2 p, float per) { p = mod(p, per); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
vec2 hash2(vec2 p, float per) { p = mod(p, per); return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453123); }
float vnoise(vec2 p, float per) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i, per), hash1(i + vec2(1.0, 0.0), per), f.x), mix(hash1(i + vec2(0.0, 1.0), per), hash1(i + vec2(1.0, 1.0), per), f.x), f.y);
}
float fbm(vec2 p, float per, int oct) {
  float a = 0.5; float s = 0.0; float n = 0.0;
  for (int i = 0; i < 7; i++) { if (i >= oct) break; s += a * vnoise(p, per); n += a; p *= 2.0; per *= 2.0; a *= 0.5; }
  return s / n;
}
float ridged(vec2 p, float per, int oct) {
  float a = 0.5; float s = 0.0; float n = 0.0;
  for (int i = 0; i < 7; i++) { if (i >= oct) break; s += a * (1.0 - abs(vnoise(p, per) * 2.0 - 1.0)); n += a; p *= 2.0; per *= 2.0; a *= 0.5; }
  return s / n;
}
// x = F1, y = F2 - F1 (edge distance), z = cell id
vec3 voro(vec2 p, float per) {
  vec2 i = floor(p); vec2 f = fract(p); float d1 = 9.0; float d2 = 9.0; float id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 o = hash2(i + g, per) * 0.8 + 0.1; vec2 r = g + o - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = hash1(i + g + 17.3, per); } else if (d < d2) { d2 = d; }
  }
  return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), id);
}
`;

const FRAG_A = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform int uL;
${NOISE_LIB}
const float TAU = 6.28318530718;
void main() {
  vec2 uv = vUv;
  vec3 c = vec3(0.5);
  float h = 0.5;
  if (uL == 0) { // grass: soft clumps with fine blade streaks
    float big = fbm(uv * 4.0, 4.0, 4);
    float mid = fbm(uv * 14.0, 14.0, 3);
    float blades = vnoise(vec2(uv.x * 150.0, uv.y * 48.0), 48.0) * 0.6 + vnoise(vec2(uv.x * 90.0 + 30.0, uv.y * 150.0), 30.0) * 0.4;
    c = vec3(0.47, 0.5, 0.44) + (big - 0.5) * vec3(0.22, 0.26, 0.1) + (mid - 0.5) * vec3(0.1, 0.14, 0.04) + (blades - 0.5) * 0.12;
    float dry = smoothstep(0.62, 0.8, fbm(uv * 3.0 + 7.0, 3.0, 3));
    c += dry * vec3(0.06, 0.03, -0.03);
    h = 0.35 + big * 0.2 + blades * 0.4;
  } else if (uL == 1) { // dirt: packed soil with pebbles
    float big = fbm(uv * 5.0, 5.0, 5);
    vec3 v = voro(uv * 22.0, 22.0);
    float pebble = smoothstep(0.16, 0.05, v.x) * step(0.55, v.z);
    float crack = smoothstep(0.03, 0.0, voro(uv * 6.0 + 3.0, 6.0).y) * 0.5;
    c = vec3(0.5, 0.49, 0.47) + (big - 0.5) * 0.3 + pebble * 0.16 - crack * 0.16;
    h = big * 0.6 + pebble * 0.4 - crack * 0.3 + 0.1;
  } else if (uL == 2) { // sand: wind ripples
    float big = fbm(uv * 3.0, 3.0, 4);
    float warp = fbm(uv * 6.0 + 2.0, 6.0, 3);
    float rip = 0.5 + 0.5 * sin((uv.y * 22.0 + warp * 2.6 + uv.x * 3.0) * TAU);
    float grain = hash1(floor(uv * 512.0), 512.0);
    c = vec3(0.5) + (big - 0.5) * 0.14 + (rip - 0.5) * 0.07 + (grain - 0.5) * 0.06;
    h = 0.3 + rip * 0.35 + big * 0.25;
  } else if (uL == 3) { // cobblestones
    vec3 v = voro(uv * 9.0, 9.0);
    float stone = smoothstep(0.02, 0.2, v.y);
    float bump = fbm(uv * 40.0, 40.0, 3);
    vec3 tint = vec3(0.5) + (v.z - 0.5) * vec3(0.26, 0.24, 0.2);
    vec3 mortar = vec3(0.2, 0.22, 0.19);
    c = mix(mortar, tint + (bump - 0.5) * 0.1, stone);
    h = stone * (0.62 + 0.3 * smoothstep(0.0, 0.5, v.y) + bump * 0.08);
  } else if (uL == 4) { // large paving slabs
    vec2 p = uv * 4.0; float row = floor(p.y); p.x += mod(row, 2.0) * 0.5;
    vec2 f = fract(p); vec2 cell = floor(p);
    float d = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    float edge = smoothstep(0.012, 0.06, d);
    float id = hash1(cell, 4.0);
    float n = fbm(uv * 24.0, 24.0, 4);
    float crack = smoothstep(0.02, 0.0, abs(fbm(uv * 5.0 + id * 9.0, 5.0, 3) - 0.5)) * step(0.72, id);
    c = mix(vec3(0.24), vec3(0.5) + (id - 0.5) * 0.16 + (n - 0.5) * 0.14, edge) - crack * 0.14 * edge;
    h = edge * (0.75 + n * 0.12) - crack * 0.2;
  } else if (uL == 5) { // timber planks along X
    float rows = 8.0; float r = floor(uv.y * rows); float fy = fract(uv.y * rows);
    float off = hash1(vec2(r, 3.0), rows);
    float u = uv.x * 2.0 + off; float seg = floor(u); float fx = fract(u);
    float id = hash1(vec2(seg + r * 7.0, r), 64.0);
    float grain = fbm(vec2(uv.x * 10.0 + id * 8.0, uv.y * 110.0), 110.0, 4);
    float gap = smoothstep(0.03, 0.09, fy) * smoothstep(0.03, 0.09, 1.0 - fy) * smoothstep(0.004, 0.02, fx) * smoothstep(0.004, 0.02, 1.0 - fx);
    float nail = smoothstep(0.03, 0.015, length(vec2((fx - 0.06) * 3.0, fy - 0.5)));
    c = mix(vec3(0.17, 0.15, 0.13), vec3(0.5) + (id - 0.5) * 0.2 + (grain - 0.5) * 0.24, gap) - nail * 0.2;
    h = gap * (0.7 + grain * 0.16);
  } else if (uL == 6) { // dungeon flagstones
    vec2 p = uv * 4.0; vec2 f = fract(p); vec2 cell = floor(p);
    float wob = fbm(uv * 16.0, 16.0, 3) * 0.05;
    float d = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) + wob - 0.02;
    float edge = smoothstep(0.01, 0.07, d);
    float id = hash1(cell + 5.0, 4.0);
    float n = fbm(uv * 30.0, 30.0, 4);
    float chip = smoothstep(0.62, 0.8, fbm(uv * 11.0 + 4.0, 11.0, 3)) * (1.0 - smoothstep(0.0, 0.2, d));
    float crack = smoothstep(0.016, 0.0, abs(fbm(uv * 4.0 + id * 5.0, 4.0, 4) - 0.5)) * step(0.5, id);
    c = mix(vec3(0.16), vec3(0.5) + (id - 0.5) * 0.2 + (n - 0.5) * 0.18, edge) - (chip + crack) * 0.12;
    h = edge * (0.7 + n * 0.14) - chip * 0.25 - crack * 0.2;
  } else if (uL == 7) { // woven carpet with a diamond motif
    vec2 p = uv * 4.0; vec2 f = fract(p) - 0.5;
    float dia = abs(f.x) + abs(f.y);
    float motif = smoothstep(0.34, 0.3, dia) - smoothstep(0.2, 0.16, dia) + smoothstep(0.08, 0.05, dia);
    float weave = sin(uv.x * TAU * 96.0) * sin(uv.y * TAU * 96.0);
    float border = smoothstep(0.47, 0.5, max(abs(f.x), abs(f.y)));
    c = vec3(0.5) + motif * vec3(0.2, 0.16, 0.02) + weave * 0.03 + border * vec3(0.18, 0.14, 0.0);
    h = 0.5 + weave * 0.2 + motif * 0.1;
  } else if (uL == 8) { // ice with crack veins
    float big = fbm(uv * 3.0, 3.0, 4);
    vec3 v = voro(uv * 5.0, 5.0);
    float crack = smoothstep(0.035, 0.0, v.y);
    float fine = smoothstep(0.02, 0.0, voro(uv * 13.0 + 2.0, 13.0).y) * 0.5;
    c = vec3(0.48, 0.5, 0.52) + (big - 0.5) * 0.12 + crack * 0.22 + fine * 0.12;
    h = 0.6 - crack * 0.35 - fine * 0.15 + big * 0.08;
  } else if (uL == 9) { // polished marble tiles
    vec2 p = uv * 2.0; vec2 f = fract(p);
    float d = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    float edge = smoothstep(0.004, 0.02, d);
    float w = fbm(uv * 3.0, 3.0, 5);
    float vein = smoothstep(0.06, 0.0, abs(sin((uv.x * 3.0 + uv.y * 2.0 + w * 3.4) * TAU * 0.5)));
    float vein2 = smoothstep(0.03, 0.0, abs(fbm(uv * 7.0 + 3.0, 7.0, 4) - 0.5));
    c = mix(vec3(0.3), vec3(0.52) + (w - 0.5) * 0.08 - vein * 0.12 - vein2 * 0.08, edge);
    h = edge * 0.8 - vein * 0.03;
  } else if (uL == 10) { // rock: ridged strata
    float big = ridged(uv * 3.0, 3.0, 5);
    float fine = ridged(uv * 12.0 + 4.0, 12.0, 4);
    float strata = fbm(vec2(uv.x * 2.0, uv.y * 14.0), 2.0, 3);
    float crack = smoothstep(0.03, 0.0, voro(uv * 6.0, 6.0).y);
    c = vec3(0.5) + (big - 0.5) * 0.3 + (strata - 0.5) * 0.16 + (fine - 0.5) * 0.12 - crack * 0.14;
    h = big * 0.55 + fine * 0.25 + strata * 0.15 - crack * 0.25;
  } else if (uL == 11) { // brick / ashlar masonry
    vec2 p = vec2(uv.x * 4.0, uv.y * 8.0); float row = floor(p.y); p.x += mod(row, 2.0) * 0.5;
    vec2 f = fract(p); vec2 cell = floor(p);
    float wob = fbm(uv * 20.0, 20.0, 3) * 0.04;
    float d = min(min(f.x, 1.0 - f.x) * 2.0, min(f.y, 1.0 - f.y)) + wob - 0.02;
    float edge = smoothstep(0.02, 0.1, d);
    float id = hash1(cell + 3.0, 8.0);
    float n = fbm(uv * 36.0, 36.0, 4);
    c = mix(vec3(0.2, 0.2, 0.19), vec3(0.5) + (id - 0.5) * 0.22 + (n - 0.5) * 0.16, edge);
    h = edge * (0.72 + n * 0.14 + (id - 0.5) * 0.1);
  } else if (uL == 12) { // snow drifts
    float big = fbm(uv * 3.0, 3.0, 5);
    float fine = fbm(uv * 26.0, 26.0, 3);
    float sparkle = step(0.985, hash1(floor(uv * 512.0), 512.0));
    c = vec3(0.49, 0.5, 0.52) + (big - 0.5) * 0.09 + (fine - 0.5) * 0.04 + sparkle * 0.2;
    h = big * 0.7 + fine * 0.12;
  } else if (uL == 13) { // bark: vertical ridges (v = up)
    float r = ridged(vec2(uv.x * 14.0, uv.y * 3.0), 14.0, 4);
    float n = fbm(vec2(uv.x * 30.0, uv.y * 8.0), 30.0, 3);
    c = vec3(0.5) + (r - 0.5) * 0.34 + (n - 0.5) * 0.14;
    h = r * 0.75 + n * 0.15;
  } else if (uL == 14) { // roof shingles (v = down the slope)
    vec2 p = vec2(uv.x * 8.0, uv.y * 8.0); float row = floor(p.y); p.x += mod(row, 2.0) * 0.5;
    vec2 f = fract(p); vec2 cell = floor(p);
    float id = hash1(cell + 11.0, 8.0);
    float lip = smoothstep(0.0, 0.14, 1.0 - f.y);
    float side = smoothstep(0.0, 0.06, f.x) * smoothstep(0.0, 0.06, 1.0 - f.x);
    float round2 = smoothstep(0.0, 0.3, 1.0 - f.y + sin(f.x * 3.14159) * 0.22 - 0.2);
    float n = fbm(uv * 30.0, 30.0, 3);
    c = mix(vec3(0.24), vec3(0.5) + (id - 0.5) * 0.22 + (n - 0.5) * 0.12 - f.y * 0.1, side * lip);
    h = side * round2 * (0.35 + f.y * 0.55);
  } else { // plaster / stucco
    float big = fbm(uv * 4.0, 4.0, 5);
    float fine = fbm(uv * 40.0, 40.0, 3);
    float crack = smoothstep(0.012, 0.0, abs(fbm(uv * 3.0 + 9.0, 3.0, 4) - 0.5)) * step(0.5, fbm(uv * 2.0, 2.0, 2));
    c = vec3(0.5) + (big - 0.5) * 0.1 + (fine - 0.5) * 0.07 - crack * 0.1;
    h = 0.55 + big * 0.2 + fine * 0.12 - crack * 0.3;
  }
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), clamp(h, 0.0, 1.0));
}
`;

const FRAG_N = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
varying vec2 vUv;
uniform sampler2DArray uSrc;
uniform float uL;
uniform float uTexel;
uniform float uStrength;
uniform float uRough;
void main() {
  float e = uTexel;
  float hl = texture(uSrc, vec3(vUv - vec2(e, 0.0), uL)).a;
  float hr = texture(uSrc, vec3(vUv + vec2(e, 0.0), uL)).a;
  float hd = texture(uSrc, vec3(vUv - vec2(0.0, e), uL)).a;
  float hu = texture(uSrc, vec3(vUv + vec2(0.0, e), uL)).a;
  float hc = texture(uSrc, vec3(vUv, uL)).a;
  vec2 n = clamp(vec2(hr - hl, hu - hd) * uStrength, -1.0, 1.0);
  float avg = (hl + hr + hd + hu) * 0.25;
  float cavity = clamp(0.5 + (hc - avg) * 6.0, 0.0, 1.0);
  float ao = clamp(0.35 + hc * 0.9, 0.0, 1.0) * mix(0.8, 1.0, cavity);
  float rough = clamp(uRough + (0.5 - hc) * 0.25, 0.05, 1.0);
  gl_FragColor = vec4(n * 0.5 + 0.5, rough, ao);
}
`;

const FRAG_NOISE = /* glsl */ `
precision highp float;
varying vec2 vUv;
${NOISE_LIB}
void main() {
  vec2 uv = vUv;
  float v = vnoise(uv * 8.0, 8.0);
  float f = fbm(uv * 4.0, 4.0, 6);
  vec3 w = voro(uv * 6.0, 6.0);
  float hi = hash1(floor(uv * 256.0), 256.0);
  gl_FragColor = vec4(v, f, 1.0 - clamp(w.x * 1.4, 0.0, 1.0), hi);
}
`;

/** per-layer normal strength and base roughness */
const LAYER_PARAMS: [number, number][] = [
  [3.0, 0.92], [4.5, 0.95], [2.6, 0.9], [7.0, 0.74], [5.0, 0.6], [5.0, 0.72], [6.0, 0.68], [2.0, 0.97],
  [3.0, 0.1], [2.0, 0.16], [8.0, 0.88], [6.5, 0.82], [2.0, 0.55], [8.0, 0.92], [7.0, 0.78], [2.2, 0.9],
];

export function buildDetailLib(renderer: THREE.WebGLRenderer, size: number): DetailLib {
  const mk = (): THREE.WebGLArrayRenderTarget => {
    const rt = new THREE.WebGLArrayRenderTarget(size, size, LAYERS, { depthBuffer: false });
    const t = rt.texture;
    t.format = THREE.RGBAFormat;
    t.type = THREE.UnsignedByteType;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.colorSpace = THREE.NoColorSpace;
    return rt;
  };
  const rtA = mk();
  const rtN = mk();
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);
  const prevTarget = renderer.getRenderTarget();
  const prevAuto = renderer.autoClear;
  renderer.autoClear = true;
  const matA = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_A, uniforms: { uL: { value: 0 } }, depthTest: false, depthWrite: false });
  quad.material = matA;
  for (let l = 0; l < LAYERS; l++) {
    matA.uniforms.uL.value = l;
    renderer.setRenderTarget(rtA, l);
    renderer.render(scene, cam);
  }
  const matN = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG_N, depthTest: false, depthWrite: false,
    uniforms: { uSrc: { value: rtA.texture }, uL: { value: 0 }, uTexel: { value: 1 / size }, uStrength: { value: 4 }, uRough: { value: 0.8 } },
  });
  quad.material = matN;
  for (let l = 0; l < LAYERS; l++) {
    matN.uniforms.uL.value = l;
    matN.uniforms.uStrength.value = LAYER_PARAMS[l][0] * (size / 512);
    matN.uniforms.uRough.value = LAYER_PARAMS[l][1];
    renderer.setRenderTarget(rtN, l);
    renderer.render(scene, cam);
  }
  // shader noise atlas
  const rtNoise = new THREE.WebGLRenderTarget(256, 256, { depthBuffer: false });
  rtNoise.texture.wrapS = rtNoise.texture.wrapT = THREE.RepeatWrapping;
  rtNoise.texture.minFilter = THREE.LinearMipmapLinearFilter;
  rtNoise.texture.magFilter = THREE.LinearFilter;
  rtNoise.texture.generateMipmaps = true;
  rtNoise.texture.colorSpace = THREE.NoColorSpace;
  const matNoise = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_NOISE, depthTest: false, depthWrite: false });
  quad.material = matNoise;
  renderer.setRenderTarget(rtNoise);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prevTarget);
  renderer.autoClear = prevAuto;
  matA.dispose();
  matN.dispose();
  matNoise.dispose();
  quad.geometry.dispose();
  return {
    albedo: rtA.texture,
    normal: rtN.texture,
    noise: rtNoise.texture,
    size,
    dispose: () => {
      rtA.dispose();
      rtN.dispose();
      rtNoise.dispose();
    },
  };
}

// ---------------------------------------------------------------------------------- canvas helpers

/** soft radial sprite used by particles, light pools and glows */
export function radialTexture(size = 128, power = 2): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const d = Math.min(1, Math.hypot(dx, dy) * 2);
      const a = Math.pow(1 - d, power);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function canvasTexture(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}
