import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import type { EngineContext } from "../../../app/EngineContext"
import { DeterministicRandom } from "../../../utils/DeterministicRandom"
import type { GeneratedPropData } from "../../terrain/TerrainTypes"
import type { TerrainChunkMaterials } from "../../terrain/TerrainChunkMaterials"
import { PineBranchMeshBuilder } from "./PineBranchMeshBuilder"
import { PineFoliageMeshBuilder } from "./PineFoliageMeshBuilder"
import type { PineBranchSegment, PineFoliageCard, PineProfile } from "./PineTypes"

export class PinePropBuilder {
  private readonly _meshes: Mesh[] = []

  public constructor(
    private readonly _context: EngineContext,
    private readonly _materials: TerrainChunkMaterials,
  ) {}

  public create(prop: GeneratedPropData): Mesh[] {
    const position = new Vector3(prop.position[0], prop.position[1], prop.position[2])
    const random = DeterministicRandom.create(DeterministicRandom.hashString(prop.id))
    const profile = this._createPineProfile(prop.scale, random)
    const trunkHeight = profile.heightMeters
    const crownBaseHeight = trunkHeight * profile.crownBaseFactor
    const crownHeight = trunkHeight - crownBaseHeight
    const maxBranchLength = profile.maxBranchLength
    const whorlCount = profile.whorlCount
    const branchSegments: PineBranchSegment[] = []
    const foliageCards: PineFoliageCard[] = []
    const trunk = MeshBuilder.CreateCylinder(
      `${prop.id}_trunk`,
      {
        height: trunkHeight,
        diameterTop: 0.09 * prop.scale,
        diameterBottom: 0.62 * prop.scale,
        tessellation: 7,
      },
      this._context.scene,
    )

    trunk.position = position.add(new Vector3(0, trunkHeight / 2, 0))
    trunk.rotation.y = prop.rotationY
    trunk.material = this._materials.trunk
    this._meshes.push(trunk)

    for (let whorlIndex = 0; whorlIndex < whorlCount; whorlIndex += 1) {
      const crownT = (whorlIndex + 0.15) / whorlCount
      const branchHeight = crownBaseHeight + crownHeight * crownT
      const branchesInWhorl = this._getPineBranchesInWhorl(profile, crownT)
      const whorlRotation = prop.rotationY + whorlIndex * 1.48 + (random() - 0.5) * 0.28

      for (let branchIndex = 0; branchIndex < branchesInWhorl; branchIndex += 1) {
        const angle =
          whorlRotation + branchIndex * ((Math.PI * 2) / branchesInWhorl) + (random() - 0.5) * 0.28
        const branchLength = this._getPineBranchLength(maxBranchLength, crownT, random())
        const missingBranchChance = profile.missingBranchChance * this._lerp(0.65, 1.25, crownT)

        if (random() < missingBranchChance || branchLength < 0.3 * prop.scale) {
          continue
        }

        const verticalAngle =
          this._lerp(profile.lowerBranchAngle, profile.upperBranchAngle, crownT) +
          (random() - 0.5) * 0.12
        const start = position.add(new Vector3(0, branchHeight, 0))
        const horizontalLength = Math.cos(verticalAngle) * branchLength
        const end = position.add(
          new Vector3(
            Math.sin(angle) * horizontalLength,
            branchHeight + Math.sin(verticalAngle) * branchLength,
            Math.cos(angle) * horizontalLength,
          ),
        )
        const branchRadius = this._getPineBranchRadius(branchLength, prop.scale, crownT)
        const branchTipRadius = Math.max(0.012 * prop.scale, branchRadius * 0.28)
        const branchSag = profile.branchSag * (0.35 + (1 - crownT) * 0.85)
        const branchMid = this._lerpVector(start, end, 0.48).add(new Vector3(0, -branchSag, 0))

        branchSegments.push({
          start,
          end: branchMid,
          radiusStart: branchRadius,
          radiusEnd: branchRadius * 0.62,
        })
        branchSegments.push({
          start: branchMid,
          end,
          radiusStart: branchRadius * 0.62,
          radiusEnd: branchTipRadius,
        })
        foliageCards.push({
          center: this._lerpVector(start, end, 0.66 + random() * 0.12),
          angle: angle + (random() - 0.5) * 0.16,
          verticalAngle,
          width: (0.48 + random() * 0.16) * prop.scale * profile.foliageScale * (1 - crownT * 0.18),
          length: (1.35 + random() * 0.4) * prop.scale * profile.foliageScale * (1 - crownT * 0.24),
          variant: Math.floor(random() * 3),
        })
        foliageCards.push({
          center: this._lerpVector(start, end, 0.86 + random() * 0.1),
          angle: angle + (random() - 0.5) * 0.24,
          verticalAngle: verticalAngle + 0.05,
          width: (0.42 + random() * 0.12) * prop.scale * profile.foliageScale * (1 - crownT * 0.18),
          length:
            (1.05 + random() * 0.28) * prop.scale * profile.foliageScale * (1 - crownT * 0.28),
          variant: Math.floor(random() * 3),
        })

        if (random() < profile.twigChance && crownT < 0.88) {
          const side = random() > 0.5 ? -1 : 1
          const twigAngle = angle + side * (0.48 + random() * 0.32)
          const twigLength = branchLength * (0.16 + random() * 0.08)
          const twigStart = this._lerpVector(start, end, 0.56 + random() * 0.26)
          const twigEnd = twigStart.add(
            new Vector3(
              Math.sin(twigAngle) * twigLength,
              (0.04 + random() * 0.12) * prop.scale,
              Math.cos(twigAngle) * twigLength,
            ),
          )

          branchSegments.push({
            start: twigStart,
            end: twigEnd,
            radiusStart: branchRadius * 0.38,
            radiusEnd: Math.max(0.008 * prop.scale, branchRadius * 0.14),
          })
          foliageCards.push({
            center: twigEnd,
            angle: twigAngle,
            verticalAngle: verticalAngle + 0.08,
            width:
              (0.36 + random() * 0.12) * prop.scale * profile.foliageScale * (1 - crownT * 0.18),
            length:
              (0.86 + random() * 0.24) * prop.scale * profile.foliageScale * (1 - crownT * 0.28),
            variant: Math.floor(random() * 3),
          })
        }
      }
    }

    this._addPineTopLeader(
      position,
      trunkHeight,
      prop.rotationY,
      prop.scale,
      random,
      profile,
      branchSegments,
      foliageCards,
    )
    this._createPineBranchMesh(`${prop.id}_branches`, branchSegments, this._materials.trunk)
    this._createPineFoliageMesh(`${prop.id}_foliage`, foliageCards)

    return this._meshes
  }

  private _createPineProfile(scale: number, random: () => number): PineProfile {
    const roll = random()

    if (roll < 0.18) {
      return {
        heightMeters: (8.2 + random() * 2.2) * scale,
        crownBaseFactor: 0.16 + random() * 0.06,
        maxBranchLength: (1.85 + random() * 0.55) * scale,
        whorlCount: Math.max(9, Math.round(10 + scale * 4.8)),
        lowerBranchCount: 5,
        middleBranchCount: 5,
        upperBranchCount: 4,
        lowerBranchAngle: -0.12,
        upperBranchAngle: 0.5,
        branchSag: 0.09 * scale,
        missingBranchChance: 0.03,
        twigChance: 0.78,
        foliageScale: 1.12,
        topBranchCount: 7,
        topLeaderHeight: 0.82 * scale,
      }
    }

    if (roll < 0.72) {
      return {
        heightMeters: (9.8 + random() * 2.7) * scale,
        crownBaseFactor: 0.24 + random() * 0.08,
        maxBranchLength: (2.2 + random() * 0.7) * scale,
        whorlCount: Math.max(9, Math.round(9 + scale * 4.5)),
        lowerBranchCount: 4,
        middleBranchCount: 5,
        upperBranchCount: 4,
        lowerBranchAngle: -0.28,
        upperBranchAngle: 0.42,
        branchSag: 0.16 * scale,
        missingBranchChance: 0.06,
        twigChance: 0.66,
        foliageScale: 1,
        topBranchCount: 6,
        topLeaderHeight: 0.68 * scale,
      }
    }

    if (roll < 0.9) {
      return {
        heightMeters: (11.6 + random() * 3.2) * scale,
        crownBaseFactor: 0.36 + random() * 0.12,
        maxBranchLength: (2.35 + random() * 0.85) * scale,
        whorlCount: Math.max(8, Math.round(8 + scale * 3.8)),
        lowerBranchCount: 3,
        middleBranchCount: 4,
        upperBranchCount: 4,
        lowerBranchAngle: -0.36,
        upperBranchAngle: 0.36,
        branchSag: 0.22 * scale,
        missingBranchChance: 0.1,
        twigChance: 0.54,
        foliageScale: 0.96,
        topBranchCount: 5,
        topLeaderHeight: 0.78 * scale,
      }
    }

    return {
      heightMeters: (10.4 + random() * 2.8) * scale,
      crownBaseFactor: 0.3 + random() * 0.13,
      maxBranchLength: (1.9 + random() * 0.6) * scale,
      whorlCount: Math.max(7, Math.round(7 + scale * 3.4)),
      lowerBranchCount: 3,
      middleBranchCount: 4,
      upperBranchCount: 3,
      lowerBranchAngle: -0.32,
      upperBranchAngle: 0.32,
      branchSag: 0.19 * scale,
      missingBranchChance: 0.2,
      twigChance: 0.42,
      foliageScale: 0.78,
      topBranchCount: 4,
      topLeaderHeight: 0.58 * scale,
    }
  }

  private _getPineBranchesInWhorl(profile: PineProfile, crownT: number): number {
    if (crownT < 0.16) {
      return profile.lowerBranchCount
    }

    if (crownT > 0.82) {
      return profile.upperBranchCount
    }

    return profile.middleBranchCount
  }

  private _addPineTopLeader(
    position: Vector3,
    trunkHeight: number,
    rotationY: number,
    scale: number,
    random: () => number,
    profile: PineProfile,
    branchSegments: PineBranchSegment[],
    foliageCards: PineFoliageCard[],
  ): void {
    const leaderBase = position.add(new Vector3(0, trunkHeight - 0.7 * scale, 0))
    const leaderTip = position.add(new Vector3(0, trunkHeight + profile.topLeaderHeight, 0))

    branchSegments.push({
      start: leaderBase,
      end: leaderTip,
      radiusStart: 0.05 * scale,
      radiusEnd: 0.006 * scale,
    })

    for (let index = 0; index < profile.topBranchCount; index += 1) {
      const topT = index / Math.max(profile.topBranchCount - 1, 1)
      const angle = rotationY + index * 2.399 + (random() - 0.5) * 0.32
      const height = trunkHeight - 0.55 * scale + topT * 0.82 * scale
      const reach = (0.58 - topT * 0.28) * scale
      const start = position.add(new Vector3(0, height, 0))
      const end = position.add(
        new Vector3(
          Math.sin(angle) * reach,
          height + (0.16 + topT * 0.18) * scale,
          Math.cos(angle) * reach,
        ),
      )

      branchSegments.push({
        start,
        end,
        radiusStart: (0.028 - topT * 0.01) * scale,
        radiusEnd: 0.006 * scale,
      })
      foliageCards.push({
        center: this._lerpVector(start, end, 0.72),
        angle,
        verticalAngle: 0.42 + topT * 0.18,
        width: (0.34 - topT * 0.06) * scale,
        length: (0.78 - topT * 0.16) * scale,
        variant: Math.floor(random() * 3),
      })
    }
  }

  private _getPineBranchLength(maxBranchLength: number, crownT: number, roll: number): number {
    const lengthFactor = Math.max(0.14, Math.pow(1 - crownT, 0.85))
    const bottomFade = Math.min(Math.max(crownT / 0.18, 0.58), 1)
    const randomJitter = 0.84 + roll * 0.24

    return maxBranchLength * lengthFactor * bottomFade * randomJitter
  }

  private _getPineBranchRadius(branchLength: number, scale: number, crownT: number): number {
    return (0.026 * scale + branchLength * 0.006) * (1 - crownT * 0.24)
  }

  private _createPineBranchMesh(
    name: string,
    segments: readonly PineBranchSegment[],
    material: StandardMaterial,
  ): void {
    const mesh = new PineBranchMeshBuilder(this._context).create(name, segments, material)

    if (mesh) {
      this._meshes.push(mesh)
    }
  }

  private _createPineFoliageMesh(name: string, cards: readonly PineFoliageCard[]): void {
    const mesh = new PineFoliageMeshBuilder(this._context, this._materials).create(name, cards)

    if (mesh) {
      this._meshes.push(mesh)
    }
  }

  private _lerpVector(from: Vector3, to: Vector3, amount: number): Vector3 {
    return new Vector3(
      this._lerp(from.x, to.x, amount),
      this._lerp(from.y, to.y, amount),
      this._lerp(from.z, to.z, amount),
    )
  }

  private _lerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount
  }
}
