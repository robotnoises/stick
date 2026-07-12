import "./styles.css"
import "./ui/styles/ui.css"
import { Game } from "./app/Game"
import { defaultGameConfig } from "./app/GameConfig"
import { loadGameSettings, saveGameSettings } from "./app/GameSettings"
import { LocalForageSaveGameRepository } from "./data/LocalForageSaveGameRepository"
import { GameUiController } from "./ui/GameUiController"

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas")
const uiRoot = document.querySelector<HTMLElement>("#ui-root")

if (!canvas) {
  throw new Error("Missing #game-canvas element.")
}

if (!uiRoot) {
  throw new Error("Missing #ui-root element.")
}

const settings = loadGameSettings()
const saveGameRepository = new LocalForageSaveGameRepository()
const savedWorldConfig = await saveGameRepository.getWorldConfig()
/* v8 ignore next */
const gameConfig = { ...defaultGameConfig, ...(savedWorldConfig ?? {}) }
const game = new Game(canvas, gameConfig, settings, undefined, saveGameRepository)

await game.start()

const ui = new GameUiController(uiRoot, settings, {
  getDebugVisible: () => window.stick?.debug.visible() ?? false,
  getHeadingDegrees: () => game.getPlayerHeadingDegrees(),
  getMapPosition: () => game.getMapPosition(),
  getSurvivalStatus: () => game.getSurvivalStatus(),
  getWorldBounds: () => game.getWorldBounds(),
  getWorldTime: () => game.getWorldTime(),
  onDebugVisibleChanged: (visible) => window.stick?.debug.show(visible),
  onSaveGame: () => game.saveGame(),
  onSettingsChanged: (nextSettings) => {
    settings.invertMouseY = nextSettings.invertMouseY
    saveGameSettings(settings)
    game.updateSettings(settings)
  },
})

ui.mount()

window.addEventListener("beforeunload", () => {
  ui.dispose()
  game.dispose()
})
