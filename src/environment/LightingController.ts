import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight"
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"
import type { TimeOfDaySystem } from "./TimeOfDaySystem"

export class LightingController implements GameSystem {
  private readonly _sun: DirectionalLight
  private readonly _ambient: HemisphericLight

  public constructor(
    private readonly _context: EngineContext,
    private readonly _time: TimeOfDaySystem,
  ) {
    this._sun = new DirectionalLight("sun", new Vector3(-0.35, -0.8, 0.25), this._context.scene)
    this._sun.intensity = 1.6

    this._ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), this._context.scene)
    this._ambient.intensity = 0.45
  }

  public update(_deltaSeconds: number): void {
    const normalizedDay = this._time.timeOfDayHours / 24
    const angle = normalizedDay * Math.PI * 2 - Math.PI / 2
    const elevation = Math.sin(angle)

    this._sun.direction = new Vector3(Math.cos(angle), -Math.max(elevation, 0.05), 0.25).normalize()
    this._sun.intensity = Math.max(0.15, elevation) * 1.6
    this._ambient.intensity = 0.2 + Math.max(0, elevation) * 0.35
  }
}
