import type { GameSystem } from "../app/GameSystem"
import type { PlayerController } from "../player/PlayerController"
import type { TimeOfDaySystem } from "../environment/TimeOfDaySystem"

export class DebugOverlay implements GameSystem {
  private static readonly _playerEyeHeightMeters = 1.7

  private readonly _element: HTMLDivElement

  public constructor(
    private readonly _player: PlayerController,
    private readonly _time: TimeOfDaySystem,
  ) {
    this._element = document.createElement("div")
    this._element.id = "debug-overlay"

    document.body.appendChild(this._element)
  }

  public update(_deltaSeconds: number): void {
    const position = this._player.position
    const elevationMeters = position.y - DebugOverlay._playerEyeHeightMeters

    this._element.textContent = [
      "Stick prototype",
      `pos: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`,
      `elevation: ${elevationMeters.toFixed(1)}m`,
      `heading: ${this._player.headingDegrees.toFixed(0)}°`,
      `time: ${this._time.timeOfDayHours.toFixed(2)}h`,
    ].join("\n")
  }

  public dispose(): void {
    this._element.remove()
  }
}
