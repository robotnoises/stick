import { PointLight } from "@babylonjs/core/Lights/pointLight"
import { SpotLight } from "@babylonjs/core/Lights/spotLight"
import { Material } from "@babylonjs/core/Materials/material"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { Scene } from "@babylonjs/core/scene"
import type { CampfireVisual } from "./CampfireTypes"

export class CampfireMeshFactory {
  private readonly _woodMaterial: StandardMaterial
  private readonly _charMaterial: StandardMaterial
  private readonly _flameOuterMaterial: StandardMaterial
  private readonly _flameInnerMaterial: StandardMaterial
  private readonly _emberMaterial: StandardMaterial

  public constructor(private readonly _scene: Scene) {
    this._woodMaterial = new StandardMaterial("campfire-wood-material", this._scene)
    this._woodMaterial.diffuseColor = new Color3(0.28, 0.15, 0.08)
    this._woodMaterial.specularColor = Color3.Black()
    this._woodMaterial.maxSimultaneousLights = 8

    this._charMaterial = new StandardMaterial("campfire-char-material", this._scene)
    this._charMaterial.diffuseColor = new Color3(0.045, 0.035, 0.028)
    this._charMaterial.specularColor = Color3.Black()
    this._charMaterial.maxSimultaneousLights = 8

    this._flameOuterMaterial = this._createFlameMaterial(
      "campfire-flame-outer-material",
      new Color3(1, 0.25, 0.04),
      0.72,
    )
    this._flameInnerMaterial = this._createFlameMaterial(
      "campfire-flame-inner-material",
      new Color3(1, 0.78, 0.18),
      0.82,
    )

    this._emberMaterial = new StandardMaterial("campfire-ember-material", this._scene)
    this._emberMaterial.diffuseColor = Color3.Black()
    this._emberMaterial.emissiveColor = new Color3(1, 0.18, 0.035)
    this._emberMaterial.disableLighting = true

  }

  public createMediumFire(position: Vector3): CampfireVisual {
    const root = new TransformNode("medium-campfire", this._scene)

    root.position = position.clone()

    this._createWoodPile(root)
    this._createEmbers(root)

    const flameMeshes = this._createFlames(root)
    const light = new PointLight(
      "medium-campfire-light",
      position.add(new Vector3(0, 1.05, 0)),
      this._scene,
    )
    const spillLight = new SpotLight(
      "medium-campfire-ground-spill",
      position.add(new Vector3(0, 2.2, 0)),
      new Vector3(0, -1, 0),
      Math.PI * 0.92,
      1.05,
      this._scene,
    )

    light.diffuse = new Color3(1, 0.5, 0.18)
    light.specular = new Color3(1, 0.35, 0.12)
    light.intensity = 9
    light.range = 26
    light.renderPriority = 10_000
    spillLight.diffuse = new Color3(1, 0.42, 0.12)
    spillLight.specular = new Color3(0.6, 0.18, 0.04)
    spillLight.intensity = 5.2
    spillLight.range = 24
    spillLight.renderPriority = 10_001
    this._scene.markAllMaterialsAsDirty(Material.LightDirtyFlag)

    return { root, flameMeshes, light, spillLight }
  }

  public dispose(): void {
    this._woodMaterial.dispose()
    this._charMaterial.dispose()
    this._flameOuterMaterial.dispose()
    this._flameInnerMaterial.dispose()
    this._emberMaterial.dispose()
  }

  private _createFlameMaterial(name: string, emissiveColor: Color3, alpha: number): StandardMaterial {
    const material = new StandardMaterial(name, this._scene)

    material.diffuseColor = Color3.Black()
    material.emissiveColor = emissiveColor
    material.alpha = alpha
    material.disableLighting = true
    material.backFaceCulling = false
    material.transparencyMode = Material.MATERIAL_ALPHABLEND

    return material
  }

  private _createWoodPile(root: TransformNode): void {
    const stickSpecs = [
      [-0.03, 0, 0.03, 0.68, 0.055, 0],
      [0.04, 0, -0.02, 0.62, 0.045, Math.PI / 5],
      [0, 0.035, 0.01, 0.58, 0.04, -Math.PI / 4],
      [-0.06, 0.02, -0.04, 0.52, 0.038, Math.PI / 2.8],
      [0.06, 0.045, 0.04, 0.5, 0.035, -Math.PI / 2.6],
      [0, 0.065, -0.01, 0.46, 0.035, Math.PI / 1.55],
    ] as const

    stickSpecs.forEach(([x, y, z, length, diameter, angle], index) => {
      const stick = MeshBuilder.CreateCylinder(
        `campfire-stick-${index}`,
        { height: length, diameter, tessellation: 8 },
        this._scene,
      )

      stick.parent = root
      stick.position.set(x, 0.06 + y, z)
      stick.rotation.z = Math.PI / 2 + (index % 2 === 0 ? 0.08 : -0.06)
      stick.rotation.y = angle
      stick.material = index === 2 ? this._charMaterial : this._woodMaterial
      stick.isPickable = false
    })
  }

  private _createEmbers(root: TransformNode): void {
    const emberSpecs = [
      [-0.08, 0.1, -0.03, 0.08],
      [0.07, 0.095, 0.04, 0.065],
      [0.01, 0.105, 0.07, 0.055],
      [0.03, 0.1, -0.06, 0.05],
    ] as const

    emberSpecs.forEach(([x, y, z, diameter], index) => {
      const ember = MeshBuilder.CreateSphere(
        `campfire-ember-${index}`,
        { diameter, segments: 8 },
        this._scene,
      )

      ember.parent = root
      ember.position.set(x, y, z)
      ember.scaling.y = 0.45
      ember.material = this._emberMaterial
      ember.isPickable = false
    })
  }

  private _createFlames(root: TransformNode): Mesh[] {
    const flames: Mesh[] = []

    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI
      const outer = this._createFlameLeaf(`campfire-flame-outer-${index}`, 0.22, 0.95, 0.12)
      const inner = this._createFlameLeaf(`campfire-flame-inner-${index}`, 0.12, 0.68, 0.1)

      outer.parent = root
      outer.position.y = 0.18
      outer.rotation.y = angle
      outer.material = this._flameOuterMaterial
      outer.isPickable = false

      inner.parent = root
      inner.position.y = 0.2
      inner.rotation.y = angle + 0.2
      inner.material = this._flameInnerMaterial
      inner.isPickable = false

      flames.push(outer, inner)
    }

    return flames
  }

  private _createFlameLeaf(name: string, width: number, height: number, sway: number): Mesh {
    const mesh = new Mesh(name, this._scene)
    const halfWidth = width / 2
    const positions = [
      -halfWidth, 0, 0,
      halfWidth, 0, 0,
      halfWidth * 0.7, height * 0.42, sway,
      0, height, 0,
      -halfWidth * 0.65, height * 0.42, -sway,
    ]
    const indices = [0, 1, 2, 0, 2, 4, 4, 2, 3]
    const colors: number[] = []

    for (let index = 0; index < 5; index += 1) {
      colors.push(1, 1, 1, index === 3 ? 0.25 : 1)
    }

    const vertexData = new VertexData()

    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.colors = colors
    vertexData.applyToMesh(mesh)

    return mesh
  }
}
