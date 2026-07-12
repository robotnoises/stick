import { useRef, useState } from "preact/hooks"
import type { WorldBounds } from "../../app/GameConfig"
import type {
  MapDrawing,
  MapDrawingLabel,
  MapDrawingPoint,
  MapDrawingStroke,
} from "../../cartography/MapDrawing"
import { Modal } from "./Modal"

export interface MapModalProps {
  readonly drawings: readonly MapDrawing[]
  readonly onClose: () => void
  readonly onSaveDrawings: (drawings: readonly MapDrawing[]) => Promise<void>
  readonly playerHeadingDegrees: number
  readonly playerX: number
  readonly playerZ: number
  readonly worldBounds: WorldBounds
}

const mapSize = 520
const mapPadding = 0
const gridMeters = 1000
const pencilColor = "#5b3624"
const pencilWidthMeters = 32
const eraserRadiusMeters = 95
type MapTool = "eraser" | "label" | "pencil"
type ActiveMapTool = MapTool | null
type MapEditAction =
  | { readonly type: "add-drawing"; readonly drawingId: string }
  | { readonly type: "restore-drawings"; readonly drawings: readonly MapDrawing[] }

export function MapModal({
  drawings,
  onClose,
  onSaveDrawings,
  playerHeadingDegrees,
  playerX,
  playerZ,
  worldBounds,
}: MapModalProps) {
  const [activeTool, setActiveTool] = useState<ActiveMapTool>(null)
  const [hoveredLabel, setHoveredLabel] = useState<MapDrawingLabel | null>(null)
  const [mapDrawings, setMapDrawings] = useState<readonly MapDrawing[]>(drawings)
  const [activeStroke, setActiveStroke] = useState<MapDrawingStroke | null>(null)
  const [unsavedActions, setUnsavedActions] = useState<readonly MapEditAction[]>([])
  const eraseStartDrawings = useRef<readonly MapDrawing[] | null>(null)
  const didErase = useRef(false)
  const isErasing = useRef(false)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const plotSize = mapSize - mapPadding * 2
  const toMapX = (worldX: number): number =>
    mapPadding + ((worldX - worldBounds.minX) / (worldBounds.maxX - worldBounds.minX)) * plotSize
  const toMapY = (worldZ: number): number =>
    mapPadding + ((worldBounds.maxZ - worldZ) / (worldBounds.maxZ - worldBounds.minZ)) * plotSize
  const toWorldX = (mapX: number): number =>
    worldBounds.minX + ((mapX - mapPadding) / plotSize) * (worldBounds.maxX - worldBounds.minX)
  const toWorldZ = (mapY: number): number =>
    worldBounds.maxZ - ((mapY - mapPadding) / plotSize) * (worldBounds.maxZ - worldBounds.minZ)
  const centerX = toMapX(0)
  const centerY = toMapY(0)
  const playerMapX = toMapX(playerX)
  const playerMapY = toMapY(playerZ)
  const verticalGridLines = createGridValues(worldBounds.minX, worldBounds.maxX, gridMeters)
  const horizontalGridLines = createGridValues(worldBounds.minZ, worldBounds.maxZ, gridMeters)
  const renderedDrawings = activeStroke ? [...mapDrawings, activeStroke] : mapDrawings

  const saveAndClose = (): void => {
    void onSaveDrawings(mapDrawings).finally(onClose)
  }

  const undo = (): void => {
    const action = unsavedActions.at(-1)

    if (!action) {
      return
    }

    if (action.type === "add-drawing") {
      setMapDrawings((current) => current.filter((drawing) => drawing.id !== action.drawingId))
    } else {
      setMapDrawings(action.drawings)
    }

    setUnsavedActions((current) => current.slice(0, -1))
  }

  const eraseAt = (point: MapDrawingPoint): void => {
    setMapDrawings((current) => {
      let changed = false
      const replacedIds = new Set<string>()
      const nextDrawings = current.flatMap<MapDrawing>((drawing) => {
        if (drawing.type === "label") {
          if (getDistance(point, drawing.point) > eraserRadiusMeters) {
            return [drawing]
          }

          changed = true
          replacedIds.add(drawing.id)
          return []
        }

        const erased = eraseStrokeAtPoint(drawing, point, eraserRadiusMeters)

        if (erased.length === 1 && erased[0] === drawing) {
          return [drawing]
        }

        changed = true
        replacedIds.add(drawing.id)
        return erased
      })

      if (!changed) {
        return current
      }

      setUnsavedActions((actions) =>
        actions.filter(
          (action) => action.type !== "add-drawing" || !replacedIds.has(action.drawingId),
        ),
      )

      didErase.current = true

      return nextDrawings
    })
  }

  const handlePointerDown = (event: PointerEvent): void => {
    const point = getMapPoint(event, svgRef.current)

    if (!point) {
      return
    }

    ;(event.currentTarget as SVGSVGElement | null)?.setPointerCapture(event.pointerId)

    if (activeTool === "eraser") {
      eraseStartDrawings.current = mapDrawings
      didErase.current = false
      isErasing.current = true
      return
    }

    if (activeTool === "label") {
      const text = window.prompt("Map note")?.trim()

      if (!text) {
        return
      }

      const label: MapDrawingLabel = {
        id: createDrawingId(),
        type: "label",
        point,
        text,
      }

      setMapDrawings((current) => [...current, label])
      setUnsavedActions((current) => [...current, { type: "add-drawing", drawingId: label.id }])
      return
    }

    if (activeTool === "pencil") {
      setActiveStroke({
        id: createDrawingId(),
        type: "stroke",
        color: pencilColor,
        widthMeters: pencilWidthMeters,
        points: [point],
      })
    }
  }

  const handlePointerMove = (event: PointerEvent): void => {
    const point = getMapPoint(event, svgRef.current)

    if (!point) {
      return
    }

    if (activeTool === "eraser") {
      if (isErasing.current) {
        eraseAt(point)
      }

      return
    }

    if (activeTool === "label") {
      return
    }

    if (!activeStroke) {
      return
    }

    const previous = activeStroke.points[activeStroke.points.length - 1]

    if (previous && Math.hypot(previous.x - point.x, previous.z - point.z) < 18) {
      return
    }

    setActiveStroke({ ...activeStroke, points: [...activeStroke.points, point] })
  }

  const handlePointerUp = (): void => {
    if (isErasing.current && didErase.current && eraseStartDrawings.current) {
      setUnsavedActions((current) => [
        ...current,
        { type: "restore-drawings", drawings: eraseStartDrawings.current ?? [] },
      ])
    }

    isErasing.current = false
    didErase.current = false
    eraseStartDrawings.current = null

    if (!activeStroke) {
      return
    }

    if (activeStroke.points.length > 1) {
      setMapDrawings((current) => [...current, activeStroke])
      setUnsavedActions((current) => [
        ...current,
        { type: "add-drawing", drawingId: activeStroke.id },
      ])
    }

    setActiveStroke(null)
  }

  const mapPointToSvg = (point: MapDrawingPoint): string => `${toMapX(point.x)},${toMapY(point.z)}`

  return (
    <Modal
      dismissOnBackdropClick
      showClose
      onClose={saveAndClose}
      panelClassName="stick-map-modal-panel"
      subtitle="Cartography"
      title="My Map"
    >
      <div class="stick-map-modal-content">
        <div class="stick-map-toolbar" aria-label="Map drawing tools">
          <button
            class={activeTool === "pencil" ? "stick-map-tool-active" : ""}
            type="button"
            onClick={() => setActiveTool("pencil")}
            title="Pencil"
            aria-label="Pencil"
            aria-pressed={activeTool === "pencil"}
          >
            <span class="stick-map-tool-icon stick-map-tool-icon-pencil" aria-hidden="true" />
          </button>
          <button
            class={activeTool === "eraser" ? "stick-map-tool-active" : ""}
            type="button"
            onClick={() => setActiveTool("eraser")}
            title="Eraser"
            aria-label="Eraser"
            aria-pressed={activeTool === "eraser"}
          >
            <span class="stick-map-tool-icon stick-map-tool-icon-eraser" aria-hidden="true" />
          </button>
          <button
            class={activeTool === "label" ? "stick-map-tool-active" : ""}
            type="button"
            onClick={() => setActiveTool("label")}
            title="Label"
            aria-label="Label"
            aria-pressed={activeTool === "label"}
          >
            <span class="stick-map-tool-star" aria-hidden="true">★</span>
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={unsavedActions.length === 0}
            title="Undo last stroke"
            aria-label="Undo last stroke"
          >
            <span class="stick-map-tool-icon stick-map-tool-icon-undo" aria-hidden="true" />
          </button>
        </div>
        <div class="stick-map-stage">
          <svg
            ref={svgRef}
            class={`stick-map${activeTool ? ` stick-map-drawing-enabled stick-map-tool-${activeTool}` : ""}`}
            viewBox={`0 0 ${mapSize} ${mapSize}`}
            role="img"
            aria-label="Blank gridded map with starting point revealed"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
          <rect class="stick-map-paper" x="0" y="0" width={mapSize} height={mapSize} />
          <rect
            class="stick-map-border"
            x={mapPadding}
            y={mapPadding}
            width={plotSize}
            height={plotSize}
          />
          {verticalGridLines.map((x) => (
            <line
              key={`x-${x}`}
              class="stick-map-grid"
              x1={toMapX(x)}
              y1={mapPadding}
              x2={toMapX(x)}
              y2={mapPadding + plotSize}
            />
          ))}
          {horizontalGridLines.map((z) => (
            <line
              key={`z-${z}`}
              class="stick-map-grid"
              x1={mapPadding}
              y1={toMapY(z)}
              x2={mapPadding + plotSize}
              y2={toMapY(z)}
            />
          ))}
          {renderedDrawings.map((drawing) =>
            drawing.type === "stroke" ? (
              <polyline
                key={drawing.id}
                class="stick-map-user-stroke"
                points={drawing.points.map(mapPointToSvg).join(" ")}
                style={{ stroke: drawing.color, strokeWidth: toMapStrokeWidth(drawing.widthMeters, worldBounds) }}
              />
            ) : (
              <g
                key={drawing.id}
                class="stick-map-user-label"
                transform={`translate(${toMapX(drawing.point.x)} ${toMapY(drawing.point.z)})`}
                role="button"
                tabIndex={0}
                aria-label={`Map note: ${drawing.text}`}
                onBlur={() => setHoveredLabel(null)}
                onFocus={() => setHoveredLabel(drawing)}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerEnter={() => setHoveredLabel(drawing)}
                onPointerLeave={() => setHoveredLabel(null)}
              >
                <text class="stick-map-user-label-star" text-anchor="middle" dominant-baseline="middle">
                  ★
                </text>
              </g>
            ),
          )}
          <path
            class="stick-map-start-marker"
            d={`M ${centerX - 5} ${centerY - 5} L ${centerX + 5} ${centerY + 5} M ${centerX + 5} ${centerY - 5} L ${centerX - 5} ${centerY + 5}`}
          />
          <text class="stick-map-start-label" x={centerX} y={centerY + 18} text-anchor="middle">
            start
          </text>
          <g
            class="stick-map-player-marker"
            transform={`translate(${playerMapX} ${playerMapY}) rotate(${playerHeadingDegrees})`}
          >
            <path d="M 0 -7 L 5 5 L 0 2.5 L -5 5 Z" />
          </g>
          </svg>
          {hoveredLabel ? (
            <div
              class="stick-map-label-tooltip"
              style={{
                left: `${(toMapX(hoveredLabel.point.x) / mapSize) * 100}%`,
                top: `${(toMapY(hoveredLabel.point.z) / mapSize) * 100}%`,
              }}
            >
              {hoveredLabel.text}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  )

  function getMapPoint(event: PointerEvent, svg: SVGSVGElement | null): MapDrawingPoint | null {
    if (!svg) {
      return null
    }

    const bounds = svg.getBoundingClientRect()
    const mapX = ((event.clientX - bounds.left) / bounds.width) * mapSize
    const mapY = ((event.clientY - bounds.top) / bounds.height) * mapSize

    if (mapX < mapPadding || mapX > mapPadding + plotSize || mapY < mapPadding || mapY > mapPadding + plotSize) {
      return null
    }

    return { x: toWorldX(mapX), z: toWorldZ(mapY) }
  }
}

function createGridValues(min: number, max: number, step: number): number[] {
  const values: number[] = []
  const first = Math.ceil(min / step) * step

  for (let value = first; value <= max; value += step) {
    if (value > min && value < max) {
      values.push(value)
    }
  }

  return values
}

function toMapStrokeWidth(widthMeters: number, worldBounds: WorldBounds): number {
  const worldWidth = worldBounds.maxX - worldBounds.minX

  return (widthMeters / worldWidth) * (mapSize - mapPadding * 2)
}

function eraseStrokeAtPoint(
  stroke: MapDrawingStroke,
  point: MapDrawingPoint,
  radiusMeters: number,
): readonly MapDrawingStroke[] {
  const keptRuns: MapDrawingPoint[][] = []
  let currentRun: MapDrawingPoint[] = []

  for (const strokePoint of stroke.points) {
    if (getDistance(point, strokePoint) <= radiusMeters) {
      if (currentRun.length > 1) {
        keptRuns.push(currentRun)
      }

      currentRun = []
      continue
    }

    currentRun.push(strokePoint)
  }

  if (currentRun.length > 1) {
    keptRuns.push(currentRun)
  }

  if (keptRuns.length === 1 && keptRuns[0]?.length === stroke.points.length) {
    return [stroke]
  }

  return keptRuns.map((points) => ({
    ...stroke,
    id: createDrawingId(),
    points,
  }))
}

function createDrawingId(): string {
  return `map_drawing_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function getDistance(a: MapDrawingPoint, b: MapDrawingPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

