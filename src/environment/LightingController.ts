import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight"
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight"
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
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
  private readonly _sunMaterial: StandardMaterial
  private readonly _moonMaterial: StandardMaterial

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

    this._sunMaterial.disableLighting = true
    this._sunMaterial.diffuseColor = Color3.Black()
    this._sunMaterial.emissiveColor = new Color3(1, 0.82, 0.38)

    this._moonMaterial.disableLighting = true
    this._moonMaterial.diffuseColor = Color3.Black()
    this._moonMaterial.emissiveColor = new Color3(0.72, 0.78, 0.86)

    this._sunDisc = MeshBuilder.CreateSphere(
      "sun-disc",
      { diameter: 10, segments: 16 },
      this._context.scene,
    )
    this._moonDisc = MeshBuilder.CreateSphere(
      "moon-disc",
      { diameter: 7, segments: 16 },
      this._context.scene,
    )

    this._sunDisc.material = this._sunMaterial
    this._moonDisc.material = this._moonMaterial

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

    this._updateSky(elevation)
    this._updateCelestialBody(this._sunDisc, sunSkyDirection, elevation)
    this._updateCelestialBody(this._moonDisc, moonSkyDirection, -elevation)
  }

  public dispose(): void {
    this._sunDisc.dispose()
    this._moonDisc.dispose()
    this._sunMaterial.dispose()
    this._moonMaterial.dispose()
    this._sun.dispose()
    this._moon.dispose()
    this._ambient.dispose()
  }

  private _updateSky(elevation: number): void {
    const night = new Color4(0.035, 0.045, 0.085, 1)
    const twilight = new Color4(0.9, 0.47, 0.28, 1)
    const day = new Color4(0.53, 0.72, 0.9, 1)

    const daylight = this._smoothStep(-0.05, 0.45, elevation)
    const twilightAmount = Math.max(0, 1 - Math.abs(elevation) / 0.35) * 0.65
    const base = this._mixColor4(night, day, daylight)

    const skyColor = this._mixColor4(base, twilight, twilightAmount)

    this._context.scene.clearColor = skyColor
    this._context.scene.fogColor = new Color3(skyColor.r, skyColor.g, skyColor.b)
  }

  private _updateCelestialBody(mesh: Mesh, direction: Vector3, elevation: number): void {
    const cameraPosition = this._context.scene.activeCamera?.position ?? Vector3.Zero()

    mesh.position = cameraPosition.add(direction.scale(LightingController._celestialDistance))
    mesh.visibility = this._smoothStep(-0.08, 0.12, elevation)
    mesh.setEnabled(mesh.visibility > 0.01)
  }

  private _mixColor4(from: Color4, to: Color4, amount: number): Color4 {
    const t = Math.min(Math.max(amount, 0), 1)

    return new Color4(
      from.r + (to.r - from.r) * t,
      from.g + (to.g - from.g) * t,
      from.b + (to.b - from.b) * t,
      from.a + (to.a - from.a) * t,
    )
  }

  private _smoothStep(edge0: number, edge1: number, value: number): number {
    const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1)

    return x * x * (3 - 2 * x)
  }
}
