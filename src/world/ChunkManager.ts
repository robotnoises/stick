import { Texture } from "@babylonjs/core/Materials/Textures/texture"
import { Material } from "@babylonjs/core/Materials/material"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { Observer } from "@babylonjs/core/Misc/observable"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import bark006ColorUrl from "../../assets/exported/textures/terrain/bark006-color.png?url"
import bark014ColorUrl from "../../assets/exported/textures/terrain/bark014-color.png?url"
import fineClumpySandBaseColorUrl from "../../assets/exported/textures/terrain/fine-clumpy-sand-basecolor.png?url"
import grass004ColorUrl from "../../assets/exported/textures/terrain/grass004-color.png?url"
import ground048ColorUrl from "../../assets/exported/textures/terrain/ground048-color.png?url"
import rock058ColorUrl from "../../assets/exported/textures/terrain/rock058-color.png?url"
import pineNeedleClusterUrl from "../../assets/exported/textures/props/pine-needle-cluster.png?url"
import pineNeedleLitterUrl from "../../assets/exported/textures/props/pine-needle-litter.png?url"
import waterColorUrl from "../../assets/exported/textures/terrain/water.jpg?url"
import type { Scene } from "@babylonjs/core/scene"
import type { EngineContext } from "../app/EngineContext"
import type { WorldBounds } from "../app/GameConfig"
import type { ChunkRepository, ChunkMutation, PersistedChunkData } from "../data/ChunkRepository"
import { ChunkCoord } from "./ChunkCoord"
import { TerrainChunk, type TerrainChunkMaterials } from "./TerrainChunk"
import type { ChunkTerrainData } from "./TerrainTypes"
import { WorldBoundsHelper } from "./WorldBounds"
import { TerrainGenerator } from "./generation/TerrainGenerator"
import type { TerrainGenerationDebugStats } from "./generation/TerrainGeneratorWorkerClient"
import type { RiverFeature, WorldFeatureGenerator } from "./generation/WorldFeatureGenerator"

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

interface RiverWaterStation {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly distanceMeters: number
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
  private static readonly _persistedVersion = 1

  private readonly _activeChunks = new Map<string, TerrainChunk>()
  private readonly _activeCoords = new Map<string, ChunkCoord>()
  private readonly _bounds: WorldBoundsHelper | null
  private readonly _dataCache = new Map<string, CachedChunkData>()
  private readonly _inFlightLoads = new Set<string>()
  private readonly _materials: TerrainChunkMaterials
  private readonly _queuedCoords = new Map<string, ChunkCoord>()
  private readonly _chunkBoundaryMeshes = new Map<string, Mesh>()
  private readonly _riverWaterMeshes: Mesh[] = []
  private _chunkBoundariesDebugEnabled = false
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
    this._materials = this._createMaterials()
    this._createRiverWaterMeshes()
  }

  public get hasPendingWork(): boolean {
    return this._queuedCoords.size > 0 || this._inFlightLoads.size > 0
  }

  public get chunkBoundariesDebugEnabled(): boolean {
    return this._chunkBoundariesDebugEnabled
  }

  public setChunkBoundariesDebugEnabled(enabled: boolean): void {
    this._chunkBoundariesDebugEnabled = enabled

    if (!enabled) {
      this._disposeChunkBoundaryMeshes()
      return
    }

    for (const coord of this._activeCoords.values()) {
      this._ensureChunkBoundaryMesh(coord)
    }
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
    this._disposeChunkBoundaryMeshes()
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
      this._ensureChunkBoundaryMesh(coord)
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

    if (persisted && this._isCompatiblePersistedChunk(persisted)) {
      const data = this._fromPersistedChunk(persisted)
      const now = Date.now()

      this._dataCache.set(coord.key, { data, lastUsed: now })
      await this._savePersistedChunk({ ...persisted, lastVisitedAt: now })

      return data
    }

    const generated = await this._chunkDataGenerator.generateChunk(coord)
    const now = Date.now()

    this._dataCache.set(coord.key, { data: generated, lastUsed: now })
    await this._savePersistedChunk(this._toPersistedChunk(generated, storageKey, [], now, now))

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
      this._disposeChunkBoundaryMesh(key)
      this._activeChunks.delete(key)
      this._activeCoords.delete(key)
    }
  }

  private _ensureChunkBoundaryMesh(coord: ChunkCoord): void {
    if (!this._chunkBoundariesDebugEnabled || this._chunkBoundaryMeshes.has(coord.key)) {
      return
    }

    const minX = coord.x * this._generator.chunkSizeMeters
    const minZ = coord.z * this._generator.chunkSizeMeters
    const maxX = minX + this._generator.chunkSizeMeters
    const maxZ = minZ + this._generator.chunkSizeMeters
    const lift = 0.45
    const boundary = MeshBuilder.CreateLines(
      `debug_chunk_boundary_${coord.key}`,
      {
        points: [
          new Vector3(minX, this.getHeightAt(minX, minZ) + lift, minZ),
          new Vector3(maxX, this.getHeightAt(maxX, minZ) + lift, minZ),
          new Vector3(maxX, this.getHeightAt(maxX, maxZ) + lift, maxZ),
          new Vector3(minX, this.getHeightAt(minX, maxZ) + lift, maxZ),
          new Vector3(minX, this.getHeightAt(minX, minZ) + lift, minZ),
        ],
      },
      this._context.scene,
    ) as Mesh

    boundary.isPickable = false
    this._chunkBoundaryMeshes.set(coord.key, boundary)
  }

  private _disposeChunkBoundaryMesh(key: string): void {
    const boundary = this._chunkBoundaryMeshes.get(key)

    boundary?.dispose()
    this._chunkBoundaryMeshes.delete(key)
  }

  private _disposeChunkBoundaryMeshes(): void {
    for (const boundary of this._chunkBoundaryMeshes.values()) {
      boundary.dispose()
    }

    this._chunkBoundaryMeshes.clear()
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
    const localX = worldX - data.coord.x * data.chunkSizeMeters
    const localZ = worldZ - data.coord.z * data.chunkSizeMeters
    const gridSize = data.resolution + 1
    const step = data.chunkSizeMeters / data.resolution
    const sampleX = Math.min(Math.max(localX / step, 0), data.resolution)
    const sampleZ = Math.min(Math.max(localZ / step, 0), data.resolution)
    const x0 = Math.floor(sampleX)
    const z0 = Math.floor(sampleZ)
    const x1 = Math.min(x0 + 1, data.resolution)
    const z1 = Math.min(z0 + 1, data.resolution)
    const tx = sampleX - x0
    const tz = sampleZ - z0
    const a = data.heights[z0 * gridSize + x0] ?? 0
    const b = data.heights[z0 * gridSize + x1] ?? a
    const c = data.heights[z1 * gridSize + x0] ?? a
    const d = data.heights[z1 * gridSize + x1] ?? c
    const xMix0 = this._lerp(a, b, tx)
    const xMix1 = this._lerp(c, d, tx)

    return this._lerp(xMix0, xMix1, tz)
  }

  private _isCompatiblePersistedChunk(chunk: PersistedChunkData): boolean {
    return (
      chunk.worldSeed === this._generator.seed &&
      chunk.generatorVersion === TerrainGenerator.version &&
      chunk.chunkSizeMeters === this._generator.chunkSizeMeters &&
      chunk.resolution === this._generator.resolution
    )
  }

  private _fromPersistedChunk(chunk: PersistedChunkData): ChunkTerrainData {
    const mutations = chunk.mutations
    const heights = new Float32Array(chunk.heights)
    const terrainMaterials = this._getPersistedTerrainMaterials(chunk, heights)
    const removedPropIds = new Set(
      mutations
        .filter((mutation) => mutation.type === "propRemoved")
        .map((mutation) => mutation.propId),
    )
    const props = chunk.props.filter((prop) => !removedPropIds.has(prop.id))

    for (const mutation of mutations) {
      if (mutation.type === "terrainDelta") {
        heights[mutation.vertexIndex] = (heights[mutation.vertexIndex] ?? 0) + mutation.deltaY
      }
    }

    return {
      key: ChunkCoord.toKey(chunk.coordX, chunk.coordZ),
      coord: new ChunkCoord(chunk.coordX, chunk.coordZ),
      chunkSizeMeters: chunk.chunkSizeMeters,
      resolution: chunk.resolution,
      generatorVersion: chunk.generatorVersion,
      seed: chunk.worldSeed,
      heights,
      terrainMaterials,
      props,
    }
  }

  private _toPersistedChunk(
    data: ChunkTerrainData,
    storageKey: string,
    mutations: ChunkMutation[],
    generatedAt: number,
    lastVisitedAt: number,
  ): PersistedChunkData {
    return {
      version: ChunkManager._persistedVersion,
      key: storageKey,
      coordX: data.coord.x,
      coordZ: data.coord.z,
      worldSeed: data.seed,
      generatorVersion: data.generatorVersion,
      chunkSizeMeters: data.chunkSizeMeters,
      resolution: data.resolution,
      heights: Array.from(data.heights),
      terrainMaterials: Array.from(data.terrainMaterials),
      props: data.props,
      mutations,
      generatedAt,
      lastVisitedAt,
    }
  }

  private _getPersistedTerrainMaterials(
    chunk: PersistedChunkData,
    heights: Float32Array,
  ): Uint8Array {
    const expectedLength = (chunk.resolution + 1) * (chunk.resolution + 1)

    if (chunk.terrainMaterials && chunk.terrainMaterials.length === expectedLength) {
      return new Uint8Array(chunk.terrainMaterials)
    }

    const terrainMaterials = new Uint8Array(expectedLength)
    const step = chunk.chunkSizeMeters / chunk.resolution

    for (let z = 0; z <= chunk.resolution; z += 1) {
      for (let x = 0; x <= chunk.resolution; x += 1) {
        const index = z * (chunk.resolution + 1) + x
        const worldX = chunk.coordX * chunk.chunkSizeMeters + x * step
        const worldZ = chunk.coordZ * chunk.chunkSizeMeters + z * step

        terrainMaterials[index] = this._generator.getTerrainMaterial(
          worldX,
          worldZ,
          heights[index] ?? 0,
        )
      }
    }

    return terrainMaterials
  }

  private _getStorageKey(coord: ChunkCoord): string {
    if (!this._options.worldId) {
      return coord.key
    }

    return `${this._options.worldId}:${coord.key}`
  }

  private _createRiverWaterMeshes(): void {
    for (const river of this._worldFeatures.rivers) {
      this._createRiverWaterMesh(river)
    }
  }

  private _createRiverWaterMesh(river: RiverFeature): void {
    const stations = this._getRiverWaterStations(river)

    if (stations.length < 2) {
      return
    }

    const mesh = new Mesh(`water_${river.id}`, this._context.scene)
    const vertexData = new VertexData()
    const positions: number[] = []
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const halfWidthMeters = river.widthMeters / 2 + 1.25
    const uvLengthScaleMeters = 48

    for (let stationIndex = 0; stationIndex < stations.length; stationIndex += 1) {
      const station = stations[stationIndex]!
      const previous = stations[Math.max(0, stationIndex - 1)]!
      const next = stations[Math.min(stations.length - 1, stationIndex + 1)]!
      const tangentX = next.x - previous.x
      const tangentZ = next.z - previous.z
      const tangentLength = Math.hypot(tangentX, tangentZ) || 1
      const normalX = -tangentZ / tangentLength
      const normalZ = tangentX / tangentLength
      const leftX = station.x + normalX * halfWidthMeters
      const leftZ = station.z + normalZ * halfWidthMeters
      const rightX = station.x - normalX * halfWidthMeters
      const rightZ = station.z - normalZ * halfWidthMeters
      const vertexStart = stationIndex * 2
      const riverV = station.distanceMeters / uvLengthScaleMeters

      positions.push(leftX, station.y, leftZ, rightX, station.y, rightZ)
      normals.push(0, 1, 0, 0, 1, 0)
      uvs.push(0, riverV, 1, riverV)

      if (stationIndex === 0) {
        continue
      }

      indices.push(
        vertexStart - 2,
        vertexStart,
        vertexStart - 1,
        vertexStart - 1,
        vertexStart,
        vertexStart + 1,
      )
    }

    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.uvs = uvs
    vertexData.applyToMesh(mesh)

    mesh.material = this._materials.water
    mesh.isPickable = false
    this._riverWaterMeshes.push(mesh)
  }

  private _getRiverWaterStations(river: RiverFeature): RiverWaterStation[] {
    const stations: RiverWaterStation[] = []
    const segmentLengthMeters = 4
    let riverDistanceMeters = 0

    for (let pointIndex = 1; pointIndex < river.points.length; pointIndex += 1) {
      const [startX, startZ] = river.points[pointIndex - 1]!
      const [endX, endZ] = river.points[pointIndex]!
      const segmentLength = Math.hypot(endX - startX, endZ - startZ)

      if (segmentLength === 0) {
        continue
      }

      const subdivisions = Math.max(1, Math.ceil(segmentLength / segmentLengthMeters))

      for (let subdivision = 0; subdivision <= subdivisions; subdivision += 1) {
        if (stations.length > 0 && subdivision === 0) {
          continue
        }

        const t = subdivision / subdivisions

        const x = this._lerp(startX, endX, t)
        const z = this._lerp(startZ, endZ, t)

        stations.push({
          x,
          y: this._getRiverWaterHeight(river, x, z),
          z,
          distanceMeters: riverDistanceMeters + segmentLength * t,
        })
      }

      riverDistanceMeters += segmentLength
    }

    return stations
  }

  private _getRiverWaterHeight(river: RiverFeature, worldX: number, worldZ: number): number {
    return this._worldFeatures.getRiverWaterLevelAtPosition(river, worldX, worldZ) + 0.08
  }

  private _disposeRiverWaterMeshes(): void {
    for (const mesh of this._riverWaterMeshes) {
      mesh.dispose()
    }

    this._riverWaterMeshes.length = 0
  }

  private _createMaterials(): TerrainChunkMaterials {
    const grassTerrain = new StandardMaterial(
      "progressive-grass-terrain-material",
      this._context.scene,
    )
    const dirtTerrain = new StandardMaterial(
      "progressive-dirt-terrain-material",
      this._context.scene,
    )
    const sandTerrain = new StandardMaterial(
      "progressive-sand-terrain-material",
      this._context.scene,
    )
    const pineNeedlesTerrain = new StandardMaterial(
      "progressive-pine-needles-terrain-material",
      this._context.scene,
    )
    const trunk = new StandardMaterial("progressive-pine-trunk-material", this._context.scene)
    const deadWood = new StandardMaterial("progressive-dead-wood-material", this._context.scene)
    const needles = new StandardMaterial("progressive-pine-needles-material", this._context.scene)
    const pineFoliage = new StandardMaterial(
      "progressive-pine-foliage-material",
      this._context.scene,
    )
    const pineNeedleLitter = new StandardMaterial(
      "progressive-pine-needle-litter-material",
      this._context.scene,
    )
    const rock = new StandardMaterial("progressive-rock-material", this._context.scene)
    const water = new StandardMaterial("progressive-water-material", this._context.scene)

    this._configureTerrainMaterial(grassTerrain, grass004ColorUrl, new Color3(0.92, 1, 0.86))
    this._configureTerrainMaterial(dirtTerrain, ground048ColorUrl, new Color3(0.75, 0.58, 0.42))
    this._configureTerrainMaterial(
      sandTerrain,
      fineClumpySandBaseColorUrl,
      new Color3(1, 0.94, 0.78),
    )
    this._configureTerrainMaterial(
      pineNeedlesTerrain,
      ground048ColorUrl,
      new Color3(0.48, 0.38, 0.24),
    )
    this._configureTexturedMaterial(trunk, bark014ColorUrl, 1, new Color3(0.8, 0.72, 0.62))
    this._configureTexturedMaterial(deadWood, bark006ColorUrl, 1.5, new Color3(0.6, 0.46, 0.32))
    this._configureTexturedMaterial(rock, rock058ColorUrl, 2, new Color3(0.82, 0.86, 0.86))

    trunk.backFaceCulling = false
    trunk.twoSidedLighting = true
    trunk.specularColor = Color3.Black()
    deadWood.backFaceCulling = false
    deadWood.twoSidedLighting = true

    needles.diffuseColor = new Color3(0.11, 0.27, 0.14)
    needles.specularColor = Color3.Black()

    const pineFoliageTexture = new Texture(pineNeedleClusterUrl, this._context.scene)

    pineFoliageTexture.hasAlpha = true
    pineFoliage.diffuseTexture = pineFoliageTexture
    pineFoliage.diffuseColor = new Color3(0.5, 0.78, 0.44)
    pineFoliage.emissiveColor = new Color3(0.012, 0.034, 0.014)
    pineFoliage.specularColor = Color3.Black()
    pineFoliage.backFaceCulling = false
    pineFoliage.twoSidedLighting = true
    pineFoliage.useAlphaFromDiffuseTexture = true
    pineFoliage.alphaCutOff = 0.36
    pineFoliage.transparencyMode = Material.MATERIAL_ALPHATEST

    const pineNeedleLitterTexture = new Texture(pineNeedleLitterUrl, this._context.scene)

    pineNeedleLitterTexture.hasAlpha = true
    pineNeedleLitter.diffuseTexture = pineNeedleLitterTexture
    pineNeedleLitter.diffuseColor = new Color3(0.42, 0.32, 0.2)
    pineNeedleLitter.specularColor = Color3.Black()
    pineNeedleLitter.backFaceCulling = false
    pineNeedleLitter.twoSidedLighting = true
    pineNeedleLitter.useAlphaFromDiffuseTexture = true
    pineNeedleLitter.alphaCutOff = 0.32
    pineNeedleLitter.transparencyMode = Material.MATERIAL_ALPHATEST

    const waterTexture = new Texture(waterColorUrl, this._context.scene)

    waterTexture.uScale = 1.2
    waterTexture.vScale = 1.2
    waterTexture.level = 0.24

    water.emissiveTexture = waterTexture
    water.diffuseColor = new Color3(0.08, 0.22, 0.38)
    water.emissiveColor = new Color3(0.035, 0.1, 0.14)
    water.specularColor = new Color3(1.35, 1.3, 1.12)
    water.specularPower = 48
    water.roughness = 0.08
    water.alpha = 0.68
    water.useSpecularOverAlpha = true
    water.transparencyMode = Material.MATERIAL_ALPHABLEND
    water.backFaceCulling = false
    water.twoSidedLighting = true

    this._waterFlowObserver =
      this._context.scene.onBeforeRenderObservable?.add(() => {
        const deltaSeconds = this._context.engine.getDeltaTime() / 1000

        waterTexture.uOffset += deltaSeconds * 0.0025
        waterTexture.vOffset += deltaSeconds * 0.011
      }) ?? null

    return {
      terrain: [grassTerrain, dirtTerrain, sandTerrain, pineNeedlesTerrain],
      trunk,
      deadWood,
      needles,
      pineFoliage,
      pineNeedleLitter,
      rock,
      water,
    }
  }

  private _configureTerrainMaterial(
    material: StandardMaterial,
    textureUrl: string,
    tint: Color3,
  ): void {
    this._configureTexturedMaterial(material, textureUrl, 10, tint)
    material.ambientColor = new Color3(0.22, 0.22, 0.22)
    material.backFaceCulling = false
    material.twoSidedLighting = true
  }

  private _configureTexturedMaterial(
    material: StandardMaterial,
    textureUrl: string,
    scale: number,
    tint: Color3,
  ): void {
    const texture = new Texture(textureUrl, this._context.scene)

    texture.uScale = scale
    texture.vScale = scale
    material.diffuseTexture = texture
    material.diffuseColor = tint
    material.specularColor = Color3.Black()
  }

  private _lerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount
  }
}
