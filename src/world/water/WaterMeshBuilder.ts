import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import type { EngineContext } from "../../app/EngineContext"
import type { WorldBounds } from "../../app/GameConfig"
import type { ChunkTerrainData } from "../terrain/TerrainTypes"
import type { TerrainChunkMaterials } from "../terrain/TerrainChunkMaterials"
import type { WorldFeatureGenerator } from "../generation/WorldFeatureGenerator"

export class WaterMeshBuilder {
  public constructor(
    private readonly _context: EngineContext,
    private readonly _data: ChunkTerrainData,
    private readonly _materials: TerrainChunkMaterials,
    private readonly _worldFeatures: WorldFeatureGenerator | null,
  ) {}

  public create(): Mesh[] {
    if (!this._worldFeatures) {
      return []
    }

    const bounds = this._getChunkBounds()
    const lakes = this._worldFeatures.getLakesIntersectingBounds(bounds)
    const meshes: Mesh[] = []

    for (const lake of lakes) {
      const water = MeshBuilder.CreateGround(
        `water_${this._data.key}_${lake.id}`,
        {
          width: this._data.chunkSizeMeters,
          height: this._data.chunkSizeMeters,
          subdivisions: 1,
        },
        this._context.scene,
      )

      water.position = new Vector3(
        bounds.minX + this._data.chunkSizeMeters / 2,
        lake.waterLevelMeters,
        bounds.minZ + this._data.chunkSizeMeters / 2,
      )
      water.material = this._materials.water
      water.isPickable = false

      meshes.push(water)
    }

    return meshes
  }

  private _getChunkBounds(): WorldBounds {
    const minX = this._data.coord.x * this._data.chunkSizeMeters
    const minZ = this._data.coord.z * this._data.chunkSizeMeters

    return {
      minX,
      maxX: minX + this._data.chunkSizeMeters,
      minZ,
      maxZ: minZ + this._data.chunkSizeMeters,
    }
  }
}
