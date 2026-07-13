import type { TimeOfDaySystem } from "../environment/TimeOfDaySystem"
import type { PlayerController } from "../player/PlayerController"
import type { DebugOverlayActions } from "./DebugOverlayTypes"

export interface DebugSettingsEditorHandlers {
  readonly onCancel: () => void
  readonly onClick: (event: MouseEvent) => void
  readonly onNewWorld: () => void
  readonly onResetTerrainCache: () => void
  readonly onRevealMap: () => void
  readonly onSubmit: (event: SubmitEvent) => void
}

export class DebugSettingsEditor {
  public constructor(
    private readonly _player: PlayerController,
    private readonly _time: TimeOfDaySystem,
    private readonly _actions: DebugOverlayActions,
    private readonly _handlers: DebugSettingsEditorHandlers,
  ) {}

  public render(element: HTMLDivElement): void {
    const position = this._player.position
    const form = document.createElement("form")
    const submitButton = document.createElement("button")
    const cancelButton = document.createElement("button")
    const resetTerrainCacheButton = document.createElement("button")
    const newWorldButton = document.createElement("button")
    const revealMapButton = document.createElement("button")
    const placeFireButton = document.createElement("button")

    element.classList.remove("debug-overlay-readonly-mode")
    element.classList.add("debug-overlay-editor-mode")
    form.id = "debug-overlay-editor"
    form.noValidate = true
    form.addEventListener("click", this._handlers.onClick)
    form.addEventListener("submit", this._handlers.onSubmit)
    submitButton.type = "submit"
    submitButton.textContent = "Apply"
    cancelButton.type = "button"
    cancelButton.textContent = "Cancel"
    cancelButton.addEventListener("click", this._handlers.onCancel)
    resetTerrainCacheButton.type = "button"
    resetTerrainCacheButton.textContent = "Reset terrain cache"
    resetTerrainCacheButton.addEventListener("click", this._handlers.onResetTerrainCache)
    newWorldButton.type = "button"
    newWorldButton.textContent = "New random world"
    newWorldButton.addEventListener("click", this._handlers.onNewWorld)
    revealMapButton.type = "button"
    revealMapButton.textContent = "Reveal world map"
    revealMapButton.addEventListener("click", this._handlers.onRevealMap)
    placeFireButton.type = "button"
    placeFireButton.textContent = "Place medium fire"
    placeFireButton.addEventListener("click", () => this._actions.placeMediumFire?.())
    placeFireButton.hidden = !this._actions.placeMediumFire

    form.append(
      this._createHeading(),
      this._createNumberField("positionX", "x", position.x),
      this._createNumberField("positionY", "y", position.y),
      this._createNumberField("positionZ", "z", position.z),
      this._createNumberField("heading", "heading", this._player.headingDegrees),
      this._createNumberField("day", "day", this._time.day),
      this._createNumberField("timeOfDay", "time", this._time.timeOfDayHours),
      this._createOptionalSeedField(),
      this._createOptionalChunkBoundaryField(),
      this._createButtonRow(submitButton, cancelButton),
      this._createDebugToolRow(revealMapButton, placeFireButton),
      this._createDangerRow(resetTerrainCacheButton, newWorldButton),
    )

    element.replaceChildren(form)
  }

  private _createHeading(): HTMLDivElement {
    const heading = document.createElement("div")

    heading.className = "debug-overlay-heading"
    heading.textContent = "Edit debug values"

    return heading
  }

  private _createOptionalSeedField(): HTMLLabelElement | DocumentFragment {
    const seed = this._actions.getWorldSeed?.()

    if (seed === undefined) {
      return document.createDocumentFragment()
    }

    return this._createNumberField("worldSeed", "seed", seed)
  }

  private _createOptionalChunkBoundaryField(): HTMLLabelElement | DocumentFragment {
    const enabled = this._actions.getChunkBoundariesDebugEnabled?.()

    if (enabled === undefined) {
      return document.createDocumentFragment()
    }

    return this._createCheckboxField("chunkBoundaries", "chunks", enabled)
  }

  private _createCheckboxField(
    name: string,
    labelText: string,
    checked: boolean,
  ): HTMLLabelElement {
    const label = document.createElement("label")
    const labelSpan = document.createElement("span")
    const input = document.createElement("input")

    labelSpan.textContent = labelText
    input.name = name
    input.type = "checkbox"
    input.checked = checked

    label.append(labelSpan, input)

    return label
  }

  private _createNumberField(name: string, labelText: string, value: number): HTMLLabelElement {
    const label = document.createElement("label")
    const labelSpan = document.createElement("span")
    const input = document.createElement("input")

    labelSpan.textContent = labelText
    input.name = name
    input.type = "number"
    input.step = "any"
    input.value = value.toFixed(2)

    label.append(labelSpan, input)

    return label
  }

  private _createButtonRow(...buttons: HTMLButtonElement[]): HTMLDivElement {
    const row = document.createElement("div")

    row.className = "debug-overlay-actions"
    row.append(...buttons)

    return row
  }

  private _createDebugToolRow(...buttons: HTMLButtonElement[]): HTMLDivElement {
    const row = document.createElement("div")
    const heading = document.createElement("div")

    row.className = "debug-overlay-command-section"
    heading.className = "debug-overlay-command-heading"
    heading.textContent = "Debug tools"
    row.append(heading, this._createButtonRow(...buttons))

    return row
  }

  private _createDangerRow(
    resetTerrainCacheButton: HTMLButtonElement,
    newWorldButton: HTMLButtonElement,
  ): HTMLDivElement {
    const row = document.createElement("div")
    const heading = document.createElement("div")

    row.className = "debug-overlay-command-section debug-overlay-danger-section"
    heading.className = "debug-overlay-command-heading"
    heading.textContent = "Danger zone"
    row.append(heading, this._createButtonRow(resetTerrainCacheButton, newWorldButton))

    return row
  }
}
