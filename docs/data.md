# Stick Data and Persistence

## Goal

Gameplay systems should not know which database or storage backend is being used. They should depend on repository contracts/classes so IndexedDB, local files, cloud saves, or test doubles can be swapped in later.

The first implementation will use IndexedDB through `localForage`.

## Repository Boundary

World, player, and gameplay systems should never import `localForage` or raw IndexedDB APIs directly. They should receive persistence dependencies through constructor injection.

Example:

```ts
export interface ChunkRepository {
  getChunk(key: string): Promise<PersistedChunkData | null>
  saveChunk(chunk: PersistedChunkData): Promise<void>
  deleteChunk(key: string): Promise<void>
  listChunkKeys(): Promise<string[]>
}

export class LocalForageChunkRepository implements ChunkRepository {
  // IndexedDB/localForage-backed implementation
}
```

The `ChunkManager` should depend on `ChunkRepository`, not `LocalForageChunkRepository`.

## Initial Repositories

### `ChunkRepository`

Stores generated terrain chunk snapshots and later chunk mutations.

Responsibilities:

- Load/save `PersistedChunkData` by chunk key.
- Delete chunks if a save/world is reset.
- List known chunk keys for debugging, cleanup, or future world summaries.
- Hide storage implementation from world systems.
- Handle schema version migration later.

### Future `SaveGameRepository`

Stores high-level save state that is not tied to a single terrain chunk.

Likely responsibilities:

- Save/load player position and orientation.
- Save/load time of day and elapsed world time.
- Save/load survival state.
- Save/load backpack contents and selected item.
- Manage save slots/world IDs.

## Persistence Shape

```ts
export interface SaveGame {
  version: number
  seed: number
  player: {
    position: [number, number, number]
    yaw: number
    survival: PlayerSurvivalSnapshot
    backpack: PlayerBackpackSnapshot
  }
  world: {
    timeOfDayHours: number
    elapsedWorldSeconds: number
  }
}

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
  readonly props: GeneratedPropData[]
  readonly mutations: ChunkMutation[]
  readonly generatedAt: number
  readonly lastVisitedAt: number
}

export type ChunkMutation =
  | { readonly type: "propRemoved"; readonly propId: string }
  | { readonly type: "terrainDelta"; readonly vertexIndex: number; readonly deltaY: number }
```

Typed arrays cannot be stored as JSON directly through all storage paths, so repositories should serialize them deliberately. Initially `heights: number[]` is acceptable. Later, if chunk data gets large, switch to an `ArrayBuffer` or compressed binary representation behind the same repository interface.

## Keying Strategy

Chunk keys should include enough scope to avoid collisions between worlds/saves.

Current scoped chunk key:

```text
${worldId}:chunk_${chunkX}_${chunkZ}
```

The default development world currently uses:

```text
default:chunk_${chunkX}_${chunkZ}
```

`worldId` scopes storage to avoid collisions between worlds/saves. `worldSeed` is stored inside the persisted chunk for compatibility checks, but the seed is not the storage key. Future save slots can use the save/world ID as this prefix.

## Implementation Rules

1. Keep repository interfaces small and task-oriented.
2. Inject repositories into systems that need persistence.
3. Keep serialization/deserialization inside repository implementations.
4. Keep schema migration inside the data layer.
5. Use in-memory fake repositories for tests and prototypes when useful.
