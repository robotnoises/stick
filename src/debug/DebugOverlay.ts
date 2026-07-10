import type { GameSystem } from "../app/GameSystem"
import type { TimeOfDaySystem } from "../environment/TimeOfDaySystem"
import type { PlayerController } from "../player/PlayerController"
import { DebugReadOnlyPanel } from "./DebugReadOnlyPanel"
import { DebugSettingsEditor } from "./DebugSettingsEditor"
import type { DebugMapData, DebugMapRiverData, DebugOverlayActions } from "./DebugOverlayTypes"

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
  private readonly _readOnlyPanel: DebugReadOnlyPanel
  private readonly _settingsEditor: DebugSettingsEditor
  private _isEditing = false

  public constructor(
    private readonly _player: PlayerController,
    private readonly _time: TimeOfDaySystem,
    private readonly _actions: DebugOverlayActions = {},
  ) {
    this._element = document.createElement("div")
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
    details.textContent =
      "Revealed debug view: world bounds, chunk grid, origin/start, player, and major water features."
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
        : "Revealed debug view: world bounds, chunk grid, origin/start, player, and major water features."
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
    svg.setAttribute(
      "aria-label",
      "Debug map of world bounds, grid, player, origin, and major landforms",
    )

    this._appendSvgRect(svg, padding, padding, plotSize, plotSize, "debug-map-world-bounds")
    this._appendDebugMapChunkGrid(
      svg,
      bounds,
      padding,
      plotSize,
      data.chunkSizeMeters,
      toSvgX,
      toSvgY,
    )
    this._appendDebugMapGrid(svg, bounds, padding, plotSize, toSvgX, toSvgY)

    for (const lake of data.lakes) {
      this._appendSvgEllipse(
        svg,
        toSvgX(lake.centerX),
        toSvgY(lake.centerZ),
        ((lake.radiusX + lake.shoreFalloffMeters) / width) * plotSize,
        ((lake.radiusZ + lake.shoreFalloffMeters) / depth) * plotSize,
        "debug-map-lake-shore-falloff",
      )
      this._appendSvgEllipse(
        svg,
        toSvgX(lake.centerX),
        toSvgY(lake.centerZ),
        (lake.radiusX / width) * plotSize,
        (lake.radiusZ / depth) * plotSize,
        "debug-map-lake",
      )
    }

    for (const river of data.rivers) {
      this._appendDebugMapRiverBank(svg, river, toSvgX, toSvgY, width, plotSize)
      this._appendDebugMapRiver(svg, river, toSvgX, toSvgY, width, plotSize)
    }

    this._appendSvgCircle(svg, toSvgX(0), toSvgY(0), 5, "debug-map-origin")
    const playerX = toSvgX(data.playerPosition.x)
    const playerY = toSvgY(data.playerPosition.z)

    this._appendSvgCircle(svg, playerX, playerY, 6, "debug-map-player")
    this._appendDebugMapPlayerHeading(svg, playerX, playerY, data.playerHeadingDegrees)

    return svg
  }

  private _appendDebugMapRiverBank(
    svg: SVGSVGElement,
    river: DebugMapRiverData,
    toSvgX: (worldX: number) => number,
    toSvgY: (worldZ: number) => number,
    worldWidth: number,
    plotSize: number,
  ): void {
    const strokeWidth = Math.max(
      3,
      ((river.widthMeters + river.bankFalloffMeters * 2) / worldWidth) * plotSize,
    )

    this._appendDebugMapPolyline(
      svg,
      river.points,
      toSvgX,
      toSvgY,
      "debug-map-river-bank-falloff",
      strokeWidth,
    )
  }

  private _appendDebugMapRiver(
    svg: SVGSVGElement,
    river: DebugMapRiverData,
    toSvgX: (worldX: number) => number,
    toSvgY: (worldZ: number) => number,
    worldWidth: number,
    plotSize: number,
  ): void {
    const strokeWidth = Math.max(2, (river.widthMeters / worldWidth) * plotSize)

    this._appendDebugMapPolyline(svg, river.points, toSvgX, toSvgY, "debug-map-river", strokeWidth)
  }

  private _appendDebugMapPolyline(
    svg: SVGSVGElement,
    points: ReadonlyArray<readonly [number, number]>,
    toSvgX: (worldX: number) => number,
    toSvgY: (worldZ: number) => number,
    className: string,
    strokeWidth: number,
  ): void {
    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline")

    polyline.setAttribute("points", points.map(([x, z]) => `${toSvgX(x)},${toSvgY(z)}`).join(" "))
    polyline.setAttribute("class", className)
    polyline.setAttribute("stroke-width", String(strokeWidth))
    svg.appendChild(polyline)
  }

  private _appendDebugMapPlayerHeading(
    svg: SVGSVGElement,
    playerX: number,
    playerY: number,
    headingDegrees: number,
  ): void {
    const radians = headingDegrees * (Math.PI / 180)
    const length = 24
    const endX = playerX + Math.sin(radians) * length
    const endY = playerY - Math.cos(radians) * length
    const arrowLeftX = endX - Math.sin(radians + Math.PI / 4) * 8
    const arrowLeftY = endY + Math.cos(radians + Math.PI / 4) * 8
    const arrowRightX = endX - Math.sin(radians - Math.PI / 4) * 8
    const arrowRightY = endY + Math.cos(radians - Math.PI / 4) * 8

    this._appendSvgLine(svg, playerX, playerY, endX, endY, "debug-map-player-heading")
    this._appendSvgLine(svg, endX, endY, arrowLeftX, arrowLeftY, "debug-map-player-heading")
    this._appendSvgLine(svg, endX, endY, arrowRightX, arrowRightY, "debug-map-player-heading")
  }

  private _appendDebugMapChunkGrid(
    svg: SVGSVGElement,
    bounds: DebugMapData["worldBounds"],
    padding: number,
    plotSize: number,
    chunkSizeMeters: number,
    toSvgX: (worldX: number) => number,
    toSvgY: (worldZ: number) => number,
  ): void {
    const startX = Math.ceil(bounds.minX / chunkSizeMeters) * chunkSizeMeters
    const startZ = Math.ceil(bounds.minZ / chunkSizeMeters) * chunkSizeMeters

    for (let x = startX; x <= bounds.maxX; x += chunkSizeMeters) {
      this._appendSvgLine(
        svg,
        toSvgX(x),
        padding,
        toSvgX(x),
        padding + plotSize,
        "debug-map-chunk-grid",
      )
    }

    for (let z = startZ; z <= bounds.maxZ; z += chunkSizeMeters) {
      this._appendSvgLine(
        svg,
        padding,
        toSvgY(z),
        padding + plotSize,
        toSvgY(z),
        "debug-map-chunk-grid",
      )
    }
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
    const data = this._actions.getDebugMapData?.()

    if (!data) {
      return
    }

    this._renderDebugMap(data)
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
