import '@babylonjs/core/Culling/ray';
import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';

export class Compass {
  public constructor(private readonly _camera: UniversalCamera) {}

  /**
   * Heading in degrees relative to world north.
   * Convention: +Z is north, +X is east.
   */
  public getHeadingDegrees(): number {
    const forward = this._camera.getForwardRay().direction;
    const angleRad = Math.atan2(forward.x, forward.z);
    const degrees = angleRad * (180 / Math.PI);
    return (degrees + 360) % 360;
  }
}
