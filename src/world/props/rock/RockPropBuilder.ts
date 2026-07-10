import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../../../app/EngineContext"
import { DeterministicRandom } from "../../../utils/DeterministicRandom"
import type { GeneratedPropData } from "../../terrain/TerrainTypes"
import type { TerrainChunkMaterials } from "../../terrain/TerrainChunkMaterials"

export class RockPropBuilder {
  public constructor(
    private readonly _context: EngineContext,
    private readonly _materials: TerrainChunkMaterials,
  ) {}

  public create(prop: GeneratedPropData): Mesh {
    const random = DeterministicRandom.create(DeterministicRandom.hashString(`${prop.id}_rock`))
    const rock = new Mesh(prop.id, this._context.scene)
    const vertexData = new VertexData()
    const positions: number[] = []
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const sides = 12
    const height = (0.55 + random() * 0.38) * prop.scale
    const radiusX = (0.48 + random() * 0.34) * prop.scale
    const radiusZ = (0.46 + random() * 0.38) * prop.scale
    const ringProfiles = [
      { y: -0.44, radius: 0.58 },
      { y: -0.3, radius: 0.84 },
      { y: -0.14, radius: 1.02 },
      { y: 0.06, radius: 0.96 },
      { y: 0.22, radius: 0.78 },
      { y: 0.34, radius: 0.56 },
      { y: 0.43, radius: 0.36 },
    ]

    for (let ringIndex = 0; ringIndex < ringProfiles.length; ringIndex += 1) {
      const ring = ringProfiles[ringIndex]!

      for (let side = 0; side < sides; side += 1) {
        const baseAngle = side * ((Math.PI * 2) / sides)
        const angle = baseAngle + (random() - 0.5) * 0.13
        const broadLobe = 0.72 + random() * 0.48
        const ridge = 1 + Math.sin(baseAngle * 3 + random() * Math.PI) * 0.13
        const chip = random() < 0.16 ? 0.82 + random() * 0.12 : 1
        const verticalBulge = 1 + Math.sin(ringIndex * 1.7 + side * 0.9 + random()) * 0.07
        const taper = ring.radius * broadLobe * ridge * chip * verticalBulge
        const surfaceJitter = (random() - 0.5) * prop.scale * 0.04
        const topSmoothT = ringIndex / (ringProfiles.length - 1)
        const yJitter = height * (0.1 - topSmoothT * 0.045)
        const x = Math.sin(angle) * radiusX * taper + Math.sin(angle) * surfaceJitter
        const y = ring.y * height + (random() - 0.5) * yJitter
        const z = Math.cos(angle) * radiusZ * taper + Math.cos(angle) * surfaceJitter

        positions.push(x, y, z)
        uvs.push(side / sides, ringIndex / (ringProfiles.length - 1))
      }
    }

    for (let ringIndex = 0; ringIndex < ringProfiles.length - 1; ringIndex += 1) {
      for (let side = 0; side < sides; side += 1) {
        const nextSide = (side + 1) % sides
        const current = ringIndex * sides + side
        const currentNext = ringIndex * sides + nextSide
        const above = (ringIndex + 1) * sides + side
        const aboveNext = (ringIndex + 1) * sides + nextSide

        indices.push(current, above, currentNext)
        indices.push(currentNext, above, aboveNext)
      }
    }

    this._appendCap(positions, indices, uvs, 0, sides, -0.47 * height, true)
    this._appendCap(
      positions,
      indices,
      uvs,
      (ringProfiles.length - 1) * sides,
      sides,
      0.45 * height,
      false,
    )

    VertexData.ComputeNormals(positions, indices, normals)
    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.uvs = uvs
    vertexData.applyToMesh(rock)

    rock.position = new Vector3(
      prop.position[0],
      prop.position[1] + height * (0.32 + random() * 0.08),
      prop.position[2],
    )
    rock.rotation.y = prop.rotationY + (random() - 0.5) * 0.5
    rock.scaling = new Vector3(1, 0.9 + random() * 0.22, 0.88 + random() * 0.24)
    rock.material = this._materials.rock
    rock.isPickable = false

    return rock
  }

  private _appendCap(
    positions: number[],
    indices: number[],
    uvs: number[],
    ringStart: number,
    sides: number,
    y: number,
    isBottom: boolean,
  ): void {
    const centerIndex = positions.length / 3

    positions.push(0, y, 0)
    uvs.push(0.5, 0.5)

    for (let side = 0; side < sides; side += 1) {
      const nextSide = (side + 1) % sides

      if (isBottom) {
        indices.push(centerIndex, ringStart + side, ringStart + nextSide)
      } else {
        indices.push(centerIndex, ringStart + nextSide, ringStart + side)
      }
    }
  }
}
