import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"
import type { ChunkRepository } from "../data/ChunkRepository"
import type { PlayerController } from "../player/PlayerController"
import { ChunkCoord } from "./ChunkCoord"
import { ChunkManager, type TerrainStreamingDebugStats } from "./ChunkManager"
import { TerrainGenerator } from "./generation/TerrainGenerator"
import type { WorldFeatureGenerator } from "./generation/WorldFeatureGenerator"

export class ProgressiveTerrainSystem implements GameSystem {
  private readonly _generator: TerrainGenerator
  private readonly _chunkManager: ChunkManager
  private _targetCenter: ChunkCoord | null = null
  private _loadedCenterKey = ""
  private _isRefreshing = false

  public constructor(
    private readonly _context: EngineContext,
    private readonly _player: PlayerController,
    chunkRepository: ChunkRepository,
    worldFeatures: WorldFeatureGenerator,
  ) {
    this._generator = new TerrainGenerator({
      seed: this._context.config.worldSeed,
      chunkSizeMeters: 64,
      resolution: 32,
      worldFeatures,
    })

    this._chunkManager = new ChunkManager(
      this._context,
      this._generator,
      chunkRepository,
      worldFeatures,
      {
        loadRadiusChunks: 3,
        unloadRadiusChunks: 4,
        memoryRadiusChunks: 5,
        maxChunkLoadsPerFrame: 1,
        worldBounds: this._context.config.worldBounds,
        worldId: this._context.config.worldId,
      },
    )
  }

  public async initialize(): Promise<void> {
    this._targetCenter = this._getPlayerChunkCoord()
    await this._refreshChunks()
  }

  public update(_deltaSeconds: number): void {
    const center = this._getPlayerChunkCoord()

    if (center.key !== this._targetCenter?.key) {
      this._targetCenter = center
    }

    if (
      !this._isRefreshing &&
      (this._chunkManager.hasPendingWork || center.key !== this._loadedCenterKey)
    ) {
      void this._refreshChunks()
    }
  }

  public getHeightAt(worldX: number, worldZ: number): number {
    return this._chunkManager.getHeightAt(worldX, worldZ)
  }

  public getStreamingDebugStats(): TerrainStreamingDebugStats {
    return this._chunkManager.getDebugStats()
  }

  public get chunkBoundariesDebugEnabled(): boolean {
    return this._chunkManager.chunkBoundariesDebugEnabled
  }

  public setChunkBoundariesDebugEnabled(enabled: boolean): void {
    this._chunkManager.setChunkBoundariesDebugEnabled(enabled)
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
      if (this._targetCenter) {
        const center = this._targetCenter

        await this._chunkManager.updateStreaming(center)
        this._loadedCenterKey = center.key
      }
    } finally {
      this._isRefreshing = false
    }
  }

  private _getPlayerChunkCoord(): ChunkCoord {
    const position = this._player.position

    return ChunkCoord.fromWorldPosition(position.x, position.z, this._generator.chunkSizeMeters)
  }
}
