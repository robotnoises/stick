import type { PointLight } from "@babylonjs/core/Lights/pointLight"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import type { AnimalPositionProvider } from "../AnimalTypes"
import type { FireflyVisual } from "./FireflyMeshFactory"

interface FireflyTarget {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface FireflyControllerOptions {
  readonly id: string
  readonly visual: FireflyVisual
  readonly initialPosition: Vector3
  readonly player: AnimalPositionProvider
  readonly terrainHeightProvider: (worldX: number, worldZ: number) => number
  readonly random: () => number
}

export class FireflyController {
  private static readonly _flightSpeedMetersPerSecond = 0.9

  private readonly _body: Mesh
  private readonly _halo: Mesh
  private readonly _light: PointLight
  private readonly _random: () => number
  private readonly _scale: number
  private _position: Vector3
  private _target: FireflyTarget
  private _elapsedSeconds = 0
  private _targetAgeSeconds = 0
  private _phase: number
  private _worldLightingEnabled = false

  public constructor(private readonly _options: FireflyControllerOptions) {
    this._body = this._options.visual.body
    this._halo = this._options.visual.halo
    this._light = this._options.visual.light
    this._random = this._options.random
    this._scale = this._options.visual.scale
    this._position = this._options.initialPosition.clone()
    this._target = this._chooseTarget()
    this._phase = this._random() * Math.PI * 2
    this._applyTransform()
  }

  public get id(): string {
    return this._options.id
  }

  public get position(): Vector3 {
    return this._position.clone()
  }

  public setWorldLightingEnabled(enabled: boolean): boolean {
    if (this._worldLightingEnabled === enabled) {
      return false
    }

    this._worldLightingEnabled = enabled
    this._light.includedOnlyMeshes = enabled ? [] : [this._body, this._halo]

    return true
  }

  public update(deltaSeconds: number): void {
    this._elapsedSeconds += deltaSeconds
    this._targetAgeSeconds += deltaSeconds

    const toTargetX = this._target.x - this._position.x
    const toTargetY = this._target.y - this._position.y
    const toTargetZ = this._target.z - this._position.z
    const distance = Math.hypot(toTargetX, toTargetY, toTargetZ)

    if (distance < 0.3 || this._targetAgeSeconds > 6) {
      this._target = this._chooseTarget()
      this._targetAgeSeconds = 0
      return
    }

    const step = Math.min(FireflyController._flightSpeedMetersPerSecond * deltaSeconds, distance)
    const driftX = Math.sin(this._elapsedSeconds * 1.7 + this._phase) * 0.16 * deltaSeconds
    const driftY = Math.sin(this._elapsedSeconds * 2.3 + this._phase) * 0.08 * deltaSeconds
    const driftZ = Math.cos(this._elapsedSeconds * 1.4 + this._phase) * 0.16 * deltaSeconds
    const nextX = this._position.x + (toTargetX / distance) * step + driftX
    const nextZ = this._position.z + (toTargetZ / distance) * step + driftZ
    const groundY = this._options.terrainHeightProvider(nextX, nextZ)
    const nextY = this._position.y + (toTargetY / distance) * step + driftY

    this._position = new Vector3(nextX, Math.max(groundY + 0.35, nextY), nextZ)
    this._applyTransform()
  }

  public dispose(): void {
    this._body.dispose()
    this._halo.dispose()
    this._light.dispose()
    this._options.visual.bodyMaterial.dispose()
    this._options.visual.haloMaterial.dispose()
  }

  private _chooseTarget(): FireflyTarget {
    const player = this._options.player.position
    const radius = 8 + this._random() * 28
    const angle = this._random() * Math.PI * 2
    const x = player.x + Math.sin(angle) * radius
    const z = player.z + Math.cos(angle) * radius
    const groundY = this._options.terrainHeightProvider(x, z)
    const y = groundY + 0.65 + this._random() * 2.2

    return { x, y, z }
  }

  private _applyTransform(): void {
    const rawPulse = (Math.sin(this._elapsedSeconds * 3.2 + this._phase) + 1) * 0.5
    const pulse = this._smoothStep(0.38, 1, rawPulse)

    this._body.position = this._position.clone()
    this._body.visibility = pulse * 0.5
    this._body.scaling = new Vector3(
      0.75 + pulse * 0.8,
      0.75 + pulse * 0.8,
      0.75 + pulse * 0.8,
    ).scale(this._scale)
    this._halo.position = this._position.clone()
    this._halo.visibility = pulse * 0.52
    this._halo.scaling = new Vector3(0.8 + pulse * 0.45, 0.8 + pulse * 0.45, 0.8 + pulse * 0.45)
    this._light.position = this._position.clone()
    this._light.intensity = pulse * (this._worldLightingEnabled ? 0.7 : 0.38)
  }

  private _smoothStep(edge0: number, edge1: number, value: number): number {
    const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1)

    return t * t * (3 - 2 * t)
  }
}
