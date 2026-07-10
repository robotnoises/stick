import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../../../app/EngineContext"
import { DeterministicRandom } from "../../../utils/DeterministicRandom"
import { TerrainMaterial, type ChunkTerrainData, type GeneratedPropData } from "../../terrain/TerrainTypes"
import { TerrainChunkHeightSampler } from "../../terrain/TerrainChunkHeightSampler"
import type { TerrainChunkMaterials } from "../../terrain/TerrainChunkMaterials"

interface GroundLitterCard {
  readonly center: Vector3
  readonly rotationY: number
  readonly width: number
  readonly depth: number
  readonly variant: number
}

export class GroundLitterBuilder {
  private readonly _heightSampler: TerrainChunkHeightSampler

  public constructor(
    private readonly _context: EngineContext,
    private readonly _data: ChunkTerrainData,
    private readonly _materials: TerrainChunkMaterials,
  ) {
    this._heightSampler = new TerrainChunkHeightSampler(this._data)
  }

  public create(): Mesh | null {
    const cards: GroundLitterCard[] = []

    for (const prop of this._data.props) {
      switch (prop.type) {
        case "pine":
          this._addTreeCards(prop, 5, 10, cards)
          break
        case "deadPine":
          this._addTreeCards(prop, 3, 6, cards)
          break
        case "log":
          this._addLogCards(prop, cards)
          break
        case "rock":
          break
      }
    }

    this._addForestFloorCards(cards)

    if (cards.length === 0) {
      return null
    }

    const mesh = new Mesh(`pine_litter_${this._data.key}`, this._context.scene)
    const vertexData = new VertexData()
    const positions: number[] = []
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []

    for (const card of cards) {
      this._appendCard(positions, indices, uvs, card)
    }

    VertexData.ComputeNormals(positions, indices, normals)
    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.uvs = uvs
    vertexData.applyToMesh(mesh)

    mesh.material = this._materials.pineNeedleLitter
    mesh.isPickable = false

    return mesh
  }

  private _addTreeCards(
    prop: GeneratedPropData,
    minCards: number,
    maxCards: number,
    cards: GroundLitterCard[],
  ): void {
    const random = DeterministicRandom.create(DeterministicRandom.hashString(`${prop.id}_ground_litter`))
    const cardCount = minCards + Math.floor(random() * (maxCards - minCards + 1))

    for (let index = 0; index < cardCount; index += 1) {
      const angle = random() * Math.PI * 2
      const radius = (0.45 + random() * 2.15) * prop.scale
      const worldX = prop.position[0] + Math.sin(angle) * radius
      const worldZ = prop.position[2] + Math.cos(angle) * radius
      const size = (0.62 + random() * 0.88) * prop.scale

      cards.push({
        center: new Vector3(worldX, this._heightSampler.sample(worldX, worldZ) + 0.035, worldZ),
        rotationY: random() * Math.PI * 2,
        width: size * (0.8 + random() * 0.45),
        depth: size * (0.62 + random() * 0.38),
        variant: Math.floor(random() * 6),
      })
    }
  }

  private _addLogCards(prop: GeneratedPropData, cards: GroundLitterCard[]): void {
    const random = DeterministicRandom.create(DeterministicRandom.hashString(`${prop.id}_ground_litter`))
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
        center: new Vector3(worldX, this._heightSampler.sample(worldX, worldZ) + 0.035, worldZ),
        rotationY: prop.rotationY + (random() - 0.5) * 1.2,
        width: size * (1.05 + random() * 0.5),
        depth: size * (0.5 + random() * 0.35),
        variant: Math.floor(random() * 6),
      })
    }
  }

  private _addForestFloorCards(cards: GroundLitterCard[]): void {
    const random = DeterministicRandom.create(
      DeterministicRandom.hashString(`${this._data.key}_forest_floor_litter`),
    )
    const baseX = this._data.coord.x * this._data.chunkSizeMeters
    const baseZ = this._data.coord.z * this._data.chunkSizeMeters
    const candidateCount = Math.max(6, Math.round(this._data.chunkSizeMeters / 4))

    for (let index = 0; index < candidateCount; index += 1) {
      const worldX = baseX + random() * this._data.chunkSizeMeters
      const worldZ = baseZ + random() * this._data.chunkSizeMeters

      if (this._sampleTerrainMaterial(worldX, worldZ) !== TerrainMaterial.PineNeedles) {
        continue
      }

      if (random() > 0.56) {
        continue
      }

      const size = 0.42 + random() * 0.82

      cards.push({
        center: new Vector3(worldX, this._heightSampler.sample(worldX, worldZ) + 0.032, worldZ),
        rotationY: random() * Math.PI * 2,
        width: size * (0.95 + random() * 0.58),
        depth: size * (0.5 + random() * 0.32),
        variant: Math.floor(random() * 6),
      })
    }
  }

  private _appendCard(
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
    const rect = this._getUvRect(card.variant)
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

  private _getUvRect(variant: number): {
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

  private _sampleTerrainMaterial(worldX: number, worldZ: number): number {
    const localX = worldX - this._data.coord.x * this._data.chunkSizeMeters
    const localZ = worldZ - this._data.coord.z * this._data.chunkSizeMeters
    const gridSize = this._data.resolution + 1
    const step = this._data.chunkSizeMeters / this._data.resolution
    const sampleX = Math.min(Math.max(Math.round(localX / step), 0), this._data.resolution)
    const sampleZ = Math.min(Math.max(Math.round(localZ / step), 0), this._data.resolution)

    return this._data.terrainMaterials[sampleZ * gridSize + sampleX] ?? TerrainMaterial.Grass
  }
}
