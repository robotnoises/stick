import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"
import type { WaterColumnSample } from "../world/water/WaterVolumeSampler"
import { Compass } from "./Compass"

export type PlayerWaterState = "grounded" | "wading" | "submerged"

export interface PlayerWaterSampler {
  sampleColumn(worldX: number, worldZ: number): WaterColumnSample
}

export interface PlayerCollisionResolver {
  resolveHorizontalPosition(worldX: number, worldZ: number): { readonly x: number; readonly z: number }
}

export class PlayerController implements GameSystem {
  private static readonly _eyeHeightMeters = 1.7
  private static readonly _mouseSensitivity = 1 / 2800
  private static readonly _walkSpeed = 0.25
  private static readonly _wadeSpeed = 0.16
  private static readonly _waterSinkAccelerationMetersPerSecond = 0.35
  private static readonly _waterTerminalSinkSpeedMetersPerSecond = 0.22
  // TODO: private static readonly _runSpeed = 0.55

  private readonly _camera: UniversalCamera
  private readonly _compass: Compass
  private _groundHeightProvider: ((worldX: number, worldZ: number) => number) | null = null
  private _positionClampProvider:
    ((worldX: number, worldZ: number) => { readonly x: number; readonly z: number }) | null = null
  private _waterSampler: PlayerWaterSampler | null = null
  private _collisionResolver: PlayerCollisionResolver | null = null
  private _waterState: PlayerWaterState = "grounded"
  private _waterDepthMeters = 0
  private _verticalVelocityMetersPerSecond = 0

  public constructor(private readonly _context: EngineContext) {
    this._camera = new UniversalCamera(
      "player-camera",
      new Vector3(0, 1.7, -8),
      this._context.scene,
    )
    this._camera.minZ = 0.05
    this._camera.speed = PlayerController._walkSpeed
    this._camera.angularSensibility = 2800
    this.setInvertMouseY(false)
    this._camera.keysUp = [87]
    this._camera.keysDown = [83]
    this._camera.keysLeft = [65]
    this._camera.keysRight = [68]
    this._camera.attachControl(this._context.canvas, true)
    this._context.canvas.addEventListener("click", this._handlePointerLockRequest)
    this._context.scene.activeCamera = this._camera

    this._compass = new Compass(this._camera)
  }

  public get position(): Vector3 {
    return this._camera.position.clone()
  }

  public get headingDegrees(): number {
    return this._compass.getHeadingDegrees()
  }

  public get forwardDirection(): Vector3 {
    return this._camera.getForwardRay().direction.clone().normalize()
  }

  public get waterState(): PlayerWaterState {
    return this._waterState
  }

  public get waterDepthMeters(): number {
    return this._waterDepthMeters
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

  public setPositionClampProvider(
    provider: (worldX: number, worldZ: number) => { readonly x: number; readonly z: number },
  ): void {
    this._positionClampProvider = provider
  }

  public setWaterSampler(sampler: PlayerWaterSampler): void {
    this._waterSampler = sampler
  }

  public setCollisionResolver(resolver: PlayerCollisionResolver): void {
    this._collisionResolver = resolver
  }

  public setPosition(x: number, y: number, z: number): void {
    this._camera.position.set(x, y, z)
  }

  public setHeadingDegrees(headingDegrees: number): void {
    this._camera.rotation.y = this._normalizeDegrees(headingDegrees) * (Math.PI / 180)
  }

  public update(deltaSeconds: number): void {
    const clampedPosition = this._positionClampProvider?.(
      this._camera.position.x,
      this._camera.position.z,
    )

    if (clampedPosition) {
      this._camera.position.x = clampedPosition.x
      this._camera.position.z = clampedPosition.z
    }

    const collisionResolvedPosition = this._collisionResolver?.resolveHorizontalPosition(
      this._camera.position.x,
      this._camera.position.z,
    )

    if (collisionResolvedPosition) {
      this._camera.position.x = collisionResolvedPosition.x
      this._camera.position.z = collisionResolvedPosition.z
    }

    const reclampedPosition = this._positionClampProvider?.(
      this._camera.position.x,
      this._camera.position.z,
    )

    if (reclampedPosition) {
      this._camera.position.x = reclampedPosition.x
      this._camera.position.z = reclampedPosition.z
    }

    const groundHeight =
      this._groundHeightProvider?.(this._camera.position.x, this._camera.position.z) ?? 0
    const waterColumn = this._waterSampler?.sampleColumn(
      this._camera.position.x,
      this._camera.position.z,
    )

    if (!waterColumn?.hasWater) {
      this._waterState = "grounded"
      this._waterDepthMeters = 0
      this._verticalVelocityMetersPerSecond = 0
      this._camera.speed = PlayerController._walkSpeed
      this._camera.position.y = groundHeight + PlayerController._eyeHeightMeters
      return
    }

    this._waterDepthMeters = waterColumn.depthMeters
    this._camera.speed = PlayerController._wadeSpeed

    if (waterColumn.depthMeters < 1.2) {
      this._waterState = "wading"
      this._verticalVelocityMetersPerSecond = 0
      this._camera.position.y = groundHeight + PlayerController._eyeHeightMeters
      return
    }

    this._waterState = "submerged"
    this._verticalVelocityMetersPerSecond = Math.max(
      this._verticalVelocityMetersPerSecond -
        PlayerController._waterSinkAccelerationMetersPerSecond * deltaSeconds,
      -PlayerController._waterTerminalSinkSpeedMetersPerSecond,
    )

    const minEyeY = waterColumn.bedY + 1
    const maxEyeY = waterColumn.surfaceY + 0.25
    const nextEyeY = this._camera.position.y + this._verticalVelocityMetersPerSecond * deltaSeconds

    this._camera.position.y = Math.min(Math.max(nextEyeY, minEyeY), maxEyeY)
  }

  public dispose(): void {
    this._context.canvas.removeEventListener("click", this._handlePointerLockRequest)
    this._camera.detachControl()
  }

  private _normalizeDegrees(degrees: number): number {
    return ((degrees % 360) + 360) % 360
  }

  private readonly _handlePointerLockRequest = (): void => {
    if (document.pointerLockElement === this._context.canvas) {
      return
    }

    this._context.canvas.requestPointerLock()
  }
}
