import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"
import type { WaterVolumeSampler } from "../world/water/WaterVolumeSampler"
import type { AnimalPositionProvider, FishSpawnCandidate } from "./AnimalTypes"
import { FishController } from "./FishController"
import { FishMeshFactory } from "./FishMeshFactory"

export interface AnimalSystemOptions {
  readonly activeRadiusMeters?: number
  readonly cellSizeMeters?: number
  readonly maxFish?: number
  readonly fishSpawnChance?: number
  readonly random?: () => number
}

export class AnimalSystem implements GameSystem {
  private readonly _activeRadiusMeters: number
  private readonly _cellSizeMeters: number
  private readonly _maxFish: number
  private readonly _fishSpawnChance: number
  private readonly _random: () => number
  private readonly _fish = new Map<string, FishController>()
  private readonly _fishCells = new Map<string, string>()
  private readonly _fishMeshFactory: FishMeshFactory
  private _nextFishId = 0

  public constructor(
    private readonly _context: EngineContext,
    private readonly _player: AnimalPositionProvider,
    private readonly _waterSampler: WaterVolumeSampler,
    options: AnimalSystemOptions = {},
  ) {
    this._activeRadiusMeters = options.activeRadiusMeters ?? 70
    this._cellSizeMeters = options.cellSizeMeters ?? 28
    this._maxFish = options.maxFish ?? 6
    this._fishSpawnChance = options.fishSpawnChance ?? 0.08
    this._random = options.random ?? Math.random
    this._fishMeshFactory = new FishMeshFactory(this._context)
  }

  public get activeFishCount(): number {
    return this._fish.size
  }

  public update(deltaSeconds: number): void {
    this._spawnNearbyFish()
    this._disposeDistantFish()

    for (const fish of this._fish.values()) {
      fish.update(deltaSeconds)
    }
  }

  public dispose(): void {
    for (const fish of this._fish.values()) {
      fish.dispose()
    }

    this._fish.clear()
    this._fishCells.clear()
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

      if (this._random() > this._fishSpawnChance) {
        continue
      }

      const column = this._waterSampler.sampleColumn(candidate.x, candidate.z)

      if (!column.hasWater || column.depthMeters < 0.75 || column.distanceToShoreMeters > -0.5) {
        continue
      }

      const fishId = `fish_runtime_${this._nextFishId}`
      const y = column.bedY + column.depthMeters * (0.3 + this._random() * 0.35)
      const scale = 0.75 + this._random() * 0.65
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
