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

interface FishSteering {
  readonly target: FishTarget
  readonly speedMetersPerSecond: number
  readonly isFleeing: boolean
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
  private static readonly _playerAvoidanceRadiusMeters = 5.5

  private readonly _body: Mesh
  private readonly _tail: Mesh
  private readonly _random: () => number
  private readonly _scale: number
  private readonly _cruiseSpeedMetersPerSecond: number
  private _position: Vector3
  private _target: FishTarget
  private _elapsedSeconds = 0
  private _targetAgeSeconds = 0

  public constructor(private readonly _options: FishControllerOptions) {
    this._body = this._options.visual.body
    this._tail = this._options.visual.tail
    this._random = this._options.random
    this._scale = this._options.visual.scale
    this._cruiseSpeedMetersPerSecond = 0.32 + this._random() * 0.34
    this._position = this._options.initialPosition.clone()
    this._target = this._chooseTarget()
    this._applyTransform(0, 0)
  }

  public get id(): string {
    return this._options.id
  }

  public get position(): Vector3 {
    return this._position.clone()
  }

  public update(deltaSeconds: number): void {
    this._elapsedSeconds += deltaSeconds
    this._targetAgeSeconds += deltaSeconds

    const column = this._options.waterSampler.sampleColumn(this._position.x, this._position.z)

    if (!column.hasWater) {
      this._target = this._chooseTarget()
      this._targetAgeSeconds = 0
      this._applyTransform(0, 0)
      return
    }

    const steering = this._getSteering()
    const toTargetX = steering.target.x - this._position.x
    const toTargetY = steering.target.y - this._position.y
    const toTargetZ = steering.target.z - this._position.z
    const distance = Math.hypot(toTargetX, toTargetY, toTargetZ)

    if (
      distance < 0.25 ||
      this._targetAgeSeconds > 5 ||
      (!steering.isFleeing && !this._isTargetValid())
    ) {
      this._target = this._chooseTarget()
      this._targetAgeSeconds = 0
      return
    }

    const speed = steering.speedMetersPerSecond + column.currentMetersPerSecond * 0.18
    const step = Math.min(speed * deltaSeconds, distance)
    const nextX = this._position.x + (toTargetX / distance) * step
    const nextY = this._position.y + (toTargetY / distance) * step
    const nextZ = this._position.z + (toTargetZ / distance) * step
    const nextColumn = this._options.waterSampler.sampleColumn(nextX, nextZ)

    if (!nextColumn.hasWater) {
      this._target = this._chooseTarget()
      this._targetAgeSeconds = 0
      return
    }

    const minY = nextColumn.bedY + 0.2 * this._scale
    const maxY = nextColumn.surfaceY - 0.18 * this._scale

    this._position = new Vector3(nextX, Math.min(Math.max(nextY, minY), maxY), nextZ)
    this._applyTransform(Math.atan2(toTargetX, toTargetZ), steering.isFleeing ? 1 : speed)
  }

  public dispose(): void {
    this._body.dispose()
    this._tail.dispose()
    this._options.visual.material.dispose()
  }

  private _chooseTarget(): FishTarget {
    const column = this._options.waterSampler.sampleColumn(this._position.x, this._position.z)
    const radius = 0.8 + this._random() * 3.2
    const angle = this._random() * Math.PI * 2
    const targetX = this._position.x + Math.sin(angle) * radius
    const targetZ = this._position.z + Math.cos(angle) * radius
    const targetColumn = this._options.waterSampler.sampleColumn(targetX, targetZ)
    const usableColumn = targetColumn.hasWater ? targetColumn : column
    const depthT = 0.28 + this._random() * 0.42
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

  private _getSteering(): FishSteering {
    const player = this._options.player.position
    const dx = this._position.x - player.x
    const dz = this._position.z - player.z
    const distance = Math.hypot(dx, dz)

    if (distance > 0 && distance < FishController._playerAvoidanceRadiusMeters) {
      const fleeDistance = 4 + this._random() * 2.5
      const targetX = this._position.x + (dx / distance) * fleeDistance
      const targetZ = this._position.z + (dz / distance) * fleeDistance
      const targetColumn = this._options.waterSampler.sampleColumn(targetX, targetZ)

      if (targetColumn.hasWater) {
        return {
          target: {
            x: targetX,
            y: targetColumn.bedY + targetColumn.depthMeters * 0.55,
            z: targetZ,
          },
          speedMetersPerSecond: this._cruiseSpeedMetersPerSecond * 2.7,
          isFleeing: true,
        }
      }
    }

    return {
      target: this._target,
      speedMetersPerSecond: this._cruiseSpeedMetersPerSecond,
      isFleeing: false,
    }
  }

  private _applyTransform(yaw: number, speedMetersPerSecond: number): void {
    const tailWagSpeed = speedMetersPerSecond > 0.8 ? 18 : 8
    const tailWagAmount = speedMetersPerSecond > 0.8 ? 0.42 : 0.2
    const tailWag = Math.sin(this._elapsedSeconds * tailWagSpeed) * tailWagAmount

    this._body.position = this._position.clone()
    this._tail.position = this._position.add(
      new Vector3(-Math.sin(yaw) * 0.31 * this._scale, 0, -Math.cos(yaw) * 0.31 * this._scale),
    )
    this._body.rotation.y = yaw
    this._tail.rotation.y = yaw + tailWag
  }
}
