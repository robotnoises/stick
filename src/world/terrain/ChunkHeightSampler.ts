import type { ChunkTerrainData } from "../TerrainTypes"

export class ChunkHeightSampler {
  public constructor(private readonly _data: ChunkTerrainData) {}

  public sample(worldX: number, worldZ: number): number {
    const localX = worldX - this._data.coord.x * this._data.chunkSizeMeters
    const localZ = worldZ - this._data.coord.z * this._data.chunkSizeMeters
    const gridSize = this._data.resolution + 1
    const step = this._data.chunkSizeMeters / this._data.resolution
    const sampleX = Math.min(Math.max(localX / step, 0), this._data.resolution)
    const sampleZ = Math.min(Math.max(localZ / step, 0), this._data.resolution)
    const x0 = Math.floor(sampleX)
    const z0 = Math.floor(sampleZ)
    const x1 = Math.min(x0 + 1, this._data.resolution)
    const z1 = Math.min(z0 + 1, this._data.resolution)
    const tx = sampleX - x0
    const tz = sampleZ - z0
    const a = this._data.heights[z0 * gridSize + x0] ?? 0
    const b = this._data.heights[z0 * gridSize + x1] ?? a
    const c = this._data.heights[z1 * gridSize + x0] ?? a
    const d = this._data.heights[z1 * gridSize + x1] ?? c
    const xMix0 = this._lerp(a, b, tx)
    const xMix1 = this._lerp(c, d, tx)

    return this._lerp(xMix0, xMix1, tz)
  }

  private _lerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount
  }
}
