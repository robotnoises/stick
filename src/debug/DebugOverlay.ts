import type { GameSystem } from "../app/GameSystem"
import type { TimeOfDaySystem } from "../environment/TimeOfDaySystem"
import type { PlayerController } from "../player/PlayerController"

export interface DebugOverlayActions {
  resetWorld?(): Promise<void> | void
}

export class DebugOverlay implements GameSystem {
  private static readonly _playerEyeHeightMeters = 1.7

  private readonly _element: HTMLDivElement
  private _isEditing = false

  public constructor(
    private readonly _player: PlayerController,
    private readonly _time: TimeOfDaySystem,
    private readonly _actions: DebugOverlayActions = {},
  ) {
    this._element = document.createElement("div")
    this._element.id = "debug-overlay"
    this._element.addEventListener("click", this._handleClick)

    document.body.appendChild(this._element)
  }

  public update(_deltaSeconds: number): void {
    if (this._isEditing) {
      return
    }

    this._renderReadOnly()
  }

  public dispose(): void {
    this._element.removeEventListener("click", this._handleClick)
    this._element.remove()
  }

  private _renderReadOnly(): void {
    const position = this._player.position
    const elevationMeters = position.y - DebugOverlay._playerEyeHeightMeters

    this._element.textContent = [
      "Stick prototype",
      `pos: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`,
      `elevation: ${elevationMeters.toFixed(1)}m`,
      `heading: ${this._player.headingDegrees.toFixed(0)}°`,
      `day: ${this._time.day}`,
      `time: ${this._time.timeOfDayHours.toFixed(2)}h`,
    ].join("\n")
  }

  private _renderEditor(): void {
    const position = this._player.position
    const form = document.createElement("form")
    const submitButton = document.createElement("button")
    const cancelButton = document.createElement("button")
    const resetWorldButton = document.createElement("button")

    this._isEditing = true
    form.id = "debug-overlay-editor"
    form.noValidate = true
    form.addEventListener("click", this._handleEditorClick)
    form.addEventListener("submit", this._handleSubmit)
    submitButton.type = "submit"
    submitButton.textContent = "Apply"
    cancelButton.type = "button"
    cancelButton.textContent = "Cancel"
    cancelButton.addEventListener("click", this._handleCancel)
    resetWorldButton.type = "button"
    resetWorldButton.textContent = "Reset world"
    resetWorldButton.addEventListener("click", this._handleResetWorld)

    form.append(
      this._createHeading(),
      this._createNumberField("positionX", "x", position.x),
      this._createNumberField("positionY", "y", position.y),
      this._createNumberField("positionZ", "z", position.z),
      this._createNumberField("heading", "heading", this._player.headingDegrees),
      this._createNumberField("day", "day", this._time.day),
      this._createNumberField("timeOfDay", "time", this._time.timeOfDayHours),
      this._createButtonRow(submitButton, cancelButton),
      this._createDangerRow(resetWorldButton),
    )

    this._element.replaceChildren(form)
  }

  private _createHeading(): HTMLDivElement {
    const heading = document.createElement("div")

    heading.className = "debug-overlay-heading"
    heading.textContent = "Edit debug values"

    return heading
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

  private _createButtonRow(
    submitButton: HTMLButtonElement,
    cancelButton: HTMLButtonElement,
  ): HTMLDivElement {
    const row = document.createElement("div")

    row.className = "debug-overlay-actions"
    row.append(submitButton, cancelButton)

    return row
  }

  private _createDangerRow(resetWorldButton: HTMLButtonElement): HTMLDivElement {
    const row = document.createElement("div")

    row.className = "debug-overlay-actions debug-overlay-danger-actions"
    row.append(resetWorldButton)

    return row
  }

  private _readNumber(form: HTMLFormElement, name: string, fallback: number): number {
    const input = form.elements.namedItem(name) as HTMLInputElement
    const parsed = Number(input.value)

    return Number.isFinite(parsed) ? parsed : fallback
  }

  private _exitEditor(): void {
    this._isEditing = false
    this._renderReadOnly()
  }

  private readonly _handleClick = (event: MouseEvent): void => {
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

    this._player.setPosition(x, y, z)
    this._player.setHeadingDegrees(heading)
    this._time.setWorldTime(day, timeOfDay)
    this._exitEditor()
  }

  private readonly _handleCancel = (): void => {
    this._exitEditor()
  }

  private readonly _handleResetWorld = (): void => {
    if (!this._actions.resetWorld) {
      return
    }

    const confirmed = window.confirm(
      "Reset the world? This deletes persisted terrain chunks and reloads the game.",
    )

    if (!confirmed) {
      return
    }

    void this._actions.resetWorld()
  }
}
