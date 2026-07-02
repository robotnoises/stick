# Progressive Terrain Plan

## Goal

The world should stream around the player in first person, feel continuous at chunk boundaries, and feel familiar when the player returns to a previously visited area.

Terrain generation should have three layers:

1. **Deterministic base generation** from `worldSeed`, chunk coordinate, and generator version.
2. **Persisted chunk memory** in IndexedDB for chunks the player has visited/generated.
3. **Runtime chunk instances** in Babylon meshes and prop instances around the player.

This lets the game unload distant terrain from memory while preserving the exact terrain and prop layout for later rehydration.

## Initial Scope

Start with synchronous main-thread generation, then move CPU-heavy generation to a worker later.

Initial defaults:

```ts
chunkSizeMeters = 64
chunkResolution = 32 // 33 x 33 vertices
loadRadiusChunks = 2 // 5 x 5 active chunks
unloadRadiusChunks = 3
memoryRadiusChunks = 4 // keep raw chunk data briefly after mesh disposal
```

## Finite World Bounds

Progressive terrain should stream lazily inside a finite playable world extent. The bounds should live in world/game config initially and later in save data. `ChunkManager` should filter desired chunk coordinates against those bounds, while `TerrainGenerator` and future `WorldFeatureGenerator` use the same bounds to create finite landform and biome systems.

Do not pre-generate every chunk inside the bounds. The bounds limit the possible coordinate space and feature registry, while chunks are still generated, loaded, persisted, and unloaded on demand. Short-term prototypes may clamp/refuse outside-bounds chunks; long term, world edges should be hidden or justified by natural barriers and extraction/world-design constraints.

Edge enforcement should be two-layered: render deterministic boundary landforms just inside/along the bounds, then keep a simple hard collision/clamp behind them as a fallback. Boundary chunks may need special generation rules for mountains, cliffs, rivers, canyon walls, horizon lakes, dense deadfall, or other impassable terrain.

## Runtime Flow

```text
Player moves
  ↓
ProgressiveTerrainSystem computes current chunk coord
  ↓
ChunkManager determines desired chunk set
  ↓
For each missing nearby chunk:
  1. Check in-memory chunk data cache
  2. Else load persisted chunk from IndexedDB
  3. Else generate new chunk from seed
  4. Store generated chunk data in IndexedDB
  5. Build Babylon mesh + props
  ↓
For distant chunks:
  1. Persist dirty mutations if needed
  2. Dispose Babylon mesh + props
  3. Keep raw chunk data only if inside memory radius / LRU budget
  4. Drop raw data from memory when too far away
```

## Why Persist Generated Chunks?

The base terrain can be deterministic, so in theory we can regenerate the same heights from seed. However, persisting first-generation chunk snapshots gives us:

- stable terrain if generation algorithms change later
- stable prop placement and landmark identity
- faster rehydration when walking back
- a natural place to merge player mutations
- a stronger sense that visited terrain is remembered

The generator should still be deterministic. Persistence is a cache plus historical record, not a replacement for good seeded generation.

## Core Classes

### `ProgressiveTerrainSystem`

Game system responsible for updating terrain around the player.

Responsibilities:

- Track player chunk coordinate.
- Ask `ChunkManager` to load/unload chunks.
- Expose terrain height sampling to player movement later.
- Own per-frame terrain streaming budget.

### `ChunkManager`

Coordinates chunk lifecycle.

Responsibilities:

- Maintain active `TerrainChunk` instances.
- Maintain a small LRU cache of raw `ChunkTerrainData`.
- Request persisted chunks from `ChunkRepository`.
- Request fresh chunks from `TerrainGenerator` when no saved data exists.
- Dispose distant chunks.

### `TerrainChunk`

Owns renderable runtime objects for one chunk.

Responsibilities:

- Build terrain mesh from `ChunkTerrainData`.
- Create deterministic prop instances from chunk data.
- Dispose mesh and props cleanly.
- Track dirty mutation state.

### `TerrainGenerator`

Pure procedural generation service.

Responsibilities:

- Given seed, chunk coordinate, chunk size, and resolution, produce `ChunkTerrainData`.
- Sample by world coordinates so neighboring chunks share exact edge heights.
- Generate prop candidates deterministically.

### `ChunkRepository`

Repository abstraction for chunk persistence. See [Data and Persistence](data.md) for the repository contract and storage boundary rules.

The `ChunkManager` should receive a `ChunkRepository` through constructor injection rather than importing database APIs directly.

## Data Model

### Runtime Chunk Data

```ts
export interface ChunkCoordData {
  readonly x: number
  readonly z: number
}

export interface ChunkTerrainData {
  readonly key: string
  readonly coord: ChunkCoordData
  readonly chunkSizeMeters: number
  readonly resolution: number
  readonly generatorVersion: number
  readonly seed: number
  readonly heights: Float32Array
  readonly terrainMaterials: Uint8Array
  readonly props: GeneratedPropData[]
}

export interface GeneratedPropData {
  readonly id: string
  readonly type: "pine" | "rock" | "log"
  readonly position: [number, number, number]
  readonly rotationY: number
  readonly scale: number
}
```

### Persisted Chunk Data

Persisted chunk keys should be scoped by world/save ID, for example `default:chunk_0_0`. The seed is stored as chunk metadata for compatibility checks, not used as the storage key.

Typed arrays cannot be stored as JSON directly through all storage paths, so the repository should serialize them deliberately. See [Data and Persistence](data.md) for broader data-layer rules.

```ts
export interface PersistedChunkData {
  readonly version: number
  readonly key: string
  readonly coordX: number
  readonly coordZ: number
  readonly worldSeed: number
  readonly generatorVersion: number
  readonly chunkSizeMeters: number
  readonly resolution: number
  readonly heights: number[]
  readonly terrainMaterials: number[]
  readonly props: GeneratedPropData[]
  readonly mutations: ChunkMutation[]
  readonly generatedAt: number
  readonly lastVisitedAt: number
}

export type ChunkMutation =
  | { readonly type: "propRemoved"; readonly propId: string }
  | { readonly type: "terrainDelta"; readonly vertexIndex: number; readonly deltaY: number }
```

Later, if chunk data gets large, we can switch `heights` to an `ArrayBuffer`/binary representation.

## Chunk Lifecycle States

```text
missing
  ↓
loading-from-memory | loading-from-db | generating
  ↓
hydrated-data
  ↓
active-rendered
  ↓
disposed-render
  ↓
cached-data
  ↓
evicted
```

Definitions:

- **hydrated-data:** raw height/prop data is available but no Babylon mesh exists yet.
- **active-rendered:** chunk has mesh/props in scene.
- **disposed-render:** Babylon objects were disposed, but data may still be in memory.
- **evicted:** no runtime memory remains; reload requires IndexedDB or regeneration.

## Load/Unload Policy

Use two radii to avoid popping and thrashing:

- `loadRadiusChunks`: chunks within this radius should be rendered.
- `unloadRadiusChunks`: chunks beyond this radius should dispose render objects.
- `memoryRadiusChunks`: chunks beyond this radius can be evicted from raw memory cache.

Example:

```text
0-2 chunks away: rendered
3 chunks away: grace band, do not immediately unload/reload repeatedly
4 chunks away: mesh disposed, raw data may remain cached
5+ chunks away: raw data can be evicted from memory
```

## Persistence Rules

1. New chunks are saved after generation succeeds.
2. Existing chunks update `lastVisitedAt` when activated.
3. Player mutations mark the chunk dirty.
4. Dirty chunks are saved before mesh disposal and periodically as a safety measure.
5. If a persisted chunk's `generatorVersion` differs from the current version, prefer the persisted chunk for already visited terrain.
6. If `worldSeed`, `chunkSizeMeters`, or `resolution` differs, treat persisted data as incompatible unless a migration exists.

## Terrain Generation Notes

For large landforms that span multiple chunks, see [Large Landforms and World Features](landforms.md).

Chunk edge heights must be sampled from absolute world positions:

```ts
worldX = chunkX * chunkSizeMeters + localX
worldZ = chunkZ * chunkSizeMeters + localZ
height = noise(worldX, worldZ, seed)
```

This prevents cracks because adjacent chunks compute the same height for shared edge coordinates.

Initial height recipe:

```text
height = broad hills * 18m
       + medium variation * 5m
       + small roughness * 1m
```

Initial biome/prop placement can be simple:

- slope below threshold allows trees
- noise controls density
- deterministic per-chunk random chooses exact candidates

## Near-Term Implementation Steps

1. Add `ChunkCoord` utility.
2. Add `TerrainGenerator` producing `ChunkTerrainData`.
3. Add `TerrainChunk` that builds one mesh from height data.
4. Add `ChunkRepository` interface and `LocalForageChunkRepository` implementation.
5. Inject `ChunkRepository` into `ChunkManager`; do not let terrain systems import database APIs directly.
6. Add `ChunkManager` with load/unload/cache behavior.
7. Replace `TestTerrainSystem` with `ProgressiveTerrainSystem`.
8. Wire player height sampling after visual streaming works.
9. Move generation to a worker once behavior is correct.

## Open Questions

- Should initially generated terrain snapshots be permanent forever, or can old untouched chunks be regenerated after major version changes?
- How large should the memory cache be on low-end browsers?
- Should terrain edits be stored as sparse deltas forever, or periodically baked into a new chunk snapshot?
- How aggressively should chunk saves be debounced?
- Do we want multiple save slots/worlds, and therefore a save ID prefix for all chunk keys?
