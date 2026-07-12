import type { WorldBounds } from "../../app/GameConfig"
import { Modal } from "./Modal"

export interface MapModalProps {
  readonly onClose: () => void
  readonly playerHeadingDegrees: number
  readonly playerX: number
  readonly playerZ: number
  readonly worldBounds: WorldBounds
}

const mapSize = 520
const mapPadding = 34
const gridMeters = 1000

export function MapModal({ onClose, playerHeadingDegrees, playerX, playerZ, worldBounds }: MapModalProps) {
  const plotSize = mapSize - mapPadding * 2
  const toMapX = (worldX: number): number =>
    mapPadding + ((worldX - worldBounds.minX) / (worldBounds.maxX - worldBounds.minX)) * plotSize
  const toMapY = (worldZ: number): number =>
    mapPadding + ((worldBounds.maxZ - worldZ) / (worldBounds.maxZ - worldBounds.minZ)) * plotSize
  const centerX = toMapX(0)
  const centerY = toMapY(0)
  const playerMapX = toMapX(playerX)
  const playerMapY = toMapY(playerZ)
  const verticalGridLines = createGridValues(worldBounds.minX, worldBounds.maxX, gridMeters)
  const horizontalGridLines = createGridValues(worldBounds.minZ, worldBounds.maxZ, gridMeters)

  return (
    <Modal
      dismissOnBackdropClick
      showClose
      onClose={onClose}
      panelClassName="stick-map-modal-panel"
      subtitle="Cartography"
      title="My Map"
    >
      <div class="stick-map-modal-content">
        <svg
          class="stick-map"
          viewBox={`0 0 ${mapSize} ${mapSize}`}
          role="img"
          aria-label="Blank gridded map with starting point revealed"
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
      </div>
    </Modal>
  )
}

function createGridValues(min: number, max: number, step: number): number[] {
  const values: number[] = []
  const first = Math.ceil(min / step) * step

  for (let value = first; value <= max; value += step) {
    values.push(value)
  }

  return values
}
