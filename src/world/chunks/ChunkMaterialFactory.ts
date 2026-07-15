import { Material } from "@babylonjs/core/Materials/material"
import { Texture } from "@babylonjs/core/Materials/Textures/texture"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math.color"
import type { Observer } from "@babylonjs/core/Misc/observable"
import type { Scene } from "@babylonjs/core/scene"
import bark006ColorUrl from "../../../assets/exported/textures/terrain/bark006-color.png?url"
import bark014ColorUrl from "../../../assets/exported/textures/terrain/bark014-color.png?url"
import fineClumpySandBaseColorUrl from "../../../assets/exported/textures/terrain/fine-clumpy-sand-basecolor.png?url"
import foliage006ColorUrl from "../../../assets/exported/textures/terrain/foliage006-color.png?url"
import foliage006OpacityUrl from "../../../assets/exported/textures/terrain/foliage006-opacity.png?url"
import grass005ColorUrl from "../../../assets/exported/textures/terrain/grass005-color.png?url"
import ground048ColorUrl from "../../../assets/exported/textures/terrain/ground048-color.png?url"
import riverBedColorUrl from "../../../assets/exported/textures/terrain/river-bed-color-512.png?url"
import rock064ColorUrl from "../../../assets/exported/textures/terrain/rock064-color.png?url"
import pineNeedleClusterUrl from "../../../assets/exported/textures/props/pine-needle-cluster.png?url"
import pineNeedleLitterUrl from "../../../assets/exported/textures/props/pine-needle-litter.png?url"
import waterColorUrl from "../../../assets/exported/textures/terrain/water.jpg?url"
import type { EngineContext } from "../../app/EngineContext"
import type { TerrainChunkMaterials } from "../terrain/TerrainChunkMaterials"

export interface ChunkMaterialFactoryResult {
  readonly materials: TerrainChunkMaterials
  readonly waterFlowObserver: Observer<Scene> | null
}

export class ChunkMaterialFactory {
  public constructor(private readonly _context: EngineContext) {}

  public create(): ChunkMaterialFactoryResult {
    const grassTerrain = new StandardMaterial(
      "progressive-grass-terrain-material",
      this._context.scene,
    )
    const dirtTerrain = new StandardMaterial(
      "progressive-dirt-terrain-material",
      this._context.scene,
    )
    const sandTerrain = new StandardMaterial(
      "progressive-sand-terrain-material",
      this._context.scene,
    )
    const pineNeedlesTerrain = new StandardMaterial(
      "progressive-pine-needles-terrain-material",
      this._context.scene,
    )
    const riverBedTerrain = new StandardMaterial(
      "progressive-river-bed-terrain-material",
      this._context.scene,
    )
    const trunk = new StandardMaterial("progressive-pine-trunk-material", this._context.scene)
    const deadWood = new StandardMaterial("progressive-dead-wood-material", this._context.scene)
    const needles = new StandardMaterial("progressive-pine-needles-material", this._context.scene)
    const pineFoliage = new StandardMaterial(
      "progressive-pine-foliage-material",
      this._context.scene,
    )
    const pineNeedleLitter = new StandardMaterial(
      "progressive-pine-needle-litter-material",
      this._context.scene,
    )
    const grassFoliage = new StandardMaterial(
      "progressive-grass-foliage-material",
      this._context.scene,
    )
    const rock = new StandardMaterial("progressive-rock-material", this._context.scene)
    const water = new StandardMaterial("progressive-water-material", this._context.scene)

    this._configureTerrainMaterial(grassTerrain, grass005ColorUrl, new Color3(0.92, 1, 0.86))
    this._configureTerrainMaterial(dirtTerrain, ground048ColorUrl, new Color3(0.75, 0.58, 0.42))
    this._configureTerrainMaterial(
      sandTerrain,
      fineClumpySandBaseColorUrl,
      new Color3(1, 0.94, 0.78),
    )
    this._configureTerrainMaterial(
      pineNeedlesTerrain,
      ground048ColorUrl,
      new Color3(0.48, 0.38, 0.24),
    )
    this._configureTerrainMaterial(riverBedTerrain, riverBedColorUrl, new Color3(0.7, 0.64, 0.55))
    this._configureTexturedMaterial(trunk, bark014ColorUrl, 1, new Color3(0.8, 0.72, 0.62))
    this._configureTexturedMaterial(deadWood, bark006ColorUrl, 1.5, new Color3(0.6, 0.46, 0.32))
    this._configureTexturedMaterial(rock, rock064ColorUrl, 2, new Color3(0.82, 0.86, 0.86))

    trunk.backFaceCulling = false
    trunk.twoSidedLighting = true
    trunk.specularColor = Color3.Black()
    deadWood.backFaceCulling = false
    deadWood.twoSidedLighting = true

    needles.diffuseColor = new Color3(0.11, 0.27, 0.14)
    needles.specularColor = Color3.Black()

    const pineFoliageTexture = new Texture(pineNeedleClusterUrl, this._context.scene)

    pineFoliageTexture.hasAlpha = true
    pineFoliage.diffuseTexture = pineFoliageTexture
    pineFoliage.diffuseColor = new Color3(0.5, 0.78, 0.44)
    pineFoliage.emissiveColor = new Color3(0.012, 0.034, 0.014)
    pineFoliage.specularColor = Color3.Black()
    pineFoliage.backFaceCulling = false
    pineFoliage.twoSidedLighting = true
    pineFoliage.useAlphaFromDiffuseTexture = true
    pineFoliage.alphaCutOff = 0.36
    pineFoliage.transparencyMode = Material.MATERIAL_ALPHATEST

    const pineNeedleLitterTexture = new Texture(pineNeedleLitterUrl, this._context.scene)

    pineNeedleLitterTexture.hasAlpha = true
    pineNeedleLitter.diffuseTexture = pineNeedleLitterTexture
    pineNeedleLitter.diffuseColor = new Color3(0.42, 0.32, 0.2)
    pineNeedleLitter.specularColor = Color3.Black()
    pineNeedleLitter.backFaceCulling = false
    pineNeedleLitter.twoSidedLighting = true
    pineNeedleLitter.useAlphaFromDiffuseTexture = true
    pineNeedleLitter.alphaCutOff = 0.32
    pineNeedleLitter.transparencyMode = Material.MATERIAL_ALPHATEST

    const grassFoliageTexture = new Texture(foliage006ColorUrl, this._context.scene)
    const grassFoliageOpacityTexture = new Texture(foliage006OpacityUrl, this._context.scene)

    grassFoliageOpacityTexture.getAlphaFromRGB = true
    grassFoliage.diffuseTexture = grassFoliageTexture
    grassFoliage.opacityTexture = grassFoliageOpacityTexture
    grassFoliage.diffuseColor = new Color3(0.62, 0.86, 0.48)
    grassFoliage.emissiveColor = new Color3(0.01, 0.025, 0.006)
    grassFoliage.specularColor = Color3.Black()
    grassFoliage.backFaceCulling = false
    grassFoliage.twoSidedLighting = true
    grassFoliage.alphaCutOff = 0.36
    grassFoliage.transparencyMode = Material.MATERIAL_ALPHATEST

    const waterTexture = new Texture(waterColorUrl, this._context.scene)

    waterTexture.uScale = 1.2
    waterTexture.vScale = 1.2
    waterTexture.level = 0.18

    water.emissiveTexture = waterTexture
    water.diffuseColor = new Color3(0.045, 0.11, 0.16)
    water.emissiveColor = new Color3(0.018, 0.045, 0.055)
    water.specularColor = new Color3(0.92, 1.02, 0.98)
    water.specularPower = 48
    water.roughness = 0.08
    water.alpha = 0.54
    water.useSpecularOverAlpha = true
    water.transparencyMode = Material.MATERIAL_ALPHABLEND
    water.backFaceCulling = false
    water.twoSidedLighting = true

    const waterFlowObserver =
      this._context.scene.onBeforeRenderObservable?.add(() => {
        const deltaSeconds = this._context.engine.getDeltaTime() / 1000

        waterTexture.uOffset += deltaSeconds * 0.0025
        waterTexture.vOffset += deltaSeconds * 0.011
      }) ?? null

    return {
      materials: {
        terrain: [grassTerrain, dirtTerrain, sandTerrain, pineNeedlesTerrain, riverBedTerrain],
        trunk,
        deadWood,
        needles,
        pineFoliage,
        pineNeedleLitter,
        grassFoliage,
        rock,
        water,
      },
      waterFlowObserver,
    }
  }

  private _configureTerrainMaterial(
    material: StandardMaterial,
    textureUrl: string,
    tint: Color3,
  ): void {
    this._configureTexturedMaterial(material, textureUrl, 10, tint)
    material.ambientColor = new Color3(0.22, 0.22, 0.22)
    material.maxSimultaneousLights = 8
    material.backFaceCulling = false
    material.twoSidedLighting = true
  }

  private _configureTexturedMaterial(
    material: StandardMaterial,
    textureUrl: string,
    scale: number,
    tint: Color3,
  ): void {
    const texture = new Texture(textureUrl, this._context.scene)

    texture.uScale = scale
    texture.vScale = scale
    material.diffuseTexture = texture
    material.diffuseColor = tint
    material.maxSimultaneousLights = 8
    material.specularColor = Color3.Black()
  }
}
