import type { Engine } from '@babylonjs/core/Engines/engine';
import type { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import type { Scene } from '@babylonjs/core/scene';
import type { GameConfig } from './GameConfig';

export class EngineContext {
  public constructor(
    public readonly canvas: HTMLCanvasElement,
    public readonly engine: Engine | WebGPUEngine,
    public readonly scene: Scene,
    public readonly config: GameConfig,
  ) {}
}
