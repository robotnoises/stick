import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../app/EngineContext"
import type { ChunkTerrainData, GeneratedPropData } from "./TerrainTypes"

export interface TerrainChunkMaterials {
  readonly terrain: StandardMaterial
  readonly trunk: StandardMaterial
  readonly needles: StandardMaterial
}

export class TerrainChunk {
  private readonly _terrainMesh: Mesh
  private readonly _props: Mesh[] = []

  public constructor(
    private readonly _context: EngineContext,
    private readonly _data: ChunkTerrainData,
    private readonly _materials: TerrainChunkMaterials,
  ) {
    this._terrainMesh = this._createTerrainMesh()

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
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const gridSize = this._data.resolution + 1
    const step = this._data.chunkSizeMeters / this._data.resolution
    const baseX = this._data.coord.x * this._data.chunkSizeMeters
    const baseZ = this._data.coord.z * this._data.chunkSizeMeters

    for (let z = 0; z < gridSize; z += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        const index = z * gridSize + x

        positions.push(baseX + x * step, this._data.heights[index] ?? 0, baseZ + z * step)
        uvs.push(x / this._data.resolution, z / this._data.resolution)
      }
    }

    for (let z = 0; z < this._data.resolution; z += 1) {
      for (let x = 0; x < this._data.resolution; x += 1) {
        const topLeft = z * gridSize + x
        const topRight = topLeft + 1
        const bottomLeft = topLeft + gridSize
        const bottomRight = bottomLeft + 1

        indices.push(topLeft, bottomLeft, topRight)
        indices.push(topRight, bottomLeft, bottomRight)
      }
    }

    VertexData.ComputeNormals(positions, indices, normals)

    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.uvs = uvs
    vertexData.applyToMesh(mesh)

    mesh.material = this._materials.terrain
    return mesh
  }

  private _createProp(prop: GeneratedPropData): void {
    if (prop.type !== "pine") {
      return
    }

    const position = new Vector3(prop.position[0], prop.position[1], prop.position[2])
    const trunkHeight = 4.5 * prop.scale
    const needlesHeight = 6 * prop.scale
    const trunk = MeshBuilder.CreateCylinder(
      `${prop.id}_trunk`,
      {
        height: trunkHeight,
        diameterTop: 0.25 * prop.scale,
        diameterBottom: 0.45 * prop.scale,
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
        diameterTop: 0.1 * prop.scale,
        diameterBottom: 3.4 * prop.scale,
        tessellation: 8,
      },
      this._context.scene,
    )

    needles.position = position.add(new Vector3(0, trunkHeight + needlesHeight / 2 - 0.8, 0))
    needles.rotation.y = prop.rotationY
    needles.material = this._materials.needles

    this._props.push(trunk, needles)
  }
}
