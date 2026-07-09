import { Material } from "@babylonjs/core/Materials/material"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math.color"
import type { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"
import type { TimeOfDaySystem } from "./TimeOfDaySystem"

export interface CloudPositionProvider {
  readonly position: Vector3
}

interface CloudLayer {
  readonly mesh: Mesh
  readonly offsetX: number
  readonly offsetZ: number
  readonly driftX: number
  readonly driftZ: number
  readonly heightMeters: number
}

export class CloudSystem implements GameSystem {
  private static readonly _cloudCount = 11
  private static readonly _cloudRadiusMeters = 360

  private readonly _cloudMaterial: StandardMaterial
  private readonly _clouds: CloudLayer[] = []
  private _elapsedSeconds = 0

  public constructor(
    private readonly _context: EngineContext,
    private readonly _time: TimeOfDaySystem,
    private readonly _player: CloudPositionProvider,
  ) {
    this._cloudMaterial = new StandardMaterial("day-cloud-material", this._context.scene)
    this._cloudMaterial.diffuseColor = new Color3(1, 1, 1)
    this._cloudMaterial.emissiveColor = new Color3(0.86, 0.9, 0.94)
    this._cloudMaterial.specularColor = Color3.Black()
    this._cloudMaterial.alpha = 0
    this._cloudMaterial.disableLighting = true
    this._cloudMaterial.fogEnabled = false
    this._cloudMaterial.backFaceCulling = false
    this._cloudMaterial.disableDepthWrite = true
    this._cloudMaterial.transparencyMode = Material.MATERIAL_ALPHABLEND

    for (let index = 0; index < CloudSystem._cloudCount; index += 1) {
      this._clouds.push(this._createCloudLayer(index))
    }
  }

  public update(deltaSeconds: number): void {
    this._elapsedSeconds += deltaSeconds
    this._cloudMaterial.alpha = this._getCloudAlpha()

    const playerPosition = this._player.position

    for (const cloud of this._clouds) {
      cloud.mesh.position.x = playerPosition.x + cloud.offsetX + cloud.driftX * this._elapsedSeconds
      cloud.mesh.position.y = cloud.heightMeters
      cloud.mesh.position.z = playerPosition.z + cloud.offsetZ + cloud.driftZ * this._elapsedSeconds
    }
  }

  public dispose(): void {
    for (const cloud of this._clouds) {
      cloud.mesh.dispose()
    }

    this._clouds.length = 0
    this._cloudMaterial.dispose()
  }

  private _createCloudLayer(index: number): CloudLayer {
    const angle = index * 2.399963229728653
    const radius = CloudSystem._cloudRadiusMeters * (0.34 + ((index * 37) % 53) / 90)
    const offsetX = Math.sin(angle) * radius
    const offsetZ = Math.cos(angle) * radius
    const width = 58 + ((index * 19) % 42)
    const depth = 8 + ((index * 11) % 10)
    const mesh = this._createCloudMesh(`day_cloud_${index}`, width, depth)

    mesh.material = this._cloudMaterial
    mesh.isPickable = false
    mesh.alwaysSelectAsActiveMesh = true
    mesh.rotation.y = angle * 0.37

    return {
      mesh,
      offsetX,
      offsetZ,
      driftX: 0.18 + (index % 3) * 0.04,
      driftZ: 0.05 + (index % 4) * 0.025,
      heightMeters: 92 + (index % 5) * 7,
    }
  }

  private _createCloudMesh(name: string, width: number, depth: number): Mesh {
    const mesh = new Mesh(name, this._context.scene)
    const vertexData = new VertexData()
    const positions: number[] = []
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const lobeCount = 11

    for (let lobe = 0; lobe < lobeCount; lobe += 1) {
      const t = lobe / Math.max(lobeCount - 1, 1)
      const centerX = (t - 0.5) * width * 0.82
      const centerZ = Math.sin(t * Math.PI * 2.4) * depth * 0.16
      const edgeFade = 1 - Math.abs(t - 0.5) * 0.9
      const lobeWidth = width * (0.16 + (lobe % 3) * 0.035) * edgeFade
      const lobeDepth = depth * (0.32 + (lobe % 2) * 0.12) * edgeFade

      this._appendCloudLobe(
        positions,
        indices,
        normals,
        uvs,
        centerX,
        centerZ,
        lobeWidth,
        lobeDepth,
      )
    }

    for (let streak = 0; streak < 4; streak += 1) {
      const t = (streak + 0.5) / 4
      const centerX = (t - 0.5) * width * 0.72
      const centerZ = depth * (0.18 + streak * 0.08)

      this._appendCloudLobe(
        positions,
        indices,
        normals,
        uvs,
        centerX,
        centerZ,
        width * 0.22,
        depth * 0.12,
      )
    }

    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.uvs = uvs
    vertexData.applyToMesh(mesh)

    return mesh
  }

  private _appendCloudLobe(
    positions: number[],
    indices: number[],
    normals: number[],
    uvs: number[],
    centerX: number,
    centerZ: number,
    width: number,
    depth: number,
  ): void {
    const vertexStart = positions.length / 3
    const ringSegments = 14

    positions.push(centerX, 0, centerZ)
    normals.push(0, -1, 0)
    uvs.push(0.5, 0.5)

    for (let segment = 0; segment <= ringSegments; segment += 1) {
      const angle = segment * ((Math.PI * 2) / ringSegments)
      const x = centerX + Math.cos(angle) * (width / 2)
      const z = centerZ + Math.sin(angle) * (depth / 2)

      positions.push(x, 0, z)
      normals.push(0, -1, 0)
      uvs.push(Math.cos(angle) * 0.5 + 0.5, Math.sin(angle) * 0.5 + 0.5)
    }

    for (let segment = 1; segment <= ringSegments; segment += 1) {
      indices.push(vertexStart, vertexStart + segment, vertexStart + segment + 1)
    }
  }

  private _getCloudAlpha(): number {
    const normalizedDay = this._time.timeOfDayHours / 24
    const angle = normalizedDay * Math.PI * 2 - Math.PI / 2
    const elevation = Math.sin(angle)
    const daylight = this._smoothStep(0.03, 0.28, elevation)

    return daylight * 0.18
  }

  private _smoothStep(edge0: number, edge1: number, value: number): number {
    const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1)

    return t * t * (3 - 2 * t)
  }
}
