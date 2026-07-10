import { PointLight } from "@babylonjs/core/Lights/pointLight"
import { Color3 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import type { EngineContext } from "../app/EngineContext"

export interface FireflyVisual {
  readonly body: Mesh
  readonly light: PointLight
  readonly material: StandardMaterial
  readonly scale: number
}

export class FireflyMeshFactory {
  public constructor(private readonly _context: EngineContext) {}

  public createFirefly(id: string, position: Vector3, scale: number): FireflyVisual {
    const material = new StandardMaterial(`${id}_material`, this._context.scene)

    material.diffuseColor = new Color3(0.28, 0.72, 0.12)
    material.emissiveColor = new Color3(0.62, 1, 0.18)
    material.specularColor = Color3.Black()
    material.disableLighting = true
    material.alpha = 0.42

    const body = MeshBuilder.CreateSphere(
      `${id}_body`,
      {
        diameter: 0.08 * scale,
        segments: 6,
      },
      this._context.scene,
    )
    const light = new PointLight(`${id}_glow`, position.clone(), this._context.scene)

    light.diffuse = new Color3(0.55, 1, 0.18)
    light.specular = new Color3(0.2, 0.45, 0.06)
    light.range = 3.2 * scale
    light.intensity = 0.18

    body.material = material
    body.position = position.clone()
    body.isPickable = false
    body.alwaysSelectAsActiveMesh = true

    return { body, light, material, scale }
  }
}
