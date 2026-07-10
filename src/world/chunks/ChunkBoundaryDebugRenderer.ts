import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import type { EngineContext } from "../../app/EngineContext"
import { ChunkCoord } from "../ChunkCoord"

export class ChunkBoundaryDebugRenderer {
  private readonly _meshes = new Map<string, Mesh>()
  private _enabled = false

  public constructor(
    private readonly _context: EngineContext,
    private readonly _chunkSizeMeters: number,
    private readonly _heightProvider: (worldX: number, worldZ: number) => number,
  ) {}

  public get enabled(): boolean {
    return this._enabled
  }

  public get meshes(): Map<string, Mesh> {
    return this._meshes
  }

  public setEnabled(enabled: boolean, activeCoords: Iterable<ChunkCoord>): void {
    this._enabled = enabled

    if (!enabled) {
      this.disposeAll()
      return
    }

    for (const coord of activeCoords) {
      this.ensure(coord)
    }
  }

  public ensure(coord: ChunkCoord): void {
    if (!this._enabled || this._meshes.has(coord.key)) {
      return
    }

    const minX = coord.x * this._chunkSizeMeters
    const minZ = coord.z * this._chunkSizeMeters
    const maxX = minX + this._chunkSizeMeters
    const maxZ = minZ + this._chunkSizeMeters
    const lift = 0.45
    const boundary = MeshBuilder.CreateLines(
      `debug_chunk_boundary_${coord.key}`,
      {
        points: [
          new Vector3(minX, this._heightProvider(minX, minZ) + lift, minZ),
          new Vector3(maxX, this._heightProvider(maxX, minZ) + lift, minZ),
          new Vector3(maxX, this._heightProvider(maxX, maxZ) + lift, maxZ),
          new Vector3(minX, this._heightProvider(minX, maxZ) + lift, maxZ),
          new Vector3(minX, this._heightProvider(minX, minZ) + lift, minZ),
        ],
      },
      this._context.scene,
    ) as Mesh

    boundary.isPickable = false
    this._meshes.set(coord.key, boundary)
  }

  public disposeMesh(key: string): void {
    const boundary = this._meshes.get(key)

    boundary?.dispose()
    this._meshes.delete(key)
  }

  public disposeAll(): void {
    for (const boundary of this._meshes.values()) {
      boundary.dispose()
    }

    this._meshes.clear()
  }
}
