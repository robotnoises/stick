import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"
import type { CampfireInstance } from "./CampfireTypes"
import { CampfireMeshFactory } from "./CampfireMeshFactory"

export interface CampfirePositionProvider {
  readonly position: Vector3
  readonly forwardDirection: Vector3
}

export interface CampfireHeightProvider {
  getHeightAt(worldX: number, worldZ: number): number
}

export class CampfireSystem implements GameSystem {
  private static readonly _mediumFireBurnSeconds = 60 * 60
  private static readonly _placementDistanceMeters = 2.3

  private readonly _meshFactory: CampfireMeshFactory
  private readonly _fires: CampfireInstance[] = []

  public constructor(
    private readonly _context: EngineContext,
    private readonly _player: CampfirePositionProvider,
    private readonly _heightProvider: CampfireHeightProvider,
  ) {
    this._meshFactory = new CampfireMeshFactory(this._context.scene)
  }

  public placeMediumFireInFrontOfPlayer(): void {
    const forward = this._player.forwardDirection.clone()
    const horizontalForward = new Vector3(forward.x, 0, forward.z)

    if (horizontalForward.lengthSquared() <= 0.0001) {
      horizontalForward.z = 1
    }

    horizontalForward.normalize()

    const playerPosition = this._player.position
    const targetX = playerPosition.x + horizontalForward.x * CampfireSystem._placementDistanceMeters
    const targetZ = playerPosition.z + horizontalForward.z * CampfireSystem._placementDistanceMeters
    const targetY = this._heightProvider.getHeightAt(targetX, targetZ)

    this.placeMediumFire(new Vector3(targetX, targetY, targetZ))
  }

  public placeMediumFire(position: Vector3): void {
    const visual = this._meshFactory.createMediumFire(position)

    this._fires.push({
      id: `campfire_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      visual,
      remainingBurnSeconds: CampfireSystem._mediumFireBurnSeconds,
      flickerSeed: Math.random() * Math.PI * 2,
    })
  }

  public update(deltaSeconds: number): void {
    const worldDeltaSeconds = deltaSeconds * this._context.config.timeScale

    for (let index = this._fires.length - 1; index >= 0; index -= 1) {
      const fire = this._fires[index]

      if (!fire) {
        continue
      }

      fire.remainingBurnSeconds -= worldDeltaSeconds

      if (fire.remainingBurnSeconds <= 0) {
        this._disposeFireVisual(fire)
        this._fires.splice(index, 1)
        continue
      }

      this._updateFireVisual(fire, deltaSeconds)
    }
  }

  public dispose(): void {
    for (const fire of this._fires) {
      this._disposeFireVisual(fire)
    }

    this._fires.length = 0
    this._meshFactory.dispose()
  }

  private _updateFireVisual(fire: CampfireInstance, deltaSeconds: number): void {
    fire.flickerSeed += deltaSeconds * 8.5

    const flicker =
      Math.sin(fire.flickerSeed) * 0.08 +
      Math.sin(fire.flickerSeed * 2.41 + 1.7) * 0.05 +
      Math.random() * 0.035
    const intensity = 18 + flicker * 4

    fire.visual.light.intensity = Math.max(12, intensity)
    fire.visual.spillLight.intensity = Math.max(1.8, intensity * 0.18)

    fire.visual.fillLights.forEach((fillLight, index) => {
      const fillFlicker =
        Math.sin(fire.flickerSeed * (0.82 + index * 0.09) + index * 1.6) * 0.1 +
        Math.sin(fire.flickerSeed * 1.9 + index) * 0.05

      fillLight.intensity = Math.max(4, 7 + fillFlicker * 3)
    })

    fire.visual.flameMeshes.forEach((mesh, index) => {
      const pulse = 1 + Math.sin(fire.flickerSeed * (1.1 + index * 0.07) + index) * 0.08
      const stretch = 1 + Math.sin(fire.flickerSeed * 1.7 + index * 0.9) * 0.1

      mesh.scaling.x = pulse
      mesh.scaling.y = stretch
      mesh.visibility = 0.82 + Math.sin(fire.flickerSeed * 1.3 + index) * 0.08
    })
  }

  private _disposeFireVisual(fire: CampfireInstance): void {
    fire.visual.light.dispose()

    for (const fillLight of fire.visual.fillLights) {
      fillLight.dispose()
    }

    fire.visual.spillLight.dispose()
    fire.visual.root.dispose(false, true)
  }
}
