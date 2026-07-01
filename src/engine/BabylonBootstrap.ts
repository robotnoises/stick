import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import { Scene } from '@babylonjs/core/scene';
import { Color4 } from '@babylonjs/core/Maths/math.color';

export class BabylonBootstrap {
  public static async createEngine(canvas: HTMLCanvasElement): Promise<Engine | WebGPUEngine> {
    if (await WebGPUEngine.IsSupportedAsync) {
      const engine = new WebGPUEngine(canvas, {
        antialias: true,
        adaptToDeviceRatio: true,
      });
      await engine.initAsync();
      return engine;
    }

    return new Engine(canvas, true, {
      adaptToDeviceRatio: true,
      stencil: true,
    });
  }

  public static createScene(engine: Engine | WebGPUEngine): Scene {
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.53, 0.72, 0.9, 1);
    return scene;
  }
}
