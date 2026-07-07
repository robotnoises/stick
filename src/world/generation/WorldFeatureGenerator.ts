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
  readonly waterProfile: ReadonlyArray<readonly [number, number]>
}

export type WaterFeature = LakeFeature | RiverFeature

interface BaseWaterFeatureSample {
  readonly normalizedDistance: number
  readonly distanceToShoreMeters: number
  readonly waterLevelMeters: number
  readonly isUnderWater: boolean
  readonly isShore: boolean
}

export interface LakeWaterFeatureSample extends BaseWaterFeatureSample {
  readonly feature: LakeFeature
  readonly type: "lake"
}

export interface RiverWaterFeatureSample extends BaseWaterFeatureSample {
  readonly feature: RiverFeature
  readonly type: "river"
}

export type WaterFeatureSample = LakeWaterFeatureSample | RiverWaterFeatureSample

export interface WorldFeatureSample {
  readonly water: WaterFeatureSample | null
}

interface RiverProjection {
  readonly distanceToCenterMeters: number
  readonly distanceAlongRiverMeters: number
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

  public getRiverWaterLevelAtDistance(river: RiverFeature, distanceMeters: number): number {
    if (river.waterProfile.length === 0) {
      return river.waterLevelMeters
    }

    const first = river.waterProfile[0]!
    const last = river.waterProfile[river.waterProfile.length - 1]!

    if (distanceMeters <= first[0]) {
      return first[1]
    }

    if (distanceMeters >= last[0]) {
      return last[1]
    }

    let low = 0
    let high = river.waterProfile.length - 1

    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2)
      const [midDistance] = river.waterProfile[mid]!

      if (midDistance <= distanceMeters) {
        low = mid
      } else {
        high = mid
      }
    }

    const [distance0, waterLevel0] = river.waterProfile[low]!
    const [distance1, waterLevel1] = river.waterProfile[high]!
    const amount = (distanceMeters - distance0) / (distance1 - distance0)

    return this._lerp(waterLevel0, waterLevel1, amount)
  }

  public getRiverWaterLevelAtPosition(river: RiverFeature, worldX: number, worldZ: number): number {
    const projection = this._getNearestRiverProjection(river, worldX, worldZ)

    return projection
      ? this.getRiverWaterLevelAtDistance(river, projection.distanceAlongRiverMeters)
      : river.waterLevelMeters
  }

  private _getNearestLakeWaterSample(worldX: number, worldZ: number): WaterFeatureSample | null {
    let nearestLake: LakeFeature | null = null
    let nearestNormalizedDistance = Number.POSITIVE_INFINITY
    let nearestDistanceToShore = Number.POSITIVE_INFINITY

    for (const lake of this._lakes) {
      const normalizedDistance = this._getLakeNormalizedDistance(lake, worldX, worldZ)
      const distanceToShore = this._getApproximateDistanceToLakeShoreMeters(
        lake,
        normalizedDistance,
      )
      const isInsideLake = normalizedDistance < 1
      const currentIsInsideLake = nearestNormalizedDistance < 1

      if (
        (isInsideLake &&
          (!currentIsInsideLake || normalizedDistance < nearestNormalizedDistance)) ||
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
      waterLevelMeters: nearestLake.waterLevelMeters,
      isUnderWater: nearestNormalizedDistance < 1,
      isShore:
        nearestNormalizedDistance >= 1 && nearestDistanceToShore <= nearestLake.shoreFalloffMeters,
    }
  }

  private _getNearestRiverWaterSample(worldX: number, worldZ: number): WaterFeatureSample | null {
    let nearestRiver: RiverFeature | null = null
    let nearestProjection: RiverProjection | null = null

    for (const river of this._rivers) {
      const projection = this._getNearestRiverProjection(river, worldX, worldZ)

      if (
        projection &&
        (!nearestProjection ||
          projection.distanceToCenterMeters < nearestProjection.distanceToCenterMeters)
      ) {
        nearestRiver = river
        nearestProjection = projection
      }
    }

    if (!nearestRiver || !nearestProjection) {
      return null
    }

    const halfWidth = nearestRiver.widthMeters / 2
    const normalizedDistance =
      halfWidth === 0 ? 0 : nearestProjection.distanceToCenterMeters / halfWidth
    const distanceToShore = nearestProjection.distanceToCenterMeters - halfWidth

    return {
      feature: nearestRiver,
      type: "river",
      normalizedDistance,
      distanceToShoreMeters: distanceToShore,
      waterLevelMeters: this.getRiverWaterLevelAtDistance(
        nearestRiver,
        nearestProjection.distanceAlongRiverMeters,
      ),
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

      const widthMeters = 10 + random() * 18
      const depthMeters = 1.2 + random() * 2.8
      const bankFalloffMeters = 8 + random() * 16
      const waterProfile = this._createRiverWaterProfile(points, depthMeters)
      const waterLevelMeters = waterProfile[0]?.[1] ?? -6 + random() * 8

      rivers.push({
        id: `river_${index}`,
        points,
        widthMeters,
        depthMeters,
        bankFalloffMeters,
        waterLevelMeters,
        waterProfile,
      })
    }

    return rivers
  }

  private _createRiverWaterProfile(
    points: ReadonlyArray<readonly [number, number]>,
    depthMeters: number,
  ): ReadonlyArray<readonly [number, number]> {
    const profile: Array<readonly [number, number]> = []
    const stationSpacingMeters = 64
    const minSlope = 0.00035
    const surfaceInsetMeters = Math.min(Math.max(depthMeters * 0.25, 0.3), 0.8)
    let riverDistanceMeters = 0
    let previousWaterLevel = Number.POSITIVE_INFINITY

    for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
      const [startX, startZ] = points[pointIndex - 1]!
      const [endX, endZ] = points[pointIndex]!
      const segmentLength = Math.hypot(endX - startX, endZ - startZ)

      if (segmentLength === 0) {
        continue
      }

      const subdivisions = Math.max(1, Math.ceil(segmentLength / stationSpacingMeters))

      for (let subdivision = 0; subdivision <= subdivisions; subdivision += 1) {
        if (profile.length > 0 && subdivision === 0) {
          continue
        }

        const t = subdivision / subdivisions
        const distanceMeters = riverDistanceMeters + segmentLength * t
        const x = this._lerp(startX, endX, t)
        const z = this._lerp(startZ, endZ, t)
        const terrainConstrainedLevel = this._getApproximateTerrainHeight(x, z) - surfaceInsetMeters
        const slopeConstrainedLevel =
          previousWaterLevel === Number.POSITIVE_INFINITY
            ? terrainConstrainedLevel
            : previousWaterLevel - minSlope * (distanceMeters - profile[profile.length - 1]![0])
        const waterLevel = Math.min(terrainConstrainedLevel, slopeConstrainedLevel)

        profile.push([distanceMeters, waterLevel])
        previousWaterLevel = waterLevel
      }

      riverDistanceMeters += segmentLength
    }

    return profile
  }

  private _getApproximateTerrainHeight(worldX: number, worldZ: number): number {
    return (
      this._getRegionalElevation(worldX, worldZ) +
      this._getRollingHillElevation(worldX, worldZ) +
      this._getRidgeElevation(worldX, worldZ) +
      this._getSurfaceRoughness(worldX, worldZ)
    )
  }

  private _getRegionalElevation(worldX: number, worldZ: number): number {
    const continental = this._valueNoise(worldX * 0.0018, worldZ * 0.0018, 5)
    const uplands = this._valueNoise(worldX * 0.004, worldZ * 0.004, 11)

    return continental * 28 + uplands * 12
  }

  private _getRollingHillElevation(worldX: number, worldZ: number): number {
    const warpX = this._valueNoise(worldX * 0.006, worldZ * 0.006, 17) * 22
    const warpZ = this._valueNoise(worldX * 0.006, worldZ * 0.006, 19) * 22
    const hills = this._valueNoise((worldX + warpX) * 0.014, (worldZ + warpZ) * 0.014, 23)

    return hills * 7
  }

  private _getRidgeElevation(worldX: number, worldZ: number): number {
    const ridgeNoise = this._valueNoise(worldX * 0.007, worldZ * 0.007, 29)
    const ridgeShape = 1 - Math.abs(ridgeNoise)
    const sharpenedRidge = ridgeShape * ridgeShape
    const mountainMask = (this._valueNoise(worldX * 0.0025, worldZ * 0.0025, 31) + 1) / 2

    return sharpenedRidge * mountainMask * 18
  }

  private _getSurfaceRoughness(worldX: number, worldZ: number): number {
    const medium = this._valueNoise(worldX * 0.035, worldZ * 0.035, 41)
    const small = this._valueNoise(worldX * 0.09, worldZ * 0.09, 43)

    return medium * 1.6 + small * 0.45
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

      if (maxX > bounds.minX && minX < bounds.maxX && maxZ > bounds.minZ && minZ < bounds.maxZ) {
        return true
      }
    }

    return false
  }

  public _getDistanceToRiverCenterMeters(
    river: RiverFeature,
    worldX: number,
    worldZ: number,
  ): number {
    return (
      this._getNearestRiverProjection(river, worldX, worldZ)?.distanceToCenterMeters ??
      Number.POSITIVE_INFINITY
    )
  }

  private _getNearestRiverProjection(
    river: RiverFeature,
    worldX: number,
    worldZ: number,
  ): RiverProjection | null {
    let nearestProjection: RiverProjection | null = null
    let distanceAtSegmentStart = 0

    for (let index = 1; index < river.points.length; index += 1) {
      const [x0, z0] = river.points[index - 1]!
      const [x1, z1] = river.points[index]!
      const projection = this._getProjectionToSegment(worldX, worldZ, x0, z0, x1, z1)
      const segmentLength = Math.hypot(x1 - x0, z1 - z0)
      const riverProjection = {
        distanceToCenterMeters: projection.distanceMeters,
        distanceAlongRiverMeters: distanceAtSegmentStart + segmentLength * projection.t,
      }

      if (
        !nearestProjection ||
        riverProjection.distanceToCenterMeters < nearestProjection.distanceToCenterMeters
      ) {
        nearestProjection = riverProjection
      }

      distanceAtSegmentStart += segmentLength
    }

    return nearestProjection
  }

  public _getDistanceToSegmentMeters(
    worldX: number,
    worldZ: number,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
  ): number {
    return this._getProjectionToSegment(worldX, worldZ, x0, z0, x1, z1).distanceMeters
  }

  private _getProjectionToSegment(
    worldX: number,
    worldZ: number,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
  ): { readonly t: number; readonly distanceMeters: number } {
    const dx = x1 - x0
    const dz = z1 - z0
    const lengthSquared = dx * dx + dz * dz

    if (lengthSquared === 0) {
      return { t: 0, distanceMeters: Math.hypot(worldX - x0, worldZ - z0) }
    }

    const t = Math.min(Math.max(((worldX - x0) * dx + (worldZ - z0) * dz) / lengthSquared, 0), 1)
    const closestX = x0 + dx * t
    const closestZ = z0 + dz * t

    return { t, distanceMeters: Math.hypot(worldX - closestX, worldZ - closestZ) }
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

  private _valueNoise(x: number, z: number, salt: number): number {
    const x0 = Math.floor(x)
    const z0 = Math.floor(z)
    const x1 = x0 + 1
    const z1 = z0 + 1
    const tx = this._smooth(x - x0)
    const tz = this._smooth(z - z0)
    const a = this._hashNoise(x0, z0, salt)
    const b = this._hashNoise(x1, z0, salt)
    const c = this._hashNoise(x0, z1, salt)
    const d = this._hashNoise(x1, z1, salt)
    const xMix0 = this._lerp(a, b, tx)
    const xMix1 = this._lerp(c, d, tx)

    return this._lerp(xMix0, xMix1, tz)
  }

  private _hashNoise(x: number, z: number, salt: number): number {
    return this._hash(x, z, salt) * 2 - 1
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

  private _smooth(value: number): number {
    return value * value * (3 - 2 * value)
  }

  private _lerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount
  }
}
