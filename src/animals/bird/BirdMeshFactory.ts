import { Color3 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../../app/EngineContext"

export interface BirdVisual {
  readonly body: Mesh
  readonly leftWing: Mesh
  readonly rightWing: Mesh
  readonly tail: Mesh
  readonly material: StandardMaterial
  readonly scale: number
}

export class BirdMeshFactory {
  public constructor(private readonly _context: EngineContext) {}

  public createBird(id: string, position: Vector3, scale: number): BirdVisual {
    const material = new StandardMaterial(`${id}_material`, this._context.scene)

    material.diffuseColor = new Color3(0.08, 0.09, 0.08)
    material.specularColor = Color3.Black()
    material.backFaceCulling = false

    const body = MeshBuilder.CreateSphere(
      `${id}_body`,
      {
        diameter: 0.22 * scale,
        segments: 6,
      },
      this._context.scene,
    )
    const leftWing = this._createWingMesh(`${id}_left_wing`, scale, -1)
    const rightWing = this._createWingMesh(`${id}_right_wing`, scale, 1)
    const tail = this._createTailMesh(`${id}_tail`, scale)

    body.scaling = new Vector3(0.75, 0.55, 1.45)
    body.material = material
    body.position = position.clone()
    body.isPickable = false

    for (const mesh of [leftWing, rightWing, tail]) {
      mesh.material = material
      mesh.position = position.clone()
      mesh.isPickable = false
    }

    return { body, leftWing, rightWing, tail, material, scale }
  }

  private _createWingMesh(name: string, scale: number, side: -1 | 1): Mesh {
    const mesh = new Mesh(name, this._context.scene)
    const vertexData = new VertexData()
    const span = 0.72 * scale
    const chord = 0.2 * scale

    vertexData.positions = [0, 0, chord / 2, side * span, 0, 0, 0, 0, -chord / 2]
    vertexData.indices = [0, 1, 2]
    vertexData.normals = [0, 1, 0, 0, 1, 0, 0, 1, 0]
    vertexData.uvs = [0, 1, 0.5, 0, 1, 1]
    vertexData.applyToMesh(mesh)

    return mesh
  }

  private _createTailMesh(name: string, scale: number): Mesh {
    const mesh = new Mesh(name, this._context.scene)
    const vertexData = new VertexData()
    const width = 0.18 * scale
    const length = 0.24 * scale

    vertexData.positions = [0, 0, 0, -width / 2, 0, -length, width / 2, 0, -length]
    vertexData.indices = [0, 1, 2]
    vertexData.normals = [0, 1, 0, 0, 1, 0, 0, 1, 0]
    vertexData.uvs = [0.5, 0, 0, 1, 1, 1]
    vertexData.applyToMesh(mesh)

    return mesh
  }
}
