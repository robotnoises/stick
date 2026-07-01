import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { EngineContext } from '../app/EngineContext';
import type { GameSystem } from '../app/GameSystem';
import { Compass } from './Compass';

export class PlayerController implements GameSystem {
  private readonly _camera: UniversalCamera;
  private readonly _compass: Compass;

  public constructor(private readonly _context: EngineContext) {
    this._camera = new UniversalCamera('player-camera', new Vector3(0, 1.7, -8), this._context.scene);
    this._camera.minZ = 0.05;
    this._camera.speed = 1.4;
    this._camera.angularSensibility = 2800;
    this._camera.keysUp = [87];
    this._camera.keysDown = [83];
    this._camera.keysLeft = [65];
    this._camera.keysRight = [68];
    this._camera.attachControl(this._context.canvas, true);
    this._context.scene.activeCamera = this._camera;

    this._compass = new Compass(this._camera);
  }

  public get position(): Vector3 {
    return this._camera.position.clone();
  }

  public get headingDegrees(): number {
    return this._compass.getHeadingDegrees();
  }

  public update(_deltaSeconds: number): void {
    // Keep prototype player at eye height until terrain collision is implemented.
    this._camera.position.y = 1.7;
  }
}
