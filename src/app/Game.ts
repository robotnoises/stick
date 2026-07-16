import { AnimalSystem } from "../animals/AnimalSystem"
import type { MapDrawing } from "../cartography/MapDrawing"
import { BabylonBootstrap } from "../engine/BabylonBootstrap"
import { LocalForageChunkRepository } from "../data/LocalForageChunkRepository"
import type { SaveGameData, SaveGameRepository } from "../data/SaveGameRepository"
import { DebugOverlay } from "../debug/DebugOverlay"
import { CloudSystem } from "../environment/CloudSystem"
import { DistantBackdropSystem } from "../environment/DistantBackdropSystem"
import { CampfireSystem } from "../fire/CampfireSystem"
import { LightingController } from "../environment/LightingController"
import { TimeOfDaySystem } from "../environment/TimeOfDaySystem"
import { createCoreBackpack } from "../items/CoreItems"
import { FlashlightController } from "../items/FlashlightController"
import { InventorySystem } from "../items/InventorySystem"
import { PlayerController } from "../player/PlayerController"
import { ProgressiveTerrainSystem } from "../world/terrain/ProgressiveTerrainSystem"
import { WorldBoundsHelper } from "../world/WorldBounds"
import { WorldFeatureGenerator } from "../world/generation/WorldFeatureGenerator"
import { WaterVolumeSampler } from "../world/water/WaterVolumeSampler"
import { EngineContext } from "./EngineContext"
import { defaultGameConfig, type GameConfig } from "./GameConfig"
import { defaultGameSettings, type GameSettings } from "./GameSettings"
import type { GameSystem } from "./GameSystem"
import { StickGlobalApiInstaller, type StickGlobalApi } from "./StickGlobalApi"

export class Game {
  private _context: EngineContext | null = null
  private readonly _systems: GameSystem[] = []
  private _lastFrameTime = 0
  private _globalApi: StickGlobalApi | null = null
  private _player: PlayerController | null = null
  private _time: TimeOfDaySystem | null = null
  private _mapDrawings: readonly MapDrawing[] = []
  private _inventory: InventorySystem | null = null

  public constructor(
    private readonly _canvas: HTMLCanvasElement,
    private readonly _config: GameConfig = defaultGameConfig,
    private _settings: GameSettings = defaultGameSettings,
    private readonly _reloadWindow: () => void = window.location.reload.bind(window.location),
    private readonly _saveGameRepository: SaveGameRepository | null = null,
  ) {}

  public async start(): Promise<void> {
    const engine = await BabylonBootstrap.createEngine(this._canvas)
    const scene = BabylonBootstrap.createScene(engine)

    this._context = new EngineContext(this._canvas, engine, scene, this._config)

    const time = new TimeOfDaySystem(this._config.startTimeOfDayHours, this._config.timeScale)
    const player = new PlayerController(this._context)

    this._time = time
    const chunkRepository = new LocalForageChunkRepository()
    const worldFeatures = new WorldFeatureGenerator({
      seed: this._context.config.worldSeed,
      worldBounds: this._context.config.worldBounds,
    })
    const terrain = new ProgressiveTerrainSystem(
      this._context,
      player,
      chunkRepository,
      worldFeatures,
    )
    const worldBounds = new WorldBoundsHelper(this._context.config.worldBounds)

    player.setInvertMouseY(this._settings.invertMouseY)
    player.setPositionClampProvider((worldX, worldZ) => worldBounds.clampPosition(worldX, worldZ))
    player.setGroundHeightProvider((worldX, worldZ) => terrain.getHeightAt(worldX, worldZ))
    player.setCollisionResolver({
      resolveHorizontalPosition: (worldX, worldZ) => terrain.resolvePlayerCollision(worldX, worldZ),
    })
    await this._restoreSaveGame(player, time)
    this._player = player

    const waterSampler = new WaterVolumeSampler({
      waterFeatures: worldFeatures,
      terrainHeightProvider: (worldX, worldZ) => terrain.getHeightAt(worldX, worldZ),
    })

    player.setWaterSampler(waterSampler)

    const animals = new AnimalSystem(this._context, player, waterSampler, {
      terrainHeightProvider: (worldX, worldZ) => terrain.getHeightAt(worldX, worldZ),
      timeProvider: time,
    })
    const backdrop = new DistantBackdropSystem(this._context, player, time)
    const clouds = new CloudSystem(this._context, time, player)
    const lighting = new LightingController(this._context, time)
    const campfires = new CampfireSystem(this._context, player, {
      getHeightAt: (worldX, worldZ) => terrain.getHeightAt(worldX, worldZ),
    })
    const flashlight = new FlashlightController(this._context, player)
    const inventory = new InventorySystem(createCoreBackpack(flashlight))

    this._inventory = inventory
    const debug = new DebugOverlay(player, time, {
      createNewWorld: () => this._createNewWorld(chunkRepository),
      getChunkBoundariesDebugEnabled: () => terrain.chunkBoundariesDebugEnabled,
      getDebugMapData: () => ({
        worldBounds: this._context!.config.worldBounds,
        playerPosition: {
          x: player.position.x,
          z: player.position.z,
        },
        playerHeadingDegrees: player.headingDegrees,
        chunkSizeMeters: 64,
        lakes: worldFeatures.lakes.map((lake) => ({
          id: lake.id,
          centerX: lake.centerX,
          centerZ: lake.centerZ,
          radiusX: lake.radiusX,
          radiusZ: lake.radiusZ,
          shoreFalloffMeters: lake.shoreFalloffMeters,
        })),
        rivers: worldFeatures.rivers.map((river) => ({
          id: river.id,
          points: river.points,
          widthMeters: river.widthMeters,
          bankFalloffMeters: river.bankFalloffMeters,
        })),
      }),
      getTerrainStreamingStats: () => terrain.getStreamingDebugStats(),
      getWorldSeed: () => this._config.worldSeed,
      resetTerrainCache: () => this._resetTerrainCache(chunkRepository),
      placeMediumFire: () => campfires.placeMediumFireInFrontOfPlayer(),
      setChunkBoundariesDebugEnabled: (enabled) => terrain.setChunkBoundariesDebugEnabled(enabled),
      setWorldSeed: (seed) => this._setWorldSeed(seed, chunkRepository),
    })

    this._globalApi = StickGlobalApiInstaller.install(debug)

    this._systems.push(
      time,
      player,
      terrain,
      animals,
      backdrop,
      clouds,
      lighting,
      campfires,
      flashlight,
      inventory,
      debug,
    )

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

  public getPlayerHeadingDegrees(): number {
    return this._player?.headingDegrees ?? 0
  }

  public getMapPosition(): { readonly headingDegrees: number; readonly x: number; readonly z: number } {
    const position = this._player?.position

    return {
      headingDegrees: this.getPlayerHeadingDegrees(),
      x: position?.x ?? 0,
      z: position?.z ?? 0,
    }
  }

  public getMapDrawings(): readonly MapDrawing[] {
    return this._mapDrawings
  }

  public async saveMapDrawings(drawings: readonly MapDrawing[]): Promise<void> {
    this._mapDrawings = drawings
    await this.saveGame()
  }

  public getWorldBounds(): GameConfig["worldBounds"] {
    return this._config.worldBounds
  }

  public getWorldTime(): { readonly day: number; readonly timeOfDayHours: number } {
    return {
      day: this._time?.day ?? 1,
      timeOfDayHours: this._time?.timeOfDayHours ?? 12,
    }
  }

  public getInventoryItems(): readonly {
    readonly id: string
    readonly name: string
    readonly description: string
    readonly category: "supply" | "tool"
    readonly consumable: boolean
    readonly maxQuantity: number
    readonly quantity: number
  }[] {
    return this._inventory?.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      consumable: item.consumable,
      maxQuantity: item.maxQuantity,
      quantity: item.quantity,
    })) ?? []
  }

  public getSelectedInventoryItem(): { readonly id: string; readonly name: string } | null {
    const selected = this._inventory?.items.find((item) => item.id === this._inventory?.selectedItemId)

    return selected ? { id: selected.id, name: selected.name } : null
  }

  public selectInventoryItem(itemId: string): void {
    this._inventory?.selectItem(itemId)
  }

  public useSelectedInventoryItem(): string {
    return this._inventory?.useSelectedItem() ?? "No item selected."
  }

  public getSurvivalStatus(): { readonly fatigue: number; readonly hunger: number; readonly thirst: number } {
    return {
      fatigue: 0.72,
      hunger: 0.84,
      thirst: 0.66,
    }
  }

  public async saveGame(): Promise<void> {
    if (!this._saveGameRepository || !this._player || !this._time) {
      return
    }

    const position = this._player.position

    await this._saveGameRepository.saveGame({
      version: 1,
      savedAt: Date.now(),
      worldId: this._config.worldId,
      worldSeed: this._config.worldSeed,
      player: {
        position: [position.x, position.y, position.z],
        headingDegrees: this._player.headingDegrees,
      },
      world: {
        day: this._time.day,
        timeOfDayHours: this._time.timeOfDayHours,
        elapsedWorldSeconds: this._time.elapsedWorldSeconds,
      },
      map: {
        drawings: this._mapDrawings,
      },
    })
  }

  public dispose(): void {
    window.removeEventListener("resize", this._handleResize)

    if (this._globalApi) {
      StickGlobalApiInstaller.uninstall(this._globalApi)
      this._globalApi = null
    }

    for (const system of [...this._systems].reverse()) {
      system.dispose?.()
    }

    this._systems.length = 0
    this._player = null
    this._time = null
    this._inventory = null
    this._context?.engine.dispose()
    this._context = null
  }

  private async _restoreSaveGame(player: PlayerController, time: TimeOfDaySystem): Promise<void> {
    const saveGame = await this._saveGameRepository?.getSaveGame()

    if (!saveGame || !this._isCompatibleSaveGame(saveGame)) {
      return
    }

    this._mapDrawings = saveGame.map?.drawings ?? []
    player.setPosition(...saveGame.player.position)
    player.setHeadingDegrees(saveGame.player.headingDegrees)
    time.setWorldClock(
      saveGame.world.day,
      saveGame.world.timeOfDayHours,
      saveGame.world.elapsedWorldSeconds,
    )
  }

  private _isCompatibleSaveGame(saveGame: SaveGameData): boolean {
    return (
      saveGame.worldId === this._config.worldId && saveGame.worldSeed === this._config.worldSeed
    )
  }

  private async _resetTerrainCache(chunkRepository: LocalForageChunkRepository): Promise<void> {
    await this._deleteTerrainChunks(chunkRepository)
    this._reloadWindow()
  }

  private async _createNewWorld(chunkRepository: LocalForageChunkRepository): Promise<void> {
    const worldSeed = Math.floor(Math.random() * 2_000_000_000)

    await this._saveWorldIdentity(`world_${worldSeed}_${Date.now()}`, worldSeed)
    await this._deleteTerrainChunks(chunkRepository)
    this._reloadWindow()
  }

  private async _setWorldSeed(
    worldSeed: number,
    chunkRepository: LocalForageChunkRepository,
  ): Promise<void> {
    await this._saveWorldIdentity(`world_${worldSeed}`, worldSeed)
    await this._deleteTerrainChunks(chunkRepository)
    this._reloadWindow()
  }

  private async _saveWorldIdentity(worldId: string, worldSeed: number): Promise<void> {
    await this._saveGameRepository?.saveWorldConfig({ worldId, worldSeed })
  }

  private async _deleteTerrainChunks(chunkRepository: LocalForageChunkRepository): Promise<void> {
    const keys = await chunkRepository.listChunkKeys()

    await Promise.all(keys.map((key) => chunkRepository.deleteChunk(key)))
  }

  private readonly _handleResize = (): void => {
    this._context?.engine.resize()
  }
}
