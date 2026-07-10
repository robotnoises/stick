import TerrainWorker from "./terrain.worker?worker"
import type { WorldBounds } from "../../app/GameConfig"
import { ChunkCoord } from "../ChunkCoord"
import type { ChunkTerrainData } from "../terrain/TerrainTypes"
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
  addEventListener(type: "error", listener: (event: ErrorEvent) => void): void
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<TerrainGenerationResponse>) => void,
  ): void
  removeEventListener(type: "error", listener: (event: ErrorEvent) => void): void
  terminate(): void
}

type TerrainWorkerFactory = () => WorkerLike

interface PendingRequest {
  readonly coord: ChunkCoord
  readonly resolve: (data: ChunkTerrainData) => void
  readonly reject: (error: Error) => void
  readonly startedAtMilliseconds: number
}

export interface TerrainGenerationDebugStats {
  readonly workerAvailable: boolean
  readonly pendingRequestCount: number
  readonly completedWorkerRequestCount: number
  readonly fallbackGenerationCount: number
  readonly workerErrorCount: number
  readonly lastWorkerErrorMessage: string | null
  readonly lastGenerationMilliseconds: number | null
  readonly averageGenerationMilliseconds: number | null
}

export class TerrainGeneratorWorkerClient {
  private readonly _fallbackGenerator: TerrainGenerator
  private readonly _workerFactory: TerrainWorkerFactory
  private readonly _pendingRequests = new Map<number, PendingRequest>()
  private _worker: WorkerLike | null = null
  private _nextRequestId = 1
  private _completedWorkerRequestCount = 0
  private _fallbackGenerationCount = 0
  private _lastGenerationMilliseconds: number | null = null
  private _lastWorkerErrorMessage: string | null = null
  private _totalGenerationMilliseconds = 0
  private _completedGenerationCount = 0
  private _workerErrorCount = 0

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
      return this._generateFallbackChunk(coord, performance.now())
    }

    const requestId = this._nextRequestId
    this._nextRequestId += 1

    return new Promise((resolve, reject) => {
      this._pendingRequests.set(requestId, {
        coord,
        resolve,
        reject,
        startedAtMilliseconds: performance.now(),
      })

      try {
        worker.postMessage({
          requestId,
          seed: this._options.seed,
          chunkX: coord.x,
          chunkZ: coord.z,
          chunkSizeMeters: this._options.chunkSizeMeters,
          resolution: this._options.resolution,
          worldBounds: this._options.worldBounds,
        })
      } catch (error) {
        this._pendingRequests.delete(requestId)
        this._recordWorkerError(error)
        resolve(this._generateFallbackChunk(coord, performance.now()))
      }
    })
  }

  public getDebugStats(): TerrainGenerationDebugStats {
    return {
      workerAvailable: this._worker !== null,
      pendingRequestCount: this._pendingRequests.size,
      completedWorkerRequestCount: this._completedWorkerRequestCount,
      fallbackGenerationCount: this._fallbackGenerationCount,
      workerErrorCount: this._workerErrorCount,
      lastWorkerErrorMessage: this._lastWorkerErrorMessage,
      lastGenerationMilliseconds: this._lastGenerationMilliseconds,
      averageGenerationMilliseconds:
        this._completedGenerationCount === 0
          ? null
          : this._totalGenerationMilliseconds / this._completedGenerationCount,
    }
  }

  public dispose(): void {
    for (const pending of this._pendingRequests.values()) {
      pending.reject(new Error("Terrain worker disposed."))
    }

    this._pendingRequests.clear()
    this._worker?.removeEventListener("message", this._handleMessage)
    this._worker?.removeEventListener("error", this._handleError)
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
      this._worker.addEventListener("error", this._handleError)
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
    this._completedWorkerRequestCount += 1
    this._recordGenerationDuration(performance.now() - pending.startedAtMilliseconds)
    pending.resolve(this._toChunkTerrainData(event.data))
  }

  private readonly _handleError = (event: ErrorEvent): void => {
    this._recordWorkerError(event.error ?? event.message)
    this._fallbackPendingRequests()
    this._worker?.removeEventListener("message", this._handleMessage)
    this._worker?.removeEventListener("error", this._handleError)
    this._worker?.terminate()
    this._worker = null
  }

  private _fallbackPendingRequests(): void {
    for (const [requestId, pending] of this._pendingRequests) {
      this._pendingRequests.delete(requestId)
      pending.resolve(this._generateFallbackChunk(pending.coord, pending.startedAtMilliseconds))
    }
  }

  private _generateFallbackChunk(
    coord: ChunkCoord,
    startedAtMilliseconds: number,
  ): ChunkTerrainData {
    const data = this._fallbackGenerator.generateChunk(coord)

    this._fallbackGenerationCount += 1
    this._recordGenerationDuration(performance.now() - startedAtMilliseconds)

    return data
  }

  private _recordWorkerError(error: unknown): void {
    this._workerErrorCount += 1
    this._lastWorkerErrorMessage = error instanceof Error ? error.message : String(error)
  }

  private _recordGenerationDuration(durationMilliseconds: number): void {
    this._lastGenerationMilliseconds = durationMilliseconds
    this._totalGenerationMilliseconds += durationMilliseconds
    this._completedGenerationCount += 1
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
