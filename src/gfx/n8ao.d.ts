declare module 'n8ao' {
  import type { Camera, Color, Scene } from 'three';
  import { Pass } from 'postprocessing';
  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    configuration: {
      aoRadius: number;
      distanceFalloff: number;
      intensity: number;
      color: Color;
      aoSamples: number;
      denoiseSamples: number;
      denoiseRadius: number;
      denoiseIterations: number;
      halfRes: boolean;
      depthAwareUpsampling: boolean;
      gammaCorrection: boolean;
      screenSpaceRadius: boolean;
      renderMode: number;
    };
    setQualityMode(mode: 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra'): void;
    setSize(width: number, height: number): void;
  }
}
