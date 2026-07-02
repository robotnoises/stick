import type { GameSystem } from "../app/GameSystem"
import type { TimeOfDaySystem } from "../environment/TimeOfDaySystem"
import type { PlayerController } from "../player/PlayerController"

export interface DebugMapLakeData {
  readonly id: string
  readonly centerX: number
  readonly centerZ: number
  readonly radiusX: number
  readonly radiusZ: number
}

export interface DebugMapData {
  readonly worldBounds: {
    readonly minX: number
    readonly maxX: number
    readonly minZ: number
    readonly maxZ: number
  }
  readonly playerPosition: {
    readonly x: number
    readonly z: number
  }
  readonly lakes: readonly DebugMapLakeData[]
}

export interface DebugOverlayActions {
  resetWorld?(): Promise<void> | void
  getDebugMapData?(): DebugMapData
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
    const revealMapButton = document.createElement("button")

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
    revealMapButton.type = "button"
    revealMapButton.textContent = "Reveal world map"
    revealMapButton.addEventListener("click", this._handleRevealMap)

    form.append(
      this._createHeading(),
      this._createNumberField("positionX", "x", position.x),
      this._createNumberField("positionY", "y", position.y),
      this._createNumberField("positionZ", "z", position.z),
      this._createNumberField("heading", "heading", this._player.headingDegrees),
      this._createNumberField("day", "day", this._time.day),
      this._createNumberField("timeOfDay", "time", this._time.timeOfDayHours),
      this._createButtonRow(submitButton, cancelButton),
      this._createDebugToolRow(revealMapButton),
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

  private _createDebugToolRow(button: HTMLButtonElement): HTMLDivElement {
    const row = document.createElement("div")

    row.className = "debug-overlay-actions debug-overlay-tool-actions"
    row.append(button)

    return row
  }

  private _createDangerRow(resetWorldButton: HTMLButtonElement): HTMLDivElement {
    const row = document.createElement("div")

    row.className = "debug-overlay-actions debug-overlay-danger-actions"
    row.append(resetWorldButton)

    return row
  }

  private _renderDebugMap(data: DebugMapData): void {
    const existing = document.querySelector("#debug-world-map-modal")

    existing?.remove()

    const modal = document.createElement("div")
    const panel = document.createElement("section")
    const title = document.createElement("h2")
    const details = document.createElement("p")
    const closeButton = document.createElement("button")
    const placePlayerButton = document.createElement("button")
    const svg = this._createDebugMapSvg(data)
    let isPlacingPlayer = false

    modal.id = "debug-world-map-modal"
    panel.id = "debug-world-map-panel"
    title.textContent = "Debug world map"
    details.textContent = "Revealed debug view: world bounds, grid, origin/start, player, and major water features."
    closeButton.type = "button"
    closeButton.textContent = "Close"
    closeButton.addEventListener("click", () => modal.remove())
    placePlayerButton.type = "button"
    placePlayerButton.textContent = "Place player"
    placePlayerButton.addEventListener("click", () => {
      isPlacingPlayer = !isPlacingPlayer
      svg.classList.toggle("debug-map-placing-player", isPlacingPlayer)
      details.textContent = isPlacingPlayer
        ? "Click any point inside the map to move the player there. A confirmation prompt will appear."
        : "Revealed debug view: world bounds, grid, origin/start, player, and major water features."
    })
    svg.addEventListener("click", (event) => {
      if (!isPlacingPlayer) {
        return
      }

      event.stopPropagation()
      const target = this._getWorldPositionFromDebugMapClick(event, svg, data)
      const confirmed = window.confirm(
        `Move player to x=${target.x.toFixed(1)}, z=${target.z.toFixed(1)}?`,
      )

      if (!confirmed) {
        return
      }

      const position = this._player.position

      this._player.setPosition(target.x, position.y, target.z)
      modal.remove()
      this._exitEditor()
    })
    modal.addEventListener("click", () => modal.remove())
    panel.addEventListener("click", (event) => event.stopPropagation())

    panel.append(title, details, svg, this._createDebugMapButtonRow(placePlayerButton, closeButton))
    modal.append(panel)
    document.body.appendChild(modal)
  }

  private _createDebugMapButtonRow(
    placePlayerButton: HTMLButtonElement,
    closeButton: HTMLButtonElement,
  ): HTMLDivElement {
    const row = document.createElement("div")

    row.className = "debug-world-map-actions"
    row.append(placePlayerButton, closeButton)

    return row
  }

  private _getWorldPositionFromDebugMapClick(
    event: MouseEvent,
    svg: SVGSVGElement,
    data: DebugMapData,
  ): { readonly x: number; readonly z: number } {
    const size = 640
    const padding = 36
    const plotSize = size - padding * 2
    const bounds = data.worldBounds
    const rect = svg.getBoundingClientRect()
    const localX = ((event.clientX - rect.left) / rect.width) * size
    const localY = ((event.clientY - rect.top) / rect.height) * size
    const normalizedX = Math.min(Math.max((localX - padding) / plotSize, 0), 1)
    const normalizedZ = Math.min(Math.max((localY - padding) / plotSize, 0), 1)

    return {
      x: bounds.minX + normalizedX * (bounds.maxX - bounds.minX),
      z: bounds.maxZ - normalizedZ * (bounds.maxZ - bounds.minZ),
    }
  }

  private _createDebugMapSvg(data: DebugMapData): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    const size = 640
    const padding = 36
    const bounds = data.worldBounds
    const width = bounds.maxX - bounds.minX
    const depth = bounds.maxZ - bounds.minZ
    const plotSize = size - padding * 2
    const toSvgX = (worldX: number): number => padding + ((worldX - bounds.minX) / width) * plotSize
    const toSvgY = (worldZ: number): number => padding + ((bounds.maxZ - worldZ) / depth) * plotSize

    svg.setAttribute("viewBox", `0 0 ${size} ${size}`)
    svg.setAttribute("role", "img")
    svg.setAttribute("aria-label", "Debug map of world bounds, grid, player, origin, and major landforms")

    this._appendSvgRect(svg, padding, padding, plotSize, plotSize, "debug-map-world-bounds")
    this._appendDebugMapGrid(svg, bounds, padding, plotSize, toSvgX, toSvgY)

    for (const lake of data.lakes) {
      this._appendSvgEllipse(
        svg,
        toSvgX(lake.centerX),
        toSvgY(lake.centerZ),
        (lake.radiusX / width) * plotSize,
        (lake.radiusZ / depth) * plotSize,
        "debug-map-lake",
      )
    }

    this._appendSvgCircle(svg, toSvgX(0), toSvgY(0), 5, "debug-map-origin")
    this._appendSvgCircle(
      svg,
      toSvgX(data.playerPosition.x),
      toSvgY(data.playerPosition.z),
      6,
      "debug-map-player",
    )

    return svg
  }

  private _appendDebugMapGrid(
    svg: SVGSVGElement,
    bounds: DebugMapData["worldBounds"],
    padding: number,
    plotSize: number,
    toSvgX: (worldX: number) => number,
    toSvgY: (worldZ: number) => number,
  ): void {
    const gridMeters = 1000
    const startX = Math.ceil(bounds.minX / gridMeters) * gridMeters
    const startZ = Math.ceil(bounds.minZ / gridMeters) * gridMeters

    for (let x = startX; x <= bounds.maxX; x += gridMeters) {
      this._appendSvgLine(svg, toSvgX(x), padding, toSvgX(x), padding + plotSize, "debug-map-grid")
    }

    for (let z = startZ; z <= bounds.maxZ; z += gridMeters) {
      this._appendSvgLine(svg, padding, toSvgY(z), padding + plotSize, toSvgY(z), "debug-map-grid")
    }
  }

  private _appendSvgRect(
    svg: SVGSVGElement,
    x: number,
    y: number,
    width: number,
    height: number,
    className: string,
  ): void {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")

    rect.setAttribute("x", String(x))
    rect.setAttribute("y", String(y))
    rect.setAttribute("width", String(width))
    rect.setAttribute("height", String(height))
    rect.setAttribute("class", className)
    svg.appendChild(rect)
  }

  private _appendSvgLine(
    svg: SVGSVGElement,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    className: string,
  ): void {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line")

    line.setAttribute("x1", String(x1))
    line.setAttribute("y1", String(y1))
    line.setAttribute("x2", String(x2))
    line.setAttribute("y2", String(y2))
    line.setAttribute("class", className)
    svg.appendChild(line)
  }

  private _appendSvgCircle(
    svg: SVGSVGElement,
    cx: number,
    cy: number,
    radius: number,
    className: string,
  ): void {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")

    circle.setAttribute("cx", String(cx))
    circle.setAttribute("cy", String(cy))
    circle.setAttribute("r", String(radius))
    circle.setAttribute("class", className)
    svg.appendChild(circle)
  }

  private _appendSvgEllipse(
    svg: SVGSVGElement,
    cx: number,
    cy: number,
    radiusX: number,
    radiusY: number,
    className: string,
  ): void {
    const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse")

    ellipse.setAttribute("cx", String(cx))
    ellipse.setAttribute("cy", String(cy))
    ellipse.setAttribute("rx", String(radiusX))
    ellipse.setAttribute("ry", String(radiusY))
    ellipse.setAttribute("class", className)
    svg.appendChild(ellipse)
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

  private readonly _handleRevealMap = (): void => {
    const data = this._actions.getDebugMapData?.()

    if (!data) {
      return
    }

    this._renderDebugMap(data)
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
