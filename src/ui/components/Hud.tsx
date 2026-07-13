import { Compass } from "./Compass"

export interface HudProps {
  readonly headingDegrees: number
  readonly onMapOpen: () => void
  readonly onMenuOpen: () => void
  readonly onPackOpen: () => void
  readonly onSelectedItemUsed: () => void
  readonly selectedItemName: string | null
}

export function Hud({
  headingDegrees,
  onMapOpen,
  onMenuOpen,
  onPackOpen,
  onSelectedItemUsed,
  selectedItemName,
}: HudProps) {
  return (
    <nav class="stick-hud" aria-label="Game actions">
      <div class="stick-hud-rail stick-hud-rail-left">
        <button class="stick-hud-action" type="button" onClick={onMapOpen}>
          Map
        </button>
        <button class="stick-hud-action" type="button" onClick={onPackOpen}>
          Pack
        </button>
      </div>

      <div class="stick-hud-compass-well">
        <Compass headingDegrees={headingDegrees} />
      </div>

      <div class="stick-hud-rail stick-hud-rail-right">
        <button class="stick-hud-action" type="button" onClick={onSelectedItemUsed}>
          {selectedItemName ?? "?"}
        </button>
        <button class="stick-hud-action" type="button" onClick={onMenuOpen}>
          Menu
        </button>
      </div>
    </nav>
  )
}
