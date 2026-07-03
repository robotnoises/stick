# Terrain Streaming Budget

## Problem

Progressive terrain currently reacts to chunk movement by refreshing all desired chunks around the player as quickly as possible.

With the current terrain settings, the active area can be large:

```text
loadRadiusChunks = 3
active grid = 7 x 7 chunks = up to 49 rendered chunks
chunkSizeMeters = 64
chunkResolution = 32
```

When the player crosses into a new chunk, missing chunks may require several expensive steps:

1. Check in-memory cache.
2. Load persisted terrain from IndexedDB.
3. Generate fresh terrain data if no persisted chunk exists.
4. Save newly generated terrain data.
5. Build Babylon terrain mesh.
6. Build water meshes.
7. Create placeholder props.

Some repository work is asynchronous, but terrain generation and Babylon mesh creation still happen on the main thread. If several chunks are loaded or generated in one burst, the game can hitch or briefly freeze.

As terrain becomes richer with rivers, lakes, props, materials, and future flora, this burst cost will get worse.

## Goal

Terrain streaming should spread chunk lifecycle work across frames so the game remains responsive.

Instead of this:

```text
Player enters new chunk
  → load/generate/build every missing desired chunk immediately
  → possible frame hitch
```

Use this:

```text
Player enters new chunk
  → compute desired chunks
  → queue missing chunk work by priority
  → process only a small budget each frame
  → nearby terrain appears first
  → far terrain fills in progressively
```

## Budget Model

Start simple with a chunk-count budget:

```ts
maxChunkLoadsPerFrame = 1
```

This means each frame can activate at most one missing chunk. That chunk may come from memory, persistence, or generation.

Later, this can evolve into a time budget:

```ts
maxTerrainStreamingMillisecondsPerFrame = 4
```

A time budget is more adaptive, but a chunk-count budget is easier to reason about and test initially.

## Prioritization

Chunk work should be prioritized by distance from the player's current chunk.

Priority order:

1. Current player chunk.
2. Adjacent chunks.
3. Near visible chunks.
4. Outer load-radius chunks.

This ensures the area around the player is filled before distant terrain.

If the player moves again before the queue finishes, the queue should be rebuilt or reprioritized so obsolete far chunks do not delay nearby chunks.

## Proposed Runtime Flow

```text
Every frame:
  ProgressiveTerrainSystem gets player chunk coord
    ↓
  ChunkManager updates desired chunk set
    ↓
  ChunkManager disposes chunks beyond unload radius
    ↓
  ChunkManager queues missing chunks inside load radius
    ↓
  ChunkManager processes up to maxChunkLoadsPerFrame queued chunks
    ↓
  ChunkManager evicts raw cached data beyond memory radius
```

## Suggested API Direction

Current-style call:

```ts
await chunkManager.updateAround(center)
```

Budgeted direction:

```ts
chunkManager.setStreamingCenter(center)
await chunkManager.processStreamingBudget()
```

Or a combined update:

```ts
await chunkManager.updateStreaming(center)
```

Where `updateStreaming` should not attempt to complete all work. It should only do this frame's allowed amount of work.

## ChunkManager Responsibilities

The `ChunkManager` should maintain:

- active chunks
- active chunk coordinates
- raw chunk data cache
- in-flight load keys
- queued chunk coordinates
- current streaming center / desired set

On each streaming update:

1. Dispose distant active chunks.
2. Build the desired coordinate set.
3. Remove queued chunks that are no longer desired.
4. Add newly desired missing chunks to the queue.
5. Sort or insert queue entries by distance to center.
6. Process only the configured budget.
7. Evict distant raw cached data.

## Queue Rules

A chunk should not be queued if:

- it is already active
- it is already in flight
- it is outside world bounds
- it is already in the queue

When the player moves, queued chunks should be reprioritized by distance to the new center.

## Initial Defaults

Suggested initial options:

```ts
maxChunkLoadsPerFrame = 1
```

Keep existing radii:

```ts
loadRadiusChunks = 3
unloadRadiusChunks = 4
memoryRadiusChunks = 5
```

This gives conservative streaming behavior and should reduce hitches noticeably.

## Tradeoffs

### Benefits

- Reduces frame hitches from burst chunk generation and mesh creation.
- Makes terrain generation cost more predictable.
- Creates a clear place to add more sophisticated scheduling later.
- Helps future worker integration by separating queueing from execution.

### Costs

- Distant chunks may appear later after fast movement or teleporting.
- More lifecycle state in `ChunkManager`.
- Tests need to account for partial progress rather than all chunks appearing immediately.

## Debugging Needs

Useful debug information:

- active chunk count
- queued chunk count
- in-flight chunk count
- current player chunk coordinate
- chunks loaded this frame
- cache size

Future debug map improvements could show:

- active chunks
- queued chunks
- cached chunks
- unloaded chunks

## Implementation Phases

### Phase 1: Chunk-Count Budget

Status: implemented.

- [x] Add `maxChunkLoadsPerFrame` to `ChunkManagerOptions`.
- [x] Add budgeted queue processing through `ChunkManager.updateStreaming`.
- [x] Keep nearest-first priority.
- [x] Update `ProgressiveTerrainSystem` to call terrain streaming every frame while work remains.
- [x] Maintain full test coverage.

### Phase 2: Debug Metrics

Status: implemented.

- [x] Expose streaming debug stats from `ChunkManager` and `ProgressiveTerrainSystem`.
- [x] Show active / queued / in-flight counts in `DebugOverlay`.
- [x] Show raw chunk cache size and current chunk load budget in `DebugOverlay`.

### Phase 3: Time Budget

- Add optional millisecond budget.
- Process chunks until either count or time budget is reached.
- Track rough timing for generation vs mesh creation.

### Phase 4: Worker Integration

Status: initial terrain worker implemented.

- [x] Move terrain data generation to a worker with main-thread fallback.
- [x] Keep Babylon mesh creation on the main thread.
- [x] Use the same queue/budget system to schedule worker requests and main-thread mesh builds.
- [x] Add worker timing/error stats to terrain debug metrics.
- [x] Fall back to main-thread generation when worker requests fail.

## Open Questions

- Should mesh creation be budgeted separately from data load/generation?
- Should high-priority chunks be allowed to exceed the budget if the player is standing in missing terrain?
- Should teleports/debug placement temporarily increase the budget?
- Should distant queued chunks be cancelled aggressively when the player changes direction?
- What visual placeholder, if any, should appear for missing chunks inside the view distance?
