import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { SubMesh } from "@babylonjs/core/Meshes/subMesh"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../app/EngineContext"
import type { WorldBounds } from "../app/GameConfig"
import { TerrainMaterial, type ChunkTerrainData, type GeneratedPropData } from "./TerrainTypes"
import type { WorldFeatureGenerator } from "./generation/WorldFeatureGenerator"

export interface TerrainChunkMaterials {
  readonly terrain: readonly StandardMaterial[]
  readonly trunk: StandardMaterial
  readonly deadWood: StandardMaterial
  readonly needles: StandardMaterial
  readonly pineFoliage: StandardMaterial
  readonly rock: StandardMaterial
  readonly water: StandardMaterial
}

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
  private readonly _terrainMesh: Mesh
  private readonly _props: Mesh[] = []

  public constructor(
    private readonly _context: EngineContext,
    private readonly _data: ChunkTerrainData,
    private readonly _materials: TerrainChunkMaterials,
    private readonly _worldFeatures: WorldFeatureGenerator | null = null,
  ) {
    this._terrainMesh = this._createTerrainMesh()
    this._createWaterMeshes()

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
    const materialIndices: number[][] = [[], [], [], []]
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

        positions.push(baseX + x * step, this._data.heights[index] ?? 0, baseZ + z * step)
        uvs.push(x / this._data.resolution, z / this._data.resolution)
        colors.push(
          ...this._getTerrainColor(this._data.terrainMaterials[index] ?? TerrainMaterial.Grass),
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
    const multiMaterial = new MultiMaterial(
      `terrain_materials_${this._data.key}`,
      this._context.scene,
    )
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

  private _createWaterMeshes(): void {
    if (!this._worldFeatures) {
      return
    }

    const bounds = this._getChunkBounds()
    const lakes = this._worldFeatures.getLakesIntersectingBounds(bounds)

    for (const lake of lakes) {
      const water = MeshBuilder.CreateGround(
        `water_${this._data.key}_${lake.id}`,
        {
          width: this._data.chunkSizeMeters,
          height: this._data.chunkSizeMeters,
          subdivisions: 1,
        },
        this._context.scene,
      )

      water.position = new Vector3(
        bounds.minX + this._data.chunkSizeMeters / 2,
        lake.waterLevelMeters,
        bounds.minZ + this._data.chunkSizeMeters / 2,
      )
      water.material = this._materials.water
      water.isPickable = false

      this._props.push(water)
    }
  }

  public _sampleChunkHeight(worldX: number, worldZ: number): number {
    const localX = worldX - this._data.coord.x * this._data.chunkSizeMeters
    const localZ = worldZ - this._data.coord.z * this._data.chunkSizeMeters
    const gridSize = this._data.resolution + 1
    const step = this._data.chunkSizeMeters / this._data.resolution
    const sampleX = Math.min(Math.max(localX / step, 0), this._data.resolution)
    const sampleZ = Math.min(Math.max(localZ / step, 0), this._data.resolution)
    const x0 = Math.floor(sampleX)
    const z0 = Math.floor(sampleZ)
    const x1 = Math.min(x0 + 1, this._data.resolution)
    const z1 = Math.min(z0 + 1, this._data.resolution)
    const tx = sampleX - x0
    const tz = sampleZ - z0
    const a = this._data.heights[z0 * gridSize + x0] ?? 0
    const b = this._data.heights[z0 * gridSize + x1] ?? a
    const c = this._data.heights[z1 * gridSize + x0] ?? a
    const d = this._data.heights[z1 * gridSize + x1] ?? c
    const xMix0 = this._lerp(a, b, tx)
    const xMix1 = this._lerp(c, d, tx)

    return this._lerp(xMix0, xMix1, tz)
  }

  private _getChunkBounds(): WorldBounds {
    const minX = this._data.coord.x * this._data.chunkSizeMeters
    const minZ = this._data.coord.z * this._data.chunkSizeMeters

    return {
      minX,
      maxX: minX + this._data.chunkSizeMeters,
      minZ,
      maxZ: minZ + this._data.chunkSizeMeters,
    }
  }

  private _getTerrainColor(material: number): [number, number, number, number] {
    switch (material) {
      case TerrainMaterial.Dirt:
        return [0.42, 0.31, 0.2, 1]
      case TerrainMaterial.Sand:
        return [0.63, 0.56, 0.39, 1]
      case TerrainMaterial.PineNeedles:
        return [0.24, 0.21, 0.12, 1]
      case TerrainMaterial.Grass:
      default:
        return [0.33, 0.44, 0.2, 1]
    }
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

    for (const segment of segments) {
      this._appendBranchSegment(positions, indices, segment)
    }

    VertexData.ComputeNormals(positions, indices, normals)
    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.applyToMesh(mesh)

    mesh.material = material
    mesh.isPickable = false
    this._props.push(mesh)
  }

  private _appendBranchSegment(
    positions: number[],
    indices: number[],
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

      positions.push(start.x, start.y, start.z)
      positions.push(end.x, end.y, end.z)
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
    const trunkHeight = 10.4 * prop.scale
    const trunk = MeshBuilder.CreateCylinder(
      `${prop.id}_trunk`,
      {
        height: trunkHeight,
        diameterTop: 0.25 * prop.scale,
        diameterBottom: 0.7 * prop.scale,
        tessellation: 6,
      },
      this._context.scene,
    )

    trunk.position = position.add(new Vector3(0, trunkHeight / 2, 0))
    trunk.rotation.y = prop.rotationY
    trunk.material = this._materials.deadWood
    this._props.push(trunk)

    for (let branchIndex = 0; branchIndex < 3; branchIndex += 1) {
      const branchHeight = trunkHeight * (0.38 + branchIndex * 0.17)
      const branchLength = (2.1 - branchIndex * 0.32) * prop.scale
      const branch = MeshBuilder.CreateCylinder(
        `${prop.id}_branch_${branchIndex}`,
        {
          height: branchLength,
          diameterTop: 0.06 * prop.scale,
          diameterBottom: 0.12 * prop.scale,
          tessellation: 5,
        },
        this._context.scene,
      )

      branch.position = position.add(new Vector3(0, branchHeight, 0))
      branch.rotation.y = prop.rotationY + branchIndex * ((Math.PI * 2) / 3)
      branch.rotation.z = Math.PI / 2.8
      branch.material = this._materials.deadWood
      this._props.push(branch)
    }
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
    const logLength = 3.2 * prop.scale
    const logDiameter = 0.45 * prop.scale
    const log = MeshBuilder.CreateCylinder(
      prop.id,
      {
        height: logLength,
        diameterTop: logDiameter,
        diameterBottom: logDiameter,
        tessellation: 8,
      },
      this._context.scene,
    )

    log.position = new Vector3(
      prop.position[0],
      prop.position[1] + logDiameter / 2,
      prop.position[2],
    )
    log.rotation.y = prop.rotationY
    log.rotation.z = Math.PI / 2
    log.material = this._materials.deadWood

    this._props.push(log)
  }
}
