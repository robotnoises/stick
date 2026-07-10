import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math.color"
import type { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"

export interface BackdropPositionProvider {
  readonly position: Vector3
}

export interface BackdropTimeProvider {
  readonly timeOfDayHours: number
}

export class DistantBackdropSystem implements GameSystem {
  private static readonly _radiusMeters = 520
  private static readonly _segmentCount = 96

  private readonly _mountainMesh: Mesh
  private readonly _mountainMaterial: StandardMaterial

  public constructor(
    private readonly _context: EngineContext,
    private readonly _player: BackdropPositionProvider,
    private readonly _timeProvider: BackdropTimeProvider | null = null,
  ) {
    this._mountainMaterial = new StandardMaterial("distant-mountain-material", this._context.scene)
    this._mountainMaterial.diffuseColor = new Color3(0.82, 0.89, 0.95)
    this._mountainMaterial.emissiveColor = new Color3(0.5, 0.6, 0.68)
    this._mountainMaterial.specularColor = Color3.Black()
    this._mountainMaterial.alpha = 0.28
    this._mountainMaterial.disableLighting = true
    this._mountainMaterial.fogEnabled = false
    this._mountainMaterial.backFaceCulling = false
    this._mountainMaterial.disableDepthWrite = true

    this._mountainMesh = this._createMountainMesh()
    this._mountainMesh.material = this._mountainMaterial
    this._mountainMesh.isPickable = false
    this._mountainMesh.alwaysSelectAsActiveMesh = true
  }

  public update(_deltaSeconds: number): void {
    const position = this._player.position

    this._mountainMesh.position.x = position.x
    this._mountainMesh.position.z = position.z
    this._updateMountainVisibility()
  }

  public dispose(): void {
    this._mountainMesh.dispose()
    this._mountainMaterial.dispose()
  }

  private _updateMountainVisibility(): void {
    const daylight = this._getDaylightAmount()
    const nightFade = 0.04 + daylight * 0.96

    this._mountainMaterial.alpha = 0.035 + daylight * 0.245
    this._mountainMaterial.diffuseColor = new Color3(
      0.08 + nightFade * 0.74,
      0.1 + nightFade * 0.79,
      0.13 + nightFade * 0.82,
    )
    this._mountainMaterial.emissiveColor = new Color3(
      0.02 + nightFade * 0.48,
      0.025 + nightFade * 0.575,
      0.035 + nightFade * 0.645,
    )
  }

  private _getDaylightAmount(): number {
    if (!this._timeProvider) {
      return 1
    }

    const normalizedDay = this._timeProvider.timeOfDayHours / 24
    const angle = normalizedDay * Math.PI * 2 - Math.PI / 2
    const elevation = Math.sin(angle)

    return this._smoothStep(-0.04, 0.22, elevation)
  }

  private _smoothStep(edge0: number, edge1: number, value: number): number {
    const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1)

    return t * t * (3 - 2 * t)
  }

  private _createMountainMesh(): Mesh {
    const mesh = new Mesh("distant-mountain-backdrop", this._context.scene)
    const vertexData = new VertexData()
    const positions: number[] = []
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const baseY = -8
    const radius = DistantBackdropSystem._radiusMeters
    const segmentCount = DistantBackdropSystem._segmentCount

    for (let segment = 0; segment <= segmentCount; segment += 1) {
      const t = segment / segmentCount
      const angle = t * Math.PI * 2
      const ridgeHeight = 36 + this._ridgeNoise(t) * 74
      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius

      positions.push(x, baseY, z, x, baseY + ridgeHeight, z)
      normals.push(0, 0, -1, 0, 0, -1)
      uvs.push(t, 1, t, 0)
    }

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const bottom0 = segment * 2
      const top0 = bottom0 + 1
      const bottom1 = bottom0 + 2
      const top1 = bottom0 + 3

      indices.push(bottom0, top0, bottom1)
      indices.push(bottom1, top0, top1)
    }

    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.normals = normals
    vertexData.uvs = uvs
    vertexData.applyToMesh(mesh)

    return mesh
  }

  private _ridgeNoise(t: number): number {
    const broad = Math.sin(t * Math.PI * 2 * 3 + 0.7) * 0.5 + 0.5
    const medium = Math.sin(t * Math.PI * 2 * 9 + 1.9) * 0.5 + 0.5
    const sharp = Math.sin(t * Math.PI * 2 * 17 + 3.4) * 0.5 + 0.5

    return Math.min(Math.max(broad * 0.55 + medium * 0.32 + sharp * 0.13, 0), 1)
  }
}
