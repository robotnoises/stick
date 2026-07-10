import type { WorldBounds } from "../../app/GameConfig"
import type { GeneratedPropData } from "../terrain/TerrainTypes"

export interface TerrainGenerationRequest {
  readonly requestId: number
  readonly seed: number
  readonly chunkX: number
  readonly chunkZ: number
  readonly chunkSizeMeters: number
  readonly resolution: number
  readonly worldBounds: WorldBounds
}

export interface TerrainGenerationResponse {
  readonly requestId: number
  readonly key: string
  readonly coord: {
    readonly x: number
    readonly z: number
  }
  readonly chunkSizeMeters: number
  readonly resolution: number
  readonly generatorVersion: number
  readonly seed: number
  readonly heights: Float32Array
  readonly terrainMaterials: Uint8Array
  readonly props: GeneratedPropData[]
}
