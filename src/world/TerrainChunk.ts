import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { SubMesh } from "@babylonjs/core/Meshes/subMesh"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../app/EngineContext"
import type { WorldBounds } from "../app/GameConfig"
import { TerrainMaterial, type ChunkTerrainData, type GeneratedPropData } from "./TerrainTypes"
import type { WorldFeatureGenerator } from "./generation/WorldFeatureGenerator"

export interface TerrainChunkMaterials {
  readonly terrain: readonly StandardMaterial[]
  readonly trunk: StandardMaterial
  readonly deadWood: StandardMaterial
  readonly needles: StandardMaterial
  readonly rock: StandardMaterial
  readonly water: StandardMaterial
}

export class TerrainChunk {
  private readonly _terrainMesh: Mesh
  private readonly _props: Mesh[] = []

  public constructor(
    private readonly _context: EngineContext,
    private readonly _data: ChunkTerrainData,
    private readonly _materials: TerrainChunkMaterials,
    private readonly _worldFeatures: WorldFeatureGenerator | null = null,
  ) {
    this._terrainMesh = this._createTerrainMesh()
    this._createWaterMeshes()

    for (const prop of this._data.props) {
      this._createProp(prop)
    }
  }

  public get key(): string {
    return this._data.key
  }

  public dispose(): void {
    for (const prop of this._props) {
      prop.dispose()
    }

    this._props.length = 0
    this._terrainMesh.dispose()
  }

  private _createTerrainMesh(): Mesh {
    const mesh = new Mesh(`terrain_${this._data.key}`, this._context.scene)
    const vertexData = new VertexData()
    const positions: number[] = []
    const materialIndices: number[][] = [[], [], [], []]
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const colors: number[] = []
    const gridSize = this._data.resolution + 1
    const step = this._data.chunkSizeMeters / this._data.resolution
    const baseX = this._data.coord.x * this._data.chunkSizeMeters
    const baseZ = this._data.coord.z * this._data.chunkSizeMeters

    for (let z = 0; z < gridSize; z += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        const index = z * gridSize + x

        positions.push(baseX + x * step, this._data.heights[index] ?? 0, baseZ + z * step)
        uvs.push(x / this._data.resolution, z / this._data.resolution)
        colors.push(...this._getTerrainColor(this._data.terrainMaterials[index] ?? TerrainMaterial.Grass))
      }
    }

    for (let z = 0; z < this._data.resolution; z += 1) {
      for (let x = 0; x < this._data.resolution; x += 1) {
        const topLeft = z * gridSize + x
        const topRight = topLeft + 1
        const bottomLeft = topLeft + gridSize
        const bottomRight = bottomLeft + 1

        const material = this._getCellTerrainMaterial(topLeft, topRight, bottomLeft, bottomRight)

        materialIndices[material]?.push(topLeft, bottomLeft, topRight)
        materialIndices[material]?.push(topRight, bottomLeft, bottomRight)
      }
    }

    for (const materialIndexGroup of materialIndices) {
      indices.push(...materialIndexGroup)
    }

    VertexData.ComputeNormals(positions, indices, normals)

    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.uvs = uvs
    vertexData.colors = colors
    vertexData.applyToMesh(mesh)

    this._applyTerrainMaterials(mesh, materialIndices)
    return mesh
  }

  private _getCellTerrainMaterial(
    topLeft: number,
    topRight: number,
    bottomLeft: number,
    bottomRight: number,
  ): number {
    const counts = new Map<number, number>()

    for (const material of [topLeft, topRight, bottomLeft, bottomRight].map(
      (index) => this._data.terrainMaterials[index] ?? TerrainMaterial.Grass,
    )) {
      counts.set(material, (counts.get(material) ?? 0) + 1)
    }

    const sortedCounts = [...counts.entries()].sort((a, b) => b[1] - a[1])

    return sortedCounts[0]![0]
  }

  private _applyTerrainMaterials(
    mesh: Mesh,
    materialIndices: readonly number[][],
  ): void {
    const multiMaterial = new MultiMaterial(`terrain_materials_${this._data.key}`, this._context.scene)
    let indexStart = 0

    multiMaterial.subMaterials.push(...this._materials.terrain)
    mesh.material = multiMaterial
    mesh.subMeshes = []

    for (let materialIndex = 0; materialIndex < materialIndices.length; materialIndex += 1) {
      const indexCount = materialIndices[materialIndex]!.length

      if (indexCount === 0) {
        continue
      }

      new SubMesh(materialIndex, 0, this._data.heights.length, indexStart, indexCount, mesh)
      indexStart += indexCount
    }
  }

  private _createWaterMeshes(): void {
    if (!this._worldFeatures) {
      return
    }

    const bounds = this._getChunkBounds()
    const lakes = this._worldFeatures.getLakesIntersectingBounds(bounds)

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

      this._props.push(water)
    }
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

  private _getTerrainColor(material: number): [number, number, number, number] {
    switch (material) {
      case TerrainMaterial.Dirt:
        return [0.42, 0.31, 0.2, 1]
      case TerrainMaterial.Sand:
        return [0.63, 0.56, 0.39, 1]
      case TerrainMaterial.PineNeedles:
        return [0.24, 0.21, 0.12, 1]
      case TerrainMaterial.Grass:
      default:
        return [0.33, 0.44, 0.2, 1]
    }
  }

  private _createProp(prop: GeneratedPropData): void {
    switch (prop.type) {
      case "pine":
        this._createPineProp(prop)
        return
      case "deadPine":
        this._createDeadPineProp(prop)
        return
      case "rock":
        this._createRockProp(prop)
        return
      case "log":
        this._createLogProp(prop)
        return
    }
  }

  private _createPineProp(prop: GeneratedPropData): void {
    const position = new Vector3(prop.position[0], prop.position[1], prop.position[2])
    const trunkHeight = 9 * prop.scale
    const needlesHeight = 12 * prop.scale
    const trunk = MeshBuilder.CreateCylinder(
      `${prop.id}_trunk`,
      {
        height: trunkHeight,
        diameterTop: 0.32 * prop.scale,
        diameterBottom: 0.65 * prop.scale,
        tessellation: 6,
      },
      this._context.scene,
    )

    trunk.position = position.add(new Vector3(0, trunkHeight / 2, 0))
    trunk.rotation.y = prop.rotationY
    trunk.material = this._materials.trunk

    const needles = MeshBuilder.CreateCylinder(
      `${prop.id}_needles`,
      {
        height: needlesHeight,
        diameterTop: 0.15 * prop.scale,
        diameterBottom: 5.2 * prop.scale,
        tessellation: 8,
      },
      this._context.scene,
    )

    needles.position = position.add(new Vector3(0, trunkHeight + needlesHeight / 2 - 0.8, 0))
    needles.rotation.y = prop.rotationY
    needles.material = this._materials.needles

    this._props.push(trunk, needles)
  }

  private _createDeadPineProp(prop: GeneratedPropData): void {
    const position = new Vector3(prop.position[0], prop.position[1], prop.position[2])
    const trunkHeight = 10.4 * prop.scale
    const trunk = MeshBuilder.CreateCylinder(
      `${prop.id}_trunk`,
      {
        height: trunkHeight,
        diameterTop: 0.25 * prop.scale,
        diameterBottom: 0.7 * prop.scale,
        tessellation: 6,
      },
      this._context.scene,
    )

    trunk.position = position.add(new Vector3(0, trunkHeight / 2, 0))
    trunk.rotation.y = prop.rotationY
    trunk.material = this._materials.deadWood
    this._props.push(trunk)

    for (let branchIndex = 0; branchIndex < 3; branchIndex += 1) {
      const branchHeight = trunkHeight * (0.38 + branchIndex * 0.17)
      const branchLength = (2.1 - branchIndex * 0.32) * prop.scale
      const branch = MeshBuilder.CreateCylinder(
        `${prop.id}_branch_${branchIndex}`,
        {
          height: branchLength,
          diameterTop: 0.06 * prop.scale,
          diameterBottom: 0.12 * prop.scale,
          tessellation: 5,
        },
        this._context.scene,
      )

      branch.position = position.add(new Vector3(0, branchHeight, 0))
      branch.rotation.y = prop.rotationY + branchIndex * ((Math.PI * 2) / 3)
      branch.rotation.z = Math.PI / 2.8
      branch.material = this._materials.deadWood
      this._props.push(branch)
    }
  }

  private _createRockProp(prop: GeneratedPropData): void {
    const rock = MeshBuilder.CreateSphere(
      prop.id,
      {
        diameter: 1.2 * prop.scale,
        segments: 6,
      },
      this._context.scene,
    )

    rock.position = new Vector3(prop.position[0], prop.position[1] + 0.35 * prop.scale, prop.position[2])
    rock.rotation.y = prop.rotationY
    rock.material = this._materials.rock

    this._props.push(rock)
  }

  private _createLogProp(prop: GeneratedPropData): void {
    const logLength = 3.2 * prop.scale
    const logDiameter = 0.45 * prop.scale
    const log = MeshBuilder.CreateCylinder(
      prop.id,
      {
        height: logLength,
        diameterTop: logDiameter,
        diameterBottom: logDiameter,
        tessellation: 8,
      },
      this._context.scene,
    )

    log.position = new Vector3(prop.position[0], prop.position[1] + logDiameter / 2, prop.position[2])
    log.rotation.y = prop.rotationY
    log.rotation.z = Math.PI / 2
    log.material = this._materials.deadWood

    this._props.push(log)
  }
}
