import type { Vector3 } from "@babylonjs/core/Maths/math.vector"

export interface AnimalPositionProvider {
  readonly position: Vector3
}

export interface FishSpawnCandidate {
  readonly cellId: string
  readonly x: number
  readonly z: number
}

export interface BirdSpawnCandidate {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly z: number
}
