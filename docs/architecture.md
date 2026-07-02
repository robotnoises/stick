# Stick Basic Architecture

## Technical Baseline

- **Language:** TypeScript
- **Renderer/Engine:** Babylon.js
- **Preferred graphics backend:** WebGPU via `BABYLON.WebGPUEngine`
- **Persistence:** IndexedDB, likely through `localForage`
- **Concurrency:** Web Workers for procedural terrain/noise and other CPU-heavy generation
- **Style:** Strict class-based architecture with dependency injection through a shared engine context

## High-Level Runtime Flow

```text
App
└── Game
    ├── EngineContext
    │   ├── engine
    │   ├── scene
    │   ├── canvas
    │   └── services
    ├── WorldSystem
    │   ├── ChunkManager
    │   ├── TerrainGeneratorWorkerClient
    │   └── PropPlacementSystem
    ├── PlayerSystem
    │   ├── PlayerController
    │   ├── PlayerSurvivalState
    │   └── Compass
    ├── EnvironmentSystem
    │   ├── TimeOfDaySystem
    │   ├── WeatherSystem placeholder
    │   └── LightingController
    ├── PersistenceSystem
    └── DebugSystem
```

## Suggested Source Layout

```text
src/
  main.ts
  app/
    Game.ts
    EngineContext.ts
    GameConfig.ts
  engine/
    BabylonBootstrap.ts
    SceneFactory.ts
  player/
    PlayerController.ts
    PlayerSurvivalState.ts
    Compass.ts
  world/
    ChunkCoord.ts
    Chunk.ts
    ChunkManager.ts
    TerrainMeshBuilder.ts
    PropPlacementSystem.ts
  world/generation/
    TerrainGenerator.ts
    TerrainGeneratorWorkerClient.ts
    terrain.worker.ts
    Noise.ts
  environment/
    TimeOfDaySystem.ts
    LightingController.ts
    WeatherSystem.ts
  persistence/
    SaveGame.ts
    SaveRepository.ts
    ChunkSaveData.ts
  assets/
    MaterialRegistry.ts
    MeshRegistry.ts
  debug/
    DebugOverlay.ts
```

## Core Contracts

### EngineContext

The shared dependency object passed into systems that need Babylon access.

```ts
export class EngineContext {
  constructor(
    public readonly canvas: HTMLCanvasElement,
    public readonly engine: BABYLON.Engine | BABYLON.WebGPUEngine,
    public readonly scene: BABYLON.Scene,
  ) {}
}
```

### Game System Lifecycle

Use a small lifecycle interface so major systems can be started, updated, and disposed consistently.

```ts
export interface GameSystem {
  initialize?(): Promise<void> | void
  update(deltaSeconds: number): void
  dispose?(): void
}
```

### Chunk Coordinates

Keep world chunk addressing explicit and deterministic.

```ts
export class ChunkCoord {
  constructor(
    public readonly x: number,
    public readonly z: number,
  ) {}

  public get key(): string {
    return `${this.x}_${this.z}`
  }
}
```

## Main Systems

### Game

Owns startup, the render loop, and system ordering.

Responsibilities:

- create Babylon engine and scene
- create context
- register systems
- compute `deltaSeconds`
- call system updates
- run scene render
- dispose cleanly

### PlayerController

Responsibilities:

- own first-person camera or player body/camera rig
- read input
- apply movement at realistic scale
- expose world position and heading
- interact with terrain collision/height sampling

### Compass

Responsibilities:

- compute heading relative to world north
- later support held-item UI/model animation

Coordinate convention recommendation:

- X: east/west
- Y: elevation
- Z: north/south
- North: positive Z

### TimeOfDaySystem

Responsibilities:

- maintain world time
- configurable time scale
- drive sun/moon angle
- provide time data to survival/environment systems

### ChunkManager

Responsibilities:

- track player chunk position
- request generation for missing chunks
- instantiate chunks within radius
- unload chunks outside radius
- merge saved mutation data into generated chunks

### Terrain Generation Worker

Responsibilities:

- receive seed, chunk coordinate, size, resolution
- produce height data and optional masks
- return transferable typed arrays

Keep Babylon mesh creation on the main thread unless a later benchmark proves worker mesh generation is worth the complexity.

### PropPlacementSystem

Responsibilities:

- deterministic placement of trees, rocks, grasses, logs, water features, etc.
- use instancing/thin instances where possible
- avoid storing every generated prop unless mutated by the player

### Persistence Repositories

Persistence should be accessed through repository classes/interfaces, not directly from gameplay systems. See [Data and Persistence](data.md) for repository contracts, storage boundary rules, and initial persistence shapes.

## Persistence Shape

```ts
export interface SaveGame {
  version: number
  seed: number
  player: {
    position: [number, number, number]
    yaw: number
    survival: PlayerSurvivalSnapshot
  }
  world: {
    timeOfDayHours: number
    elapsedWorldSeconds: number
  }
}

export interface ChunkSaveData {
  key: string
  coordX: number
  coordZ: number
  lastSavedTimestamp: number
  mutations: ChunkMutation[]
}

export type ChunkMutation =
  | { type: "propRemoved"; propId: string }
  | { type: "terrainDelta"; vertexIndex: number; deltaY: number }
```

## Near-Term Implementation Recommendation

Start simple:

1. Bootstrap Babylon scene.
2. Add player movement and compass.
3. Add non-streamed test terrain.
4. Convert test terrain to one generated chunk.
5. Add chunk manager and streaming.
6. Move generation into a worker.
7. Add survival state and persistence.

Avoid building a full ECS initially. The current design goals fit well with explicit OOP systems and services.
