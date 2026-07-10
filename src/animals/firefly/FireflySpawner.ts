import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { EngineContext } from "../../app/EngineContext"
import type {
  AnimalPositionProvider,
  AnimalTimeProvider,
  FireflySpawnCandidate,
} from "../AnimalTypes"
import { FireflyController } from "./FireflyController"
import { FireflyMeshFactory } from "./FireflyMeshFactory"

export interface FireflySpawnerOptions {
  readonly context: EngineContext
  readonly player: AnimalPositionProvider
  readonly terrainHeightProvider: (worldX: number, worldZ: number) => number
  readonly timeProvider: AnimalTimeProvider
  readonly activeRadiusMeters: number
  readonly cellSizeMeters: number
  readonly maxFireflies: number
  readonly fireflySpawnChance: number
  readonly random: () => number
}

export class FireflySpawner {
  private readonly _fireflies = new Map<string, FireflyController>()
  private readonly _meshFactory: FireflyMeshFactory
  private _maxFireflies: number
  private _nextId = 0

  public constructor(private readonly _options: FireflySpawnerOptions) {
    this._meshFactory = new FireflyMeshFactory(this._options.context)
    this._maxFireflies = this._options.maxFireflies
  }

  public get activeCount(): number {
    return this._fireflies.size
  }

  public get fireflies(): Map<string, FireflyController> {
    return this._fireflies
  }

  public setMaxFireflies(maxFireflies: number): void {
    this._maxFireflies = maxFireflies
  }

  public update(deltaSeconds: number): void {
    this._spawnNearby()
    this._disposeDistant()

    for (const firefly of this._fireflies.values()) {
      firefly.update(deltaSeconds)
    }
  }

  public dispose(): void {
    this._disposeAll()
  }

  private _spawnNearby(): void {
    if (!this._isEveningOrNight()) {
      this._disposeAll()
      return
    }

    if (
      this._fireflies.size >= this._maxFireflies ||
      this._options.random() > this._options.fireflySpawnChance
    ) {
      return
    }

    const candidate = this._getSpawnCandidate()
    const scale = 0.75 + this._options.random() * 0.7
    const position = new Vector3(candidate.x, candidate.y, candidate.z)
    const visual = this._meshFactory.createFirefly(candidate.id, position, scale)

    this._fireflies.set(
      candidate.id,
      new FireflyController({
        id: candidate.id,
        visual,
        initialPosition: position,
        player: this._options.player,
        terrainHeightProvider: this._options.terrainHeightProvider,
        random: this._options.random,
      }),
    )
  }

  private _getSpawnCandidate(): FireflySpawnCandidate {
    const playerPosition = this._options.player.position
    const angle = this._options.random() * Math.PI * 2
    const distance = 6 + this._options.random() * Math.min(this._options.activeRadiusMeters * 0.65, 36)
    const x = playerPosition.x + Math.sin(angle) * distance
    const z = playerPosition.z + Math.cos(angle) * distance
    const y = this._options.terrainHeightProvider(x, z) + 0.7 + this._options.random() * 2.1
    const id = `firefly_runtime_${this._nextId}`

    this._nextId += 1

    return { id, x, y, z }
  }

  private _isEveningOrNight(): boolean {
    const hour = ((this._options.timeProvider.timeOfDayHours % 24) + 24) % 24

    return hour >= 18 || hour < 4
  }

  private _disposeDistant(): void {
    const playerPosition = this._options.player.position
    const disposeRadius = this._options.activeRadiusMeters + this._options.cellSizeMeters

    for (const [id, firefly] of this._fireflies) {
      const position = firefly.position
      const distance = Math.hypot(position.x - playerPosition.x, position.z - playerPosition.z)

      if (distance <= disposeRadius) {
        continue
      }

      firefly.dispose()
      this._fireflies.delete(id)
    }
  }

  private _disposeAll(): void {
    for (const firefly of this._fireflies.values()) {
      firefly.dispose()
    }

    this._fireflies.clear()
  }
}
