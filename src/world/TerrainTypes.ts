import type { ChunkCoord } from "./ChunkCoord"

export type GeneratedPropType = "pine" | "rock" | "log"

export interface GeneratedPropData {
  readonly id: string
  readonly type: GeneratedPropType
  readonly position: [number, number, number]
  readonly rotationY: number
  readonly scale: number
}

export interface ChunkTerrainData {
  readonly key: string
  readonly coord: ChunkCoord
  readonly chunkSizeMeters: number
  readonly resolution: number
  readonly generatorVersion: number
  readonly seed: number
  readonly heights: Float32Array
  readonly props: GeneratedPropData[]
}
