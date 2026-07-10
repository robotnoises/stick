import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"
import type { WaterVolumeSampler } from "../world/water/WaterVolumeSampler"
import type { AnimalPositionProvider, AnimalTimeProvider } from "./AnimalTypes"
import { BirdSpawner } from "./bird/BirdSpawner"
import { FireflySpawner } from "./firefly/FireflySpawner"
import { FishSpawner } from "./fish/FishSpawner"

export interface AnimalSystemOptions {
  readonly activeRadiusMeters?: number
  readonly cellSizeMeters?: number
  readonly maxFish?: number
  readonly maxBirds?: number
  readonly maxFireflies?: number
  readonly fishSpawnChance?: number
  readonly birdSpawnChance?: number
  readonly fireflySpawnChance?: number
  readonly terrainHeightProvider?: (worldX: number, worldZ: number) => number
  readonly timeProvider?: AnimalTimeProvider
  readonly random?: () => number
}

export class AnimalSystem implements GameSystem {
  private readonly _fishSpawner: FishSpawner
  private readonly _birdSpawner: BirdSpawner
  private readonly _fireflySpawner: FireflySpawner
  private _maxFish: number
  private _maxBirds: number
  private _maxFireflies: number

  public constructor(
    context: EngineContext,
    player: AnimalPositionProvider,
    waterSampler: WaterVolumeSampler,
    options: AnimalSystemOptions = {},
  ) {
    const activeRadiusMeters = options.activeRadiusMeters ?? 70
    const cellSizeMeters = options.cellSizeMeters ?? 28
    const terrainHeightProvider = options.terrainHeightProvider ?? (() => 0)
    const timeProvider = options.timeProvider ?? { timeOfDayHours: 12 }
    const random = options.random ?? Math.random

    this._maxFish = options.maxFish ?? 6
    this._maxBirds = options.maxBirds ?? 4
    this._maxFireflies = options.maxFireflies ?? 18

    this._fishSpawner = new FishSpawner({
      context,
      player,
      waterSampler,
      activeRadiusMeters,
      cellSizeMeters,
      maxFish: this._maxFish,
      fishSpawnChance: options.fishSpawnChance ?? 0.08,
      random,
    })
    this._birdSpawner = new BirdSpawner({
      context,
      player,
      terrainHeightProvider,
      activeRadiusMeters,
      maxBirds: this._maxBirds,
      birdSpawnChance: options.birdSpawnChance ?? 0.018,
      random,
    })
    this._fireflySpawner = new FireflySpawner({
      context,
      player,
      terrainHeightProvider,
      timeProvider,
      activeRadiusMeters,
      cellSizeMeters,
      maxFireflies: this._maxFireflies,
      fireflySpawnChance: options.fireflySpawnChance ?? 0.08,
      random,
    })
  }

  public get activeFishCount(): number {
    return this._fishSpawner.activeCount
  }

  public get _fish() {
    return this._fishSpawner.fish
  }

  public get activeBirdCount(): number {
    return this._birdSpawner.activeCount
  }

  public get _birds() {
    return this._birdSpawner.birds
  }

  public get activeFireflyCount(): number {
    return this._fireflySpawner.activeCount
  }

  public get _fireflies() {
    return this._fireflySpawner.fireflies
  }

  public update(deltaSeconds: number): void {
    this._fishSpawner.setMaxFish(this._maxFish)
    this._birdSpawner.setMaxBirds(this._maxBirds)
    this._fireflySpawner.setMaxFireflies(this._maxFireflies)
    this._fishSpawner.update(deltaSeconds)
    this._birdSpawner.update(deltaSeconds)
    this._fireflySpawner.update(deltaSeconds)
  }

  public dispose(): void {
    this._fishSpawner.dispose()
    this._birdSpawner.dispose()
    this._fireflySpawner.dispose()
  }
}
