import "./styles.css"
import { Game } from "./app/Game"
import { loadGameSettings, saveGameSettings } from "./app/GameSettings"

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas")
const optionsButton = document.querySelector<HTMLButtonElement>("#options-button")
const optionsPanel = document.querySelector<HTMLElement>("#options-panel")
const invertMouseInput = document.querySelector<HTMLInputElement>("#invert-mouse-y")

if (!canvas) {
  throw new Error("Missing #game-canvas element.")
}

if (!optionsButton || !optionsPanel || !invertMouseInput) {
  throw new Error("Missing options menu elements.")
}

const settings = loadGameSettings()
invertMouseInput.checked = settings.invertMouseY

const game = new Game(canvas, undefined, settings)

optionsButton.addEventListener("click", () => {
  optionsPanel.hidden = !optionsPanel.hidden
})

invertMouseInput.addEventListener("change", () => {
  settings.invertMouseY = invertMouseInput.checked
  saveGameSettings(settings)
  game.updateSettings(settings)
})

await game.start()

window.addEventListener("beforeunload", () => {
  game.dispose()
})
