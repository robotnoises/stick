import { Compass } from "./Compass"

export interface HudProps {
  readonly headingDegrees: number
  readonly onMenuOpen: () => void
}

export function Hud({ headingDegrees, onMenuOpen }: HudProps) {
  const noopAction = (): void => undefined

  return (
    <nav class="stick-hud" aria-label="Game actions">
      <div class="stick-hud-rail stick-hud-rail-left">
        <button class="stick-hud-action" type="button" onClick={noopAction}>
          Map
        </button>
        <button class="stick-hud-action" type="button" onClick={noopAction}>
          Pack
        </button>
      </div>

      <div class="stick-hud-compass-well">
        <Compass headingDegrees={headingDegrees} />
      </div>

      <div class="stick-hud-rail stick-hud-rail-right">
        <button class="stick-hud-action" type="button" onClick={noopAction}>
          Camp
        </button>
        <button class="stick-hud-action" type="button" onClick={onMenuOpen}>
          Menu
        </button>
      </div>
    </nav>
  )
}
