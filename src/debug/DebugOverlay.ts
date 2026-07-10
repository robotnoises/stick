import type { GameSystem } from "../app/GameSystem"
import type { TimeOfDaySystem } from "../environment/TimeOfDaySystem"
import type { PlayerController } from "../player/PlayerController"
import { DebugMapRenderer } from "./DebugMapRenderer"
import { DebugReadOnlyPanel } from "./DebugReadOnlyPanel"
import { DebugSettingsEditor } from "./DebugSettingsEditor"
import type { DebugOverlayActions } from "./DebugOverlayTypes"

export type {
  DebugMapData,
  DebugMapLakeData,
  DebugMapRiverData,
  DebugOverlayActions,
  DebugTerrainGenerationStats,
  DebugTerrainMeshBuildStats,
  DebugTerrainStreamingStats,
} from "./DebugOverlayTypes"

export class DebugOverlay implements GameSystem {
  private readonly _element: HTMLDivElement
  private readonly _mapRenderer: DebugMapRenderer
  private readonly _readOnlyPanel: DebugReadOnlyPanel
  private readonly _settingsEditor: DebugSettingsEditor
  private _isEditing = false

  public constructor(
    private readonly _player: PlayerController,
    private readonly _time: TimeOfDaySystem,
    private readonly _actions: DebugOverlayActions = {},
  ) {
    this._element = document.createElement("div")
    this._mapRenderer = new DebugMapRenderer(this._player, () => this._exitEditor())
    this._readOnlyPanel = new DebugReadOnlyPanel(this._player, this._time, this._actions)
    this._settingsEditor = new DebugSettingsEditor(this._player, this._time, this._actions, {
      onCancel: this._handleCancel,
      onClick: this._handleEditorClick,
      onNewWorld: this._handleNewWorld,
      onResetTerrainCache: this._handleResetTerrainCache,
      onRevealMap: this._handleRevealMap,
      onSubmit: this._handleSubmit,
    })
    this._element.id = "debug-overlay"
    this._element.addEventListener("pointerdown", this._handleOpenEditor)
    this._element.addEventListener("click", this._handleOpenEditor)

    document.body.appendChild(this._element)
  }

  public update(_deltaSeconds: number): void {
    if (this._isEditing) {
      return
    }

    this._renderReadOnly()
  }

  public dispose(): void {
    this._element.removeEventListener("pointerdown", this._handleOpenEditor)
    this._element.removeEventListener("click", this._handleOpenEditor)
    this._element.remove()
  }

  private _renderReadOnly(): void {
    this._readOnlyPanel.render(this._element)
  }

  private _renderEditor(): void {
    this._isEditing = true
    this._settingsEditor.render(this._element)
  }

  private _renderDebugMap(): void {
    const data = this._actions.getDebugMapData?.()

    if (data) {
      this._mapRenderer.render(data)
    }
  }

  private _readNumber(form: HTMLFormElement, name: string, fallback: number): number {
    const input = form.elements.namedItem(name) as HTMLInputElement
    const parsed = Number(input.value)

    return Number.isFinite(parsed) ? parsed : fallback
  }

  private _readOptionalCheckbox(form: HTMLFormElement, name: string): boolean | null {
    const input = form.elements.namedItem(name) as HTMLInputElement | null

    return input ? input.checked : null
  }

  private _exitEditor(): void {
    this._isEditing = false
    this._renderReadOnly()
  }

  private readonly _handleOpenEditor = (event: Event): void => {
    event.stopPropagation()

    if (this._isEditing) {
      return
    }

    this._renderEditor()
  }

  private readonly _handleEditorClick = (event: MouseEvent): void => {
    event.stopPropagation()
  }

  private readonly _handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault()

    const form = event.currentTarget as HTMLFormElement
    const position = this._player.position
    const x = this._readNumber(form, "positionX", position.x)
    const y = this._readNumber(form, "positionY", position.y)
    const z = this._readNumber(form, "positionZ", position.z)
    const heading = this._readNumber(form, "heading", this._player.headingDegrees)
    const day = this._readNumber(form, "day", this._time.day)
    const timeOfDay = this._readNumber(form, "timeOfDay", this._time.timeOfDayHours)
    const currentSeed = this._actions.getWorldSeed?.()
    const nextSeed =
      currentSeed === undefined
        ? null
        : Math.floor(this._readNumber(form, "worldSeed", currentSeed))
    const chunkBoundariesEnabled = this._readOptionalCheckbox(form, "chunkBoundaries")

    if (
      currentSeed !== undefined &&
      nextSeed !== null &&
      nextSeed !== currentSeed &&
      this._actions.setWorldSeed
    ) {
      const confirmed = window.confirm(
        `Set world seed to ${nextSeed}? This will clear terrain chunks and reload the game.`,
      )

      if (!confirmed) {
        return
      }

      void this._actions.setWorldSeed(nextSeed)
      return
    }

    this._player.setPosition(x, y, z)
    this._player.setHeadingDegrees(heading)
    this._time.setWorldTime(day, timeOfDay)

    if (chunkBoundariesEnabled !== null) {
      this._actions.setChunkBoundariesDebugEnabled?.(chunkBoundariesEnabled)
    }

    this._exitEditor()
  }

  private readonly _handleCancel = (): void => {
    this._exitEditor()
  }

  private readonly _handleRevealMap = (): void => {
    this._renderDebugMap()
  }

  private readonly _handleResetTerrainCache = (): void => {
    if (!this._actions.resetTerrainCache) {
      return
    }

    const confirmed = window.confirm(
      "Reset terrain cache? This deletes persisted terrain chunks but keeps the current world seed.",
    )

    if (!confirmed) {
      return
    }

    void this._actions.resetTerrainCache()
  }

  private readonly _handleNewWorld = (): void => {
    if (!this._actions.createNewWorld) {
      return
    }

    const confirmed = window.confirm(
      "Create a new random world? This changes the seed, deletes terrain chunks, and reloads the game.",
    )

    if (!confirmed) {
      return
    }

    void this._actions.createNewWorld()
  }
}
