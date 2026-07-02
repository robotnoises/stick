export interface WorldBounds {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

export interface GameConfig {
  readonly worldId: string
  readonly worldSeed: number
  readonly metersPerUnit: number
  readonly startTimeOfDayHours: number
  readonly timeScale: number
  readonly worldBounds: WorldBounds
}

export const defaultGameConfig: GameConfig = {
  worldId: "default",
  worldSeed: 1337,
  metersPerUnit: 1,
  startTimeOfDayHours: 8,
  timeScale: 60,
  worldBounds: {
    minX: -4000,
    maxX: 4000,
    minZ: -4000,
    maxZ: 4000,
  },
}
