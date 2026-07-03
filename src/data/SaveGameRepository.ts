export interface WorldConfigSaveData {
  readonly worldId: string
  readonly worldSeed: number
}

export interface SaveGameData {
  readonly version: number
  readonly savedAt: number
  readonly worldId: string
  readonly worldSeed: number
  readonly player: {
    readonly position: readonly [number, number, number]
    readonly headingDegrees: number
  }
  readonly world: {
    readonly day: number
    readonly timeOfDayHours: number
    readonly elapsedWorldSeconds: number
  }
}

export interface SaveGameRepository {
  getWorldConfig(): Promise<WorldConfigSaveData | null>
  saveWorldConfig(config: WorldConfigSaveData): Promise<void>
  getSaveGame(): Promise<SaveGameData | null>
  saveGame(saveGame: SaveGameData): Promise<void>
}
