import type {
  RiverFeature,
  WaterFeatureSample,
  WorldFeatureSample,
} from "../generation/WorldFeatureGenerator"

export type WaterVolumeFeatureType = "lake" | "river"

export interface WaterFeatureSampler {
  sample(worldX: number, worldZ: number): WorldFeatureSample
}

export interface WaterVolumeSamplerOptions {
  readonly waterFeatures: WaterFeatureSampler
  readonly terrainHeightProvider: (worldX: number, worldZ: number) => number
}

export interface WaterColumnSample {
  readonly hasWater: boolean
  readonly featureId: string | null
  readonly type: WaterVolumeFeatureType | null
  readonly surfaceY: number
  readonly bedY: number
  readonly depthMeters: number
  readonly distanceToShoreMeters: number
  readonly flowDirectionX: number
  readonly flowDirectionZ: number
  readonly currentMetersPerSecond: number
}

export interface WaterPointSample extends WaterColumnSample {
  readonly isSubmerged: boolean
  readonly depthBelowSurfaceMeters: number
  readonly heightAboveBedMeters: number
}

export class WaterVolumeSampler {
  private static readonly _riverCurrentMetersPerSecond = 0.35

  public constructor(private readonly _options: WaterVolumeSamplerOptions) {}

  public sampleColumn(worldX: number, worldZ: number): WaterColumnSample {
    const water = this._options.waterFeatures.sample(worldX, worldZ).water
    const bedY = this._options.terrainHeightProvider(worldX, worldZ)

    if (!water || (!water.isUnderWater && !water.isShore)) {
      return this._createDryColumnSample(bedY)
    }

    const surfaceY = water.waterLevelMeters
    const depthMeters = Math.max(surfaceY - bedY, 0)
    const hasWater = water.isUnderWater && depthMeters > 0
    const flow = hasWater ? this._getFlowDirection(water, worldX, worldZ) : { x: 0, z: 0 }
    const hasFlow = flow.x !== 0 || flow.z !== 0

    return {
      hasWater,
      featureId: water.feature.id,
      type: water.type,
      surfaceY,
      bedY,
      depthMeters,
      distanceToShoreMeters: water.distanceToShoreMeters,
      flowDirectionX: flow.x,
      flowDirectionZ: flow.z,
      currentMetersPerSecond: hasFlow ? WaterVolumeSampler._riverCurrentMetersPerSecond : 0,
    }
  }

  public samplePoint(worldX: number, worldY: number, worldZ: number): WaterPointSample {
    const column = this.sampleColumn(worldX, worldZ)
    const isSubmerged = column.hasWater && worldY >= column.bedY && worldY <= column.surfaceY

    return {
      ...column,
      isSubmerged,
      depthBelowSurfaceMeters: isSubmerged ? column.surfaceY - worldY : 0,
      heightAboveBedMeters: isSubmerged ? worldY - column.bedY : 0,
    }
  }

  private _createDryColumnSample(bedY: number): WaterColumnSample {
    return {
      hasWater: false,
      featureId: null,
      type: null,
      surfaceY: bedY,
      bedY,
      depthMeters: 0,
      distanceToShoreMeters: Number.POSITIVE_INFINITY,
      flowDirectionX: 0,
      flowDirectionZ: 0,
      currentMetersPerSecond: 0,
    }
  }

  private _getFlowDirection(
    water: WaterFeatureSample,
    worldX: number,
    worldZ: number,
  ): { readonly x: number; readonly z: number } {
    if (water.type !== "river") {
      return { x: 0, z: 0 }
    }

    return this._getRiverFlowDirection(water.feature, worldX, worldZ)
  }

  private _getRiverFlowDirection(
    feature: RiverFeature,
    worldX: number,
    worldZ: number,
  ): { readonly x: number; readonly z: number } {
    let nearestDistance = Number.POSITIVE_INFINITY
    let flowX = 0
    let flowZ = 0

    for (let index = 1; index < feature.points.length; index += 1) {
      const [x0, z0] = feature.points[index - 1]!
      const [x1, z1] = feature.points[index]!
      const segmentX = x1 - x0
      const segmentZ = z1 - z0
      const segmentLength = Math.hypot(segmentX, segmentZ)

      if (segmentLength === 0) {
        continue
      }

      const distance = this._getDistanceToSegmentMeters(worldX, worldZ, x0, z0, x1, z1)

      if (distance < nearestDistance) {
        nearestDistance = distance
        flowX = segmentX / segmentLength
        flowZ = segmentZ / segmentLength
      }
    }

    return { x: flowX, z: flowZ }
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

    const t = Math.min(Math.max(((worldX - x0) * dx + (worldZ - z0) * dz) / lengthSquared, 0), 1)
    const closestX = x0 + dx * t
    const closestZ = z0 + dz * t

    return Math.hypot(worldX - closestX, worldZ - closestZ)
  }
}
