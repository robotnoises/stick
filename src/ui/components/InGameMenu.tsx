import type { GameSettings } from "../../app/GameSettings"
import { Modal } from "./Modal"

export interface InGameMenuProps {
  readonly isDebugVisible: boolean
  readonly isMenuOpen: boolean
  readonly isSaving: boolean
  readonly onClose: () => void
  readonly onDebugVisibleChanged: (visible: boolean) => void
  readonly onSaveGame: () => void
  readonly onSettingsChanged: (settings: GameSettings) => void
  readonly saveStatus: string
  readonly settings: GameSettings
}

export function InGameMenu(props: InGameMenuProps) {
  if (!props.isMenuOpen) {
    return null
  }

  return (
    <Modal
      dismissOnBackdropClick
      showClose
      onClose={props.onClose}
      subtitle="Trail notebook"
      title="Camp Menu"
    >
      <section id="options-panel" className="stick-menu-panel">
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
        <div className="stick-menu-actions stick-menu-actions-single">
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
    </Modal>
  )
}
