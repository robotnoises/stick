import { Color3 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../app/EngineContext"

export interface FishVisual {
  readonly body: Mesh
  readonly tail: Mesh
  readonly material: StandardMaterial
}

export class FishMeshFactory {
  public constructor(private readonly _context: EngineContext) {}

  public createFish(id: string, position: Vector3, scale: number): FishVisual {
    const material = new StandardMaterial(`${id}_material`, this._context.scene)

    material.diffuseColor = new Color3(0.48, 0.66, 0.58)
    material.specularColor = new Color3(0.08, 0.1, 0.09)

    const body = MeshBuilder.CreateSphere(
      `${id}_body`,
      {
        diameter: 0.28 * scale,
        segments: 6,
      },
      this._context.scene,
    )
    const tail = this._createTailMesh(`${id}_tail`, scale)

    body.material = material
    tail.material = material
    body.isPickable = false
    tail.isPickable = false
    body.position = position.clone()
    tail.position = position.clone()

    return { body, tail, material }
  }

  private _createTailMesh(name: string, scale: number): Mesh {
    const mesh = new Mesh(name, this._context.scene)
    const vertexData = new VertexData()
    const width = 0.22 * scale
    const length = 0.24 * scale

    vertexData.positions = [0, 0, -length, -width / 2, width / 2, 0, width / 2, -width / 2, 0]
    vertexData.indices = [0, 1, 2]
    vertexData.normals = [0, 1, 0, 0, 1, 0, 0, 1, 0]
    vertexData.uvs = [0, 0.5, 1, 1, 1, 0]
    vertexData.applyToMesh(mesh)

    return mesh
  }
}
