import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import type { WaterVolumeSampler } from "../world/water/WaterVolumeSampler"
import type { AnimalPositionProvider } from "./AnimalTypes"
import type { FishVisual } from "./FishMeshFactory"

interface FishTarget {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface FishControllerOptions {
  readonly id: string
  readonly visual: FishVisual
  readonly initialPosition: Vector3
  readonly waterSampler: WaterVolumeSampler
  readonly player: AnimalPositionProvider
  readonly random: () => number
}

export class FishController {
  private static readonly _cruiseSpeedMetersPerSecond = 0.9
  private static readonly _playerAvoidanceRadiusMeters = 3.5

  private readonly _body: Mesh
  private readonly _tail: Mesh
  private readonly _random: () => number
  private _position: Vector3
  private _target: FishTarget
  private _elapsedSeconds = 0

  public constructor(private readonly _options: FishControllerOptions) {
    this._body = this._options.visual.body
    this._tail = this._options.visual.tail
    this._random = this._options.random
    this._position = this._options.initialPosition.clone()
    this._target = this._chooseTarget()
    this._applyTransform(0)
  }

  public get id(): string {
    return this._options.id
  }

  public get position(): Vector3 {
    return this._position.clone()
  }

  public update(deltaSeconds: number): void {
    this._elapsedSeconds += deltaSeconds

    const column = this._options.waterSampler.sampleColumn(this._position.x, this._position.z)

    if (!column.hasWater) {
      this._target = this._chooseTarget()
      this._applyTransform(0)
      return
    }

    const player = this._options.player.position
    const awayFromPlayer = this._getPlayerAvoidance(player)
    const toTargetX = this._target.x - this._position.x + awayFromPlayer.x
    const toTargetY = this._target.y - this._position.y
    const toTargetZ = this._target.z - this._position.z + awayFromPlayer.z
    const distance = Math.hypot(toTargetX, toTargetY, toTargetZ)

    if (distance < 0.35 || !this._isTargetValid()) {
      this._target = this._chooseTarget()
      return
    }

    const speed = FishController._cruiseSpeedMetersPerSecond + column.currentMetersPerSecond * 0.35
    const step = Math.min(speed * deltaSeconds, distance)
    const nextX = this._position.x + (toTargetX / distance) * step
    const nextY = this._position.y + (toTargetY / distance) * step
    const nextZ = this._position.z + (toTargetZ / distance) * step
    const nextColumn = this._options.waterSampler.sampleColumn(nextX, nextZ)

    if (!nextColumn.hasWater) {
      this._target = this._chooseTarget()
      return
    }

    const minY = nextColumn.bedY + 0.15
    const maxY = nextColumn.surfaceY - 0.15

    this._position = new Vector3(nextX, Math.min(Math.max(nextY, minY), maxY), nextZ)
    this._applyTransform(Math.atan2(toTargetX, toTargetZ))
  }

  public dispose(): void {
    this._body.dispose()
    this._tail.dispose()
    this._options.visual.material.dispose()
  }

  private _chooseTarget(): FishTarget {
    const column = this._options.waterSampler.sampleColumn(this._position.x, this._position.z)
    const radius = 1.5 + this._random() * 4
    const angle = this._random() * Math.PI * 2
    const targetX = this._position.x + Math.sin(angle) * radius
    const targetZ = this._position.z + Math.cos(angle) * radius
    const targetColumn = this._options.waterSampler.sampleColumn(targetX, targetZ)
    const usableColumn = targetColumn.hasWater ? targetColumn : column
    const depthT = 0.25 + this._random() * 0.5
    const targetY = usableColumn.bedY + usableColumn.depthMeters * depthT

    return {
      x: targetColumn.hasWater ? targetX : this._position.x,
      y: Math.min(Math.max(targetY, usableColumn.bedY + 0.15), usableColumn.surfaceY - 0.15),
      z: targetColumn.hasWater ? targetZ : this._position.z,
    }
  }

  private _isTargetValid(): boolean {
    const column = this._options.waterSampler.sampleColumn(this._target.x, this._target.z)

    return column.hasWater && this._target.y > column.bedY && this._target.y < column.surfaceY
  }

  private _getPlayerAvoidance(player: Vector3): { readonly x: number; readonly z: number } {
    const dx = this._position.x - player.x
    const dz = this._position.z - player.z
    const distance = Math.hypot(dx, dz)

    if (distance === 0 || distance > FishController._playerAvoidanceRadiusMeters) {
      return { x: 0, z: 0 }
    }

    const strength = (FishController._playerAvoidanceRadiusMeters - distance) * 1.8

    return { x: (dx / distance) * strength, z: (dz / distance) * strength }
  }

  private _applyTransform(yaw: number): void {
    const tailWag = Math.sin(this._elapsedSeconds * 12) * 0.28

    this._body.position = this._position.clone()
    this._tail.position = this._position.add(
      new Vector3(-Math.sin(yaw) * 0.2, 0, -Math.cos(yaw) * 0.2),
    )
    this._body.rotation.y = yaw
    this._tail.rotation.y = yaw + tailWag
  }
}
