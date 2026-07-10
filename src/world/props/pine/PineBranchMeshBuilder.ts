import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../../../app/EngineContext"
import type { PineBranchSegment } from "./PineTypes"

export class PineBranchMeshBuilder {
  public constructor(private readonly _context: EngineContext) {}

  public create(
    name: string,
    segments: readonly PineBranchSegment[],
    material: StandardMaterial,
  ): Mesh | null {
    if (segments.length === 0) {
      return null
    }

    const mesh = new Mesh(name, this._context.scene)
    const vertexData = new VertexData()
    const positions: number[] = []
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []

    for (const segment of segments) {
      this._appendBranchSegment(positions, indices, uvs, segment)
    }

    VertexData.ComputeNormals(positions, indices, normals)
    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.uvs = uvs
    vertexData.applyToMesh(mesh)

    mesh.material = material
    mesh.isPickable = false

    return mesh
  }

  private _appendBranchSegment(
    positions: number[],
    indices: number[],
    uvs: number[],
    segment: PineBranchSegment,
  ): void {
    const sides = 5
    const axis = this._normalizeVector(this._subtractVector(segment.end, segment.start))
    const reference = Math.abs(axis.y) > 0.88 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
    const normalA = this._normalizeVector(this._crossVector(reference, axis))
    const normalB = this._normalizeVector(this._crossVector(axis, normalA))
    const vertexStart = positions.length / 3

    for (let side = 0; side < sides; side += 1) {
      const angle = side * ((Math.PI * 2) / sides)
      const ringDirection = normalA.scale(Math.cos(angle)).add(normalB.scale(Math.sin(angle)))
      const start = segment.start.add(ringDirection.scale(segment.radiusStart))
      const end = segment.end.add(ringDirection.scale(segment.radiusEnd))
      const u = side / sides

      positions.push(start.x, start.y, start.z)
      positions.push(end.x, end.y, end.z)
      uvs.push(u, 0)
      uvs.push(u, 1)
    }

    for (let side = 0; side < sides; side += 1) {
      const nextSide = (side + 1) % sides
      const start0 = vertexStart + side * 2
      const end0 = start0 + 1
      const start1 = vertexStart + nextSide * 2
      const end1 = start1 + 1

      indices.push(start0, end0, start1)
      indices.push(start1, end0, end1)
    }
  }

  private _subtractVector(from: Vector3, amount: Vector3): Vector3 {
    return new Vector3(from.x - amount.x, from.y - amount.y, from.z - amount.z)
  }

  private _crossVector(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
  }

  private _normalizeVector(vector: Vector3): Vector3 {
    const length = Math.hypot(vector.x, vector.y, vector.z)

    if (length <= 0.00001) {
      return new Vector3(0, 1, 0)
    }

    return new Vector3(vector.x / length, vector.y / length, vector.z / length)
  }
}
