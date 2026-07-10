import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import type { WaterVolumeSampler } from "../../world/water/WaterVolumeSampler"
import type { AnimalPositionProvider } from "../AnimalTypes"
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
  private readonly _fins: readonly Mesh[]
  private readonly _random: () => number
  private readonly _scale: number
  private readonly _cruiseSpeedMetersPerSecond: number
  private _position: Vector3
  private _target: FishTarget
  private _fleeTarget: FishTarget | null = null
  private _fleeTimeRemainingSeconds = 0
  private _elapsedSeconds = 0
  private _targetAgeSeconds = 0

  public constructor(private readonly _options: FishControllerOptions) {
    this._body = this._options.visual.body
    this._tail = this._options.visual.tail
    this._fins = this._options.visual.fins
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
    this._fleeTimeRemainingSeconds = Math.max(this._fleeTimeRemainingSeconds - deltaSeconds, 0)

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

    for (const fin of this._fins) {
      fin.dispose()
    }

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

    if (this._fleeTarget && this._fleeTimeRemainingSeconds > 0) {
      return {
        target: this._fleeTarget,
        speedMetersPerSecond: this._cruiseSpeedMetersPerSecond * 3.2,
        isFleeing: true,
      }
    }

    if (distance > 0 && distance < FishController._playerAvoidanceRadiusMeters) {
      const fleeDistance = 4.5 + this._random() * 3
      const targetX = this._position.x + (dx / distance) * fleeDistance
      const targetZ = this._position.z + (dz / distance) * fleeDistance
      const targetColumn = this._options.waterSampler.sampleColumn(targetX, targetZ)

      if (targetColumn.hasWater) {
        this._fleeTarget = {
          x: targetX,
          y: targetColumn.bedY + targetColumn.depthMeters * 0.55,
          z: targetZ,
        }
        this._fleeTimeRemainingSeconds = 1.4

        return {
          target: this._fleeTarget,
          speedMetersPerSecond: this._cruiseSpeedMetersPerSecond * 3.2,
          isFleeing: true,
        }
      }
    }

    this._fleeTarget = null

    return {
      target: this._target,
      speedMetersPerSecond: this._cruiseSpeedMetersPerSecond,
      isFleeing: false,
    }
  }

  private _applyTransform(yaw: number, speedMetersPerSecond: number): void {
    const isFast = speedMetersPerSecond > 0.8
    const tailWagSpeed = isFast ? 18 : 8
    const tailWagAmount = isFast ? 0.42 : 0.2
    const bodySway = Math.sin(this._elapsedSeconds * (isFast ? 10 : 4.5)) * (isFast ? 0.055 : 0.035)
    const tailWag = Math.sin(this._elapsedSeconds * tailWagSpeed) * tailWagAmount
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw))
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw))

    this._body.position = this._position.clone()
    this._tail.position = this._position.add(forward.scale(-0.31 * this._scale))
    this._body.rotation.y = yaw + bodySway
    this._tail.rotation.y = yaw + tailWag
    this._positionFins(yaw, right, forward, bodySway)
  }

  private _positionFins(yaw: number, right: Vector3, forward: Vector3, bodySway: number): void {
    const dorsal = this._fins[0]
    const leftPectoral = this._fins[1]
    const rightPectoral = this._fins[2]

    if (dorsal) {
      dorsal.position = this._position.add(new Vector3(0, 0.14 * this._scale, 0))
      dorsal.rotation.y = yaw + bodySway
    }

    if (leftPectoral) {
      leftPectoral.position = this._position
        .add(right.scale(-0.11 * this._scale))
        .add(forward.scale(0.08 * this._scale))
        .add(new Vector3(0, -0.04 * this._scale, 0))
      leftPectoral.rotation.y = yaw + 0.35 + bodySway
    }

    if (rightPectoral) {
      rightPectoral.position = this._position
        .add(right.scale(0.11 * this._scale))
        .add(forward.scale(0.08 * this._scale))
        .add(new Vector3(0, -0.04 * this._scale, 0))
      rightPectoral.rotation.y = yaw - 0.35 + bodySway
    }
  }
}
