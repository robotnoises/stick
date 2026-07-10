import { PointLight } from "@babylonjs/core/Lights/pointLight"
import { Color3 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../../app/EngineContext"

export interface FireflyVisual {
  readonly body: Mesh
  readonly halo: Mesh
  readonly light: PointLight
  readonly bodyMaterial: StandardMaterial
  readonly haloMaterial: StandardMaterial
  readonly scale: number
}

export class FireflyMeshFactory {
  public constructor(private readonly _context: EngineContext) {}

  public createFirefly(id: string, position: Vector3, scale: number): FireflyVisual {
    const bodyMaterial = new StandardMaterial(`${id}_body_material`, this._context.scene)
    const haloMaterial = new StandardMaterial(`${id}_halo_material`, this._context.scene)

    bodyMaterial.diffuseColor = new Color3(0.22, 0.62, 0.08)
    bodyMaterial.emissiveColor = new Color3(0.5, 1, 0.14)
    bodyMaterial.specularColor = Color3.Black()
    bodyMaterial.disableLighting = true
    bodyMaterial.alpha = 0.24

    haloMaterial.diffuseColor = Color3.Black()
    haloMaterial.emissiveColor = new Color3(0.38, 0.9, 0.12)
    haloMaterial.specularColor = Color3.Black()
    haloMaterial.disableLighting = true
    haloMaterial.alpha = 0.36
    haloMaterial.backFaceCulling = false
    ;(haloMaterial as StandardMaterial & { useVertexAlpha: boolean }).useVertexAlpha = true

    const body = MeshBuilder.CreateSphere(
      `${id}_body`,
      {
        diameter: 0.045 * scale,
        segments: 6,
      },
      this._context.scene,
    )
    const halo = this._createSoftHaloMesh(`${id}_halo`, scale)
    const light = new PointLight(`${id}_glow`, position.clone(), this._context.scene)

    light.diffuse = new Color3(0.55, 1, 0.16)
    light.specular = new Color3(0.2, 0.45, 0.05)
    light.range = 5.2 * scale
    light.intensity = 0

    body.material = bodyMaterial
    body.position = position.clone()
    body.isPickable = false
    body.alwaysSelectAsActiveMesh = true

    halo.material = haloMaterial
    halo.position = position.clone()
    halo.isPickable = false
    halo.alwaysSelectAsActiveMesh = true
    halo.billboardMode = Mesh.BILLBOARDMODE_ALL

    return { body, halo, light, bodyMaterial, haloMaterial, scale }
  }

  private _createSoftHaloMesh(name: string, scale: number): Mesh {
    const mesh = new Mesh(name, this._context.scene)
    const vertexData = new VertexData()
    const radius = 0.09 * scale
    const ringCount = 3
    const segmentCount = 18
    const positions: number[] = [0, 0, 0]
    const indices: number[] = []
    const normals: number[] = [0, 0, -1]
    const uvs: number[] = [0.5, 0.5]
    const colors: number[] = [0.6, 1, 0.18, 0.65]

    for (let ring = 1; ring <= ringCount; ring += 1) {
      const ringRadius = (ring / ringCount) * radius
      const alpha = ring === ringCount ? 0 : 0.22 / ring

      for (let segment = 0; segment < segmentCount; segment += 1) {
        const angle = (segment / segmentCount) * Math.PI * 2
        const x = Math.cos(angle) * ringRadius
        const y = Math.sin(angle) * ringRadius

        positions.push(x, y, 0)
        normals.push(0, 0, -1)
        uvs.push(0.5 + x / (radius * 2), 0.5 + y / (radius * 2))
        colors.push(0.55, 1, 0.16, alpha)
      }
    }

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const next = (segment + 1) % segmentCount

      indices.push(0, 1 + segment, 1 + next)
    }

    for (let ring = 1; ring < ringCount; ring += 1) {
      const innerStart = 1 + (ring - 1) * segmentCount
      const outerStart = 1 + ring * segmentCount

      for (let segment = 0; segment < segmentCount; segment += 1) {
        const next = (segment + 1) % segmentCount

        indices.push(innerStart + segment, outerStart + segment, innerStart + next)
        indices.push(innerStart + next, outerStart + segment, outerStart + next)
      }
    }

    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.uvs = uvs
    vertexData.colors = colors
    vertexData.applyToMesh(mesh)

    return mesh
  }
}
