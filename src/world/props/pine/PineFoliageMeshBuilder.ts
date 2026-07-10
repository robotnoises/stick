import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../../../app/EngineContext"
import type { TerrainChunkMaterials } from "../../terrain/TerrainChunkMaterials"
import type { PineFoliageCard } from "./PineTypes"

export class PineFoliageMeshBuilder {
  public constructor(
    private readonly _context: EngineContext,
    private readonly _materials: TerrainChunkMaterials,
  ) {}

  public create(name: string, cards: readonly PineFoliageCard[]): Mesh | null {
    if (cards.length === 0) {
      return null
    }

    const mesh = new Mesh(name, this._context.scene)
    const vertexData = new VertexData()
    const positions: number[] = []
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []

    for (const card of cards) {
      this._appendPineFoliageCard(positions, indices, uvs, card)
    }

    VertexData.ComputeNormals(positions, indices, normals)
    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.uvs = uvs
    vertexData.applyToMesh(mesh)

    mesh.material = this._materials.pineFoliage
    mesh.isPickable = false
    return mesh
  }

  private _appendPineFoliageCard(
    positions: number[],
    indices: number[],
    uvs: number[],
    card: PineFoliageCard,
  ): void {
    const forward = this._normalizeVector(
      new Vector3(
        Math.sin(card.angle) * Math.cos(card.verticalAngle),
        Math.sin(card.verticalAngle),
        Math.cos(card.angle) * Math.cos(card.verticalAngle),
      ),
    )
    const horizontalRight = this._normalizeVector(
      new Vector3(Math.cos(card.angle), 0, -Math.sin(card.angle)),
    )
    const liftedCenter = card.center.add(new Vector3(0, card.width * 0.08, 0))
    const slantedRight = this._normalizeVector(
      horizontalRight.scale(0.58).add(new Vector3(0, 0.82, 0)),
    )

    this._appendPineFoliagePlane(
      positions,
      indices,
      uvs,
      liftedCenter,
      forward,
      horizontalRight,
      card,
    )
    this._appendPineFoliagePlane(
      positions,
      indices,
      uvs,
      liftedCenter.add(new Vector3(0, card.width * 0.05, 0)),
      forward,
      slantedRight,
      card,
    )
  }

  private _appendPineFoliagePlane(
    positions: number[],
    indices: number[],
    uvs: number[],
    center: Vector3,
    forward: Vector3,
    side: Vector3,
    card: PineFoliageCard,
  ): void {
    const halfWidth = card.width / 2
    const halfLength = card.length / 2
    const vertexStart = positions.length / 3
    const rect = this._getPineFoliageUvRect(card.variant)
    const corners = [
      center.add(forward.scale(-halfLength)).add(side.scale(-halfWidth)),
      center.add(forward.scale(halfLength)).add(side.scale(-halfWidth)),
      center.add(forward.scale(halfLength)).add(side.scale(halfWidth)),
      center.add(forward.scale(-halfLength)).add(side.scale(halfWidth)),
    ]

    for (const corner of corners) {
      positions.push(corner.x, corner.y, corner.z)
    }

    indices.push(vertexStart, vertexStart + 1, vertexStart + 2)
    indices.push(vertexStart, vertexStart + 2, vertexStart + 3)
    uvs.push(rect.u1, rect.v1, rect.u0, rect.v1, rect.u0, rect.v0, rect.u1, rect.v0)
  }

  private _getPineFoliageUvRect(variant: number): {
    readonly u0: number
    readonly u1: number
    readonly v0: number
    readonly v1: number
  } {
    switch (variant % 3) {
      case 0:
        return { u0: 0.25, u1: 0.9, v0: 0.69, v1: 0.91 }
      case 1:
        return { u0: 0.08, u1: 0.96, v0: 0.39, v1: 0.68 }
      default:
        return { u0: 0.08, u1: 0.96, v0: 0.1, v1: 0.39 }
    }
  }

  private _normalizeVector(vector: Vector3): Vector3 {
    const length = Math.hypot(vector.x, vector.y, vector.z)

    return length > 0
      ? new Vector3(vector.x / length, vector.y / length, vector.z / length)
      : vector
  }

}
