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
  readonly scale: number
}

export class FishMeshFactory {
  public constructor(private readonly _context: EngineContext) {}

  public createFish(id: string, position: Vector3, scale: number): FishVisual {
    const material = new StandardMaterial(`${id}_material`, this._context.scene)

    material.diffuseColor = new Color3(0.5, 0.68, 0.58)
    material.specularColor = new Color3(0.12, 0.14, 0.12)
    material.backFaceCulling = false

    const body = MeshBuilder.CreateSphere(
      `${id}_body`,
      {
        diameter: 0.34 * scale,
        segments: 8,
      },
      this._context.scene,
    )
    const tail = this._createTailMesh(`${id}_tail`, scale)

    body.scaling = new Vector3(0.32, 0.9, 1.9)
    body.material = material
    tail.material = material
    body.isPickable = false
    tail.isPickable = false
    body.position = position.clone()
    tail.position = position.clone()

    return { body, tail, material, scale }
  }

  private _createTailMesh(name: string, scale: number): Mesh {
    const mesh = new Mesh(name, this._context.scene)
    const vertexData = new VertexData()
    const height = 0.42 * scale
    const baseHeight = height * 0.28
    const length = 0.38 * scale
    const notchDepth = length * 0.58

    vertexData.positions = [
      0,
      baseHeight / 2,
      0,
      0,
      -baseHeight / 2,
      0,
      0,
      height / 2,
      -length,
      0,
      0,
      -notchDepth,
      0,
      -height / 2,
      -length,
    ]
    vertexData.indices = [0, 1, 2, 1, 3, 2, 1, 4, 3]
    vertexData.normals = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]
    vertexData.uvs = [0.98, 0.42, 0.98, 0.58, 0.05, 0, 0.36, 0.5, 0.05, 1]
    vertexData.applyToMesh(mesh)

    return mesh
  }
}
