import type { TimeOfDaySystem } from "../environment/TimeOfDaySystem"
import type { PlayerController } from "../player/PlayerController"
import type {
  DebugOverlayActions,
  DebugTerrainGenerationStats,
  DebugTerrainMeshBuildStats,
} from "./DebugOverlayTypes"

export class DebugReadOnlyPanel {
  private static readonly _playerEyeHeightMeters = 1.7

  public constructor(
    private readonly _player: PlayerController,
    private readonly _time: TimeOfDaySystem,
    private readonly _actions: DebugOverlayActions,
  ) {}

  public render(element: HTMLDivElement): void {
    element.classList.remove("debug-overlay-editor-mode")
    element.classList.add("debug-overlay-readonly-mode")

    const position = this._player.position
    const elevationMeters = position.y - DebugReadOnlyPanel._playerEyeHeightMeters
    const rows: Array<readonly [string, string]> = [
      ["pos", `${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`],
      ["elevation", `${elevationMeters.toFixed(1)}m`],
      ["water", `${this._player.waterState}, depth ${this._player.waterDepthMeters.toFixed(1)}m`],
      ["heading", `${this._player.headingDegrees.toFixed(0)}°`],
      ["day", String(this._time.day)],
      ["time", `${this._time.timeOfDayHours.toFixed(2)}h`],
      ...this._getTerrainStreamingDebugRows(),
    ]

    element.replaceChildren(
      this._createTitle(),
      ...rows.map((row) => this._createRow(row[0], row[1])),
    )
  }

  private _createTitle(): HTMLDivElement {
    const title = document.createElement("div")

    title.className = "debug-overlay-readonly-title"
    title.textContent = "Stick prototype"

    return title
  }

  private _createRow(labelText: string, valueText: string): HTMLDivElement {
    const row = document.createElement("div")
    const label = document.createElement("span")
    const value = document.createElement("span")

    row.className = "debug-overlay-readonly-row"
    label.className = "debug-overlay-readonly-label"
    value.className = "debug-overlay-readonly-value"
    label.textContent = `${labelText}: `
    value.textContent = valueText
    row.append(label, value)

    return row
  }

  private _getTerrainStreamingDebugRows(): Array<readonly [string, string]> {
    const stats = this._actions.getTerrainStreamingStats?.()

    if (!stats) {
      return []
    }

    const maxLoads = stats.maxChunkLoadsPerFrame ?? "unlimited"

    return [
      [
        "chunks",
        `active ${stats.activeChunkCount}, queued ${stats.queuedChunkCount}, loading ${stats.inFlightChunkCount}`,
      ],
      ["chunk cache", String(stats.cachedChunkDataCount)],
      ["budget", `${maxLoads}/frame`],
      ...this._getTerrainGenerationDebugRows(stats.terrainGeneration),
      ...this._getTerrainMeshBuildDebugRows(stats.terrainMeshBuild),
    ]
  }

  private _getTerrainGenerationDebugRows(
    stats: DebugTerrainGenerationStats | null,
  ): Array<readonly [string, string]> {
    if (!stats) {
      return []
    }

    const last = this._formatOptionalMilliseconds(stats.lastGenerationMilliseconds)
    const average = this._formatOptionalMilliseconds(stats.averageGenerationMilliseconds)
    const mode = stats.workerAvailable ? "worker" : "fallback"

    return [
      ["terrain gen", `${mode}, pending ${stats.pendingRequestCount}`],
      ["worker done", String(stats.completedWorkerRequestCount)],
      ["fallback", String(stats.fallbackGenerationCount)],
      ["worker errors", String(stats.workerErrorCount)],
      ...this._getTerrainGenerationErrorRows(stats.lastWorkerErrorMessage),
      ["terrain gen ms", `last ${last}, avg ${average}`],
    ]
  }

  private _getTerrainGenerationErrorRows(
    errorMessage: string | null,
  ): Array<readonly [string, string]> {
    return errorMessage ? [["worker error", errorMessage]] : []
  }

  private _getTerrainMeshBuildDebugRows(
    stats: DebugTerrainMeshBuildStats,
  ): Array<readonly [string, string]> {
    const last = this._formatOptionalMilliseconds(stats.lastBuildMilliseconds)
    const average = this._formatOptionalMilliseconds(stats.averageBuildMilliseconds)

    return [
      ["mesh builds", String(stats.builtChunkCount)],
      ["mesh build ms", `last ${last}, avg ${average}`],
    ]
  }

  private _formatOptionalMilliseconds(value: number | null): string {
    return value === null ? "n/a" : value.toFixed(1)
  }
}
