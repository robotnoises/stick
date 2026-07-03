import localForage from "localforage"
import type { SaveGameData, SaveGameRepository, WorldConfigSaveData } from "./SaveGameRepository"

export class LocalForageSaveGameRepository implements SaveGameRepository {
  private static readonly _worldConfigKey = "currentWorldConfig"
  private static readonly _saveGameKey = "currentSaveGame"

  private readonly _store: LocalForage

  public constructor() {
    this._store = localForage.createInstance({
      name: "stick",
      storeName: "saveGame",
    })
  }

  public async getWorldConfig(): Promise<WorldConfigSaveData | null> {
    return await this._store.getItem<WorldConfigSaveData>(LocalForageSaveGameRepository._worldConfigKey)
  }

  public async saveWorldConfig(config: WorldConfigSaveData): Promise<void> {
    await this._store.setItem(LocalForageSaveGameRepository._worldConfigKey, config)
  }

  public async getSaveGame(): Promise<SaveGameData | null> {
    return await this._store.getItem<SaveGameData>(LocalForageSaveGameRepository._saveGameKey)
  }

  public async saveGame(saveGame: SaveGameData): Promise<void> {
    await this._store.setItem(LocalForageSaveGameRepository._saveGameKey, saveGame)
  }
}
