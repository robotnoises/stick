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

export interface RiverFeature {
  readonly id: string
  readonly points: ReadonlyArray<readonly [number, number]>
  readonly widthMeters: number
  readonly depthMeters: number
  readonly bankFalloffMeters: number
  readonly waterLevelMeters: number
}

export type WaterFeature = LakeFeature | RiverFeature

export interface WaterFeatureSample {
  readonly feature: WaterFeature
  readonly type: "lake" | "river"
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
  private readonly _rivers: RiverFeature[]

  public constructor(private readonly _options: WorldFeatureGeneratorOptions) {
    this._lakes = this._generateLakes()
    this._rivers = this._generateRivers()
  }

  public get lakes(): readonly LakeFeature[] {
    return this._lakes
  }

  public get rivers(): readonly RiverFeature[] {
    return this._rivers
  }

  public sample(worldX: number, worldZ: number): WorldFeatureSample {
    const lake = this._getNearestLakeWaterSample(worldX, worldZ)
    const river = this._getNearestRiverWaterSample(worldX, worldZ)
    const water = this._chooseNearestWaterSample(lake, river)

    return { water }
  }

  public getLakesIntersectingBounds(bounds: WorldBounds): readonly LakeFeature[] {
    return this._lakes.filter((lake) => this._lakeIntersectsBounds(lake, bounds))
  }

  public getRiversIntersectingBounds(bounds: WorldBounds): readonly RiverFeature[] {
    return this._rivers.filter((river) => this._riverIntersectsBounds(river, bounds))
  }

  private _getNearestLakeWaterSample(worldX: number, worldZ: number): WaterFeatureSample | null {
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
        (!isInsideLake &&
          !currentIsInsideLake &&
          Math.abs(distanceToShore) < Math.abs(nearestDistanceToShore))
      ) {
        nearestLake = lake
        nearestNormalizedDistance = normalizedDistance
        nearestDistanceToShore = distanceToShore
      }
    }

    if (!nearestLake) {
      return null
    }

    return {
      feature: nearestLake,
      type: "lake",
      normalizedDistance: nearestNormalizedDistance,
      distanceToShoreMeters: nearestDistanceToShore,
      isUnderWater: nearestNormalizedDistance < 1,
      isShore:
        nearestNormalizedDistance >= 1 && nearestDistanceToShore <= nearestLake.shoreFalloffMeters,
    }
  }

  private _getNearestRiverWaterSample(worldX: number, worldZ: number): WaterFeatureSample | null {
    let nearestRiver: RiverFeature | null = null
    let nearestDistanceToCenter = Number.POSITIVE_INFINITY

    for (const river of this._rivers) {
      const distanceToCenter = this._getDistanceToRiverCenterMeters(river, worldX, worldZ)

      if (distanceToCenter < nearestDistanceToCenter) {
        nearestRiver = river
        nearestDistanceToCenter = distanceToCenter
      }
    }

    if (!nearestRiver) {
      return null
    }

    const halfWidth = nearestRiver.widthMeters / 2
    const normalizedDistance = halfWidth === 0 ? 0 : nearestDistanceToCenter / halfWidth
    const distanceToShore = nearestDistanceToCenter - halfWidth

    return {
      feature: nearestRiver,
      type: "river",
      normalizedDistance,
      distanceToShoreMeters: distanceToShore,
      isUnderWater: distanceToShore < 0,
      isShore: distanceToShore >= 0 && distanceToShore <= nearestRiver.bankFalloffMeters,
    }
  }

  private _chooseNearestWaterSample(
    lake: WaterFeatureSample | null,
    river: WaterFeatureSample | null,
  ): WaterFeatureSample | null {
    if (!lake) {
      return river
    }

    if (!river) {
      return lake
    }

    if (lake.isUnderWater !== river.isUnderWater) {
      return lake.isUnderWater ? lake : river
    }

    return Math.abs(lake.distanceToShoreMeters) <= Math.abs(river.distanceToShoreMeters)
      ? lake
      : river
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

  private _generateRivers(): RiverFeature[] {
    const bounds = this._options.worldBounds
    const width = bounds.maxX - bounds.minX
    const depth = bounds.maxZ - bounds.minZ
    const riverCount = Math.max(1, Math.min(3, Math.floor((width * depth) / 32_000_000)))
    const rivers: RiverFeature[] = []

    for (let index = 0; index < riverCount; index += 1) {
      const random = this._createRandom(this._hash(index, 0, 613))
      const pointCount = 5
      const points: Array<[number, number]> = []
      const startX = this._lerp(bounds.minX + width * 0.15, bounds.maxX - width * 0.15, random())
      const endX = this._lerp(bounds.minX + width * 0.15, bounds.maxX - width * 0.15, random())

      for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
        const t = pointIndex / (pointCount - 1)
        const bend = (random() - 0.5) * width * 0.22
        const x = this._lerp(startX, endX, t) + bend
        const z = this._lerp(bounds.maxZ + 120, bounds.minZ - 120, t)

        points.push([Math.min(Math.max(x, bounds.minX - 120), bounds.maxX + 120), z])
      }

      rivers.push({
        id: `river_${index}`,
        points,
        widthMeters: 10 + random() * 18,
        depthMeters: 1.2 + random() * 2.8,
        bankFalloffMeters: 8 + random() * 16,
        waterLevelMeters: -6 + random() * 8,
      })
    }

    return rivers
  }

  private _lakeIntersectsBounds(lake: LakeFeature, bounds: WorldBounds): boolean {
    return (
      lake.centerX + lake.radiusX + lake.shoreFalloffMeters > bounds.minX &&
      lake.centerX - lake.radiusX - lake.shoreFalloffMeters < bounds.maxX &&
      lake.centerZ + lake.radiusZ + lake.shoreFalloffMeters > bounds.minZ &&
      lake.centerZ - lake.radiusZ - lake.shoreFalloffMeters < bounds.maxZ
    )
  }

  private _riverIntersectsBounds(river: RiverFeature, bounds: WorldBounds): boolean {
    const margin = river.widthMeters / 2 + river.bankFalloffMeters

    for (let index = 1; index < river.points.length; index += 1) {
      const [x0, z0] = river.points[index - 1]!
      const [x1, z1] = river.points[index]!
      const minX = Math.min(x0, x1) - margin
      const maxX = Math.max(x0, x1) + margin
      const minZ = Math.min(z0, z1) - margin
      const maxZ = Math.max(z0, z1) + margin

      if (
        maxX > bounds.minX &&
        minX < bounds.maxX &&
        maxZ > bounds.minZ &&
        minZ < bounds.maxZ
      ) {
        return true
      }
    }

    return false
  }

  private _getDistanceToRiverCenterMeters(
    river: RiverFeature,
    worldX: number,
    worldZ: number,
  ): number {
    let nearestDistance = Number.POSITIVE_INFINITY

    for (let index = 1; index < river.points.length; index += 1) {
      const [x0, z0] = river.points[index - 1]!
      const [x1, z1] = river.points[index]!
      const distance = this._getDistanceToSegmentMeters(worldX, worldZ, x0, z0, x1, z1)

      nearestDistance = Math.min(nearestDistance, distance)
    }

    return nearestDistance
  }

  private _getDistanceToSegmentMeters(
    worldX: number,
    worldZ: number,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
  ): number {
    const dx = x1 - x0
    const dz = z1 - z0
    const lengthSquared = dx * dx + dz * dz

    if (lengthSquared === 0) {
      return Math.hypot(worldX - x0, worldZ - z0)
    }

    const t = Math.min(Math.max(((worldX - x0) * dx + (worldZ - z0) * dz) / lengthSquared, 0), 1)
    const closestX = x0 + dx * t
    const closestZ = z0 + dz * t

    return Math.hypot(worldX - closestX, worldZ - closestZ)
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
