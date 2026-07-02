import { PointLight } from "@babylonjs/core/Lights/pointLight"
import { SpotLight } from "@babylonjs/core/Lights/spotLight"
import { Color3 } from "@babylonjs/core/Maths/math.color"
import type { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"
import type { PlayerController } from "../player/PlayerController"

export interface FlashlightToggleResult {
  readonly enabled: boolean
  readonly message: string
}

export interface FlashlightUseAction {
  toggle(): FlashlightToggleResult
}

export class FlashlightController implements GameSystem, FlashlightUseAction {
  private static readonly _beamAngleRadians = Math.PI / 8
  private static readonly _beamExponent = 8
  private static readonly _spillAngleRadians = Math.PI / 3.2
  private static readonly _spillExponent = 1.2
  private static readonly _enabledIntensity = 2.4
  private static readonly _spillIntensity = 0.45
  private static readonly _fillIntensity = 0.55
  private static readonly _rangeMeters = 42
  private static readonly _spillRangeMeters = 36
  private static readonly _fillRangeMeters = 22
  private static readonly _fillOffsetMeters = 5

  private readonly _light: SpotLight
  private readonly _spillLight: SpotLight
  private readonly _fillLight: PointLight
  private _enabled = false

  public constructor(
    private readonly _context: EngineContext,
    private readonly _player: PlayerController,
  ) {
    this._light = new SpotLight(
      "solar-flashlight-core-beam",
      this._player.position,
      this._player.forwardDirection,
      FlashlightController._beamAngleRadians,
      FlashlightController._beamExponent,
      this._context.scene,
    )
    this._spillLight = new SpotLight(
      "solar-flashlight-soft-spill",
      this._player.position,
      this._player.forwardDirection,
      FlashlightController._spillAngleRadians,
      FlashlightController._spillExponent,
      this._context.scene,
    )
    this._fillLight = new PointLight(
      "solar-flashlight-bounce-fill",
      this._player.position,
      this._context.scene,
    )

    this._light.diffuse = new Color3(0.95, 0.96, 0.86)
    this._light.specular = new Color3(0.7, 0.72, 0.62)
    this._light.range = FlashlightController._rangeMeters
    this._light.intensity = 0
    this._spillLight.diffuse = new Color3(0.62, 0.68, 0.58)
    this._spillLight.specular = new Color3(0.25, 0.28, 0.22)
    this._spillLight.range = FlashlightController._spillRangeMeters
    this._spillLight.intensity = 0
    this._fillLight.diffuse = new Color3(0.48, 0.52, 0.43)
    this._fillLight.specular = new Color3(0.12, 0.13, 0.1)
    this._fillLight.range = FlashlightController._fillRangeMeters
    this._fillLight.intensity = 0
  }

  public get enabled(): boolean {
    return this._enabled
  }

  public toggle(): FlashlightToggleResult {
    this.setEnabled(!this._enabled)

    return {
      enabled: this._enabled,
      message: this._enabled ? "Solar flashlight on." : "Solar flashlight off.",
    }
  }

  public setEnabled(enabled: boolean): void {
    this._enabled = enabled
    this._light.intensity = enabled ? FlashlightController._enabledIntensity : 0
    this._spillLight.intensity = enabled ? FlashlightController._spillIntensity : 0
    this._fillLight.intensity = enabled ? FlashlightController._fillIntensity : 0
    this._updateLightTransform()
  }

  public update(_deltaSeconds: number): void {
    this._updateLightTransform()
  }

  public dispose(): void {
    this._light.dispose()
    this._spillLight.dispose()
    this._fillLight.dispose()
  }

  private _updateLightTransform(): void {
    const forward = this._player.forwardDirection.normalize()

    const position = this._getLightPosition(forward)

    this._light.position = position
    this._light.direction = forward
    this._spillLight.position = position
    this._spillLight.direction = forward
    this._fillLight.position = position.add(forward.scale(FlashlightController._fillOffsetMeters))
  }

  private _getLightPosition(forward: Vector3): Vector3 {
    return this._player.position.add(forward.scale(0.35))
  }
}
