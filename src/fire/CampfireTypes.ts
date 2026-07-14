import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import type { PointLight } from "@babylonjs/core/Lights/pointLight"
import type { SpotLight } from "@babylonjs/core/Lights/spotLight"
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode"

export interface CampfireVisual {
  readonly root: TransformNode
  readonly flameMeshes: readonly Mesh[]
  readonly light: PointLight
  readonly fillLights: readonly PointLight[]
  readonly spillLight: SpotLight
}

export interface CampfireInstance {
  readonly id: string
  readonly visual: CampfireVisual
  remainingBurnSeconds: number
  flickerSeed: number
}
