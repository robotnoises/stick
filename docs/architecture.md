# Stick Basic Architecture

## Technical Baseline

- **Language:** TypeScript
- **Renderer/Engine:** Babylon.js
- **Preferred graphics backend:** WebGPU via `BABYLON.WebGPUEngine`
- **Persistence:** IndexedDB through repository interfaces backed by `localForage`
- **Concurrency:** Web Workers for procedural terrain/noise and other CPU-heavy generation
- **Style:** Strict class-based architecture with dependency injection through a shared engine context

## Architecture Standard

Organize code by **semantic domain first**, technical role second.

Prefer this:

```text
src/animals/fish/FishController.ts
src/animals/fish/FishSpawner.ts
src/animals/fish/FishMeshFactory.ts
```

Over this:

```text
src/animals/controllers/FishController.ts
src/animals/spawning/FishSpawner.ts
src/animals/factories/FishMeshFactory.ts
```

A top-level system should usually be a small coordinator. Implementation details should live near the semantic thing they implement.

Examples:

- `AnimalSystem` coordinates animal populations; fish/bird/firefly behavior lives under their own folders.
- `TerrainChunk` coordinates chunk construction; prop, water, terrain mesh, and material details live in focused builders.
- `DebugOverlay` coordinates debug UI modes; read-only panel, editor, map rendering, and shared types live in separate files.
- `ChunkManager` coordinates streaming; material creation, persisted chunk mapping, river water meshes, and chunk boundary debug rendering live in helper classes.

### File Organization Rules

- Put semantic feature code together even when files have different technical roles.
- Avoid large “god” files that mix orchestration, rendering, persistence, generation, and UI details.
- Avoid barrel/re-export files that only mirror file names. Import concrete files directly.
- Use PascalCase file names for classes. If a utility file is PascalCase, define/export a class with static methods, e.g. `DeterministicRandom`.
- Keep shared, non-domain utilities in `src/utils/`.
- Keep root module files small and orchestration-focused.
- Extract builders/renderers/mappers when implementation details become substantial.

## High-Level Runtime Flow

```text
App
└── Game
    ├── EngineContext
    │   ├── engine
    │   ├── scene
    │   ├── canvas
    │   └── config/services
    ├── ProgressiveTerrainSystem
    │   ├── ChunkManager
    │   ├── TerrainGeneratorWorkerClient
    │   ├── TerrainGenerator
    │   └── WorldFeatureGenerator
    ├── PlayerController
    │   └── Compass
    ├── AnimalSystem
    │   ├── fish/
    │   ├── bird/
    │   └── firefly/
    ├── Environment Systems
    │   ├── TimeOfDaySystem
    │   ├── LightingController
    │   ├── CloudSystem
    │   └── DistantBackdropSystem
    ├── InventorySystem
    ├── Persistence Repositories
    └── DebugOverlay
```

## Source Layout Standard

Current preferred layout:

```text
src/
  main.ts

  app/
    EngineContext.ts
    Game.ts
    GameConfig.ts
    GameSettings.ts
    GameSystem.ts

  engine/
    BabylonBootstrap.ts

  player/
    PlayerController.ts
    Compass.ts

  items/
    Item.ts
    Backpack.ts
    InventorySystem.ts
    CoreItems.ts
    implementations/

  animals/
    AnimalSystem.ts
    AnimalTypes.ts
    fish/
      FishController.ts
      FishMeshFactory.ts
      FishSpawner.ts
    bird/
      BirdController.ts
      BirdMeshFactory.ts
      BirdSpawner.ts
    firefly/
      FireflyController.ts
      FireflyMeshFactory.ts
      FireflySpawner.ts

  world/
    ChunkCoord.ts
    ChunkManager.ts
    WorldBounds.ts
    chunks/
      ChunkBoundaryDebugRenderer.ts
      ChunkMaterialFactory.ts
      PersistedChunkMapper.ts
    generation/
      TerrainGenerator.ts
      TerrainGenerationTypes.ts
      TerrainGeneratorWorkerClient.ts
      WorldFeatureGenerator.ts
      terrain.worker.ts
    terrain/
      ProgressiveTerrainSystem.ts
      TerrainChunk.ts
      TerrainChunkHeightSampler.ts
      TerrainChunkMaterials.ts
      TerrainMeshBuilder.ts
      TerrainTypes.ts
      TestTerrainSystem.ts
    water/
      RiverWaterMeshBuilder.ts
      WaterMeshBuilder.ts
      WaterVolumeSampler.ts
    props/
      deadPine/
      groundLitter/
      log/
      pine/
      rock/

  environment/
    TimeOfDaySystem.ts
    LightingController.ts
    CloudSystem.ts
    DistantBackdropSystem.ts

  data/
    ChunkRepository.ts
    SaveGameRepository.ts
    LocalForageChunkRepository.ts
    LocalForageSaveGameRepository.ts

  debug/
    DebugOverlay.ts
    DebugOverlayTypes.ts
    DebugReadOnlyPanel.ts
    DebugSettingsEditor.ts
    DebugMapRenderer.ts

  utils/
    DeterministicRandom.ts
```

## Core Contracts

### EngineContext

The shared dependency object passed into systems that need Babylon access.

```ts
export interface EngineContext {
  readonly canvas: HTMLCanvasElement
  readonly engine: Engine
  readonly scene: Scene
  readonly config: GameConfig
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
- coordinate save/reset/new-world workflows
- dispose cleanly

### PlayerController

Responsibilities:

- own first-person camera or player body/camera rig
- read input
- apply movement at realistic scale
- expose world position and heading
- interact with terrain collision/height sampling and water sampling

### TimeOfDaySystem

Responsibilities:

- maintain world time
- configurable time scale
- drive sun/moon angle
- provide time data to environment and animal systems

### ProgressiveTerrainSystem and ChunkManager

`ProgressiveTerrainSystem` is the terrain-facing game system. `ChunkManager` owns chunk streaming orchestration.

Chunk streaming responsibilities:

- track player chunk position
- request generation for missing chunks
- instantiate chunks within radius
- unload chunks outside radius
- cache recently used chunk data
- merge saved mutation data into generated chunks
- expose terrain height sampling
- expose debug stats

Implementation details should remain extracted:

- `ChunkMaterialFactory` creates terrain/prop/water materials.
- `PersistedChunkMapper` maps persisted data to runtime terrain data.
- `ChunkBoundaryDebugRenderer` renders debug chunk bounds.
- `RiverWaterMeshBuilder` builds river water meshes.

### Terrain Generation Worker

Responsibilities:

- receive seed, chunk coordinate, size, resolution
- produce height data, terrain materials, and generated prop data
- return transferable typed arrays

Keep Babylon mesh creation on the main thread unless a later benchmark proves worker mesh generation is worth the complexity.

### TerrainChunk and Props

`TerrainChunk` should remain a composition root for one rendered chunk. It should delegate implementation-heavy work to builders.

Examples:

- `TerrainMeshBuilder`
- `WaterMeshBuilder`
- `TerrainChunkHeightSampler`
- prop builders under `world/props/*`

### AnimalSystem

`AnimalSystem` coordinates species populations. Species-specific details live under semantic subdirectories.

Responsibilities:

- update each species population
- expose active species counts
- dispose all populations

Species spawners/controllers own species-specific rules such as fish water validity, bird spawn height, and firefly night-only spawning.

### DebugOverlay

`DebugOverlay` should remain a coordinator for debug UI modes.

Implementation details live in:

- `DebugReadOnlyPanel`
- `DebugSettingsEditor`
- `DebugMapRenderer`
- `DebugOverlayTypes`

### Persistence Repositories

Persistence should be accessed through repository classes/interfaces, not directly from gameplay systems. See [Data and Persistence](data.md) for repository contracts, storage boundary rules, and initial persistence shapes.

## Persistence Shape

```ts
export interface SaveGame {
  version: number
  worldId: string
  worldSeed: number
  player: {
    position: [number, number, number]
    headingDegrees: number
  }
  time: {
    day: number
    timeOfDayHours: number
  }
}

export interface ChunkSaveData {
  key: string
  coordX: number
  coordZ: number
  worldSeed: number
  generatorVersion: number
  chunkSizeMeters: number
  resolution: number
  heights: number[]
  terrainMaterials?: number[]
  mutations: ChunkMutation[]
}

export type ChunkMutation =
  | { type: "propRemoved"; propId: string }
  | { type: "terrainDelta"; vertexIndex: number; deltaY: number }
```

## Near-Term Implementation Recommendation

When adding or expanding features:

1. Start with a simple coordinator/system.
2. Let complexity reveal semantic submodules.
3. Extract builders, renderers, mappers, spawners, and controllers into semantic folders.
4. Keep public orchestration classes small.
5. Prefer direct imports over barrel files.

Avoid building a full ECS initially. The current design goals fit well with explicit OOP systems and services.
