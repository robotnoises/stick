import localForage from "localforage"
import type { SaveGameRepository, WorldConfigSaveData } from "./SaveGameRepository"

export class LocalForageSaveGameRepository implements SaveGameRepository {
  private static readonly _worldConfigKey = "currentWorldConfig"

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
}
