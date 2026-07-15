import { PointLight } from "@babylonjs/core/Lights/pointLight"
import { SpotLight } from "@babylonjs/core/Lights/spotLight"
import { Material } from "@babylonjs/core/Materials/material"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Texture } from "@babylonjs/core/Materials/Textures/texture"
import { Color3 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { Scene } from "@babylonjs/core/scene"
import { FireMaterial } from "@babylonjs/materials/fire/fireMaterial"
import campfireDiffuseUrl from "../../assets/exported/textures/fire/campfire-diffuse.svg?url"
import campfireDistortionUrl from "../../assets/exported/textures/fire/campfire-distortion.svg?url"
import campfireOpacityUrl from "../../assets/exported/textures/fire/campfire-opacity.svg?url"
import type { CampfireVisual } from "./CampfireTypes"

export class CampfireMeshFactory {
  private readonly _woodMaterial: StandardMaterial
  private readonly _charMaterial: StandardMaterial
  private readonly _flameMaterial: FireMaterial
  private readonly _flameOuterFallbackMaterial: StandardMaterial
  private readonly _flameInnerFallbackMaterial: StandardMaterial
  private readonly _emberMaterial: StandardMaterial

  public constructor(private readonly _scene: Scene) {
    this._woodMaterial = new StandardMaterial("campfire-wood-material", this._scene)
    this._woodMaterial.diffuseColor = new Color3(0.075, 0.04, 0.024)
    this._woodMaterial.specularColor = Color3.Black()
    this._woodMaterial.maxSimultaneousLights = 8

    this._charMaterial = new StandardMaterial("campfire-char-material", this._scene)
    this._charMaterial.diffuseColor = new Color3(0.012, 0.01, 0.009)
    this._charMaterial.specularColor = Color3.Black()
    this._charMaterial.maxSimultaneousLights = 8

    this._flameMaterial = this._createFlameMaterial()
    this._flameOuterFallbackMaterial = this._createFallbackFlameMaterial(
      "campfire-flame-outer-fallback-material",
      new Color3(1, 0.22, 0.035),
      0.52,
    )
    this._flameInnerFallbackMaterial = this._createFallbackFlameMaterial(
      "campfire-flame-inner-fallback-material",
      new Color3(1, 0.82, 0.2),
      0.64,
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
    const fillLightOffsets = [new Vector3(1.7, 0.72, 0.9), new Vector3(-1.2, 0.64, -1.35)]
    const fillLights = fillLightOffsets.map(
      (offset, index) =>
        new PointLight(`medium-campfire-warm-fill-${index}`, position.add(offset), this._scene),
    )
    const spillLight = new SpotLight(
      "medium-campfire-ground-spill",
      position.add(new Vector3(0, 2.2, 0)),
      new Vector3(0, -1, 0),
      Math.PI * 0.92,
      1.05,
      this._scene,
    )

    light.diffuse = new Color3(1, 0.2, 0.035)
    light.specular = Color3.Black()
    light.shadowEnabled = false
    light.intensity = 18
    light.range = 16
    light.renderPriority = 10_000

    fillLights.forEach((fillLight, index) => {
      fillLight.diffuse = new Color3(1, 0.16, 0.025)
      fillLight.specular = Color3.Black()
      fillLight.shadowEnabled = false
      fillLight.intensity = 7
      fillLight.range = 11
      fillLight.renderPriority = 10_010 + index
    })

    spillLight.diffuse = new Color3(1, 0.14, 0.02)
    spillLight.specular = Color3.Black()
    spillLight.shadowEnabled = false
    spillLight.intensity = 3.5
    spillLight.range = 10
    spillLight.renderPriority = 10_001

    const logMeshes = root.getChildMeshes().filter((mesh) => mesh.name.startsWith("campfire-stick-"))

    light.excludedMeshes.push(...logMeshes)
    spillLight.excludedMeshes.push(...logMeshes)

    for (const fillLight of fillLights) {
      fillLight.excludedMeshes.push(...logMeshes)
    }

    this._refreshSceneLighting()

    window.setTimeout(() => this._refreshSceneLighting(), 0)

    return { root, flameMeshes, light, fillLights, spillLight }
  }

  public dispose(): void {
    this._woodMaterial.dispose()
    this._charMaterial.dispose()
    this._flameMaterial.dispose()
    this._flameOuterFallbackMaterial.dispose()
    this._flameInnerFallbackMaterial.dispose()
    this._emberMaterial.dispose()
  }

  private _createFlameMaterial(): FireMaterial {
    const material = new FireMaterial("campfire-flame-material", this._scene)

    material.diffuseTexture = new Texture(campfireDiffuseUrl, this._scene)
    material.distortionTexture = new Texture(campfireDistortionUrl, this._scene)
    material.opacityTexture = new Texture(campfireOpacityUrl, this._scene)
    material.diffuseColor = new Color3(1, 0.56, 0.18)
    material.speed = 4.2
    material.backFaceCulling = false

    return material
  }

  private _createFallbackFlameMaterial(
    name: string,
    emissiveColor: Color3,
    alpha: number,
  ): StandardMaterial {
    const material = new StandardMaterial(name, this._scene)

    material.diffuseColor = Color3.Black()
    material.emissiveColor = emissiveColor
    material.alpha = alpha
    material.disableLighting = true
    material.backFaceCulling = false
    material.transparencyMode = Material.MATERIAL_ALPHABLEND
    ;(material as StandardMaterial & { useVertexAlpha: boolean }).useVertexAlpha = true

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
    const flameSpecs = [
      { width: 0.86, height: 0.58, y: 0.34, rotation: 0 },
      { width: 0.7, height: 0.5, y: 0.31, rotation: Math.PI / 3 },
      { width: 0.62, height: 0.46, y: 0.28, rotation: -Math.PI / 3 },
    ] as const

    flameSpecs.forEach((spec, index) => {
      const flame = MeshBuilder.CreatePlane(
        `campfire-flame-${index}`,
        { width: spec.width, height: spec.height },
        this._scene,
      )

      flame.parent = root
      flame.position.y = spec.y
      flame.rotation.y = spec.rotation
      flame.material = this._flameMaterial
      flame.isPickable = false
      flames.push(flame)
    })

    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI
      const outer = this._createFlameLeaf(
        `campfire-flame-fallback-outer-${index}`,
        0.34 + (index % 2) * 0.045,
        0.38 + (index % 3) * 0.04,
        0.08,
        index * 0.37,
      )
      const inner = this._createFlameLeaf(
        `campfire-flame-fallback-inner-${index}`,
        0.18 + (index % 2) * 0.025,
        0.26 + (index % 3) * 0.03,
        0.045,
        index * 0.53 + 2,
      )

      outer.parent = root
      outer.position.set(Math.sin(angle) * 0.035, 0.16, Math.cos(angle) * 0.035)
      outer.rotation.y = angle
      outer.material = this._flameOuterFallbackMaterial
      outer.isPickable = false

      inner.parent = root
      inner.position.set(Math.sin(angle + 0.28) * 0.02, 0.19, Math.cos(angle + 0.28) * 0.02)
      inner.rotation.y = angle + 0.18
      inner.material = this._flameInnerFallbackMaterial
      inner.isPickable = false

      flames.push(outer, inner)
    }

    return flames
  }

  private _createFlameLeaf(
    name: string,
    width: number,
    height: number,
    sway: number,
    seed: number,
  ): Mesh {
    const mesh = new Mesh(name, this._scene)
    const positions: number[] = [0, height * 0.27, 0]
    const colors: number[] = [1, 1, 1, 0.72]
    const indices: number[] = []
    const outline: [number, number, number, number][] = []
    const sideSteps = 8

    outline.push([0, 0, 0, 0])

    for (let step = 0; step <= sideSteps; step += 1) {
      const t = step / sideSteps
      const y = height * t
      const taper = Math.pow(Math.sin((1 - t) * Math.PI * 0.92), 1.35)
      const lick = Math.sin(seed + t * Math.PI * 3.1) * 0.16 + Math.sin(seed * 2.1 + t * 9.4) * 0.08
      const x = (width * (0.02 + taper * 0.98) * (1 + lick)) / 2
      const z = sway * Math.sin(seed + t * Math.PI * 1.8) * t
      const alpha = Math.max(0, 0.68 * Math.pow(1 - t, 1.45))

      outline.push([x, y, z, alpha])
    }

    outline.push([0, height, 0, 0])

    for (let step = sideSteps; step >= 0; step -= 1) {
      const t = step / sideSteps
      const y = height * t
      const taper = Math.pow(Math.sin((1 - t) * Math.PI * 0.92), 1.35)
      const lick =
        Math.sin(seed + 1.7 + t * Math.PI * 2.7) * 0.14 + Math.sin(seed * 1.6 + t * 8.1) * 0.07
      const x = (-width * (0.02 + taper * 0.98) * (1 + lick)) / 2
      const z = -sway * Math.sin(seed * 0.7 + t * Math.PI * 1.6) * t
      const alpha = Math.max(0, 0.68 * Math.pow(1 - t, 1.45))

      outline.push([x, y, z, alpha])
    }

    for (const [x, y, z, alpha] of outline) {
      positions.push(x, y, z)
      colors.push(1, 1, 1, alpha)
    }

    for (let index = 1; index < outline.length; index += 1) {
      indices.push(0, index, index + 1)
    }

    indices.push(0, outline.length, 1)

    const vertexData = new VertexData()

    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.colors = colors
    vertexData.applyToMesh(mesh)

    return mesh
  }

  private _refreshSceneLighting(): void {
    this._scene.requireLightSorting = true
    this._scene.sortLightsByPriority()

    for (const mesh of this._scene.meshes) {
      ;(mesh as unknown as { _resyncLightSources?: () => void })._resyncLightSources?.()
      mesh.material?.markAsDirty(Material.AllDirtyFlag)
    }

    this._scene.markAllMaterialsAsDirty(Material.LightDirtyFlag)
    this._scene.resetCachedMaterial()
  }
}
