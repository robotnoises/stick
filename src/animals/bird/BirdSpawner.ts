import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { EngineContext } from "../../app/EngineContext"
import type { AnimalPositionProvider, BirdSpawnCandidate } from "../AnimalTypes"
import { BirdController } from "./BirdController"
import { BirdMeshFactory } from "./BirdMeshFactory"

export interface BirdSpawnerOptions {
  readonly context: EngineContext
  readonly player: AnimalPositionProvider
  readonly terrainHeightProvider: (worldX: number, worldZ: number) => number
  readonly activeRadiusMeters: number
  readonly maxBirds: number
  readonly birdSpawnChance: number
  readonly random: () => number
}

export class BirdSpawner {
  private readonly _birds = new Map<string, BirdController>()
  private readonly _meshFactory: BirdMeshFactory
  private _maxBirds: number
  private _nextId = 0

  public constructor(private readonly _options: BirdSpawnerOptions) {
    this._meshFactory = new BirdMeshFactory(this._options.context)
    this._maxBirds = this._options.maxBirds
  }

  public get activeCount(): number {
    return this._birds.size
  }

  public get birds(): Map<string, BirdController> {
    return this._birds
  }

  public setMaxBirds(maxBirds: number): void {
    this._maxBirds = maxBirds
  }

  public update(deltaSeconds: number): void {
    this._spawnNearby()
    this._disposeDistant()

    for (const bird of this._birds.values()) {
      bird.update(deltaSeconds)
    }
  }

  public dispose(): void {
    for (const bird of this._birds.values()) {
      bird.dispose()
    }

    this._birds.clear()
  }

  private _spawnNearby(): void {
    if (this._birds.size >= this._maxBirds || this._options.random() > this._options.birdSpawnChance) {
      return
    }

    const candidate = this._getSpawnCandidate()
    const scale = 0.75 + this._options.random() * 0.6
    const position = new Vector3(candidate.x, candidate.y, candidate.z)
    const visual = this._meshFactory.createBird(candidate.id, position, scale)

    this._birds.set(
      candidate.id,
      new BirdController({
        id: candidate.id,
        visual,
        initialPosition: position,
        player: this._options.player,
        terrainHeightProvider: this._options.terrainHeightProvider,
        random: this._options.random,
      }),
    )
  }

  private _getSpawnCandidate(): BirdSpawnCandidate {
    const playerPosition = this._options.player.position
    const angle = this._options.random() * Math.PI * 2
    const distance = this._options.activeRadiusMeters * (0.65 + this._options.random() * 0.35)
    const x = playerPosition.x + Math.sin(angle) * distance
    const z = playerPosition.z + Math.cos(angle) * distance
    const y = this._options.terrainHeightProvider(x, z) + 18 + this._options.random() * 28
    const id = `bird_runtime_${this._nextId}`

    this._nextId += 1

    return { id, x, y, z }
  }

  private _disposeDistant(): void {
    const playerPosition = this._options.player.position
    const disposeRadius = this._options.activeRadiusMeters + 80

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
}
