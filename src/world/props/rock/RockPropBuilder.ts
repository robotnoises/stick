import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import type { EngineContext } from "../../../app/EngineContext"
import type { GeneratedPropData } from "../../TerrainTypes"
import type { TerrainChunkMaterials } from "../../terrain/TerrainChunkMaterials"

export class RockPropBuilder {
  public constructor(
    private readonly _context: EngineContext,
    private readonly _materials: TerrainChunkMaterials,
  ) {}

  public create(prop: GeneratedPropData): Mesh {
    const rock = MeshBuilder.CreateSphere(
      prop.id,
      {
        diameter: 1.2 * prop.scale,
        segments: 6,
      },
      this._context.scene,
    )

    rock.position = new Vector3(
      prop.position[0],
      prop.position[1] + 0.35 * prop.scale,
      prop.position[2],
    )
    rock.rotation.y = prop.rotationY
    rock.material = this._materials.rock

    return rock
  }
}
