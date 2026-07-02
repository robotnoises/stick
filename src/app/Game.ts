import { BabylonBootstrap } from "../engine/BabylonBootstrap"
import { DebugOverlay } from "../debug/DebugOverlay"
import { LightingController } from "../environment/LightingController"
import { TimeOfDaySystem } from "../environment/TimeOfDaySystem"
import { createCoreBackpack } from "../items/CoreItems"
import { FlashlightController } from "../items/FlashlightController"
import { InventorySystem } from "../items/InventorySystem"
import { PlayerController } from "../player/PlayerController"
import { ProgressiveTerrainSystem } from "../world/ProgressiveTerrainSystem"
import { WorldBoundsHelper } from "../world/WorldBounds"
import { EngineContext } from "./EngineContext"
import { defaultGameConfig, type GameConfig } from "./GameConfig"
import { defaultGameSettings, type GameSettings } from "./GameSettings"
import type { GameSystem } from "./GameSystem"

export class Game {
  private _context: EngineContext | null = null
  private readonly _systems: GameSystem[] = []
  private _lastFrameTime = 0
  private _player: PlayerController | null = null

  public constructor(
    private readonly _canvas: HTMLCanvasElement,
    private readonly _config: GameConfig = defaultGameConfig,
    private _settings: GameSettings = defaultGameSettings,
  ) {}

  public async start(): Promise<void> {
    const engine = await BabylonBootstrap.createEngine(this._canvas)
    const scene = BabylonBootstrap.createScene(engine)

    this._context = new EngineContext(this._canvas, engine, scene, this._config)

    const time = new TimeOfDaySystem(this._config.startTimeOfDayHours, this._config.timeScale)
    const player = new PlayerController(this._context)
    const terrain = new ProgressiveTerrainSystem(this._context, player)
    const worldBounds = new WorldBoundsHelper(this._context.config.worldBounds)

    player.setInvertMouseY(this._settings.invertMouseY)
    player.setPositionClampProvider((worldX, worldZ) => worldBounds.clampPosition(worldX, worldZ))
    player.setGroundHeightProvider((worldX, worldZ) => terrain.getHeightAt(worldX, worldZ))
    this._player = player

    const lighting = new LightingController(this._context, time)
    const flashlight = new FlashlightController(this._context, player)
    const inventory = new InventorySystem(createCoreBackpack(flashlight))
    const debug = new DebugOverlay(player, time)

    this._systems.push(time, player, terrain, lighting, flashlight, inventory, debug)

    for (const system of this._systems) {
      await system.initialize?.()
    }

    window.addEventListener("resize", this._handleResize)

    this._lastFrameTime = performance.now()

    engine.runRenderLoop(() => {
      const now = performance.now()
      const deltaSeconds = Math.min((now - this._lastFrameTime) / 1000, 0.1)

      this._lastFrameTime = now

      for (const system of this._systems) {
        system.update(deltaSeconds)
      }

      scene.render()
    })
  }

  public updateSettings(settings: GameSettings): void {
    this._settings = settings
    this._player?.setInvertMouseY(settings.invertMouseY)
  }

  public dispose(): void {
    window.removeEventListener("resize", this._handleResize)

    for (const system of [...this._systems].reverse()) {
      system.dispose?.()
    }

    this._systems.length = 0
    this._player = null
    this._context?.engine.dispose()
    this._context = null
  }

  private readonly _handleResize = (): void => {
    this._context?.engine.resize()
  }
}
