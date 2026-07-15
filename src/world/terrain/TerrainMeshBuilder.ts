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
    const materialIndices: number[][] = this._materials.terrain.map(() => [])
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

        const worldX = baseX + x * step
        const worldZ = baseZ + z * step

        positions.push(worldX, this._data.heights[index] ?? 0, worldZ)
        uvs.push(x / this._data.resolution, z / this._data.resolution)
        colors.push(
          ...this._getTerrainColor(
            this._data.terrainMaterials[index] ?? TerrainMaterial.Grass,
            worldX,
            worldZ,
          ),
        )
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

  private _getTerrainColor(
    material: number,
    worldX: number,
    worldZ: number,
  ): [number, number, number, number] {
    const patchNoise = this._valueNoise(worldX * 0.035, worldZ * 0.035, 17)
    const fineNoise = this._valueNoise(worldX * 0.12, worldZ * 0.12, 23)
    const noise = patchNoise * 0.78 + fineNoise * 0.22

    switch (material) {
      case TerrainMaterial.Dirt:
        return this._varyColor([0.42, 0.31, 0.2], noise, 0.08)
      case TerrainMaterial.Sand:
        return this._varyColor([0.63, 0.56, 0.39], noise, 0.045)
      case TerrainMaterial.PineNeedles:
        return this._varyColor([0.24, 0.21, 0.12], noise, 0.1)
      case TerrainMaterial.RiverBed:
        return this._varyColor([0.22, 0.19, 0.15], noise, 0.08)
      case TerrainMaterial.Grass:
      default:
        return this._varyGrassColor(noise)
    }
  }

  private _varyGrassColor(noise: number): [number, number, number, number] {
    const brightness = 1 + noise * 0.12
    const warmth = Math.max(noise, 0) * 0.035
    const coolness = Math.max(-noise, 0) * 0.035

    return [
      this._clamp01(0.33 * brightness + warmth),
      this._clamp01(0.44 * brightness + coolness),
      this._clamp01(0.2 * brightness - warmth * 0.45),
      1,
    ]
  }

  private _varyColor(
    color: readonly [number, number, number],
    noise: number,
    amount: number,
  ): [number, number, number, number] {
    const brightness = 1 + noise * amount

    return [
      this._clamp01(color[0] * brightness),
      this._clamp01(color[1] * brightness),
      this._clamp01(color[2] * brightness),
      1,
    ]
  }

  private _valueNoise(x: number, z: number, salt: number): number {
    const x0 = Math.floor(x)
    const z0 = Math.floor(z)
    const x1 = x0 + 1
    const z1 = z0 + 1
    const tx = this._smooth(x - x0)
    const tz = this._smooth(z - z0)
    const a = this._hashNoise(x0, z0, salt)
    const b = this._hashNoise(x1, z0, salt)
    const c = this._hashNoise(x0, z1, salt)
    const d = this._hashNoise(x1, z1, salt)
    const xMix0 = this._lerp(a, b, tx)
    const xMix1 = this._lerp(c, d, tx)

    return this._lerp(xMix0, xMix1, tz)
  }

  private _hashNoise(x: number, z: number, salt: number): number {
    let hash = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(salt, 2246822519)

    hash = Math.imul(hash ^ (hash >>> 13), 1274126177)

    return ((hash ^ (hash >>> 16)) >>> 0) / 2147483648 - 1
  }

  private _smooth(value: number): number {
    return value * value * (3 - 2 * value)
  }

  private _lerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount
  }

  private _clamp01(value: number): number {
    return Math.min(Math.max(value, 0), 1)
  }
}
