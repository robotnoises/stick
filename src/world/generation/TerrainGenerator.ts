import { ChunkCoord } from "../ChunkCoord"
import {
  TerrainMaterial,
  type ChunkTerrainData,
  type GeneratedPropData,
  type TerrainMaterialId,
} from "../terrain/TerrainTypes"
import type { WorldFeatureGenerator, WaterFeatureSample } from "./WorldFeatureGenerator"

export interface TerrainGeneratorOptions {
  readonly seed: number
  readonly chunkSizeMeters: number
  readonly resolution: number
  readonly worldFeatures?: WorldFeatureGenerator
}

interface ForestComposition {
  readonly density: number
  readonly pineWeightMultiplier: number
  readonly deadPineWeightMultiplier: number
  readonly logWeightMultiplier: number
  readonly rockWeightMultiplier: number
  readonly scaleMultiplier: number
}

export class TerrainGenerator {
  public static readonly version = 3

  public constructor(private readonly _options: TerrainGeneratorOptions) {}

  public get chunkSizeMeters(): number {
    return this._options.chunkSizeMeters
  }

  public get resolution(): number {
    return this._options.resolution
  }

  public get seed(): number {
    return this._options.seed
  }

  public generateChunk(coord: ChunkCoord): ChunkTerrainData {
    const gridSize = this._options.resolution + 1
    const heights = new Float32Array(gridSize * gridSize)
    const terrainMaterials = new Uint8Array(gridSize * gridSize)

    for (let z = 0; z < gridSize; z += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        const worldX = this._toWorldCoordinate(coord.x, x)
        const worldZ = this._toWorldCoordinate(coord.z, z)
        const index = z * gridSize + x

        const height = this.getHeight(worldX, worldZ)

        heights[index] = height
        terrainMaterials[index] = this.getTerrainMaterial(worldX, worldZ, height)
      }
    }

    return {
      key: coord.key,
      coord,
      chunkSizeMeters: this._options.chunkSizeMeters,
      resolution: this._options.resolution,
      generatorVersion: TerrainGenerator.version,
      seed: this._options.seed,
      heights,
      terrainMaterials,
      props: this._generateProps(coord),
    }
  }

  public getHeight(worldX: number, worldZ: number): number {
    const regionalElevation = this._getRegionalElevation(worldX, worldZ)
    const rollingHills = this._getRollingHillElevation(worldX, worldZ)
    const ridgeElevation = this._getRidgeElevation(worldX, worldZ)
    const surfaceRoughness = this._getSurfaceRoughness(worldX, worldZ)
    const baseHeight = regionalElevation + rollingHills + ridgeElevation + surfaceRoughness

    return this._applyWaterFeatures(baseHeight, worldX, worldZ)
  }

  public getTerrainMaterial(
    worldX: number,
    worldZ: number,
    height = this.getHeight(worldX, worldZ),
  ): TerrainMaterialId {
    const water = this._options.worldFeatures?.sample(worldX, worldZ).water

    if (water?.isUnderWater) {
      return TerrainMaterial.RiverBed
    }

    if (water?.isShore) {
      return TerrainMaterial.Sand
    }

    const lowland = this._valueNoise(worldX * 0.012, worldZ * 0.012, 53)
    const forestFloor = this._valueNoise(worldX * 0.018, worldZ * 0.018, 67)
    const exposedSoil = this._valueNoise(worldX * 0.045, worldZ * 0.045, 79)

    if (height < -5.5 || (height < -3 && lowland > 0.15)) {
      return TerrainMaterial.Sand
    }

    if (exposedSoil > 0.48) {
      return TerrainMaterial.Dirt
    }

    if (forestFloor > -0.15) {
      return TerrainMaterial.PineNeedles
    }

    return TerrainMaterial.Grass
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

  private _generateProps(coord: ChunkCoord): GeneratedPropData[] {
    const random = this._createRandom(this._hash(coord.x, coord.z, 97))
    const candidateCount = 16
    const props: GeneratedPropData[] = []

    for (let index = 0; index < candidateCount; index += 1) {
      const localX = 4 + random() * (this._options.chunkSizeMeters - 8)
      const localZ = 4 + random() * (this._options.chunkSizeMeters - 8)
      const worldX = coord.x * this._options.chunkSizeMeters + localX
      const worldZ = coord.z * this._options.chunkSizeMeters + localZ
      const height = this.getHeight(worldX, worldZ)
      const water = this._options.worldFeatures?.sample(worldX, worldZ).water

      if (water?.isUnderWater || water?.isShore) {
        continue
      }

      const material = this.getTerrainMaterial(worldX, worldZ, height)
      const composition = this._getForestComposition(worldX, worldZ, material)

      if (random() > composition.density) {
        continue
      }

      const propType = this._choosePropType(material, random(), composition)

      if (!propType) {
        continue
      }

      props.push({
        id: `${coord.key}_${propType}_${index}`,
        type: propType,
        position: [worldX, height, worldZ],
        rotationY: random() * Math.PI * 2,
        scale: this._getPropScale(propType, random(), composition),
      })
    }

    props.push(...this._generateGrassProps(coord, random))

    return props
  }

  private _generateGrassProps(coord: ChunkCoord, random: () => number): GeneratedPropData[] {
    const props: GeneratedPropData[] = []
    const candidateCount = 48

    for (let index = 0; index < candidateCount; index += 1) {
      const localX = 2 + random() * (this._options.chunkSizeMeters - 4)
      const localZ = 2 + random() * (this._options.chunkSizeMeters - 4)
      const worldX = coord.x * this._options.chunkSizeMeters + localX
      const worldZ = coord.z * this._options.chunkSizeMeters + localZ
      const height = this.getHeight(worldX, worldZ)
      const water = this._options.worldFeatures?.sample(worldX, worldZ).water

      if (water?.isUnderWater || water?.isShore) {
        continue
      }

      const material = this.getTerrainMaterial(worldX, worldZ, height)
      const spawnChance = this._getGrassSpawnChance(material)

      if (random() > spawnChance) {
        continue
      }

      props.push({
        id: `${coord.key}_grass_${index}`,
        type: "grass",
        position: [worldX, height, worldZ],
        rotationY: random() * Math.PI * 2,
        scale: this._getPropScale("grass", random()),
      })
    }

    return props
  }

  private _getGrassSpawnChance(material: TerrainMaterialId): number {
    switch (material) {
      case TerrainMaterial.Grass:
        return 0.68
      case TerrainMaterial.Dirt:
        return 0.26
      case TerrainMaterial.PineNeedles:
        return 0.12
      case TerrainMaterial.Sand:
      default:
        return 0.03
    }
  }

  private _applyWaterFeatures(baseHeight: number, worldX: number, worldZ: number): number {
    const water = this._options.worldFeatures?.sample(worldX, worldZ).water

    if (!water) {
      return baseHeight
    }

    if (water.isUnderWater) {
      return this._getLakeBedHeight(baseHeight, water)
    }

    if (water.isShore) {
      return this._getShoreHeight(baseHeight, water)
    }

    return baseHeight
  }

  private _getLakeBedHeight(baseHeight: number, water: WaterFeatureSample): number {
    const feature = water.feature
    const depthFactor = 1 - Math.min(Math.max(water.normalizedDistance, 0), 1)
    const bedHeight = water.waterLevelMeters - feature.depthMeters * (0.35 + depthFactor * 0.65)

    return Math.min(baseHeight, bedHeight)
  }

  private _getShoreHeight(baseHeight: number, water: WaterFeatureSample): number {
    const feature = water.feature
    const falloffMeters =
      "shoreFalloffMeters" in feature ? feature.shoreFalloffMeters : feature.bankFalloffMeters
    const shoreT = Math.min(Math.max(water.distanceToShoreMeters / falloffMeters, 0), 1)
    const shoreHeight = this._lerp(water.waterLevelMeters + 0.2, baseHeight, shoreT)

    return Math.min(baseHeight, shoreHeight)
  }

  private _getForestComposition(
    worldX: number,
    worldZ: number,
    material: TerrainMaterialId,
  ): ForestComposition {
    const forestPatch = this._normalizedValueNoise(worldX * 0.0032, worldZ * 0.0032, 101)
    const clearingPatch = this._normalizedValueNoise(worldX * 0.0065, worldZ * 0.0065, 103)
    const deadfallPatch = this._normalizedValueNoise(worldX * 0.0044, worldZ * 0.0044, 107)
    const agePatch = this._normalizedValueNoise(worldX * 0.0027, worldZ * 0.0027, 109)
    const clearingAmount =
      clearingPatch > 0.72
        ? this._smooth(Math.min(Math.max((clearingPatch - 0.72) / 0.28, 0), 1))
        : 0
    const deadfallAmount = this._smooth(Math.min(Math.max((deadfallPatch - 0.55) / 0.45, 0), 1))
    const youngStandAmount = forestPatch > 0.68 && agePatch < 0.38 ? 1 : 0
    const baseDensity = this._getBasePropDensity(material)
    const forestFactor = this._lerp(0.42, 1.35, forestPatch)
    const clearingFactor = this._lerp(1, 0.16, clearingAmount)
    const youngStandFactor = youngStandAmount > 0 ? 1.16 : 1
    const density = Math.min(
      Math.max(baseDensity * forestFactor * clearingFactor * youngStandFactor, 0.02),
      0.96,
    )
    const ageScale = this._lerp(0.82, 1.18, agePatch)

    return {
      density,
      pineWeightMultiplier:
        clearingFactor * (youngStandAmount > 0 ? 1.22 : this._lerp(0.88, 1.08, agePatch)),
      deadPineWeightMultiplier: this._lerp(0.62, 2.25, deadfallAmount),
      logWeightMultiplier: this._lerp(0.55, 2.8, deadfallAmount),
      rockWeightMultiplier: this._lerp(1.08, 0.82, forestPatch),
      scaleMultiplier: youngStandAmount > 0 ? 0.78 : ageScale,
    }
  }

  private _getBasePropDensity(material: TerrainMaterialId): number {
    switch (material) {
      case TerrainMaterial.Sand:
        return 0.08
      case TerrainMaterial.Dirt:
        return 0.28
      case TerrainMaterial.PineNeedles:
        return 0.82
      case TerrainMaterial.Grass:
      default:
        return 0.48
    }
  }

  private _choosePropType(
    material: TerrainMaterialId,
    roll: number,
    composition: ForestComposition | null = null,
  ): GeneratedPropData["type"] | null {
    if (!composition) {
      return this._chooseLegacyPropType(material, roll)
    }

    const weights = this._getComposedPropWeights(material, composition)
    const totalWeight = weights.pine + weights.deadPine + weights.log + weights.rock

    if (totalWeight <= 0) {
      return null
    }

    let cursor = roll * totalWeight

    if (cursor < weights.pine) {
      return "pine"
    }

    cursor -= weights.pine

    if (cursor < weights.deadPine) {
      return "deadPine"
    }

    cursor -= weights.deadPine

    if (cursor < weights.log) {
      return "log"
    }

    return "rock"
  }

  private _chooseLegacyPropType(
    material: TerrainMaterialId,
    roll: number,
  ): GeneratedPropData["type"] | null {
    switch (material) {
      case TerrainMaterial.Sand:
        return roll > 0.93 ? "rock" : null
      case TerrainMaterial.Dirt:
        if (roll < 0.18) {
          return "rock"
        }

        return roll < 0.24 ? "pine" : null
      case TerrainMaterial.PineNeedles:
        if (roll < 0.38) {
          return "pine"
        }

        if (roll < 0.46) {
          return "deadPine"
        }

        return roll < 0.64 ? "log" : null
      case TerrainMaterial.Grass:
      default:
        if (roll < 0.24) {
          return "pine"
        }

        if (roll < 0.29) {
          return "deadPine"
        }

        return roll < 0.38 ? "rock" : null
    }
  }

  private _getComposedPropWeights(
    material: TerrainMaterialId,
    composition: ForestComposition,
  ): {
    readonly pine: number
    readonly deadPine: number
    readonly log: number
    readonly rock: number
  } {
    let pine = 0
    let deadPine = 0
    let log = 0
    let rock = 0

    switch (material) {
      case TerrainMaterial.Sand:
        rock = 1
        break
      case TerrainMaterial.Dirt:
        pine = 0.35
        deadPine = 0.04
        log = 0.06
        rock = 0.55
        break
      case TerrainMaterial.PineNeedles:
        pine = 0.6
        deadPine = 0.12
        log = 0.28
        break
      case TerrainMaterial.Grass:
      default:
        pine = 0.6
        deadPine = 0.08
        log = 0.02
        rock = 0.3
        break
    }

    return {
      pine: pine * composition.pineWeightMultiplier,
      deadPine: deadPine * composition.deadPineWeightMultiplier,
      log: log * composition.logWeightMultiplier,
      rock: rock * composition.rockWeightMultiplier,
    }
  }

  private _getPropScale(
    type: GeneratedPropData["type"],
    roll: number,
    composition: ForestComposition | null = null,
  ): number {
    const scaleMultiplier = composition?.scaleMultiplier ?? 1

    switch (type) {
      case "rock":
        return 0.45 + roll * 1.1
      case "grass":
        return 0.45 + roll * 0.55
      case "log":
        return (0.7 + roll * 0.8) * scaleMultiplier
      case "deadPine":
        return (0.7 + roll * 0.65) * scaleMultiplier
      case "pine":
        return (0.75 + roll * 0.75) * scaleMultiplier
    }
  }

  private _toWorldCoordinate(chunkAxis: number, vertexAxis: number): number {
    const step = this._options.chunkSizeMeters / this._options.resolution

    return chunkAxis * this._options.chunkSizeMeters + vertexAxis * step
  }

  private _normalizedValueNoise(x: number, z: number, salt: number): number {
    return (this._valueNoise(x, z, salt) + 1) / 2
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
