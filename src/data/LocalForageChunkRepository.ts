import localForage from "localforage"
import type { ChunkRepository, PersistedChunkData } from "./ChunkRepository"

export class LocalForageChunkRepository implements ChunkRepository {
  private readonly _store: LocalForage

  public constructor() {
    this._store = localForage.createInstance({
      name: "stick",
      storeName: "terrainChunks",
    })
  }

  public async getChunk(key: string): Promise<PersistedChunkData | null> {
    return await this._store.getItem<PersistedChunkData>(key)
  }

  public async saveChunk(chunk: PersistedChunkData): Promise<void> {
    await this._store.setItem(chunk.key, chunk)
  }

  public async deleteChunk(key: string): Promise<void> {
    await this._store.removeItem(key)
  }

  public async listChunkKeys(): Promise<string[]> {
    return await this._store.keys()
  }
}
