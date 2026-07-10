export interface DebugMapLakeData {
  readonly id: string
  readonly centerX: number
  readonly centerZ: number
  readonly radiusX: number
  readonly radiusZ: number
  readonly shoreFalloffMeters: number
}

export interface DebugMapRiverData {
  readonly id: string
  readonly points: ReadonlyArray<readonly [number, number]>
  readonly widthMeters: number
  readonly bankFalloffMeters: number
}

export interface DebugMapData {
  readonly worldBounds: {
    readonly minX: number
    readonly maxX: number
    readonly minZ: number
    readonly maxZ: number
  }
  readonly playerPosition: {
    readonly x: number
    readonly z: number
  }
  readonly playerHeadingDegrees: number
  readonly chunkSizeMeters: number
  readonly lakes: readonly DebugMapLakeData[]
  readonly rivers: readonly DebugMapRiverData[]
}

export interface DebugTerrainGenerationStats {
  readonly workerAvailable: boolean
  readonly pendingRequestCount: number
  readonly completedWorkerRequestCount: number
  readonly fallbackGenerationCount: number
  readonly workerErrorCount: number
  readonly lastWorkerErrorMessage: string | null
  readonly lastGenerationMilliseconds: number | null
  readonly averageGenerationMilliseconds: number | null
}

export interface DebugTerrainMeshBuildStats {
  readonly builtChunkCount: number
  readonly lastBuildMilliseconds: number | null
  readonly averageBuildMilliseconds: number | null
}

export interface DebugTerrainStreamingStats {
  readonly activeChunkCount: number
  readonly queuedChunkCount: number
  readonly inFlightChunkCount: number
  readonly cachedChunkDataCount: number
  readonly maxChunkLoadsPerFrame: number | null
  readonly terrainGeneration: DebugTerrainGenerationStats | null
  readonly terrainMeshBuild: DebugTerrainMeshBuildStats
}

export interface DebugOverlayActions {
  createNewWorld?(): Promise<void> | void
  getChunkBoundariesDebugEnabled?(): boolean
  getDebugMapData?(): DebugMapData
  getTerrainStreamingStats?(): DebugTerrainStreamingStats
  getWorldSeed?(): number
  resetTerrainCache?(): Promise<void> | void
  setChunkBoundariesDebugEnabled?(enabled: boolean): void
  setWorldSeed?(seed: number): Promise<void> | void
}
