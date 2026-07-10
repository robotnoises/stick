import type { GameSettings } from "../../app/GameSettings"

export interface InGameMenuProps {
  readonly isDebugVisible: boolean
  readonly isMenuOpen: boolean
  readonly isSaving: boolean
  readonly onClose: () => void
  readonly onDebugVisibleChanged: (visible: boolean) => void
  readonly onMenuOpenChanged: (open: boolean) => void
  readonly onSaveGame: () => void
  readonly onSettingsChanged: (settings: GameSettings) => void
  readonly saveStatus: string
  readonly settings: GameSettings
}

export function InGameMenu(props: InGameMenuProps) {
  return (
    <div id="options-ui" className="game-ui-menu" aria-label="Game menu">
      <button
        id="options-button"
        className="game-ui-menu-button"
        type="button"
        onClick={() => props.onMenuOpenChanged(!props.isMenuOpen)}
      >
        Menu
      </button>
      <section id="options-panel" className="game-ui-menu-panel" hidden={!props.isMenuOpen}>
        <h2>Menu</h2>
        <label>
          <input
            id="invert-mouse-y"
            type="checkbox"
            checked={props.settings.invertMouseY}
            onChange={(event) =>
              props.onSettingsChanged({
                ...props.settings,
                invertMouseY: event.currentTarget.checked,
              })
            }
          />
          Invert mouse Y axis
        </label>
        <label>
          <input
            id="debug-overlay-visible"
            type="checkbox"
            checked={props.isDebugVisible}
            onChange={(event) => props.onDebugVisibleChanged(event.currentTarget.checked)}
          />
          Show debug overlay
        </label>
        <div className="game-ui-menu-actions">
          <button type="button" onClick={props.onClose}>
            Resume
          </button>
          <button id="save-game-button" type="button" disabled={props.isSaving} onClick={props.onSaveGame}>
            Save game
          </button>
        </div>
        <p id="save-game-status" aria-live="polite">
          {props.saveStatus}
        </p>
      </section>
    </div>
  )
}
