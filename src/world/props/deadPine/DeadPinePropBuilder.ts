import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import type { EngineContext } from "../../../app/EngineContext"
import { DeterministicRandom } from "../../../utils/DeterministicRandom"
import type { PineBranchSegment } from "../pine/PineTypes"
import type { GeneratedPropData } from "../../TerrainTypes"
import type { TerrainChunkMaterials } from "../../terrain/TerrainChunkMaterials"
import { PineBranchMeshBuilder } from "../pine/PineBranchMeshBuilder"

export class DeadPinePropBuilder {
  public constructor(
    private readonly _context: EngineContext,
    private readonly _materials: TerrainChunkMaterials,
  ) {}

  public create(prop: GeneratedPropData): Mesh[] {
    const position = new Vector3(prop.position[0], prop.position[1], prop.position[2])
    const random = DeterministicRandom.create(DeterministicRandom.hashString(`${prop.id}_dead`))
    const trunkHeight = (8.8 + random() * 3.4) * prop.scale
    const trunk = MeshBuilder.CreateCylinder(
      `${prop.id}_trunk`,
      {
        height: trunkHeight,
        diameterTop: (0.09 + random() * 0.12) * prop.scale,
        diameterBottom: 0.68 * prop.scale,
        tessellation: 6,
      },
      this._context.scene,
    )
    const branchSegments: PineBranchSegment[] = []
    const whorlCount = 5 + Math.floor(random() * 4)

    trunk.position = position.add(new Vector3(0, trunkHeight / 2, 0))
    trunk.rotation.y = prop.rotationY
    trunk.material = this._materials.deadWood

    for (let whorlIndex = 0; whorlIndex < whorlCount; whorlIndex += 1) {
      const heightT = 0.2 + (whorlIndex / Math.max(whorlCount - 1, 1)) * 0.68
      const branchCount = 1 + Math.floor(random() * 3)
      const whorlRotation = prop.rotationY + whorlIndex * 1.76 + random() * 0.5

      for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
        if (random() < 0.34) {
          continue
        }

        const angle =
          whorlRotation + branchIndex * ((Math.PI * 2) / branchCount) + (random() - 0.5) * 0.55
        const length = (0.85 + random() * 1.65) * prop.scale * (1 - heightT * 0.35)
        const droop = (0.08 + random() * 0.34) * prop.scale
        const start = position.add(new Vector3(0, trunkHeight * heightT, 0))
        const mid = position.add(
          new Vector3(
            Math.sin(angle) * length * 0.52,
            trunkHeight * heightT - droop * 0.35,
            Math.cos(angle) * length * 0.52,
          ),
        )
        const end = position.add(
          new Vector3(
            Math.sin(angle) * length,
            trunkHeight * heightT - droop,
            Math.cos(angle) * length,
          ),
        )
        const radius = (0.035 + length * 0.018) * prop.scale

        branchSegments.push({
          start,
          end: mid,
          radiusStart: radius,
          radiusEnd: radius * 0.62,
        })
        branchSegments.push({
          start: mid,
          end,
          radiusStart: radius * 0.62,
          radiusEnd: Math.max(0.012 * prop.scale, radius * 0.24),
        })
      }
    }

    if (random() > 0.45) {
      const snagBase = position.add(new Vector3(0, trunkHeight - 0.5 * prop.scale, 0))
      const snagAngle = prop.rotationY + random() * Math.PI * 2
      const snagTip = snagBase.add(
        new Vector3(
          Math.sin(snagAngle) * 0.22 * prop.scale,
          0.72 * prop.scale,
          Math.cos(snagAngle) * 0.22 * prop.scale,
        ),
      )

      branchSegments.push({
        start: snagBase,
        end: snagTip,
        radiusStart: 0.07 * prop.scale,
        radiusEnd: 0.01 * prop.scale,
      })
    }

    const branches = new PineBranchMeshBuilder(this._context).create(
      `${prop.id}_dead_branches`,
      branchSegments,
      this._materials.deadWood,
    )

    return branches ? [trunk, branches] : [trunk]
  }
}
