import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../../app/EngineContext"
import type { TerrainChunkMaterials } from "../terrain/TerrainChunkMaterials"
import type { RiverFeature, WorldFeatureGenerator } from "../generation/WorldFeatureGenerator"

interface RiverWaterStation {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly distanceMeters: number
}

export class RiverWaterMeshBuilder {
  public constructor(
    private readonly _context: EngineContext,
    private readonly _worldFeatures: WorldFeatureGenerator,
    private readonly _materials: TerrainChunkMaterials,
  ) {}

  public createAll(): Mesh[] {
    const meshes: Mesh[] = []

    for (const river of this._worldFeatures.rivers) {
      const mesh = this._createRiverWaterMesh(river)

      if (mesh) {
        meshes.push(mesh)
      }
    }

    return meshes
  }

  private _createRiverWaterMesh(river: RiverFeature): Mesh | null {
    const stations = this._getRiverWaterStations(river)

    if (stations.length < 2) {
      return null
    }

    const mesh = new Mesh(`water_${river.id}`, this._context.scene)
    const vertexData = new VertexData()
    const positions: number[] = []
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const halfWidthMeters = river.widthMeters / 2 + 1.25
    const uvLengthScaleMeters = 48

    for (let stationIndex = 0; stationIndex < stations.length; stationIndex += 1) {
      const station = stations[stationIndex]!
      const previous = stations[Math.max(0, stationIndex - 1)]!
      const next = stations[Math.min(stations.length - 1, stationIndex + 1)]!
      const tangentX = next.x - previous.x
      const tangentZ = next.z - previous.z
      const tangentLength = Math.hypot(tangentX, tangentZ) || 1
      const normalX = -tangentZ / tangentLength
      const normalZ = tangentX / tangentLength
      const leftX = station.x + normalX * halfWidthMeters
      const leftZ = station.z + normalZ * halfWidthMeters
      const rightX = station.x - normalX * halfWidthMeters
      const rightZ = station.z - normalZ * halfWidthMeters
      const vertexStart = stationIndex * 2
      const riverV = station.distanceMeters / uvLengthScaleMeters

      positions.push(leftX, station.y, leftZ, rightX, station.y, rightZ)
      normals.push(0, 1, 0, 0, 1, 0)
      uvs.push(0, riverV, 1, riverV)

      if (stationIndex === 0) {
        continue
      }

      indices.push(
        vertexStart - 2,
        vertexStart,
        vertexStart - 1,
        vertexStart - 1,
        vertexStart,
        vertexStart + 1,
      )
    }

    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.uvs = uvs
    vertexData.applyToMesh(mesh)

    mesh.material = this._materials.water
    mesh.isPickable = false

    return mesh
  }

  private _getRiverWaterStations(river: RiverFeature): RiverWaterStation[] {
    const stations: RiverWaterStation[] = []
    const segmentLengthMeters = 4
    let riverDistanceMeters = 0

    for (let pointIndex = 1; pointIndex < river.points.length; pointIndex += 1) {
      const [startX, startZ] = river.points[pointIndex - 1]!
      const [endX, endZ] = river.points[pointIndex]!
      const segmentLength = Math.hypot(endX - startX, endZ - startZ)

      if (segmentLength === 0) {
        continue
      }

      const subdivisions = Math.max(1, Math.ceil(segmentLength / segmentLengthMeters))

      for (let subdivision = 0; subdivision <= subdivisions; subdivision += 1) {
        if (stations.length > 0 && subdivision === 0) {
          continue
        }

        const t = subdivision / subdivisions
        const x = this._lerp(startX, endX, t)
        const z = this._lerp(startZ, endZ, t)

        stations.push({
          x,
          y: this._getRiverWaterHeight(river, x, z),
          z,
          distanceMeters: riverDistanceMeters + segmentLength * t,
        })
      }

      riverDistanceMeters += segmentLength
    }

    return stations
  }

  private _getRiverWaterHeight(river: RiverFeature, worldX: number, worldZ: number): number {
    return this._worldFeatures.getRiverWaterLevelAtPosition(river, worldX, worldZ) + 0.08
  }

  private _lerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount
  }
}
