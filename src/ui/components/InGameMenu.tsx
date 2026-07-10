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
    <>
      {props.isMenuOpen ? <div className="stick-menu-vignette" aria-hidden="true" /> : null}
      <div id="options-ui" className="stick-menu" aria-label="Game menu">
        <button
          id="options-button"
          className="stick-menu-button"
          type="button"
          aria-expanded={props.isMenuOpen}
          aria-controls="options-panel"
          onClick={() => props.onMenuOpenChanged(!props.isMenuOpen)}
        >
          Menu
        </button>
        <section id="options-panel" className="stick-menu-panel" hidden={!props.isMenuOpen}>
          <div className="stick-menu-panel-header">
            <p className="stick-menu-kicker">Trail notebook</p>
            <h2>Camp Menu</h2>
          </div>
          <div className="stick-menu-section">
            <h3>Settings</h3>
            <label className="stick-checkbox-row">
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
              <span>Invert mouse Y axis</span>
            </label>
            <label className="stick-checkbox-row">
              <input
                id="debug-overlay-visible"
                type="checkbox"
                checked={props.isDebugVisible}
                onChange={(event) => props.onDebugVisibleChanged(event.currentTarget.checked)}
              />
              <span>Show debug overlay</span>
            </label>
          </div>
          <div className="stick-menu-actions">
            <button className="stick-button stick-button-secondary" type="button" onClick={props.onClose}>
              Resume
            </button>
            <button
              id="save-game-button"
              className="stick-button"
              type="button"
              disabled={props.isSaving}
              onClick={props.onSaveGame}
            >
              Save game
            </button>
          </div>
          <p id="save-game-status" className="stick-save-status" aria-live="polite">
            {props.saveStatus}
          </p>
        </section>
      </div>
    </>
  )
}
