import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import type { EngineContext } from "../../../app/EngineContext"
import { DeterministicRandom } from "../../../utils/DeterministicRandom"
import type { GeneratedPropData } from "../../terrain/TerrainTypes"
import type { TerrainChunkMaterials } from "../../terrain/TerrainChunkMaterials"
import { PineBranchMeshBuilder } from "../pine/PineBranchMeshBuilder"
import type { PineBranchSegment } from "../pine/PineTypes"

export class LogPropBuilder {
  public constructor(
    private readonly _context: EngineContext,
    private readonly _materials: TerrainChunkMaterials,
  ) {}

  public create(prop: GeneratedPropData): Mesh[] {
    const random = DeterministicRandom.create(DeterministicRandom.hashString(`${prop.id}_log`))
    const logLength = (3.0 + random() * 0.9) * prop.scale
    const logDiameter = (0.38 + random() * 0.16) * prop.scale
    const log = MeshBuilder.CreateCylinder(
      prop.id,
      {
        height: logLength,
        diameterTop: logDiameter * (0.86 + random() * 0.12),
        diameterBottom: logDiameter,
        tessellation: 8,
      },
      this._context.scene,
    )
    const center = new Vector3(
      prop.position[0],
      prop.position[1] + logDiameter / 2,
      prop.position[2],
    )
    const branchSegments: PineBranchSegment[] = []

    log.position = center
    log.rotation.y = prop.rotationY
    log.rotation.z = Math.PI / 2
    log.material = this._materials.deadWood

    const axis = new Vector3(Math.cos(prop.rotationY), 0, -Math.sin(prop.rotationY))
    const side = new Vector3(Math.sin(prop.rotationY), 0, Math.cos(prop.rotationY))
    const stubCount = 2 + Math.floor(random() * 3)

    for (let stubIndex = 0; stubIndex < stubCount; stubIndex += 1) {
      const along = (random() - 0.5) * logLength * 0.76
      const sideSign = random() > 0.5 ? -1 : 1
      const stubLength = (0.28 + random() * 0.42) * prop.scale
      const start = center
        .add(axis.scale(along))
        .add(side.scale(sideSign * logDiameter * 0.34))
        .add(new Vector3(0, logDiameter * (0.08 + random() * 0.22), 0))
      const end = start
        .add(side.scale(sideSign * stubLength))
        .add(axis.scale((random() - 0.5) * stubLength * 0.32))
        .add(new Vector3(0, (random() - 0.35) * stubLength * 0.35, 0))
      const radius = (0.035 + random() * 0.025) * prop.scale

      branchSegments.push({
        start,
        end,
        radiusStart: radius,
        radiusEnd: radius * 0.28,
      })
    }

    const stubs = new PineBranchMeshBuilder(this._context).create(
      `${prop.id}_stubs`,
      branchSegments,
      this._materials.deadWood,
    )

    return stubs ? [log, stubs] : [log]
  }
}
