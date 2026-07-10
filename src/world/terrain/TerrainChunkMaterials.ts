import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"

export interface TerrainChunkMaterials {
  readonly terrain: readonly StandardMaterial[]
  readonly trunk: StandardMaterial
  readonly deadWood: StandardMaterial
  readonly needles: StandardMaterial
  readonly pineFoliage: StandardMaterial
  readonly pineNeedleLitter: StandardMaterial
  readonly grassFoliage: StandardMaterial
  readonly rock: StandardMaterial
  readonly water: StandardMaterial
}
