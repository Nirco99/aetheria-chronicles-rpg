// Post-processing stack of the 3D renderer: HDR scene -> ambient occlusion -> ray-marched
// volumetric light shafts -> bloom -> depth of field -> filmic grade (ACES, split toning, vignette,
// grain, impact aberration) -> anti-aliasing.
import * as THREE from 'three';
import {
  BlendFunction, BloomEffect, ChromaticAberrationEffect, DepthOfFieldEffect, Effect, EffectAttribute, EffectComposer, EffectPass, FXAAEffect,
  RenderPass, SMAAEffect, SMAAPreset, TiltShiftEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import type { Quality } from './quality';
import type { Environment } from './env';

const VOLUMETRIC_FRAG = /* glsl */ `
uniform mat4 uProjInv;
uniform mat4 uViewInv;
uniform mat4 uShadowMat;
uniform highp sampler2DShadow uShadowMap;
uniform sampler2D uNoise;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uFogCol;
uniform float uDensity;
uniform float uFogTop;
uniform float uTimeV;
uniform float uShafts;
uniform float uShadowOn;
float hgPhase(float c, float g) { float g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 vp = uProjInv * ndc;
  vp /= vp.w;
  vec3 wp = (uViewInv * vec4(vp.xyz, 1.0)).xyz;
  vec3 ray = wp - uCamPos;
  float len = min(length(ray), 4000.0);
  vec3 dir = normalize(ray);
  float t0 = 0.0;
  if (dir.y < -0.0001) t0 = clamp((uFogTop - uCamPos.y) / dir.y, 0.0, len);
  float span = len - t0;
  float dt = span / float(VOL_STEPS);
  vec3 p = uCamPos + dir * (t0 + dt * ign(uv * resolution));
  vec3 stepV = dir * dt;
  float trans = 1.0;
  vec3 scat = vec3(0.0);
  float phase = hgPhase(dot(dir, uSunDir), 0.5) * 16.0 + 0.5;
  for (int i = 0; i < VOL_STEPS; i++) {
    float hgt = clamp((uFogTop - p.y) / uFogTop, 0.0, 1.0);
    float n = texture2D(uNoise, p.xz / 520.0 + vec2(uTimeV * 0.012, uTimeV * 0.005)).g;
    float dens = uDensity * hgt * (0.45 + 1.1 * n);
    float lit = 1.0;
    if (uShadowOn > 0.5) {
      vec4 sc = uShadowMat * vec4(p, 1.0);
      vec3 sp = sc.xyz / sc.w;
      if (sp.x > 0.001 && sp.x < 0.999 && sp.y > 0.001 && sp.y < 0.999 && sp.z < 1.0) lit = texture(uShadowMap, vec3(sp.xy, sp.z - 0.0015));
    }
    vec3 li = uSunCol * (lit * phase * uShafts * 2.2) + uFogCol * 0.6;
    float a = 1.0 - exp(-dens * dt);
    scat += trans * a * li;
    trans *= 1.0 - a;
    p += stepV;
  }
  outputColor = vec4(inputColor.rgb * trans + scat, inputColor.a);
}
`;

class VolumetricEffect extends Effect {
  constructor(steps: number, noise: THREE.Texture) {
    super('VolumetricEffect', VOLUMETRIC_FRAG, {
      blendFunction: BlendFunction.SET,
      attributes: EffectAttribute.DEPTH,
      defines: new Map([['VOL_STEPS', String(steps)]]),
      uniforms: new Map<string, THREE.Uniform>([
        ['uProjInv', new THREE.Uniform(new THREE.Matrix4())],
        ['uViewInv', new THREE.Uniform(new THREE.Matrix4())],
        ['uShadowMat', new THREE.Uniform(new THREE.Matrix4())],
        ['uShadowMap', new THREE.Uniform(null)],
        ['uNoise', new THREE.Uniform(noise)],
        ['uCamPos', new THREE.Uniform(new THREE.Vector3())],
        ['uSunDir', new THREE.Uniform(new THREE.Vector3(0, 1, 0))],
        ['uSunCol', new THREE.Uniform(new THREE.Color())],
        ['uFogCol', new THREE.Uniform(new THREE.Color())],
        ['uDensity', new THREE.Uniform(0.001)],
        ['uFogTop', new THREE.Uniform(150)],
        ['uTimeV', new THREE.Uniform(0)],
        ['uShafts', new THREE.Uniform(1)],
        ['uShadowOn', new THREE.Uniform(0)],
      ]),
    });
  }
}

const GRADE_FRAG = /* glsl */ `
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uVignette;
uniform float uGrain;
uniform float uTimeG;
uniform vec3 uTintLo;
uniform vec3 uTintHi;
uniform vec4 uFade;
uniform float uHurt;
vec3 acesFit(vec3 x) {
  const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float gradeHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, 0.0) * uExposure;
  c = acesFit(c * 0.58);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c = (c - 0.5) * uContrast + 0.5;
  c *= mix(uTintLo, uTintHi, smoothstep(0.0, 0.9, l));
  vec2 q = (uv - 0.5) * vec2(1.0, 0.88);
  float vg = smoothstep(0.92, 0.28, length(q));
  c *= mix(1.0 - uVignette, 1.0, vg);
  c = mix(c, vec3(0.75, 0.02, 0.05) * (0.4 + l), uHurt * (1.0 - vg));
  c += (gradeHash(uv * resolution + fract(uTimeG) * 61.0) - 0.5) * uGrain;
  c = mix(c, uFade.rgb, uFade.a);
  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}
`;

class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', GRADE_FRAG, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map<string, THREE.Uniform>([
        ['uExposure', new THREE.Uniform(1)],
        ['uContrast', new THREE.Uniform(1.06)],
        ['uSaturation', new THREE.Uniform(1.02)],
        ['uVignette', new THREE.Uniform(0.32)],
        ['uGrain', new THREE.Uniform(0.022)],
        ['uTimeG', new THREE.Uniform(0)],
        ['uTintLo', new THREE.Uniform(new THREE.Color(0.96, 0.99, 1.06))],
        ['uTintHi', new THREE.Uniform(new THREE.Color(1.04, 1.01, 0.96))],
        ['uFade', new THREE.Uniform(new THREE.Vector4(0, 0, 0, 0))],
        ['uHurt', new THREE.Uniform(0)],
      ]),
    });
  }
}

export interface LookParams {
  contrast: number;
  saturation: number;
  vignette: number;
  tintLo: [number, number, number];
  tintHi: [number, number, number];
  bloom: number;
}

export class PostFX {
  readonly composer: EffectComposer;
  private vol: VolumetricEffect | null = null;
  private bloom: BloomEffect | null = null;
  private dof: DepthOfFieldEffect | null = null;
  private tilt: TiltShiftEffect | null = null;
  private ca: ChromaticAberrationEffect;
  private grade: GradeEffect;
  private ao: N8AOPostPass | null = null;
  /** world-space point the depth of field focuses on */
  readonly focus = new THREE.Vector3();
  /** impact pulse 0..1 (chromatic aberration + shake accent) */
  impact = 0;
  hurt = 0;
  readonly fade = new THREE.Vector4(0, 0, 0, 0);
  /** extra blur for menus / cinematic title */
  dofBoost = 0;
  /** depth (world units) over which the depth of field goes from sharp to fully blurred */
  focusRange = 260;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, private camera: THREE.PerspectiveCamera, readonly q: Quality, noise: THREE.Texture) {
    const half = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    this.composer = new EffectComposer(renderer, { frameBufferType: half ? THREE.HalfFloatType : THREE.UnsignedByteType, multisampling: q.msaa });
    this.composer.addPass(new RenderPass(scene, camera));
    if (q.ao > 0) {
      const ao = new N8AOPostPass(scene, camera, 1, 1);
      ao.configuration.aoRadius = 15;
      ao.configuration.distanceFalloff = 1.1;
      ao.configuration.intensity = q.ao > 1 ? 3.4 : 2.8;
      ao.configuration.color = new THREE.Color(0.02, 0.03, 0.06);
      ao.configuration.halfRes = q.ao < 2;
      ao.configuration.depthAwareUpsampling = true;
      ao.setQualityMode(q.ao > 1 ? 'High' : 'Low');
      this.composer.addPass(ao);
      this.ao = ao;
    }
    const first: Effect[] = [];
    if (q.volumetric > 0) {
      this.vol = new VolumetricEffect(q.volumetric, noise);
      first.push(this.vol);
    }
    if (q.bloom) {
      this.bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.0, luminanceSmoothing: 0.35, intensity: 0.85, radius: 0.74, levels: q.id === 'low' ? 5 : 7 });
      first.push(this.bloom);
    }
    if (first.length) this.composer.addPass(new EffectPass(camera, ...first));
    if (q.dof === 2) {
      this.dof = new DepthOfFieldEffect(camera, { worldFocusDistance: 600, worldFocusRange: 260, bokehScale: 3.2, resolutionScale: q.id === 'high' ? 0.5 : 0.75 });
      this.dof.target = this.focus;
      this.composer.addPass(new EffectPass(camera, this.dof));
    } else if (q.dof === 1) {
      this.tilt = new TiltShiftEffect({ offset: 0.06, focusArea: 0.62, feather: 0.36, resolutionScale: 0.5 });
      this.composer.addPass(new EffectPass(camera, this.tilt));
    }
    this.ca = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0006), radialModulation: true, modulationOffset: 0.2 });
    this.grade = new GradeEffect();
    this.composer.addPass(new EffectPass(camera, this.ca, this.grade));
    if (q.msaa === 0) this.composer.addPass(new EffectPass(camera, q.smaa ? new SMAAEffect({ preset: SMAAPreset.HIGH }) : new FXAAEffect()));
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h, false);
  }

  setLook(l: LookParams): void {
    const u = this.grade.uniforms;
    (u.get('uContrast') as THREE.Uniform).value = l.contrast;
    (u.get('uSaturation') as THREE.Uniform).value = l.saturation;
    (u.get('uVignette') as THREE.Uniform).value = l.vignette;
    ((u.get('uTintLo') as THREE.Uniform).value as THREE.Color).setRGB(l.tintLo[0], l.tintLo[1], l.tintLo[2]);
    ((u.get('uTintHi') as THREE.Uniform).value as THREE.Color).setRGB(l.tintHi[0], l.tintHi[1], l.tintHi[2]);
    if (this.bloom) this.bloom.intensity = l.bloom;
  }

  render(dt: number, env: Environment, time: number): void {
    const cam = this.camera;
    if (this.vol) {
      const u = this.vol.uniforms;
      ((u.get('uProjInv') as THREE.Uniform).value as THREE.Matrix4).copy(cam.projectionMatrixInverse);
      ((u.get('uViewInv') as THREE.Uniform).value as THREE.Matrix4).copy(cam.matrixWorld);
      ((u.get('uCamPos') as THREE.Uniform).value as THREE.Vector3).copy(cam.position);
      ((u.get('uSunDir') as THREE.Uniform).value as THREE.Vector3).copy(env.sunDir);
      ((u.get('uSunCol') as THREE.Uniform).value as THREE.Color).copy(env.sunColor).multiplyScalar(env.sunIntensity * 0.42);
      ((u.get('uFogCol') as THREE.Uniform).value as THREE.Color).copy(env.fogColor).multiplyScalar(env.indoor ? 0.5 : 0.3 + env.hemi.intensity * 0.25);
      (u.get('uDensity') as THREE.Uniform).value = env.fogDensity * (env.indoor ? 1.1 : 0.9);
      (u.get('uFogTop') as THREE.Uniform).value = env.indoor ? 110 : 200;
      (u.get('uTimeV') as THREE.Uniform).value = time;
      (u.get('uShafts') as THREE.Uniform).value = env.shafts;
      const sm = env.sun.shadow.map;
      const dtx = sm ? (sm as THREE.WebGLRenderTarget).depthTexture : null;
      (u.get('uShadowMap') as THREE.Uniform).value = dtx;
      (u.get('uShadowOn') as THREE.Uniform).value = dtx && env.shadowsOn && env.sun.castShadow ? 1 : 0;
      ((u.get('uShadowMat') as THREE.Uniform).value as THREE.Matrix4).copy(env.sun.shadow.matrix);
    }
    this.impact = Math.max(0, this.impact - dt * 3.2);
    this.hurt = Math.max(0, this.hurt - dt * 1.6);
    const off = 0.0005 + this.impact * 0.006;
    this.ca.offset.set(off, off);
    const g = this.grade.uniforms;
    (g.get('uExposure') as THREE.Uniform).value = env.exposure;
    (g.get('uTimeG') as THREE.Uniform).value = time;
    ((g.get('uFade') as THREE.Uniform).value as THREE.Vector4).copy(this.fade);
    (g.get('uHurt') as THREE.Uniform).value = this.hurt;
    if (this.dof) {
      this.dof.bokehScale = 3.0 + this.dofBoost * 5;
      // the engine re-fits near / far to the zoom every frame; the circle of confusion linearises
      // depth with its own copy of them, and a stale copy puts the whole frame out of focus
      this.dof.cocMaterial.adoptCameraSettings(this.camera);
      this.dof.cocMaterial.focusRange = this.focusRange;
    }
    if (this.tilt) this.tilt.focusArea = 0.62 - this.dofBoost * 0.3;
    this.composer.render(dt);
  }

  dispose(): void {
    this.composer.dispose();
    void this.ao;
    void this.renderer;
  }
}
