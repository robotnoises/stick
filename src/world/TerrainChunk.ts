import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../app/EngineContext"
import { TerrainMaterial, type ChunkTerrainData, type GeneratedPropData } from "./TerrainTypes"
import type { WorldFeatureGenerator } from "./generation/WorldFeatureGenerator"
import { ChunkHeightSampler } from "./terrain/ChunkHeightSampler"
import { TerrainMeshBuilder } from "./terrain/TerrainMeshBuilder"
import type { TerrainChunkMaterials } from "./terrain/TerrainChunkMaterials"
import { WaterMeshBuilder } from "./water/WaterMeshBuilder"

export type { TerrainChunkMaterials } from "./terrain/TerrainChunkMaterials"

interface PineBranchSegment {
  readonly start: Vector3
  readonly end: Vector3
  readonly radiusStart: number
  readonly radiusEnd: number
}

interface PineFoliageCard {
  readonly center: Vector3
  readonly angle: number
  readonly verticalAngle: number
  readonly width: number
  readonly length: number
  readonly variant: number
}

interface GroundLitterCard {
  readonly center: Vector3
  readonly rotationY: number
  readonly width: number
  readonly depth: number
  readonly variant: number
}

interface PineProfile {
  readonly heightMeters: number
  readonly crownBaseFactor: number
  readonly maxBranchLength: number
  readonly whorlCount: number
  readonly lowerBranchCount: number
  readonly middleBranchCount: number
  readonly upperBranchCount: number
  readonly lowerBranchAngle: number
  readonly upperBranchAngle: number
  readonly branchSag: number
  readonly missingBranchChance: number
  readonly twigChance: number
  readonly foliageScale: number
  readonly topBranchCount: number
  readonly topLeaderHeight: number
}

export class TerrainChunk {
  private readonly _heightSampler: ChunkHeightSampler
  private readonly _terrainMesh: Mesh
  private readonly _props: Mesh[] = []

  public constructor(
    private readonly _context: EngineContext,
    private readonly _data: ChunkTerrainData,
    private readonly _materials: TerrainChunkMaterials,
    private readonly _worldFeatures: WorldFeatureGenerator | null = null,
  ) {
    this._heightSampler = new ChunkHeightSampler(this._data)
    this._terrainMesh = this._createTerrainMesh()
    this._props.push(...this._createWaterMeshes())

    for (const prop of this._data.props) {
      this._createProp(prop)
    }

    this._createGroundLitterMesh()
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
    return new TerrainMeshBuilder(this._context, this._data, this._materials).create()
  }

  private _createWaterMeshes(): Mesh[] {
    return new WaterMeshBuilder(this._context, this._data, this._materials, this._worldFeatures).create()
  }

  public _sampleChunkHeight(worldX: number, worldZ: number): number {
    return this._heightSampler.sample(worldX, worldZ)
  }

  private _lerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount
  }

  private _createProp(prop: GeneratedPropData): void {
    switch (prop.type) {
      case "pine":
        this._createPineProp(prop)
        return
      case "deadPine":
        this._createDeadPineProp(prop)
        return
      case "rock":
        this._createRockProp(prop)
        return
      case "log":
        this._createLogProp(prop)
        return
    }
  }

  private _createPineProp(prop: GeneratedPropData): void {
    const position = new Vector3(prop.position[0], prop.position[1], prop.position[2])
    const random = this._createRandom(this._hashString(prop.id))
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
    this._props.push(trunk)

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
    if (segments.length === 0) {
      return
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
    this._props.push(mesh)
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

  private _createPineFoliageMesh(name: string, cards: readonly PineFoliageCard[]): void {
    if (cards.length === 0) {
      return
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
    this._props.push(mesh)
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

  private _createGroundLitterMesh(): void {
    const cards: GroundLitterCard[] = []

    for (const prop of this._data.props) {
      switch (prop.type) {
        case "pine":
          this._addTreeGroundLitterCards(prop, 5, 10, cards)
          break
        case "deadPine":
          this._addTreeGroundLitterCards(prop, 3, 6, cards)
          break
        case "log":
          this._addLogGroundLitterCards(prop, cards)
          break
        case "rock":
          break
      }
    }

    this._addForestFloorGroundLitterCards(cards)

    if (cards.length === 0) {
      return
    }

    const mesh = new Mesh(`pine_litter_${this._data.key}`, this._context.scene)
    const vertexData = new VertexData()
    const positions: number[] = []
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []

    for (const card of cards) {
      this._appendGroundLitterCard(positions, indices, uvs, card)
    }

    VertexData.ComputeNormals(positions, indices, normals)
    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.uvs = uvs
    vertexData.applyToMesh(mesh)

    mesh.material = this._materials.pineNeedleLitter
    mesh.isPickable = false
    this._props.push(mesh)
  }

  private _addTreeGroundLitterCards(
    prop: GeneratedPropData,
    minCards: number,
    maxCards: number,
    cards: GroundLitterCard[],
  ): void {
    const random = this._createRandom(this._hashString(`${prop.id}_ground_litter`))
    const cardCount = minCards + Math.floor(random() * (maxCards - minCards + 1))

    for (let index = 0; index < cardCount; index += 1) {
      const angle = random() * Math.PI * 2
      const radius = (0.45 + random() * 2.15) * prop.scale
      const worldX = prop.position[0] + Math.sin(angle) * radius
      const worldZ = prop.position[2] + Math.cos(angle) * radius
      const size = (0.62 + random() * 0.88) * prop.scale

      cards.push({
        center: new Vector3(worldX, this._sampleChunkHeight(worldX, worldZ) + 0.035, worldZ),
        rotationY: random() * Math.PI * 2,
        width: size * (0.8 + random() * 0.45),
        depth: size * (0.62 + random() * 0.38),
        variant: Math.floor(random() * 6),
      })
    }
  }

  private _addLogGroundLitterCards(prop: GeneratedPropData, cards: GroundLitterCard[]): void {
    const random = this._createRandom(this._hashString(`${prop.id}_ground_litter`))
    const cardCount = 4 + Math.floor(random() * 4)
    const axis = new Vector3(Math.cos(prop.rotationY), 0, -Math.sin(prop.rotationY))
    const side = new Vector3(Math.sin(prop.rotationY), 0, Math.cos(prop.rotationY))
    const logLength = 3.2 * prop.scale

    for (let index = 0; index < cardCount; index += 1) {
      const along = (random() - 0.5) * logLength
      const offset = (random() > 0.5 ? -1 : 1) * (0.34 + random() * 0.55) * prop.scale
      const worldX = prop.position[0] + axis.x * along + side.x * offset
      const worldZ = prop.position[2] + axis.z * along + side.z * offset
      const size = (0.54 + random() * 0.68) * prop.scale

      cards.push({
        center: new Vector3(worldX, this._sampleChunkHeight(worldX, worldZ) + 0.035, worldZ),
        rotationY: prop.rotationY + (random() - 0.5) * 1.2,
        width: size * (1.05 + random() * 0.5),
        depth: size * (0.5 + random() * 0.35),
        variant: Math.floor(random() * 6),
      })
    }
  }

  private _addForestFloorGroundLitterCards(cards: GroundLitterCard[]): void {
    const random = this._createRandom(this._hashString(`${this._data.key}_forest_floor_litter`))
    const baseX = this._data.coord.x * this._data.chunkSizeMeters
    const baseZ = this._data.coord.z * this._data.chunkSizeMeters
    const candidateCount = Math.max(6, Math.round(this._data.chunkSizeMeters / 4))

    for (let index = 0; index < candidateCount; index += 1) {
      const worldX = baseX + random() * this._data.chunkSizeMeters
      const worldZ = baseZ + random() * this._data.chunkSizeMeters

      if (this._sampleChunkTerrainMaterial(worldX, worldZ) !== TerrainMaterial.PineNeedles) {
        continue
      }

      if (random() > 0.56) {
        continue
      }

      const size = 0.42 + random() * 0.82

      cards.push({
        center: new Vector3(worldX, this._sampleChunkHeight(worldX, worldZ) + 0.032, worldZ),
        rotationY: random() * Math.PI * 2,
        width: size * (0.95 + random() * 0.58),
        depth: size * (0.5 + random() * 0.32),
        variant: Math.floor(random() * 6),
      })
    }
  }

  private _appendGroundLitterCard(
    positions: number[],
    indices: number[],
    uvs: number[],
    card: GroundLitterCard,
  ): void {
    const right = new Vector3(Math.cos(card.rotationY), 0, -Math.sin(card.rotationY))
    const forward = new Vector3(Math.sin(card.rotationY), 0, Math.cos(card.rotationY))
    const halfWidth = card.width / 2
    const halfDepth = card.depth / 2
    const vertexStart = positions.length / 3
    const rect = this._getGroundLitterUvRect(card.variant)
    const corners = [
      card.center.add(right.scale(-halfWidth)).add(forward.scale(-halfDepth)),
      card.center.add(right.scale(halfWidth)).add(forward.scale(-halfDepth)),
      card.center.add(right.scale(halfWidth)).add(forward.scale(halfDepth)),
      card.center.add(right.scale(-halfWidth)).add(forward.scale(halfDepth)),
    ]

    for (const corner of corners) {
      positions.push(corner.x, corner.y, corner.z)
    }

    indices.push(vertexStart, vertexStart + 2, vertexStart + 1)
    indices.push(vertexStart, vertexStart + 3, vertexStart + 2)
    uvs.push(rect.u0, rect.v1, rect.u1, rect.v1, rect.u1, rect.v0, rect.u0, rect.v0)
  }

  private _getGroundLitterUvRect(variant: number): {
    readonly u0: number
    readonly u1: number
    readonly v0: number
    readonly v1: number
  } {
    switch (variant % 6) {
      case 0:
        return { u0: 0.02, u1: 0.48, v0: 0.66, v1: 0.92 }
      case 1:
        return { u0: 0.5, u1: 0.96, v0: 0.66, v1: 0.92 }
      case 2:
        return { u0: 0.02, u1: 0.48, v0: 0.38, v1: 0.64 }
      case 3:
        return { u0: 0.5, u1: 0.96, v0: 0.38, v1: 0.64 }
      case 4:
        return { u0: 0.02, u1: 0.48, v0: 0.08, v1: 0.34 }
      default:
        return { u0: 0.5, u1: 0.96, v0: 0.08, v1: 0.34 }
    }
  }

  private _sampleChunkTerrainMaterial(worldX: number, worldZ: number): number {
    const localX = worldX - this._data.coord.x * this._data.chunkSizeMeters
    const localZ = worldZ - this._data.coord.z * this._data.chunkSizeMeters
    const gridSize = this._data.resolution + 1
    const step = this._data.chunkSizeMeters / this._data.resolution
    const sampleX = Math.min(Math.max(Math.round(localX / step), 0), this._data.resolution)
    const sampleZ = Math.min(Math.max(Math.round(localZ / step), 0), this._data.resolution)

    return this._data.terrainMaterials[sampleZ * gridSize + sampleX] ?? TerrainMaterial.Grass
  }

  private _subtractVector(from: Vector3, amount: Vector3): Vector3 {
    return new Vector3(from.x - amount.x, from.y - amount.y, from.z - amount.z)
  }

  private _crossVector(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
  }

  private _normalizeVector(vector: Vector3): Vector3 {
    const length = Math.hypot(vector.x, vector.y, vector.z)

    return length > 0
      ? new Vector3(vector.x / length, vector.y / length, vector.z / length)
      : vector
  }

  private _lerpVector(from: Vector3, to: Vector3, amount: number): Vector3 {
    return new Vector3(
      this._lerp(from.x, to.x, amount),
      this._lerp(from.y, to.y, amount),
      this._lerp(from.z, to.z, amount),
    )
  }

  private _hashString(value: string): number {
    let hash = 2166136261

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }

    return hash >>> 0
  }

  private _createRandom(seed: number): () => number {
    let state = seed >>> 0

    return () => {
      state = (state + 0x6d2b79f5) >>> 0

      let value = state

      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

      return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }
  }

  private _createDeadPineProp(prop: GeneratedPropData): void {
    const position = new Vector3(prop.position[0], prop.position[1], prop.position[2])
    const random = this._createRandom(this._hashString(`${prop.id}_dead`))
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
    this._props.push(trunk)

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

    this._createPineBranchMesh(`${prop.id}_dead_branches`, branchSegments, this._materials.deadWood)
  }

  private _createRockProp(prop: GeneratedPropData): void {
    const rock = MeshBuilder.CreateSphere(
      prop.id,
      {
        diameter: 1.2 * prop.scale,
        segments: 6,
      },
      this._context.scene,
    )

    rock.position = new Vector3(
      prop.position[0],
      prop.position[1] + 0.35 * prop.scale,
      prop.position[2],
    )
    rock.rotation.y = prop.rotationY
    rock.material = this._materials.rock

    this._props.push(rock)
  }

  private _createLogProp(prop: GeneratedPropData): void {
    const random = this._createRandom(this._hashString(`${prop.id}_log`))
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

    this._props.push(log)

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

    this._createPineBranchMesh(`${prop.id}_stubs`, branchSegments, this._materials.deadWood)
  }
}
