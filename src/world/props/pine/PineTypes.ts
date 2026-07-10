import type { Vector3 } from "@babylonjs/core/Maths/math.vector"

export interface PineBranchSegment {
  readonly start: Vector3
  readonly end: Vector3
  readonly radiusStart: number
  readonly radiusEnd: number
}
