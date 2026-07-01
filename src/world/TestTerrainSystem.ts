import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"

export class TestTerrainSystem implements GameSystem {
  public constructor(private readonly _context: EngineContext) {}

  public initialize(): void {
    const ground = MeshBuilder.CreateGround(
      "test-ground",
      {
        width: 400,
        height: 400,
        subdivisions: 64,
      },
      this._context.scene,
    )

    const material = new StandardMaterial("terrain-placeholder", this._context.scene)

    material.diffuseColor.set(0.35, 0.43, 0.22)
    material.specularColor.set(0, 0, 0)
    ground.material = material

    this._createLandmarkPines()
  }

  public update(_deltaSeconds: number): void {}

  private _createLandmarkPines(): void {
    const trunkMaterial = new StandardMaterial("pine-trunk-placeholder", this._context.scene)
    const needlesMaterial = new StandardMaterial("pine-needles-placeholder", this._context.scene)

    trunkMaterial.diffuseColor.set(0.34, 0.21, 0.12)
    needlesMaterial.diffuseColor.set(0.12, 0.28, 0.15)

    const positions = [
      new Vector3(12, 0, 35),
      new Vector3(-24, 0, 42),
      new Vector3(48, 0, -18),
      new Vector3(-60, 0, -32),
      new Vector3(5, 0, -75),
    ]

    positions.forEach((position, index) => {
      const trunkHeight = 5 + index
      const trunk = MeshBuilder.CreateCylinder(
        `pine_${index}_trunk`,
        {
          height: trunkHeight,
          diameterTop: 0.35,
          diameterBottom: 0.55,
        },
        this._context.scene,
      )

      trunk.position = position.add(new Vector3(0, trunkHeight / 2, 0))
      trunk.material = trunkMaterial

      const needles = MeshBuilder.CreateCylinder(
        `pine_${index}_needles`,
        {
          height: 7 + index * 0.7,
          diameterTop: 0.1,
          diameterBottom: 4 + index * 0.3,
          tessellation: 8,
        },
        this._context.scene,
      )

      needles.position = position.add(new Vector3(0, trunkHeight + 2.5, 0))
      needles.material = needlesMaterial
    })
  }
}
