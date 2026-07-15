import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { EngineContext } from "../../app/EngineContext"
import type { WaterColumnSample, WaterVolumeSampler } from "../../world/water/WaterVolumeSampler"
import type { AnimalPositionProvider, FishSpawnCandidate } from "../AnimalTypes"
import { FishController } from "./FishController"
import { FishMeshFactory } from "./FishMeshFactory"

export interface FishSpawnerOptions {
  readonly context: EngineContext
  readonly player: AnimalPositionProvider
  readonly waterSampler: WaterVolumeSampler
  readonly activeRadiusMeters: number
  readonly cellSizeMeters: number
  readonly maxFish: number
  readonly fishSpawnChance: number
  readonly random: () => number
}

export class FishSpawner {
  private readonly _fish = new Map<string, FishController>()
  private readonly _fishCells = new Map<string, string>()
  private readonly _meshFactory: FishMeshFactory
  private _maxFish: number
  private _nextId = 0

  public constructor(private readonly _options: FishSpawnerOptions) {
    this._meshFactory = new FishMeshFactory(this._options.context)
    this._maxFish = this._options.maxFish
  }

  public get activeCount(): number {
    return this._fish.size
  }

  public get fish(): Map<string, FishController> {
    return this._fish
  }

  public setMaxFish(maxFish: number): void {
    this._maxFish = maxFish
  }

  public update(deltaSeconds: number): void {
    this._spawnNearby()
    this._disposeDistant()

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

  private _spawnNearby(): void {
    if (this._fish.size >= this._maxFish) {
      return
    }

    for (const candidate of this._getNearbySpawnCandidates()) {
      if (this._fish.size >= this._maxFish) {
        return
      }

      if ([...this._fishCells.values()].includes(candidate.cellId)) {
        continue
      }

      const column = this._options.waterSampler.sampleColumn(candidate.x, candidate.z)

      if (!column.hasWater || column.depthMeters < 0.75 || column.distanceToShoreMeters > -0.5) {
        continue
      }

      if (this._options.random() > this._getSpawnChance(column)) {
        continue
      }

      const fishId = `fish_runtime_${this._nextId}`
      const y = column.bedY + column.depthMeters * (0.35 + this._options.random() * 0.3)
      const scale = 0.35 + this._options.random() * 0.35
      const position = new Vector3(candidate.x, y, candidate.z)
      const visual = this._meshFactory.createFish(fishId, position, scale)
      const fish = new FishController({
        id: fishId,
        visual,
        initialPosition: position,
        waterSampler: this._options.waterSampler,
        player: this._options.player,
        random: this._options.random,
      })

      this._nextId += 1
      this._fish.set(fishId, fish)
      this._fishCells.set(fishId, candidate.cellId)
    }
  }

  private _getSpawnChance(column: WaterColumnSample): number {
    const isVisibleNearShore =
      column.distanceToShoreMeters >= -6 &&
      column.distanceToShoreMeters <= -0.5 &&
      column.depthMeters <= 2.5

    if (this._options.fishSpawnChance >= 1) {
      return 1
    }

    return isVisibleNearShore
      ? Math.min(this._options.fishSpawnChance * 2.2, 0.22)
      : this._options.fishSpawnChance
  }

  private _disposeDistant(): void {
    const playerPosition = this._options.player.position
    const disposeRadius = this._options.activeRadiusMeters + this._options.cellSizeMeters

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

  private _getNearbySpawnCandidates(): FishSpawnCandidate[] {
    const position = this._options.player.position
    const centerCellX = Math.floor(position.x / this._options.cellSizeMeters)
    const centerCellZ = Math.floor(position.z / this._options.cellSizeMeters)
    const radiusCells = Math.ceil(this._options.activeRadiusMeters / this._options.cellSizeMeters)
    const candidates: FishSpawnCandidate[] = []

    for (let z = -radiusCells; z <= radiusCells; z += 1) {
      for (let x = -radiusCells; x <= radiusCells; x += 1) {
        const cellX = centerCellX + x
        const cellZ = centerCellZ + z
        const cellId = `fish_cell_${cellX}_${cellZ}`
        const worldX = (cellX + 0.18 + this._options.random() * 0.64) * this._options.cellSizeMeters
        const worldZ = (cellZ + 0.18 + this._options.random() * 0.64) * this._options.cellSizeMeters

        if (Math.hypot(worldX - position.x, worldZ - position.z) > this._options.activeRadiusMeters) {
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
