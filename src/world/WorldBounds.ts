import type { WorldBounds } from "../app/GameConfig"
import type { ChunkCoord } from "./ChunkCoord"

export class WorldBoundsHelper {
  public constructor(private readonly _bounds: WorldBounds) {}

  public containsPosition(x: number, z: number): boolean {
    return x >= this._bounds.minX && x <= this._bounds.maxX && z >= this._bounds.minZ && z <= this._bounds.maxZ
  }

  public clampPosition(x: number, z: number): { readonly x: number; readonly z: number } {
    return {
      x: Math.min(Math.max(x, this._bounds.minX), this._bounds.maxX),
      z: Math.min(Math.max(z, this._bounds.minZ), this._bounds.maxZ),
    }
  }

  public intersectsChunk(coord: ChunkCoord, chunkSizeMeters: number): boolean {
    const chunkMinX = coord.x * chunkSizeMeters
    const chunkMaxX = chunkMinX + chunkSizeMeters
    const chunkMinZ = coord.z * chunkSizeMeters
    const chunkMaxZ = chunkMinZ + chunkSizeMeters

    return (
      chunkMaxX > this._bounds.minX &&
      chunkMinX < this._bounds.maxX &&
      chunkMaxZ > this._bounds.minZ &&
      chunkMinZ < this._bounds.maxZ
    )
  }
}
