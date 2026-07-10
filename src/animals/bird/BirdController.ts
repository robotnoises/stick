import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import type { AnimalPositionProvider } from "../AnimalTypes"
import type { BirdVisual } from "./BirdMeshFactory"

interface BirdTarget {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface BirdControllerOptions {
  readonly id: string
  readonly visual: BirdVisual
  readonly initialPosition: Vector3
  readonly player: AnimalPositionProvider
  readonly terrainHeightProvider: (worldX: number, worldZ: number) => number
  readonly random: () => number
}

export class BirdController {
  private static readonly _flightSpeedMetersPerSecond = 8

  private readonly _body: Mesh
  private readonly _leftWing: Mesh
  private readonly _rightWing: Mesh
  private readonly _tail: Mesh
  private readonly _random: () => number
  private readonly _scale: number
  private _position: Vector3
  private _target: BirdTarget
  private _yaw = 0
  private _elapsedSeconds = 0
  private _targetAgeSeconds = 0
  private _glideTimeRemainingSeconds = 0
  private _nextGlideInSeconds = 2

  public constructor(private readonly _options: BirdControllerOptions) {
    this._body = this._options.visual.body
    this._leftWing = this._options.visual.leftWing
    this._rightWing = this._options.visual.rightWing
    this._tail = this._options.visual.tail
    this._random = this._options.random
    this._scale = this._options.visual.scale
    this._position = this._options.initialPosition.clone()
    this._target = this._chooseTarget()
    this._yaw = Math.atan2(this._target.x - this._position.x, this._target.z - this._position.z)
    this._nextGlideInSeconds = 1.5 + this._random() * 4
    this._applyTransform()
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
    this._updateGlide(deltaSeconds)

    const toTargetX = this._target.x - this._position.x
    const toTargetY = this._target.y - this._position.y
    const toTargetZ = this._target.z - this._position.z
    const horizontalDistance = Math.hypot(toTargetX, toTargetZ)
    const distance = Math.hypot(toTargetX, toTargetY, toTargetZ)

    if (distance < 4 || this._targetAgeSeconds > 8) {
      this._target = this._chooseTarget()
      this._targetAgeSeconds = 0
      return
    }

    this._turnToward(Math.atan2(toTargetX, toTargetZ), deltaSeconds)

    const step = Math.min(BirdController._flightSpeedMetersPerSecond * deltaSeconds, distance)
    const climbStep = horizontalDistance > 0 ? (toTargetY / horizontalDistance) * step * 0.45 : 0
    const nextX = this._position.x + Math.sin(this._yaw) * step
    const nextY = this._position.y + climbStep
    const nextZ = this._position.z + Math.cos(this._yaw) * step
    const minY = this._options.terrainHeightProvider(nextX, nextZ) + 8

    this._position = new Vector3(nextX, Math.max(nextY, minY), nextZ)
    this._applyTransform()
  }

  public dispose(): void {
    this._body.dispose()
    this._leftWing.dispose()
    this._rightWing.dispose()
    this._tail.dispose()
    this._options.visual.material.dispose()
  }

  private _chooseTarget(): BirdTarget {
    const player = this._options.player.position
    const radius = 45 + this._random() * 65
    const angle = this._random() * Math.PI * 2
    const x = player.x + Math.sin(angle) * radius
    const z = player.z + Math.cos(angle) * radius
    const groundY = this._options.terrainHeightProvider(x, z)
    const y = groundY + 18 + this._random() * 34

    return { x, y, z }
  }

  private _updateGlide(deltaSeconds: number): void {
    if (this._glideTimeRemainingSeconds > 0) {
      this._glideTimeRemainingSeconds = Math.max(this._glideTimeRemainingSeconds - deltaSeconds, 0)
      return
    }

    this._nextGlideInSeconds -= deltaSeconds

    if (this._nextGlideInSeconds > 0) {
      return
    }

    this._glideTimeRemainingSeconds = 0.8 + this._random() * 1.8
    this._nextGlideInSeconds = 3 + this._random() * 6
  }

  private _turnToward(targetYaw: number, deltaSeconds: number): void {
    const maxTurnRadians = 0.9 * deltaSeconds
    const deltaYaw = this._normalizeRadians(targetYaw - this._yaw)
    const clampedDeltaYaw = Math.min(Math.max(deltaYaw, -maxTurnRadians), maxTurnRadians)

    this._yaw = this._normalizeRadians(this._yaw + clampedDeltaYaw)
  }

  private _normalizeRadians(radians: number): number {
    let normalized = radians

    while (normalized > Math.PI) {
      normalized -= Math.PI * 2
    }

    while (normalized < -Math.PI) {
      normalized += Math.PI * 2
    }

    return normalized
  }

  private _applyTransform(): void {
    const isGliding = this._glideTimeRemainingSeconds > 0
    const wingFlap = isGliding ? 0.18 : Math.sin(this._elapsedSeconds * 11) * 0.75
    const forward = new Vector3(Math.sin(this._yaw), 0, Math.cos(this._yaw))

    this._body.position = this._position.clone()
    this._body.rotation.y = this._yaw

    this._leftWing.position = this._position.clone()
    this._rightWing.position = this._position.clone()
    this._leftWing.rotation.y = this._yaw
    this._rightWing.rotation.y = this._yaw
    this._leftWing.rotation.z = isGliding ? -0.12 : -wingFlap
    this._rightWing.rotation.z = isGliding ? 0.12 : wingFlap

    this._tail.position = this._position.add(forward.scale(-0.16 * this._scale))
    this._tail.rotation.y = this._yaw
  }
}
