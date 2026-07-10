import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight"
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight"
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer"
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Scene } from "@babylonjs/core/scene"
import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"
import type { TimeOfDaySystem } from "./TimeOfDaySystem"

export class LightingController implements GameSystem {
  private static readonly _celestialDistance = 320

  private readonly _sun: DirectionalLight
  private readonly _moon: DirectionalLight
  private readonly _ambient: HemisphericLight
  private readonly _sunDisc: Mesh
  private readonly _moonDisc: Mesh
  private readonly _moonHalo: Mesh
  private readonly _skyDome: Mesh
  private readonly _starField: Mesh
  private readonly _sunMaterial: StandardMaterial
  private readonly _moonMaterial: StandardMaterial
  private readonly _moonHaloMaterial: StandardMaterial
  private readonly _skyMaterial: StandardMaterial
  private readonly _starMaterial: StandardMaterial
  private readonly _moonGlow: GlowLayer
  private readonly _skyVertexHeights: number[] = []
  private readonly _skyColorBuffer: number[] = []

  public constructor(
    private readonly _context: EngineContext,
    private readonly _time: TimeOfDaySystem,
  ) {
    this._sun = new DirectionalLight("sun", new Vector3(-0.35, -0.8, 0.25), this._context.scene)
    this._moon = new DirectionalLight(
      "moonlight",
      new Vector3(0.35, -0.45, -0.25),
      this._context.scene,
    )
    this._ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), this._context.scene)

    this._sun.diffuse = new Color3(1, 0.88, 0.62)
    this._sun.specular = new Color3(1, 0.9, 0.7)
    this._sun.intensity = 1.6
    this._moon.diffuse = new Color3(0.5, 0.62, 0.9)
    this._moon.specular = new Color3(0.35, 0.45, 0.7)
    this._moon.intensity = 0
    this._ambient.diffuse = new Color3(0.55, 0.63, 0.82)
    this._ambient.groundColor = new Color3(0.04, 0.045, 0.06)
    this._ambient.intensity = 0.45

    this._sunMaterial = new StandardMaterial("sun-disc-material", this._context.scene)
    this._moonMaterial = new StandardMaterial("moon-disc-material", this._context.scene)
    this._moonHaloMaterial = new StandardMaterial("moon-halo-material", this._context.scene)
    this._skyMaterial = new StandardMaterial("sky-gradient-material", this._context.scene)
    this._starMaterial = new StandardMaterial("star-field-material", this._context.scene)

    this._sunMaterial.disableLighting = true
    this._sunMaterial.fogEnabled = false
    this._sunMaterial.diffuseColor = Color3.Black()
    this._sunMaterial.emissiveColor = new Color3(1, 0.82, 0.38)

    this._moonMaterial.disableLighting = true
    this._moonMaterial.fogEnabled = false
    this._moonMaterial.diffuseColor = Color3.Black()
    this._moonMaterial.emissiveColor = new Color3(0.72, 0.78, 0.9)
    this._moonMaterial.backFaceCulling = false
    this._moonHaloMaterial.disableLighting = true
    this._moonHaloMaterial.fogEnabled = false
    this._moonHaloMaterial.diffuseColor = Color3.Black()
    this._moonHaloMaterial.emissiveColor = new Color3(0.18, 0.24, 0.36)
    this._moonHaloMaterial.alpha = 0.16
    this._moonHaloMaterial.backFaceCulling = false

    this._skyMaterial.disableLighting = true
    this._skyMaterial.fogEnabled = false
    this._skyMaterial.diffuseColor = new Color3(1, 1, 1)
    this._skyMaterial.emissiveColor = new Color3(1, 1, 1)
    this._skyMaterial.backFaceCulling = false
    this._skyMaterial.disableDepthWrite = true

    this._starMaterial.disableLighting = true
    this._starMaterial.fogEnabled = false
    this._starMaterial.diffuseColor = Color3.Black()
    this._starMaterial.emissiveColor = new Color3(1, 1, 1)
    this._starMaterial.backFaceCulling = false
    this._starMaterial.disableDepthWrite = true
    this._starMaterial.alpha = 0

    this._skyDome = this._createSkyDome()
    this._starField = this._createStarField()

    this._sunDisc = MeshBuilder.CreateSphere(
      "sun-disc",
      { diameter: 10, segments: 16 },
      this._context.scene,
    )
    this._moonDisc = MeshBuilder.CreateDisc(
      "moon-disc",
      { radius: 5.5, tessellation: 48 },
      this._context.scene,
    )
    this._moonHalo = MeshBuilder.CreateDisc(
      "moon-halo",
      { radius: 17, tessellation: 48 },
      this._context.scene,
    )

    this._skyDome.material = this._skyMaterial
    this._starField.material = this._starMaterial
    this._sunDisc.material = this._sunMaterial
    this._moonDisc.material = this._moonMaterial
    this._moonHalo.material = this._moonHaloMaterial
    this._skyDome.isPickable = false
    this._starField.isPickable = false
    this._sunDisc.isPickable = false
    this._moonDisc.isPickable = false
    this._moonHalo.isPickable = false
    this._skyDome.alwaysSelectAsActiveMesh = true
    this._starField.alwaysSelectAsActiveMesh = true
    this._sunDisc.alwaysSelectAsActiveMesh = true
    this._moonDisc.alwaysSelectAsActiveMesh = true
    this._moonDisc.billboardMode = Mesh.BILLBOARDMODE_ALL
    this._moonHalo.alwaysSelectAsActiveMesh = true
    this._moonHalo.billboardMode = Mesh.BILLBOARDMODE_ALL

    this._moonGlow = new GlowLayer("moon-glow", this._context.scene)
    this._moonGlow.intensity = 0
    this._moonGlow.addIncludedOnlyMesh(this._moonDisc)
    this._moonGlow.addIncludedOnlyMesh(this._moonHalo)

    this._context.scene.fogMode = Scene.FOGMODE_LINEAR
    this._context.scene.fogStart = 90
    this._context.scene.fogEnd = 260
  }

  public update(_deltaSeconds: number): void {
    const normalizedDay = this._time.timeOfDayHours / 24
    const angle = normalizedDay * Math.PI * 2 - Math.PI / 2
    const elevation = Math.sin(angle)
    const sunSkyDirection = new Vector3(Math.cos(angle), elevation, 0.25).normalize()
    const moonSkyDirection = sunSkyDirection.scale(-1)

    const daylight = this._smoothStep(-0.04, 0.22, elevation)
    const moonlight = this._smoothStep(0.05, 0.45, -elevation)

    this._sun.direction = sunSkyDirection.scale(-1)
    this._sun.intensity = daylight * 1.6
    this._moon.direction = moonSkyDirection.scale(-1)
    this._moon.intensity = moonlight * 0.28
    this._ambient.intensity = 0.08 + daylight * 0.47 + moonlight * 0.1

    const moonVisibility = this._getCelestialDiscVisibility(-elevation)

    this._moonGlow.intensity = moonVisibility * 0.12
    this._updateSky(elevation)
    this._updateCelestialBody(this._sunDisc, sunSkyDirection, elevation)
    this._updateCelestialBody(this._moonDisc, moonSkyDirection, -elevation)
    this._updateCelestialBody(this._moonHalo, moonSkyDirection, -elevation)
  }

  public dispose(): void {
    this._skyDome.dispose()
    this._starField.dispose()
    this._sunDisc.dispose()
    this._moonDisc.dispose()
    this._moonHalo.dispose()
    this._skyMaterial.dispose()
    this._starMaterial.dispose()
    this._sunMaterial.dispose()
    this._moonMaterial.dispose()
    this._moonHaloMaterial.dispose()
    this._moonGlow.dispose()
    this._sun.dispose()
    this._moon.dispose()
    this._ambient.dispose()
  }

  private _createSkyDome(): Mesh {
    const radius = LightingController._celestialDistance * 1.85
    const horizontalSegments = 56
    const verticalSegments = 16
    const positions: number[] = []
    const indices: number[] = []
    const colors: number[] = []

    for (let ring = 0; ring <= verticalSegments; ring += 1) {
      const t = ring / verticalSegments
      const phi = this._lerp(-0.08, Math.PI / 2, t)
      const y = Math.sin(phi) * radius
      const ringRadius = Math.cos(phi) * radius
      const heightFactor = Math.min(Math.max(y / radius, 0), 1)

      for (let segment = 0; segment <= horizontalSegments; segment += 1) {
        const theta = segment * ((Math.PI * 2) / horizontalSegments)

        positions.push(Math.sin(theta) * ringRadius, y, Math.cos(theta) * ringRadius)
        colors.push(0.5, 0.72, 0.92, 1)
        this._skyVertexHeights.push(heightFactor)
      }
    }

    for (let ring = 0; ring < verticalSegments; ring += 1) {
      for (let segment = 0; segment < horizontalSegments; segment += 1) {
        const row = horizontalSegments + 1
        const a = ring * row + segment
        const b = a + 1
        const c = a + row
        const d = c + 1

        indices.push(a, c, b)
        indices.push(b, c, d)
      }
    }

    const mesh = new Mesh("sky-gradient-dome", this._context.scene)
    const vertexData = new VertexData()

    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.colors = colors
    vertexData.applyToMesh(mesh, true)

    return mesh
  }

  private _createStarField(): Mesh {
    const radius = LightingController._celestialDistance * 1.72
    const random = this._createRandom(9137)
    const starCount = 900
    const positions: number[] = []
    const indices: number[] = []
    const colors: number[] = []

    for (let index = 0; index < starCount; index += 1) {
      const theta = random() * Math.PI * 2
      const y = 0.06 + random() * 0.92
      const horizontal = Math.sqrt(Math.max(1 - y * y, 0))
      const direction = new Vector3(Math.sin(theta) * horizontal, y, Math.cos(theta) * horizontal)
      const tangent = this._normalizeVector(new Vector3(Math.cos(theta), 0, -Math.sin(theta)))
      const bitangent = this._normalizeVector(this._crossVector(direction, tangent))
      const center = direction.scale(radius)
      const size = (0.18 + random() * random() * 0.72) * (index % 19 === 0 ? 1.9 : 1)
      const brightness = 0.55 + random() * 0.45
      const vertexStart = positions.length / 3
      const corners = [
        center.add(tangent.scale(-size)).add(bitangent.scale(-size)),
        center.add(tangent.scale(size)).add(bitangent.scale(-size)),
        center.add(tangent.scale(size)).add(bitangent.scale(size)),
        center.add(tangent.scale(-size)).add(bitangent.scale(size)),
      ]

      for (const corner of corners) {
        positions.push(corner.x, corner.y, corner.z)
        colors.push(brightness, brightness, 1, 1)
      }

      indices.push(vertexStart, vertexStart + 1, vertexStart + 2)
      indices.push(vertexStart, vertexStart + 2, vertexStart + 3)
    }

    const mesh = new Mesh("star-field", this._context.scene)
    const vertexData = new VertexData()

    vertexData.positions = positions
    vertexData.indices = indices
    vertexData.colors = colors
    vertexData.applyToMesh(mesh)
    mesh.setEnabled(false)

    return mesh
  }

  private _updateSky(elevation: number): void {
    const daylight = this._smoothStep(-0.05, 0.45, elevation)
    const twilightAmount = Math.max(0, 1 - Math.abs(elevation) / 0.34)
    const nightHorizon = new Color3(0.018, 0.024, 0.052)
    const nightZenith = new Color3(0.002, 0.004, 0.018)
    const dayHorizon = new Color3(0.72, 0.84, 0.96)
    const dayZenith = new Color3(0.28, 0.54, 0.88)
    const twilightHorizon = new Color3(0.9, 0.36, 0.18)
    const twilightZenith = new Color3(0.035, 0.045, 0.095)
    const baseHorizon = this._mixColor3(nightHorizon, dayHorizon, daylight)
    const baseZenith = this._mixColor3(nightZenith, dayZenith, daylight)
    const horizonColor = this._mixColor3(baseHorizon, twilightHorizon, twilightAmount * 0.88)
    const zenithColor = this._mixColor3(baseZenith, twilightZenith, twilightAmount * 0.72)
    const cameraPosition = this._context.scene.activeCamera?.position ?? Vector3.Zero()
    const starVisibility = this._smoothStep(0.02, 0.28, -elevation)

    this._skyDome.position = cameraPosition.clone()
    this._starField.position = cameraPosition.clone()
    this._starMaterial.alpha = starVisibility * 0.95
    this._starField.setEnabled(starVisibility > 0.01)
    this._skyColorBuffer.length = 0

    for (const height of this._skyVertexHeights) {
      const t = Math.pow(Math.min(Math.max(height, 0), 1), 0.58)
      const color = this._mixColor3(horizonColor, zenithColor, t)

      this._skyColorBuffer.push(color.r, color.g, color.b, 1)
    }

    this._skyDome.updateVerticesData("color", this._skyColorBuffer)
    this._context.scene.clearColor = new Color4(horizonColor.r, horizonColor.g, horizonColor.b, 1)
    this._context.scene.fogColor = horizonColor
  }

  private _updateCelestialBody(mesh: Mesh, direction: Vector3, elevation: number): void {
    const cameraPosition = this._context.scene.activeCamera?.position ?? Vector3.Zero()

    mesh.position = cameraPosition.add(direction.scale(LightingController._celestialDistance))
    mesh.visibility = this._getCelestialDiscVisibility(elevation)
    mesh.setEnabled(mesh.visibility > 0.01)
  }

  private _getCelestialDiscVisibility(elevation: number): number {
    return this._smoothStep(0.12, 0.26, elevation)
  }

  private _mixColor3(from: Color3, to: Color3, amount: number): Color3 {
    const t = Math.min(Math.max(amount, 0), 1)

    return new Color3(
      from.r + (to.r - from.r) * t,
      from.g + (to.g - from.g) * t,
      from.b + (to.b - from.b) * t,
    )
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

  private _lerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount
  }

  private _smoothStep(edge0: number, edge1: number, value: number): number {
    const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1)

    return x * x * (3 - 2 * x)
  }
}
