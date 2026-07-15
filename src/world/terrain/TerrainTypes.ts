import type { ChunkCoord } from "../ChunkCoord"

export const TerrainMaterial = {
  Grass: 0,
  Dirt: 1,
  Sand: 2,
  PineNeedles: 3,
  RiverBed: 4,
} as const

export type TerrainMaterialId = (typeof TerrainMaterial)[keyof typeof TerrainMaterial]

export type GeneratedPropType = "pine" | "deadPine" | "rock" | "log" | "grass"

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
  readonly terrainMaterials: Uint8Array
  readonly props: GeneratedPropData[]
}
