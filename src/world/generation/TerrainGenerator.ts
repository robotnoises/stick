import { ChunkCoord } from "../ChunkCoord"
import { TerrainMaterial, type ChunkTerrainData, type GeneratedPropData, type TerrainMaterialId } from "../TerrainTypes"
import type { WorldFeatureGenerator, WaterFeatureSample } from "./WorldFeatureGenerator"

export interface TerrainGeneratorOptions {
  readonly seed: number
  readonly chunkSizeMeters: number
  readonly resolution: number
  readonly worldFeatures?: WorldFeatureGenerator
}

export class TerrainGenerator {
  public static readonly version = 1

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
    const broad = this._valueNoise(worldX * 0.006, worldZ * 0.006, 11)
    const medium = this._valueNoise(worldX * 0.022, worldZ * 0.022, 23)
    const small = this._valueNoise(worldX * 0.08, worldZ * 0.08, 41)
    const baseHeight = broad * 8 + medium * 2.5 + small * 0.7

    return this._applyWaterFeatures(baseHeight, worldX, worldZ)
  }

  public getTerrainMaterial(worldX: number, worldZ: number, height = this.getHeight(worldX, worldZ)): TerrainMaterialId {
    const water = this._options.worldFeatures?.sample(worldX, worldZ).water

    if (water?.isUnderWater || water?.isShore) {
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

  private _generateProps(coord: ChunkCoord): GeneratedPropData[] {
    const random = this._createRandom(this._hash(coord.x, coord.z, 97))
    const candidateCount = 12
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
      const propType = this._choosePropType(material, random())

      if (!propType) {
        continue
      }

      props.push({
        id: `${coord.key}_${propType}_${index}`,
        type: propType,
        position: [worldX, height, worldZ],
        rotationY: random() * Math.PI * 2,
        scale: this._getPropScale(propType, random()),
      })
    }

    return props
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
    const lake = water.feature
    const depthFactor = 1 - Math.min(Math.max(water.normalizedDistance, 0), 1)
    const bedHeight = lake.waterLevelMeters - lake.depthMeters * (0.35 + depthFactor * 0.65)

    return Math.min(baseHeight, bedHeight)
  }

  private _getShoreHeight(baseHeight: number, water: WaterFeatureSample): number {
    const lake = water.feature
    const shoreT = Math.min(Math.max(water.distanceToShoreMeters / lake.shoreFalloffMeters, 0), 1)
    const shoreHeight = this._lerp(lake.waterLevelMeters + 0.2, baseHeight, shoreT)

    return Math.min(baseHeight, shoreHeight)
  }

  private _choosePropType(
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

  private _getPropScale(type: GeneratedPropData["type"], roll: number): number {
    switch (type) {
      case "rock":
        return 0.45 + roll * 1.1
      case "log":
        return 0.7 + roll * 0.8
      case "deadPine":
        return 0.7 + roll * 0.65
      case "pine":
        return 0.75 + roll * 0.75
    }
  }

  private _toWorldCoordinate(chunkAxis: number, vertexAxis: number): number {
    const step = this._options.chunkSizeMeters / this._options.resolution

    return chunkAxis * this._options.chunkSizeMeters + vertexAxis * step
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
