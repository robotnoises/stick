import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"
import { LocalForageChunkRepository } from "../data/LocalForageChunkRepository"
import type { PlayerController } from "../player/PlayerController"
import { ChunkCoord } from "./ChunkCoord"
import { ChunkManager } from "./ChunkManager"
import { TerrainGenerator } from "./generation/TerrainGenerator"

export class ProgressiveTerrainSystem implements GameSystem {
  private readonly _generator: TerrainGenerator
  private readonly _chunkManager: ChunkManager
  private _targetCenter: ChunkCoord | null = null
  private _loadedCenterKey = ""
  private _isRefreshing = false

  public constructor(
    private readonly _context: EngineContext,
    private readonly _player: PlayerController,
  ) {
    this._generator = new TerrainGenerator({
      seed: this._context.config.worldSeed,
      chunkSizeMeters: 64,
      resolution: 32,
    })

    this._chunkManager = new ChunkManager(
      this._context,
      this._generator,
      new LocalForageChunkRepository(),
      {
        loadRadiusChunks: 2,
        unloadRadiusChunks: 3,
        memoryRadiusChunks: 4,
      },
    )
  }

  public async initialize(): Promise<void> {
    this._targetCenter = this._getPlayerChunkCoord()
    await this._refreshChunks()
  }

  public update(_deltaSeconds: number): void {
    const center = this._getPlayerChunkCoord()

    if (center.key === this._targetCenter?.key) {
      return
    }

    this._targetCenter = center

    if (!this._isRefreshing) {
      void this._refreshChunks()
    }
  }

  public getHeightAt(worldX: number, worldZ: number): number {
    return this._chunkManager.getHeightAt(worldX, worldZ)
  }

  public dispose(): void {
    this._chunkManager.dispose()
  }

  private async _refreshChunks(): Promise<void> {
    if (this._isRefreshing) {
      return
    }

    this._isRefreshing = true

    try {
      while (this._targetCenter && this._targetCenter.key !== this._loadedCenterKey) {
        const center = this._targetCenter

        await this._chunkManager.updateAround(center)
        this._loadedCenterKey = center.key
      }
    } finally {
      this._isRefreshing = false
    }
  }

  private _getPlayerChunkCoord(): ChunkCoord {
    const position = this._player.position

    return ChunkCoord.fromWorldPosition(
      position.x,
      position.z,
      this._generator.chunkSizeMeters,
    )
  }
}
