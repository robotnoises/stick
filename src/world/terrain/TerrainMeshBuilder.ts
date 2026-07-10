import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { SubMesh } from "@babylonjs/core/Meshes/subMesh"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../../app/EngineContext"
import { TerrainMaterial, type ChunkTerrainData } from "./TerrainTypes"
import type { TerrainChunkMaterials } from "./TerrainChunkMaterials"

export class TerrainMeshBuilder {
  public constructor(
    private readonly _context: EngineContext,
    private readonly _data: ChunkTerrainData,
    private readonly _materials: TerrainChunkMaterials,
  ) {}

  public create(): Mesh {
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

  private _applyTerrainMaterials(mesh: Mesh, materialIndices: readonly number[][]): void {
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
}
