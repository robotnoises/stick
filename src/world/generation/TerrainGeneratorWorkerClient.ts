import TerrainWorker from "./terrain.worker?worker"
import type { WorldBounds } from "../../app/GameConfig"
import { ChunkCoord } from "../ChunkCoord"
import type { ChunkTerrainData } from "../TerrainTypes"
import { TerrainGenerator } from "./TerrainGenerator"
import type { TerrainGenerationRequest, TerrainGenerationResponse } from "./TerrainGenerationTypes"
import { WorldFeatureGenerator } from "./WorldFeatureGenerator"

export interface TerrainGeneratorWorkerClientOptions {
  readonly seed: number
  readonly chunkSizeMeters: number
  readonly resolution: number
  readonly worldBounds: WorldBounds
}

interface WorkerLike {
  postMessage(message: TerrainGenerationRequest): void
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<TerrainGenerationResponse>) => void,
  ): void
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<TerrainGenerationResponse>) => void,
  ): void
  terminate(): void
}

type TerrainWorkerFactory = () => WorkerLike

interface PendingRequest {
  readonly resolve: (data: ChunkTerrainData) => void
  readonly reject: (error: Error) => void
}

export class TerrainGeneratorWorkerClient {
  private readonly _fallbackGenerator: TerrainGenerator
  private readonly _workerFactory: TerrainWorkerFactory
  private readonly _pendingRequests = new Map<number, PendingRequest>()
  private _worker: WorkerLike | null = null
  private _nextRequestId = 1

  public constructor(
    private readonly _options: TerrainGeneratorWorkerClientOptions,
    workerFactory: TerrainWorkerFactory = () => new TerrainWorker(),
  ) {
    this._workerFactory = workerFactory
    this._fallbackGenerator = new TerrainGenerator({
      seed: this._options.seed,
      chunkSizeMeters: this._options.chunkSizeMeters,
      resolution: this._options.resolution,
      worldFeatures: new WorldFeatureGenerator({
        seed: this._options.seed,
        worldBounds: this._options.worldBounds,
      }),
    })
  }

  public async generateChunk(coord: ChunkCoord): Promise<ChunkTerrainData> {
    const worker = this._getWorker()

    if (!worker) {
      return this._fallbackGenerator.generateChunk(coord)
    }

    const requestId = this._nextRequestId
    this._nextRequestId += 1

    return new Promise((resolve, reject) => {
      this._pendingRequests.set(requestId, { resolve, reject })
      worker.postMessage({
        requestId,
        seed: this._options.seed,
        chunkX: coord.x,
        chunkZ: coord.z,
        chunkSizeMeters: this._options.chunkSizeMeters,
        resolution: this._options.resolution,
        worldBounds: this._options.worldBounds,
      })
    })
  }

  public dispose(): void {
    for (const pending of this._pendingRequests.values()) {
      pending.reject(new Error("Terrain worker disposed."))
    }

    this._pendingRequests.clear()
    this._worker?.removeEventListener("message", this._handleMessage)
    this._worker?.terminate()
    this._worker = null
  }

  private _getWorker(): WorkerLike | null {
    if (this._worker) {
      return this._worker
    }

    try {
      this._worker = this._workerFactory()
      this._worker.addEventListener("message", this._handleMessage)
      return this._worker
    } catch {
      this._worker = null
      return null
    }
  }

  private readonly _handleMessage = (event: MessageEvent<TerrainGenerationResponse>): void => {
    const pending = this._pendingRequests.get(event.data.requestId)

    if (!pending) {
      return
    }

    this._pendingRequests.delete(event.data.requestId)
    pending.resolve(this._toChunkTerrainData(event.data))
  }

  private _toChunkTerrainData(response: TerrainGenerationResponse): ChunkTerrainData {
    return {
      key: response.key,
      coord: new ChunkCoord(response.coord.x, response.coord.z),
      chunkSizeMeters: response.chunkSizeMeters,
      resolution: response.resolution,
      generatorVersion: response.generatorVersion,
      seed: response.seed,
      heights: response.heights,
      terrainMaterials: response.terrainMaterials,
      props: response.props,
    }
  }
}
