import type { GeneratedPropData } from "../world/TerrainTypes"

export interface ChunkRepository {
  getChunk(key: string): Promise<PersistedChunkData | null>
  saveChunk(chunk: PersistedChunkData): Promise<void>
  deleteChunk(key: string): Promise<void>
  listChunkKeys(): Promise<string[]>
}

export interface PersistedChunkData {
  readonly version: number
  readonly key: string
  readonly coordX: number
  readonly coordZ: number
  readonly worldSeed: number
  readonly generatorVersion: number
  readonly chunkSizeMeters: number
  readonly resolution: number
  readonly heights: number[]
  readonly terrainMaterials?: number[]
  readonly props: GeneratedPropData[]
  readonly mutations: ChunkMutation[]
  readonly generatedAt: number
  readonly lastVisitedAt: number
}

export type ChunkMutation =
  | { readonly type: "propRemoved"; readonly propId: string }
  | { readonly type: "terrainDelta"; readonly vertexIndex: number; readonly deltaY: number }
