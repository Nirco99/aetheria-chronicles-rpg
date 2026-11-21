// Liquid surfaces: animated water with depth colour, shoreline foam, fresnel sky reflection and
// sun glints; flowing emissive lava; and the sea of clouds under the floating Sky Citadel.
import * as THREE from 'three';
import type { TerrainField, TerrainTextures } from './terrain';
import type { DetailLib } from './textures';
import type { Environment } from './env';
import { REALMS } from '../data/realms';
import { TILE } from '../data/constants';
import { WATER_Y, col, shared } from './util3';

const VERT = /* glsl */ `
varying vec3 vWp;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const WATER_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWp;
uniform sampler2D uShore;
uniform sampler2D uNoise;
uniform vec2 uMapPx;
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSky;
uniform vec3 uAmb;
uniform float uRain;
#include <fog_pars_fragment>
void main() {
  vec2 xz = vWp.xz;
  float sh = texture2D(uShore, xz / uMapPx).r;
  float d = (sh - 0.5) * 64.0; // < 0 inside the liquid
  if (d > 4.0) discard;
  float depth = clamp(-d / 24.0, 0.0, 1.0);
  vec2 flow = vec2(uTime * 0.035, uTime * 0.012);
  vec3 n1 = texture2D(uNoise, xz / 190.0 + flow).rgb;
  vec3 n2 = texture2D(uNoise, xz / 83.0 - flow * 1.7 + 0.37).rgb;
  vec4 n3 = texture2D(uNoise, xz / 31.0 + flow * 2.6);
  vec2 slope = (n1.rg - 0.5) * 0.7 + (n2.rg - 0.5) * 0.5 + (vec2(n3.r, n3.a) - 0.5) * (0.22 + uRain * 0.5);
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 V = normalize(cameraPosition - vWp);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
  vec3 body = mix(uShallow, uDeep, pow(depth, 0.65));
  body *= uAmb + uSunCol * max(dot(N, uSunDir), 0.0) * 0.55;
  vec3 refl = uSky * (0.9 + 0.3 * n1.b);
  vec3 c = mix(body, refl, fres * 0.85);
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 260.0);
  float glit = pow(max(dot(N, H), 0.0), 36.0) * step(0.86, n3.b);
  c += uSunCol * (spec * 9.0 + glit * 2.2);
  // shoreline foam: a soft lip and two drifting bands
  float wob = (n2.g - 0.5) * 5.0;
  float lip = smoothstep(4.0, 0.0, -d + wob * 0.4);
  float band1 = smoothstep(1.6, 0.0, abs(-d - 5.5 - wob - sin(uTime * 0.9) * 1.6));
  float band2 = smoothstep(1.2, 0.0, abs(-d - 10.5 - wob * 1.3 - sin(uTime * 0.7 + 2.0) * 2.0)) * 0.5;
  float foam = clamp(lip * 0.85 + (band1 + band2) * step(0.35, n3.g), 0.0, 1.0);
  c = mix(c, (uAmb + uSunCol * 0.8) * vec3(0.92, 0.97, 1.0), foam * 0.85);
  float alpha = mix(0.5, 0.94, pow(depth, 0.5));
  alpha = max(alpha, foam * 0.9);
  alpha = max(alpha, fres);
  alpha *= smoothstep(4.0, 1.0, d);
  gl_FragColor = vec4(c, alpha);
  #include <fog_fragment>
}
`;

const LAVA_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWp;
uniform sampler2D uShore;
uniform sampler2D uNoise;
uniform vec2 uMapPx;
uniform float uTime;
#include <fog_pars_fragment>
void main() {
  vec2 xz = vWp.xz;
  float sh = texture2D(uShore, xz / uMapPx).r;
  float d = (sh - 0.5) * 64.0;
  if (d > 3.0) discard;
  vec2 flow = vec2(uTime * 0.012, uTime * 0.02);
  vec3 a = texture2D(uNoise, xz / 240.0 + flow).rgb;
  vec3 b = texture2D(uNoise, xz / 97.0 - flow * 1.4 + a.rg * 0.12).rgb;
  vec3 cc = texture2D(uNoise, xz / 37.0 + flow * 2.0 + b.rg * 0.2).rgb;
  float crust = smoothstep(0.36, 0.56, a.g * 0.55 + b.g * 0.35 + cc.g * 0.2);
  float cracks = smoothstep(0.55, 0.9, b.b) * 0.8 + smoothstep(0.7, 0.95, cc.b) * 0.5;
  float heat = clamp(1.0 - crust + cracks * crust, 0.0, 1.0);
  heat = max(heat, smoothstep(-5.0, 1.0, d) * 0.7);
  float pulse = 0.85 + 0.15 * sin(uTime * 1.3 + xz.x * 0.02 + xz.y * 0.015);
  vec3 hot = mix(vec3(1.1, 0.14, 0.01), vec3(3.4, 1.3, 0.2), smoothstep(0.35, 1.0, heat));
  vec3 rock = vec3(0.045, 0.022, 0.02) + cc.r * 0.03;
  vec3 c = mix(rock, hot * pulse, smoothstep(0.12, 0.6, heat));
  gl_FragColor = vec4(c, smoothstep(3.0, 0.5, d));
  #include <fog_fragment>
}
`;

const CLOUD_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWp;
uniform sampler2D uNoise;
uniform float uTime;
uniform vec3 uSunCol;
uniform vec3 uSky;
uniform vec3 uAmb;
uniform float uCover;
void main() {
  vec2 xz = vWp.xz;
  vec2 wind = vec2(uTime * 0.006, uTime * 0.0025);
  float a = texture2D(uNoise, xz / 1500.0 + wind).g;
  float b = texture2D(uNoise, xz / 520.0 + wind * 2.1).g;
  float cdet = texture2D(uNoise, xz / 170.0 - wind * 3.0).r;
  float dens = a * 0.6 + b * 0.32 + cdet * 0.14;
  float alpha = smoothstep(uCover, uCover + 0.22, dens);
  float lit = smoothstep(uCover, uCover + 0.5, dens);
  vec3 c = mix(uSky * 0.75 + uAmb * 0.25, uAmb * 0.55 + uSunCol * 0.95 + vec3(0.2), lit);
  gl_FragColor = vec4(c, alpha);
}
`;

export class Liquid {
  readonly group = new THREE.Group();
  private mats: THREE.ShaderMaterial[] = [];
  readonly kind: 'water' | 'lava' | 'void';

  constructor(f: TerrainField, tex: TerrainTextures, lib: DetailLib) {
    const m = f.map;
    this.kind = f.liquidKind;
    const P = REALMS[m.realm].palette;
    const pw = m.w * TILE;
    const ph = m.h * TILE;
    const base = {
      uShore: { value: tex.shore },
      uNoise: { value: lib.noise },
      uMapPx: { value: new THREE.Vector2(pw, ph) },
      uTime: shared.time,
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color(1, 1, 1) },
      uSky: { value: new THREE.Color(0.5, 0.7, 1) },
      uAmb: { value: new THREE.Color(0.4, 0.5, 0.6) },
      uRain: { value: 0 },
    };
    if (this.kind === 'water') {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false, fog: true,
        uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...base, uDeep: { value: col(P.liquidA).clone().multiplyScalar(0.55) }, uShallow: { value: col(P.liquidB).clone().lerp(new THREE.Color(0.25, 0.8, 0.75), 0.35) } },
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph, 1, 1).rotateX(-Math.PI / 2), mat);
      mesh.position.set(pw / 2, WATER_Y, ph / 2);
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.mats.push(mat);
    } else if (this.kind === 'lava') {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: LAVA_FRAG, transparent: true, depthWrite: false, fog: true,
        uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...base },
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph, 1, 1).rotateX(-Math.PI / 2), mat);
      mesh.position.set(pw / 2, WATER_Y, ph / 2);
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.mats.push(mat);
    } else {
      for (const [y, cover, size] of [[-230, 0.36, 9000], [-120, 0.56, 7000]] as [number, number, number][]) {
        const mat = new THREE.ShaderMaterial({
          vertexShader: VERT.replace('#include <fog_pars_vertex>', '').replace('#include <fog_vertex>', ''), fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false,
          uniforms: { ...base, uCover: { value: cover } },
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1).rotateX(-Math.PI / 2), mat);
        mesh.position.set(pw / 2, y, ph / 2);
        mesh.renderOrder = y < -200 ? 1 : 2;
        this.group.add(mesh);
        this.mats.push(mat);
      }
    }
  }

  update(env: Environment): void {
    for (const m of this.mats) {
      const u = m.uniforms;
      (u.uSunDir.value as THREE.Vector3).copy(env.sunDir);
      (u.uSunCol.value as THREE.Color).copy(env.sunColor).multiplyScalar(env.sunIntensity * 0.32);
      (u.uSky.value as THREE.Color).copy(env.skyColor).multiplyScalar(env.hemi.intensity * 1.05);
      (u.uAmb.value as THREE.Color).copy(env.skyColor).multiplyScalar(env.hemi.intensity * 0.6);
      u.uRain.value = env.wet;
    }
  }

  dispose(): void {
    for (const m of this.mats) m.dispose();
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }
}
