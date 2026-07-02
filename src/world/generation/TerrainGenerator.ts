import { ChunkCoord } from "../ChunkCoord"
import type { ChunkTerrainData, GeneratedPropData } from "../TerrainTypes"

export interface TerrainGeneratorOptions {
  readonly seed: number
  readonly chunkSizeMeters: number
  readonly resolution: number
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

    for (let z = 0; z < gridSize; z += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        const worldX = this._toWorldCoordinate(coord.x, x)
        const worldZ = this._toWorldCoordinate(coord.z, z)
        const index = z * gridSize + x

        heights[index] = this.getHeight(worldX, worldZ)
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
      props: this._generateProps(coord),
    }
  }

  public getHeight(worldX: number, worldZ: number): number {
    const broad = this._valueNoise(worldX * 0.006, worldZ * 0.006, 11)
    const medium = this._valueNoise(worldX * 0.022, worldZ * 0.022, 23)
    const small = this._valueNoise(worldX * 0.08, worldZ * 0.08, 41)

    return broad * 8 + medium * 2.5 + small * 0.7
  }

  private _generateProps(coord: ChunkCoord): GeneratedPropData[] {
    const random = this._createRandom(this._hash(coord.x, coord.z, 97))
    const propCount = 3 + Math.floor(random() * 5)
    const props: GeneratedPropData[] = []

    for (let index = 0; index < propCount; index += 1) {
      const localX = 4 + random() * (this._options.chunkSizeMeters - 8)
      const localZ = 4 + random() * (this._options.chunkSizeMeters - 8)
      const worldX = coord.x * this._options.chunkSizeMeters + localX
      const worldZ = coord.z * this._options.chunkSizeMeters + localZ
      const height = this.getHeight(worldX, worldZ)

      props.push({
        id: `${coord.key}_pine_${index}`,
        type: "pine",
        position: [worldX, height, worldZ],
        rotationY: random() * Math.PI * 2,
        scale: 0.75 + random() * 0.75,
      })
    }

    return props
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
    let value = x * 374761393 + z * 668265263 + salt * 2147483647 + this._options.seed * 31

    value = (value ^ (value >> 13)) * 1274126177
    value = value ^ (value >> 16)

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
