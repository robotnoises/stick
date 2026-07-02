import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"
import { Compass } from "./Compass"

export class PlayerController implements GameSystem {
  private static readonly _mouseSensitivity = 1 / 2800

  private readonly _camera: UniversalCamera
  private readonly _compass: Compass
  private _groundHeightProvider: ((worldX: number, worldZ: number) => number) | null = null

  public constructor(private readonly _context: EngineContext) {
    this._camera = new UniversalCamera(
      "player-camera",
      new Vector3(0, 1.7, -8),
      this._context.scene,
    )
    this._camera.minZ = 0.05
    this._camera.speed = 1.4
    this._camera.angularSensibility = 2800
    this.setInvertMouseY(false)
    this._camera.keysUp = [87]
    this._camera.keysDown = [83]
    this._camera.keysLeft = [65]
    this._camera.keysRight = [68]
    this._camera.attachControl(this._context.canvas, true)
    this._context.scene.activeCamera = this._camera

    this._compass = new Compass(this._camera)
  }

  public get position(): Vector3 {
    return this._camera.position.clone()
  }

  public get headingDegrees(): number {
    return this._compass.getHeadingDegrees()
  }

  public setInvertMouseY(invertMouseY: boolean): void {
    const pointerRotateEntries = this._camera.movement.input.getEntries("pointer", "rotate")

    for (const entry of pointerRotateEntries) {
      entry.sensitivityX = PlayerController._mouseSensitivity
      entry.sensitivityY = (invertMouseY ? -1 : 1) * PlayerController._mouseSensitivity
    }
  }

  public setGroundHeightProvider(provider: (worldX: number, worldZ: number) => number): void {
    this._groundHeightProvider = provider
  }

  public update(_deltaSeconds: number): void {
    const groundHeight =
      this._groundHeightProvider?.(this._camera.position.x, this._camera.position.z) ?? 0

    this._camera.position.y = groundHeight + 1.7
  }
}
