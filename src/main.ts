import "./styles.css"
import { Game } from "./app/Game"
import { defaultGameConfig } from "./app/GameConfig"
import { loadGameSettings, saveGameSettings } from "./app/GameSettings"
import { LocalForageSaveGameRepository } from "./data/LocalForageSaveGameRepository"

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas")
const optionsButton = document.querySelector<HTMLButtonElement>("#options-button")
const optionsPanel = document.querySelector<HTMLElement>("#options-panel")
const invertMouseInput = document.querySelector<HTMLInputElement>("#invert-mouse-y")
const saveGameButton = document.querySelector<HTMLButtonElement>("#save-game-button")
const saveGameStatus = document.querySelector<HTMLElement>("#save-game-status")

if (!canvas) {
  throw new Error("Missing #game-canvas element.")
}

if (!optionsButton || !optionsPanel || !invertMouseInput || !saveGameButton || !saveGameStatus) {
  throw new Error("Missing options menu elements.")
}

const settings = loadGameSettings()
const saveGameRepository = new LocalForageSaveGameRepository()
const savedWorldConfig = await saveGameRepository.getWorldConfig()
/* v8 ignore next */
const gameConfig = { ...defaultGameConfig, ...(savedWorldConfig ?? {}) }

invertMouseInput.checked = settings.invertMouseY

const game = new Game(canvas, gameConfig, settings, undefined, saveGameRepository)

optionsButton.addEventListener("click", () => {
  optionsPanel.hidden = !optionsPanel.hidden
})

invertMouseInput.addEventListener("change", () => {
  settings.invertMouseY = invertMouseInput.checked
  saveGameSettings(settings)
  game.updateSettings(settings)
})

saveGameButton.addEventListener("click", () => {
  saveGameButton.disabled = true
  saveGameStatus.textContent = "Saving…"
  void game
    .saveGame()
    .then(() => {
      saveGameStatus.textContent = "Game saved."
    })
    /* v8 ignore start */
    .catch((error: unknown) => {
      console.warn("Failed to save game.", error)
      saveGameStatus.textContent = "Save failed."
    })
    /* v8 ignore stop */
    .finally(() => {
      saveGameButton.disabled = false
    })
})

await game.start()

window.addEventListener("beforeunload", () => {
  game.dispose()
})
