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
  private static readonly _radiusMeters = 300
  private static readonly _segmentCount = 96

  private readonly _mountainMesh: Mesh
  private readonly _mountainMaterial: StandardMaterial

  public constructor(
    private readonly _context: EngineContext,
    private readonly _player: BackdropPositionProvider,
    private readonly _timeProvider: BackdropTimeProvider | null = null,
  ) {
    this._mountainMaterial = new StandardMaterial("distant-mountain-material", this._context.scene)
    this._mountainMaterial.diffuseColor = new Color3(0.42, 0.48, 0.54)
    this._mountainMaterial.emissiveColor = new Color3(0.42, 0.48, 0.54)
    this._mountainMaterial.specularColor = Color3.Black()
    this._mountainMaterial.alpha = 1
    this._mountainMaterial.disableLighting = true
    this._mountainMaterial.fogEnabled = false
    this._mountainMaterial.backFaceCulling = false
    this._mountainMaterial.disableDepthWrite = false

    this._mountainMesh = this._createMountainMesh()
    this._mountainMesh.material = this._mountainMaterial
    this._mountainMesh.isPickable = false
    this._mountainMesh.alwaysSelectAsActiveMesh = true
  }

  public update(_deltaSeconds: number): void {
    const position = this._player.position

    this._mountainMesh.position.x = position.x
    this._mountainMesh.position.z = position.z
    this._updateMountainAppearance()
  }

  public dispose(): void {
    this._mountainMesh.dispose()
    this._mountainMaterial.dispose()
  }

  private _updateMountainAppearance(): void {
    const elevation = this._getSolarElevation()
    const skyHorizonColor = this._getSkyHorizonColor(elevation)
    const mountainColor = this._mixColor3(skyHorizonColor, Color3.Black(), 0.22)

    this._mountainMaterial.alpha = 1
    this._mountainMaterial.diffuseColor = mountainColor
    this._mountainMaterial.emissiveColor = mountainColor
  }

  private _getSolarElevation(): number {
    if (!this._timeProvider) {
      return 1
    }

    const normalizedDay = this._timeProvider.timeOfDayHours / 24
    const angle = normalizedDay * Math.PI * 2 - Math.PI / 2

    return Math.sin(angle)
  }

  private _getSkyHorizonColor(elevation: number): Color3 {
    const daylight = this._smoothStep(-0.05, 0.45, elevation)
    const twilightAmount = Math.max(0, 1 - Math.abs(elevation) / 0.34)
    const nightHorizon = new Color3(0.018, 0.024, 0.052)
    const dayHorizon = new Color3(0.72, 0.84, 0.96)
    const twilightHorizon = new Color3(0.9, 0.36, 0.18)
    const baseHorizon = this._mixColor3(nightHorizon, dayHorizon, daylight)

    return this._mixColor3(baseHorizon, twilightHorizon, twilightAmount * 0.88)
  }

  private _mixColor3(from: Color3, to: Color3, amount: number): Color3 {
    const t = Math.min(Math.max(amount, 0), 1)

    return new Color3(
      from.r + (to.r - from.r) * t,
      from.g + (to.g - from.g) * t,
      from.b + (to.b - from.b) * t,
    )
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
