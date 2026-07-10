import type { ChunkMutation, PersistedChunkData } from "../../data/ChunkRepository"
import { ChunkCoord } from "../ChunkCoord"
import { TerrainGenerator } from "../generation/TerrainGenerator"
import type { ChunkTerrainData } from "../terrain/TerrainTypes"

export class PersistedChunkMapper {
  public static readonly persistedVersion = 1

  public constructor(private readonly _generator: TerrainGenerator) {}

  public isCompatible(chunk: PersistedChunkData): boolean {
    return (
      chunk.worldSeed === this._generator.seed &&
      chunk.generatorVersion === TerrainGenerator.version &&
      chunk.chunkSizeMeters === this._generator.chunkSizeMeters &&
      chunk.resolution === this._generator.resolution
    )
  }

  public fromPersisted(chunk: PersistedChunkData): ChunkTerrainData {
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

  public toPersisted(
    data: ChunkTerrainData,
    storageKey: string,
    mutations: ChunkMutation[],
    generatedAt: number,
    lastVisitedAt: number,
  ): PersistedChunkData {
    return {
      version: PersistedChunkMapper.persistedVersion,
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
}
