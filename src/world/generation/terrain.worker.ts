import { ChunkCoord } from "../ChunkCoord"
import { TerrainGenerator } from "./TerrainGenerator"
import type { TerrainGenerationRequest, TerrainGenerationResponse } from "./TerrainGenerationTypes"
import { WorldFeatureGenerator } from "./WorldFeatureGenerator"

export interface TerrainWorkerScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<TerrainGenerationRequest>) => void,
  ): void
  postMessage(message: TerrainGenerationResponse, transfer: Transferable[]): void
}

export function generateTerrainChunkResponse(
  request: TerrainGenerationRequest,
): TerrainGenerationResponse {
  const worldFeatures = new WorldFeatureGenerator({
    seed: request.seed,
    worldBounds: request.worldBounds,
  })
  const generator = new TerrainGenerator({
    seed: request.seed,
    chunkSizeMeters: request.chunkSizeMeters,
    resolution: request.resolution,
    worldFeatures,
  })
  const data = generator.generateChunk(new ChunkCoord(request.chunkX, request.chunkZ))

  return {
    requestId: request.requestId,
    key: data.key,
    coord: {
      x: data.coord.x,
      z: data.coord.z,
    },
    chunkSizeMeters: data.chunkSizeMeters,
    resolution: data.resolution,
    generatorVersion: data.generatorVersion,
    seed: data.seed,
    heights: data.heights,
    terrainMaterials: data.terrainMaterials,
    props: data.props,
  }
}

export function initializeTerrainWorker(scope: TerrainWorkerScope): void {
  scope.addEventListener("message", (event) => {
    const response = generateTerrainChunkResponse(event.data)

    scope.postMessage(response, [response.heights.buffer, response.terrainMaterials.buffer])
  })
}

/* c8 ignore next 5 */
if (typeof self !== "undefined" && typeof window === "undefined") {
  initializeTerrainWorker(self as unknown as TerrainWorkerScope)
}
