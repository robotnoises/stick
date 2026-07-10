import type { Vector3 } from "@babylonjs/core/Maths/math.vector"

export interface PineBranchSegment {
  readonly start: Vector3
  readonly end: Vector3
  readonly radiusStart: number
  readonly radiusEnd: number
}

export interface PineFoliageCard {
  readonly center: Vector3
  readonly angle: number
  readonly verticalAngle: number
  readonly width: number
  readonly length: number
  readonly variant: number
}

export interface PineProfile {
  readonly heightMeters: number
  readonly crownBaseFactor: number
  readonly maxBranchLength: number
  readonly whorlCount: number
  readonly lowerBranchCount: number
  readonly middleBranchCount: number
  readonly upperBranchCount: number
  readonly lowerBranchAngle: number
  readonly upperBranchAngle: number
  readonly branchSag: number
  readonly missingBranchChance: number
  readonly twigChance: number
  readonly foliageScale: number
  readonly topBranchCount: number
  readonly topLeaderHeight: number
}
