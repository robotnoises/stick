import type { Observer } from "@babylonjs/core/Misc/observable"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import type { Scene } from "@babylonjs/core/scene"
import type { EngineContext } from "../app/EngineContext"
import type { WorldBounds } from "../app/GameConfig"
import type { ChunkRepository, PersistedChunkData } from "../data/ChunkRepository"
import { ChunkCoord } from "./ChunkCoord"
import { ChunkBoundaryDebugRenderer } from "./chunks/ChunkBoundaryDebugRenderer"
import { ChunkMaterialFactory } from "./chunks/ChunkMaterialFactory"
import { PersistedChunkMapper } from "./chunks/PersistedChunkMapper"
import { TerrainChunk, type TerrainChunkMaterials } from "./terrain/TerrainChunk"
import type { ChunkTerrainData } from "./terrain/TerrainTypes"
import { WorldBoundsHelper } from "./WorldBounds"
import { TerrainGenerator } from "./generation/TerrainGenerator"
import type { TerrainGenerationDebugStats } from "./generation/TerrainGeneratorWorkerClient"
import type { WorldFeatureGenerator } from "./generation/WorldFeatureGenerator"
import { TerrainChunkHeightSampler } from "./terrain/TerrainChunkHeightSampler"
import { RiverWaterMeshBuilder } from "./water/RiverWaterMeshBuilder"

export interface ChunkManagerOptions {
  readonly loadRadiusChunks: number
  readonly unloadRadiusChunks: number
  readonly memoryRadiusChunks: number
  readonly maxChunkLoadsPerFrame?: number
  readonly worldBounds?: WorldBounds
  readonly worldId?: string
}

interface CachedChunkData {
  readonly data: ChunkTerrainData
  lastUsed: number
}

export interface ChunkDataGenerator {
  generateChunk(coord: ChunkCoord): Promise<ChunkTerrainData> | ChunkTerrainData
  getDebugStats?(): TerrainGenerationDebugStats
  dispose?(): void
}

export interface TerrainMeshBuildDebugStats {
  readonly builtChunkCount: number
  readonly lastBuildMilliseconds: number | null
  readonly averageBuildMilliseconds: number | null
}

export interface TerrainStreamingDebugStats {
  readonly activeChunkCount: number
  readonly queuedChunkCount: number
  readonly inFlightChunkCount: number
  readonly cachedChunkDataCount: number
  readonly maxChunkLoadsPerFrame: number | null
  readonly terrainGeneration: TerrainGenerationDebugStats | null
  readonly terrainMeshBuild: TerrainMeshBuildDebugStats
}

export class ChunkManager {
  private readonly _activeChunks = new Map<string, TerrainChunk>()
  private readonly _activeCoords = new Map<string, ChunkCoord>()
  private readonly _bounds: WorldBoundsHelper | null
  private readonly _dataCache = new Map<string, CachedChunkData>()
  private readonly _inFlightLoads = new Set<string>()
  private readonly _materials: TerrainChunkMaterials
  private readonly _persistedChunkMapper: PersistedChunkMapper
  private readonly _queuedCoords = new Map<string, ChunkCoord>()
  private readonly _chunkBoundaryDebugRenderer: ChunkBoundaryDebugRenderer
  private readonly _riverWaterMeshes: Mesh[] = []
  private _waterFlowObserver: Observer<Scene> | null = null
  private _builtChunkCount = 0
  private _lastMeshBuildMilliseconds: number | null = null
  private _totalMeshBuildMilliseconds = 0

  public constructor(
    private readonly _context: EngineContext,
    private readonly _generator: TerrainGenerator,
    private readonly _repository: ChunkRepository,
    private readonly _worldFeatures: WorldFeatureGenerator,
    private readonly _options: ChunkManagerOptions,
    private readonly _chunkDataGenerator: ChunkDataGenerator = _generator,
  ) {
    this._bounds = this._options.worldBounds
      ? new WorldBoundsHelper(this._options.worldBounds)
      : null

    const materialFactoryResult = new ChunkMaterialFactory(this._context).create()

    this._materials = materialFactoryResult.materials
    this._waterFlowObserver = materialFactoryResult.waterFlowObserver
    this._persistedChunkMapper = new PersistedChunkMapper(this._generator)
    this._chunkBoundaryDebugRenderer = new ChunkBoundaryDebugRenderer(
      this._context,
      this._generator.chunkSizeMeters,
      (worldX, worldZ) => this.getHeightAt(worldX, worldZ),
    )
    this._riverWaterMeshes.push(
      ...new RiverWaterMeshBuilder(this._context, this._worldFeatures, this._materials).createAll(),
    )
  }

  public get hasPendingWork(): boolean {
    return this._queuedCoords.size > 0 || this._inFlightLoads.size > 0
  }

  public get chunkBoundariesDebugEnabled(): boolean {
    return this._chunkBoundaryDebugRenderer.enabled
  }

  public get _chunkBoundaryMeshes(): Map<string, Mesh> {
    return this._chunkBoundaryDebugRenderer.meshes
  }

  public setChunkBoundariesDebugEnabled(enabled: boolean): void {
    this._chunkBoundaryDebugRenderer.setEnabled(enabled, this._activeCoords.values())
  }

  public getDebugStats(): TerrainStreamingDebugStats {
    return {
      activeChunkCount: this._activeChunks.size,
      queuedChunkCount: this._queuedCoords.size,
      inFlightChunkCount: this._inFlightLoads.size,
      cachedChunkDataCount: this._dataCache.size,
      maxChunkLoadsPerFrame: this._options.maxChunkLoadsPerFrame ?? null,
      terrainGeneration: this._chunkDataGenerator.getDebugStats?.() ?? null,
      terrainMeshBuild: {
        builtChunkCount: this._builtChunkCount,
        lastBuildMilliseconds: this._lastMeshBuildMilliseconds,
        averageBuildMilliseconds:
          this._builtChunkCount === 0
            ? null
            : this._totalMeshBuildMilliseconds / this._builtChunkCount,
      },
    }
  }

  public async updateAround(center: ChunkCoord): Promise<void> {
    do {
      await this.updateStreaming(center)
    } while (this.hasPendingWork)
  }

  public async updateStreaming(center: ChunkCoord): Promise<void> {
    this._disposeDistantChunks(center)
    this._queueMissingDesiredChunks(center)

    const maxLoads = this._options.maxChunkLoadsPerFrame ?? Number.POSITIVE_INFINITY
    const loadsThisFrame = Math.max(1, maxLoads)

    for (let index = 0; index < loadsThisFrame; index += 1) {
      const coord = this._dequeueNextChunk()

      if (!coord) {
        break
      }

      await this._ensureChunk(coord)
    }

    this._evictDistantCachedData(center)
  }

  public getHeightAt(worldX: number, worldZ: number): number {
    const coord = ChunkCoord.fromWorldPosition(worldX, worldZ, this._generator.chunkSizeMeters)
    const cached = this._dataCache.get(coord.key)

    if (!cached) {
      return this._generator.getHeight(worldX, worldZ)
    }

    cached.lastUsed = Date.now()
    return this._sampleChunkHeight(cached.data, worldX, worldZ)
  }

  public dispose(): void {
    for (const chunk of this._activeChunks.values()) {
      chunk.dispose()
    }

    this._activeChunks.clear()
    this._activeCoords.clear()
    this._dataCache.clear()
    this._inFlightLoads.clear()
    this._queuedCoords.clear()
    this._chunkBoundaryDebugRenderer.disposeAll()
    this._disposeRiverWaterMeshes()
    for (const terrainMaterial of this._materials.terrain) {
      terrainMaterial.dispose()
    }
    this._materials.trunk.dispose()
    this._materials.deadWood.dispose()
    this._materials.needles.dispose()
    this._materials.pineFoliage.dispose()
    this._materials.pineNeedleLitter.dispose()
    this._materials.rock.dispose()
    this._waterFlowObserver?.remove()
    this._waterFlowObserver = null
    this._materials.water.diffuseTexture?.dispose?.()
    this._materials.water.emissiveTexture?.dispose?.()
    this._materials.water.dispose()
    this._chunkDataGenerator.dispose?.()
  }

  private async _ensureChunk(coord: ChunkCoord): Promise<void> {
    if (this._activeChunks.has(coord.key) || this._inFlightLoads.has(coord.key)) {
      return
    }

    this._inFlightLoads.add(coord.key)

    try {
      const data = await this._loadChunkData(coord)
      const meshBuildStartedAt = performance.now()
      const chunk = new TerrainChunk(this._context, data, this._materials, this._worldFeatures)

      this._recordMeshBuildDuration(performance.now() - meshBuildStartedAt)
      this._activeChunks.set(coord.key, chunk)
      this._activeCoords.set(coord.key, coord)
      this._chunkBoundaryDebugRenderer.ensure(coord)
    } finally {
      this._inFlightLoads.delete(coord.key)
    }
  }

  private _recordMeshBuildDuration(durationMilliseconds: number): void {
    this._builtChunkCount += 1
    this._lastMeshBuildMilliseconds = durationMilliseconds
    this._totalMeshBuildMilliseconds += durationMilliseconds
  }

  private async _loadChunkData(coord: ChunkCoord): Promise<ChunkTerrainData> {
    const cached = this._dataCache.get(coord.key)

    if (cached) {
      cached.lastUsed = Date.now()
      return cached.data
    }

    const storageKey = this._getStorageKey(coord)
    const persisted = await this._loadPersistedChunk(storageKey)

    if (persisted && this._persistedChunkMapper.isCompatible(persisted)) {
      const data = this._persistedChunkMapper.fromPersisted(persisted)
      const now = Date.now()

      this._dataCache.set(coord.key, { data, lastUsed: now })
      await this._savePersistedChunk({ ...persisted, lastVisitedAt: now })

      return data
    }

    const generated = await this._chunkDataGenerator.generateChunk(coord)
    const now = Date.now()

    this._dataCache.set(coord.key, { data: generated, lastUsed: now })
    await this._savePersistedChunk(this._persistedChunkMapper.toPersisted(generated, storageKey, [], now, now))

    return generated
  }

  private async _loadPersistedChunk(key: string): Promise<PersistedChunkData | null> {
    try {
      return await this._repository.getChunk(key)
    } catch (error) {
      console.warn(`Failed to load terrain chunk ${key}. Regenerating from seed.`, error)
      return null
    }
  }

  private async _savePersistedChunk(chunk: PersistedChunkData): Promise<void> {
    try {
      await this._repository.saveChunk(chunk)
    } catch (error) {
      console.warn(`Failed to persist terrain chunk ${chunk.key}.`, error)
    }
  }

  private _queueMissingDesiredChunks(center: ChunkCoord): void {
    const desiredCoords = this._getDesiredCoords(center)
    const desiredKeys = new Set(desiredCoords.map((coord) => coord.key))

    for (const key of this._queuedCoords.keys()) {
      if (!desiredKeys.has(key)) {
        this._queuedCoords.delete(key)
      }
    }

    for (const coord of desiredCoords) {
      if (
        this._activeChunks.has(coord.key) ||
        this._inFlightLoads.has(coord.key) ||
        this._queuedCoords.has(coord.key)
      ) {
        continue
      }

      this._queuedCoords.set(coord.key, coord)
    }

    const prioritizedCoords = [...this._queuedCoords.values()].sort(
      (a, b) => a.distanceTo(center) - b.distanceTo(center),
    )

    this._queuedCoords.clear()

    for (const coord of prioritizedCoords) {
      this._queuedCoords.set(coord.key, coord)
    }
  }

  private _dequeueNextChunk(): ChunkCoord | null {
    const next = this._queuedCoords.values().next()

    if (next.done) {
      return null
    }

    this._queuedCoords.delete(next.value.key)
    return next.value
  }

  private _disposeDistantChunks(center: ChunkCoord): void {
    for (const [key, chunk] of this._activeChunks) {
      const coord = this._activeCoords.get(key)

      if (!coord || coord.distanceTo(center) <= this._options.unloadRadiusChunks) {
        continue
      }

      chunk.dispose()
      this._chunkBoundaryDebugRenderer.disposeMesh(key)
      this._activeChunks.delete(key)
      this._activeCoords.delete(key)
    }
  }

  private _evictDistantCachedData(center: ChunkCoord): void {
    for (const [key, cached] of this._dataCache) {
      if (this._activeChunks.has(key)) {
        continue
      }

      if (cached.data.coord.distanceTo(center) > this._options.memoryRadiusChunks) {
        this._dataCache.delete(key)
      }
    }
  }

  private _getDesiredCoords(center: ChunkCoord): ChunkCoord[] {
    const coords: ChunkCoord[] = []

    for (let z = -this._options.loadRadiusChunks; z <= this._options.loadRadiusChunks; z += 1) {
      for (let x = -this._options.loadRadiusChunks; x <= this._options.loadRadiusChunks; x += 1) {
        const coord = new ChunkCoord(center.x + x, center.z + z)

        if (this._bounds && !this._bounds.intersectsChunk(coord, this._generator.chunkSizeMeters)) {
          continue
        }

        coords.push(coord)
      }
    }

    coords.sort((a, b) => a.distanceTo(center) - b.distanceTo(center))
    return coords
  }

  private _sampleChunkHeight(data: ChunkTerrainData, worldX: number, worldZ: number): number {
    return new TerrainChunkHeightSampler(data).sample(worldX, worldZ)
  }

  public _isCompatiblePersistedChunk(chunk: PersistedChunkData): boolean {
    return this._persistedChunkMapper.isCompatible(chunk)
  }

  public _fromPersistedChunk(chunk: PersistedChunkData): ChunkTerrainData {
    return this._persistedChunkMapper.fromPersisted(chunk)
  }

  private _getStorageKey(coord: ChunkCoord): string {
    if (!this._options.worldId) {
      return coord.key
    }

    return `${this._options.worldId}:${coord.key}`
  }

  private _disposeRiverWaterMeshes(): void {
    for (const mesh of this._riverWaterMeshes) {
      mesh.dispose()
    }

    this._riverWaterMeshes.length = 0
  }


}
