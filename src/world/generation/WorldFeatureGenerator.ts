import type { WorldBounds } from "../../app/GameConfig"

export interface WorldFeatureGeneratorOptions {
  readonly seed: number
  readonly worldBounds: WorldBounds
}

export interface LakeFeature {
  readonly id: string
  readonly centerX: number
  readonly centerZ: number
  readonly radiusX: number
  readonly radiusZ: number
  readonly waterLevelMeters: number
  readonly depthMeters: number
  readonly shoreFalloffMeters: number
}

export type WaterFeature = LakeFeature

export interface WaterFeatureSample {
  readonly feature: WaterFeature
  readonly type: "lake"
  readonly normalizedDistance: number
  readonly distanceToShoreMeters: number
  readonly isUnderWater: boolean
  readonly isShore: boolean
}

export interface WorldFeatureSample {
  readonly water: WaterFeatureSample | null
}

export class WorldFeatureGenerator {
  public static readonly version = 1

  private readonly _lakes: LakeFeature[]

  public constructor(private readonly _options: WorldFeatureGeneratorOptions) {
    this._lakes = this._generateLakes()
  }

  public get lakes(): readonly LakeFeature[] {
    return this._lakes
  }

  public sample(worldX: number, worldZ: number): WorldFeatureSample {
    let nearestLake: LakeFeature | null = null
    let nearestNormalizedDistance = Number.POSITIVE_INFINITY
    let nearestDistanceToShore = Number.POSITIVE_INFINITY

    for (const lake of this._lakes) {
      const normalizedDistance = this._getLakeNormalizedDistance(lake, worldX, worldZ)
      const distanceToShore = this._getApproximateDistanceToLakeShoreMeters(lake, normalizedDistance)
      const isInsideLake = normalizedDistance < 1
      const currentIsInsideLake = nearestNormalizedDistance < 1

      if (
        (isInsideLake && (!currentIsInsideLake || normalizedDistance < nearestNormalizedDistance)) ||
        (!isInsideLake && !currentIsInsideLake && Math.abs(distanceToShore) < Math.abs(nearestDistanceToShore))
      ) {
        nearestLake = lake
        nearestNormalizedDistance = normalizedDistance
        nearestDistanceToShore = distanceToShore
      }
    }

    if (!nearestLake) {
      return { water: null }
    }

    return {
      water: {
        feature: nearestLake,
        type: "lake",
        normalizedDistance: nearestNormalizedDistance,
        distanceToShoreMeters: nearestDistanceToShore,
        isUnderWater: nearestNormalizedDistance < 1,
        isShore:
          nearestNormalizedDistance >= 1 &&
          nearestDistanceToShore <= nearestLake.shoreFalloffMeters,
      },
    }
  }

  public getLakesIntersectingBounds(bounds: WorldBounds): readonly LakeFeature[] {
    return this._lakes.filter((lake) => this._lakeIntersectsBounds(lake, bounds))
  }

  private _generateLakes(): LakeFeature[] {
    const bounds = this._options.worldBounds
    const width = bounds.maxX - bounds.minX
    const depth = bounds.maxZ - bounds.minZ
    const lakeCount = Math.max(2, Math.min(8, Math.floor((width * depth) / 16_000_000)))
    const lakes: LakeFeature[] = []

    for (let index = 0; index < lakeCount; index += 1) {
      const random = this._createRandom(this._hash(index, 0, 311))
      const radiusX = 45 + random() * 110
      const radiusZ = 45 + random() * 110
      const marginX = Math.min(width / 2, radiusX + 80)
      const marginZ = Math.min(depth / 2, radiusZ + 80)
      const centerX = this._lerp(bounds.minX + marginX, bounds.maxX - marginX, random())
      const centerZ = this._lerp(bounds.minZ + marginZ, bounds.maxZ - marginZ, random())

      lakes.push({
        id: `lake_${index}`,
        centerX,
        centerZ,
        radiusX,
        radiusZ,
        waterLevelMeters: -2 + random() * 8,
        depthMeters: 1.5 + random() * 5,
        shoreFalloffMeters: 8 + random() * 18,
      })
    }

    return lakes
  }

  private _lakeIntersectsBounds(lake: LakeFeature, bounds: WorldBounds): boolean {
    return (
      lake.centerX + lake.radiusX + lake.shoreFalloffMeters > bounds.minX &&
      lake.centerX - lake.radiusX - lake.shoreFalloffMeters < bounds.maxX &&
      lake.centerZ + lake.radiusZ + lake.shoreFalloffMeters > bounds.minZ &&
      lake.centerZ - lake.radiusZ - lake.shoreFalloffMeters < bounds.maxZ
    )
  }

  private _getLakeNormalizedDistance(lake: LakeFeature, worldX: number, worldZ: number): number {
    const normalizedX = (worldX - lake.centerX) / lake.radiusX
    const normalizedZ = (worldZ - lake.centerZ) / lake.radiusZ

    return Math.hypot(normalizedX, normalizedZ)
  }

  private _getApproximateDistanceToLakeShoreMeters(
    lake: LakeFeature,
    normalizedDistance: number,
  ): number {
    const averageRadius = (lake.radiusX + lake.radiusZ) / 2

    return (normalizedDistance - 1) * averageRadius
  }

  private _hash(x: number, z: number, salt: number): number {
    let value =
      Math.imul(x, 374761393) +
      Math.imul(z, 668265263) +
      Math.imul(salt, 2246822519) +
      Math.imul(this._options.seed, 3266489917)

    value = Math.imul(value ^ (value >>> 13), 1274126177)
    value = value ^ (value >>> 16)

    return (value >>> 0) / 4294967295
  }

  private _createRandom(seed: number): () => number {
    let state = Math.floor(seed * 4294967295) >>> 0

    return () => {
      state = (state + 0x6d2b79f5) >>> 0

      let value = state

      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

      return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }
  }

  private _lerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount
  }
}
