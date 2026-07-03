export interface WorldConfigSaveData {
  readonly worldId: string
  readonly worldSeed: number
}

export interface SaveGameRepository {
  getWorldConfig(): Promise<WorldConfigSaveData | null>
  saveWorldConfig(config: WorldConfigSaveData): Promise<void>
}
