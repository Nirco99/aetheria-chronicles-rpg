// Graphics presets. "ultra" and "cinematic" target a discrete GPU of the RTX 4060 class; "low"
// keeps the 3D renderer playable on integrated laptop graphics; "classic" is the original 2D
// canvas renderer.
export type GfxPreset = 'classic' | 'low' | 'medium' | 'high' | 'ultra' | 'cinematic';

export interface Quality {
  id: GfxPreset;
  label: string;
  desc: string;
  /** cap on devicePixelRatio and on total rendered pixels */
  maxDpr: number;
  maxPixels: number;
  msaa: number;
  shadows: boolean;
  shadowSize: number;
  pointLights: number;
  /** 0 off, 1 half-res, 2 full-res high quality */
  ao: number;
  bloom: boolean;
  /** 0 off, 1 tilt-shift, 2 bokeh depth of field */
  dof: number;
  /** ray-march steps of the volumetric light shafts (0 = plain fog) */
  volumetric: number;
  smaa: boolean;
  /** grass blades per tile and draw distance in tiles */
  grass: number;
  grassDist: number;
  detailSize: number;
  particles: number;
  /** soft shadow-casting foliage and character shadows */
  propShadows: boolean;
  /** terrain vertices per tile edge */
  terrainSub: number;
  /** image-based lighting from the procedural sky (specular reflections on metal and water) */
  ibl: boolean;
}

export const QUALITY: Record<Exclude<GfxPreset, 'classic'>, Quality> = {
  low: {
    id: 'low', label: 'Laptop', desc: 'Integrated graphics. 3D world, sun shadows and bloom at a reduced resolution.',
    maxDpr: 1, maxPixels: 0.8e6, msaa: 0, shadows: true, shadowSize: 1024, pointLights: 3, ao: 0, bloom: true, dof: 0, volumetric: 0, smaa: false,
    grass: 10, grassDist: 13, detailSize: 256, particles: 500, propShadows: true, terrainSub: 2, ibl: false,
  },
  medium: {
    id: 'medium', label: 'Balanced', desc: 'Entry gaming GPUs. Ambient occlusion, tilt-shift focus and denser grass.',
    maxDpr: 1.25, maxPixels: 1.7e6, msaa: 0, shadows: true, shadowSize: 2048, pointLights: 8, ao: 1, bloom: true, dof: 1, volumetric: 0, smaa: true,
    grass: 26, grassDist: 18, detailSize: 512, particles: 900, propShadows: true, terrainSub: 3, ibl: true,
  },
  high: {
    id: 'high', label: 'High', desc: 'Mid-range GPUs. Volumetric light shafts, bokeh depth of field and 12 dynamic lights.',
    maxDpr: 1.5, maxPixels: 2.8e6, msaa: 0, shadows: true, shadowSize: 2048, pointLights: 12, ao: 1, bloom: true, dof: 2, volumetric: 14, smaa: true,
    grass: 46, grassDist: 22, detailSize: 512, particles: 1400, propShadows: true, terrainSub: 4, ibl: true,
  },
  ultra: {
    id: 'ultra', label: 'RTX Ultra', desc: 'RTX 4060 class. 4x MSAA, 4K shadow maps, full-resolution AO, dense volumetrics and lush grass.',
    maxDpr: 2, maxPixels: 4.4e6, msaa: 4, shadows: true, shadowSize: 4096, pointLights: 20, ao: 2, bloom: true, dof: 2, volumetric: 26, smaa: false,
    grass: 84, grassDist: 28, detailSize: 1024, particles: 2400, propShadows: true, terrainSub: 4, ibl: true,
  },
  cinematic: {
    id: 'cinematic', label: 'Cinematic 4K', desc: 'Maximum everything, rendered at up to 4K. For screenshots and the strongest GPUs.',
    maxDpr: 3, maxPixels: 8.4e6, msaa: 4, shadows: true, shadowSize: 4096, pointLights: 24, ao: 2, bloom: true, dof: 2, volumetric: 40, smaa: false,
    grass: 120, grassDist: 34, detailSize: 1024, particles: 3200, propShadows: true, terrainSub: 5, ibl: true,
  },
};

export const PRESET_ORDER: GfxPreset[] = ['classic', 'low', 'medium', 'high', 'ultra', 'cinematic'];

let gpuName: string | null = null;

/** unmasked GPU renderer string (empty when the browser hides it) */
export function detectGpu(): string {
  if (gpuName !== null) return gpuName;
  gpuName = '';
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpuName = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '';
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    gpuName = '';
  }
  return gpuName;
}

export function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

/** best default preset for the detected GPU */
export function recommendPreset(): GfxPreset {
  if (!hasWebGL2()) return 'classic';
  const g = detectGpu().toLowerCase();
  if (/rtx\s?(40[6-9]0|50\d0|30[7-9]0|4070|4080|4090)|rx\s?(7[7-9]\d\d|9\d\d\d)|radeon rx 6[89]\d\d/.test(g)) return 'ultra';
  if (/rtx|gtx\s?(1[06]\d0|16\d0)|rx\s?[5-7]\d\d\d|arc\s?[ab]\d|apple m[2-9]/.test(g)) return 'high';
  if (/gtx|radeon|apple|geforce/.test(g)) return 'medium';
  if (/intel|iris|uhd|hd graphics|swiftshader|llvmpipe|microsoft basic/.test(g)) return 'low';
  return 'medium';
}
