import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../../../app/EngineContext"
import { DeterministicRandom } from "../../../utils/DeterministicRandom"
import type { GeneratedPropData } from "../../terrain/TerrainTypes"
import type { TerrainChunkMaterials } from "../../terrain/TerrainChunkMaterials"

export class GrassPropBuilder {
  public constructor(
    private readonly _context: EngineContext,
    private readonly _materials: TerrainChunkMaterials,
  ) {}

  public create(prop: GeneratedPropData): Mesh {
    return this.createMany(prop.id, [prop])!
  }

  public createMany(name: string, props: readonly GeneratedPropData[]): Mesh | null {
    if (props.length === 0) {
      return null
    }

    const mesh = new Mesh(name, this._context.scene)
    const vertexData = new VertexData()
    const positions: number[] = []
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []

    for (const prop of props) {
      this._appendGrassProp(positions, indices, normals, uvs, prop)
    }

    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.uvs = uvs
    vertexData.applyToMesh(mesh)

    mesh.material = this._materials.grassFoliage
    mesh.isPickable = false

    return mesh
  }

  private _appendGrassProp(
    positions: number[],
    indices: number[],
    normals: number[],
    uvs: number[],
    prop: GeneratedPropData,
  ): void {
    const random = DeterministicRandom.create(DeterministicRandom.hashString(`${prop.id}_grass`))
    const clumpCount = 3 + Math.floor(random() * 3)

    for (let clumpIndex = 0; clumpIndex < clumpCount; clumpIndex += 1) {
      const angle = prop.rotationY + clumpIndex * ((Math.PI * 2) / clumpCount) + random() * 0.45
      const distance = random() * 0.34 * prop.scale
      const center = new Vector3(
        prop.position[0] + Math.sin(angle) * distance,
        prop.position[1] - 0.015 * prop.scale,
        prop.position[2] + Math.cos(angle) * distance,
      )
      const width = (0.22 + random() * 0.24) * prop.scale
      const height = (0.2 + random() * 0.24) * prop.scale
      const lean = (random() - 0.5) * 0.18 * prop.scale

      this._appendCrossCard(positions, indices, normals, uvs, center, angle, width, height, lean)
    }
  }

  private _appendCrossCard(
    positions: number[],
    indices: number[],
    normals: number[],
    uvs: number[],
    center: Vector3,
    rotationY: number,
    width: number,
    height: number,
    lean: number,
  ): void {
    this._appendCard(positions, indices, normals, uvs, center, rotationY, width, height, lean)
    this._appendCard(
      positions,
      indices,
      normals,
      uvs,
      center,
      rotationY + Math.PI / 2,
      width,
      height,
      -lean,
    )
  }

  private _appendCard(
    positions: number[],
    indices: number[],
    normals: number[],
    uvs: number[],
    center: Vector3,
    rotationY: number,
    width: number,
    height: number,
    lean: number,
  ): void {
    const right = new Vector3(Math.cos(rotationY), 0, -Math.sin(rotationY))
    const forward = new Vector3(Math.sin(rotationY), 0, Math.cos(rotationY))
    const halfWidth = width / 2
    const vertexStart = positions.length / 3
    const bottomLeft = center.add(right.scale(-halfWidth))
    const bottomRight = center.add(right.scale(halfWidth))
    const topOffset = forward.scale(lean)
    const topRight = bottomRight.add(new Vector3(0, height, 0)).add(topOffset)
    const topLeft = bottomLeft.add(new Vector3(0, height, 0)).add(topOffset)

    for (const point of [bottomLeft, bottomRight, topRight, topLeft]) {
      positions.push(point.x, point.y, point.z)
      normals.push(0, 0, 1)
    }

    indices.push(vertexStart, vertexStart + 1, vertexStart + 2)
    indices.push(vertexStart, vertexStart + 2, vertexStart + 3)
    indices.push(vertexStart, vertexStart + 2, vertexStart + 1)
    indices.push(vertexStart, vertexStart + 3, vertexStart + 2)
    uvs.push(0, 1, 1, 1, 1, 0, 0, 0)
  }
}
