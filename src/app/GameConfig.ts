export interface GameConfig {
  readonly worldSeed: number
  readonly metersPerUnit: number
  readonly startTimeOfDayHours: number
  readonly timeScale: number
}

export const defaultGameConfig: GameConfig = {
  worldSeed: 1337,
  metersPerUnit: 1,
  startTimeOfDayHours: 8,
  timeScale: 60,
}
