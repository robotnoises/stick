import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"
import type { WaterColumnSample, WaterVolumeSampler } from "../world/water/WaterVolumeSampler"
import type { AnimalPositionProvider, BirdSpawnCandidate, FishSpawnCandidate } from "./AnimalTypes"
import { BirdController } from "./BirdController"
import { BirdMeshFactory } from "./BirdMeshFactory"
import { FishController } from "./FishController"
import { FishMeshFactory } from "./FishMeshFactory"

export interface AnimalSystemOptions {
  readonly activeRadiusMeters?: number
  readonly cellSizeMeters?: number
  readonly maxFish?: number
  readonly maxBirds?: number
  readonly fishSpawnChance?: number
  readonly birdSpawnChance?: number
  readonly terrainHeightProvider?: (worldX: number, worldZ: number) => number
  readonly random?: () => number
}

export class AnimalSystem implements GameSystem {
  private readonly _activeRadiusMeters: number
  private readonly _cellSizeMeters: number
  private readonly _maxFish: number
  private readonly _maxBirds: number
  private readonly _fishSpawnChance: number
  private readonly _birdSpawnChance: number
  private readonly _terrainHeightProvider: (worldX: number, worldZ: number) => number
  private readonly _random: () => number
  private readonly _fish = new Map<string, FishController>()
  private readonly _fishCells = new Map<string, string>()
  private readonly _birds = new Map<string, BirdController>()
  private readonly _fishMeshFactory: FishMeshFactory
  private readonly _birdMeshFactory: BirdMeshFactory
  private _nextFishId = 0
  private _nextBirdId = 0

  public constructor(
    private readonly _context: EngineContext,
    private readonly _player: AnimalPositionProvider,
    private readonly _waterSampler: WaterVolumeSampler,
    options: AnimalSystemOptions = {},
  ) {
    this._activeRadiusMeters = options.activeRadiusMeters ?? 70
    this._cellSizeMeters = options.cellSizeMeters ?? 28
    this._maxFish = options.maxFish ?? 6
    this._maxBirds = options.maxBirds ?? 4
    this._fishSpawnChance = options.fishSpawnChance ?? 0.08
    this._birdSpawnChance = options.birdSpawnChance ?? 0.018
    this._terrainHeightProvider = options.terrainHeightProvider ?? (() => 0)
    this._random = options.random ?? Math.random
    this._fishMeshFactory = new FishMeshFactory(this._context)
    this._birdMeshFactory = new BirdMeshFactory(this._context)
  }

  public get activeFishCount(): number {
    return this._fish.size
  }

  public get activeBirdCount(): number {
    return this._birds.size
  }

  public update(deltaSeconds: number): void {
    this._spawnNearbyFish()
    this._spawnNearbyBirds()
    this._disposeDistantFish()
    this._disposeDistantBirds()

    for (const fish of this._fish.values()) {
      fish.update(deltaSeconds)
    }

    for (const bird of this._birds.values()) {
      bird.update(deltaSeconds)
    }
  }

  public dispose(): void {
    for (const fish of this._fish.values()) {
      fish.dispose()
    }

    this._fish.clear()
    this._fishCells.clear()

    for (const bird of this._birds.values()) {
      bird.dispose()
    }

    this._birds.clear()
  }

  private _spawnNearbyFish(): void {
    if (this._fish.size >= this._maxFish) {
      return
    }

    for (const candidate of this._getNearbyFishSpawnCandidates()) {
      if (this._fish.size >= this._maxFish) {
        return
      }

      if ([...this._fishCells.values()].includes(candidate.cellId)) {
        continue
      }

      const column = this._waterSampler.sampleColumn(candidate.x, candidate.z)

      if (!column.hasWater || column.depthMeters < 0.75 || column.distanceToShoreMeters > -0.5) {
        continue
      }

      if (this._random() > this._getFishSpawnChance(column)) {
        continue
      }

      const fishId = `fish_runtime_${this._nextFishId}`
      const y = column.bedY + column.depthMeters * (0.35 + this._random() * 0.3)
      const scale = 0.55 + this._random() * 0.55
      const position = new Vector3(candidate.x, y, candidate.z)
      const visual = this._fishMeshFactory.createFish(fishId, position, scale)
      const fish = new FishController({
        id: fishId,
        visual,
        initialPosition: position,
        waterSampler: this._waterSampler,
        player: this._player,
        random: this._random,
      })

      this._nextFishId += 1
      this._fish.set(fishId, fish)
      this._fishCells.set(fishId, candidate.cellId)
    }
  }

  private _getFishSpawnChance(column: WaterColumnSample): number {
    const isVisibleNearShore =
      column.distanceToShoreMeters >= -6 &&
      column.distanceToShoreMeters <= -0.5 &&
      column.depthMeters <= 2.5

    if (this._fishSpawnChance >= 1) {
      return 1
    }

    return isVisibleNearShore ? Math.min(this._fishSpawnChance * 2.2, 0.22) : this._fishSpawnChance
  }

  private _spawnNearbyBirds(): void {
    if (this._birds.size >= this._maxBirds || this._random() > this._birdSpawnChance) {
      return
    }

    const candidate = this._getBirdSpawnCandidate()
    const scale = 0.75 + this._random() * 0.6
    const position = new Vector3(candidate.x, candidate.y, candidate.z)
    const visual = this._birdMeshFactory.createBird(candidate.id, position, scale)

    this._birds.set(
      candidate.id,
      new BirdController({
        id: candidate.id,
        visual,
        initialPosition: position,
        player: this._player,
        terrainHeightProvider: this._terrainHeightProvider,
        random: this._random,
      }),
    )
  }

  private _getBirdSpawnCandidate(): BirdSpawnCandidate {
    const playerPosition = this._player.position
    const angle = this._random() * Math.PI * 2
    const distance = this._activeRadiusMeters * (0.65 + this._random() * 0.35)
    const x = playerPosition.x + Math.sin(angle) * distance
    const z = playerPosition.z + Math.cos(angle) * distance
    const y = this._terrainHeightProvider(x, z) + 18 + this._random() * 28
    const id = `bird_runtime_${this._nextBirdId}`

    this._nextBirdId += 1

    return { id, x, y, z }
  }

  private _disposeDistantFish(): void {
    const playerPosition = this._player.position
    const disposeRadius = this._activeRadiusMeters + this._cellSizeMeters

    for (const [id, fish] of this._fish) {
      const position = fish.position
      const distance = Math.hypot(position.x - playerPosition.x, position.z - playerPosition.z)

      if (distance <= disposeRadius) {
        continue
      }

      fish.dispose()
      this._fish.delete(id)
      this._fishCells.delete(id)
    }
  }

  private _disposeDistantBirds(): void {
    const playerPosition = this._player.position
    const disposeRadius = this._activeRadiusMeters + 80

    for (const [id, bird] of this._birds) {
      const position = bird.position
      const distance = Math.hypot(position.x - playerPosition.x, position.z - playerPosition.z)

      if (distance <= disposeRadius) {
        continue
      }

      bird.dispose()
      this._birds.delete(id)
    }
  }

  private _getNearbyFishSpawnCandidates(): FishSpawnCandidate[] {
    const position = this._player.position
    const centerCellX = Math.floor(position.x / this._cellSizeMeters)
    const centerCellZ = Math.floor(position.z / this._cellSizeMeters)
    const radiusCells = Math.ceil(this._activeRadiusMeters / this._cellSizeMeters)
    const candidates: FishSpawnCandidate[] = []

    for (let z = -radiusCells; z <= radiusCells; z += 1) {
      for (let x = -radiusCells; x <= radiusCells; x += 1) {
        const cellX = centerCellX + x
        const cellZ = centerCellZ + z
        const cellId = `fish_cell_${cellX}_${cellZ}`
        const worldX = (cellX + 0.18 + this._random() * 0.64) * this._cellSizeMeters
        const worldZ = (cellZ + 0.18 + this._random() * 0.64) * this._cellSizeMeters

        if (Math.hypot(worldX - position.x, worldZ - position.z) > this._activeRadiusMeters) {
          continue
        }

        candidates.push({ cellId, x: worldX, z: worldZ })
      }
    }

    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - position.x, a.z - position.z) -
        Math.hypot(b.x - position.x, b.z - position.z),
    )

    return candidates
  }
}
