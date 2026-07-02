# Large Landforms and World Features

## Problem

Some terrain features are larger than a single streamed terrain chunk. Rivers, lakes, hill systems, valleys, and mountain ranges must remain continuous across chunk boundaries and should not be generated independently per chunk.

## Core Approach

Large landforms should be generated from **world-space feature layers** or explicit **world feature records**. Terrain chunks then sample those features while building their local mesh.

```text
WorldFeatureGenerator
  ├── regional elevation
  ├── hills
  ├── mountain ranges
  ├── valleys
  ├── river paths
  ├── lakes / ponds
  └── biome and material masks

TerrainChunk generation
  ↓
for each vertex world position:
  sample base terrain
  sample world features
  apply feature shaping
  output height/material masks
```

This keeps terrain deterministic and continuous while still allowing chunks to stream independently.

## Finite World Bounds

Stick should use a finite playable world/map extent rather than unbounded infinite terrain. Streaming should still load chunks lazily around the player, but landform generation should know the maximum world rectangle so it can create complete river, lake, ridge, valley, and biome systems within that area.

Benefits:

- world feature generation has a bounded problem space
- persistence has a known maximum set of terrain chunks
- player-made cartography can use a meaningful maximum paper/map scale
- extraction points and natural navigation barriers can be placed intentionally
- debug tools can visualize the whole world feature layout when needed

Boundary treatment should prefer believable natural limits over visible invisible walls. Good edge-enforcement landforms include:

- steep mountain ridges, cliffs, talus fields, or avalanche slopes
- a wide/deep river, canyon, or gorge with unsafe banks
- a large lake or reservoir that continues to the horizon
- dense deadfall, burned forest, thick brush, or impassable timber
- roads, closure signs, washed-out bridges, private land, or ranger barriers
- extraction-adjacent edges where the world naturally ends at safety

Use a layered approach: the visible/navigational barrier should appear before the technical world edge, and an invisible or hard collision boundary should sit behind the believable barrier as a safety net. Short term, chunk streaming may simply refuse to load outside-bounds chunks while player clamping/collision is implemented. Long term, each world edge should have one or more deterministic boundary features so the edge is readable from a distance and feels like part of the landscape.

World features may use a small generation margin outside the playable bounds so rivers, lakes, ranges, and valleys can enter or leave the map naturally. For example, a boundary lake should render beyond the playable shoreline far enough to avoid looking like a rectangular cut-off, and a mountain range should continue beyond the traversable slope.

## Architecture Direction

Current terrain generation is world-coordinate based, which is the right foundation:

```ts
height = terrainGenerator.getHeight(worldX, worldZ)
```

Evolve that into:

```ts
class TerrainGenerator {
  public getHeight(worldX: number, worldZ: number): number {
    const baseHeight = this._baseHeight(worldX, worldZ)
    const features = this._worldFeatures.sample(worldX, worldZ)

    return this._applyFeatures(baseHeight, features)
  }
}
```

Chunks should not decide independently whether they contain a river, lake, or mountain. They should ask the world feature layer what exists at each world position.

## Feature Types

### Regional Elevation

Broad terrain shape that establishes lowlands, uplands, valleys, and general altitude.

Possible inputs:

- low-frequency noise
- domain-warped noise
- optional regional masks

Example:

```text
height = regionalElevation * 80m
       + hillNoise * 20m
       + detailNoise * 3m
```

### Hills

Hills can be field-based or explicit landmark features.

Noise-based hills are good for general terrain variation. Explicit hill features are useful for memorable navigation landmarks.

```ts
interface HillFeature {
  readonly id: string
  readonly center: [number, number]
  readonly radiusMeters: number
  readonly heightMeters: number
  readonly falloffMeters: number
}
```

### Mountains and Ridges

Mountains need structure, not just random bumps.

Short-term options:

- ridge noise
- domain-warped ridge noise
- elevation masks that create highland regions

Longer-term explicit feature:

```ts
interface MountainRangeFeature {
  readonly id: string
  readonly points: Array<[number, number]>
  readonly widthMeters: number
  readonly peakHeightMeters: number
  readonly falloffMeters: number
}
```

Terrain samples distance to the range path and adds elevation based on distance/falloff.

### Rivers

Rivers should be continuous explicit paths, usually polylines or splines.

```ts
interface RiverFeature {
  readonly id: string
  readonly points: Array<[number, number]>
  readonly widthMeters: number
  readonly depthMeters: number
  readonly bankFalloffMeters: number
  readonly waterLevelMeters: number
}
```

Terrain shaping:

```text
if distanceToRiver < width:
  carve terrain toward riverbed
else if distanceToRiver < width + bankFalloff:
  smooth terrain toward bank/shore height
```

Rendering:

- carve terrain mesh down along the channel
- generate water mesh along the river path
- add muddy/sandy/rocky bank material masks
- use vegetation rules to increase/decrease plants near banks

### Lakes and Ponds

Lakes are basin features and are easier to implement than rivers.

```ts
interface LakeFeature {
  readonly id: string
  readonly center: [number, number]
  readonly radiusX: number
  readonly radiusZ: number
  readonly waterLevelMeters: number
  readonly depthMeters: number
  readonly shoreFalloffMeters: number
}
```

Terrain shaping:

```text
inside lake:
  terrain = min(terrain, waterLevel - depth)
near shore:
  smooth terrain toward waterLevel
```

Rendering:

- flat or lightly animated water mesh at `waterLevelMeters`
- shore material mask around edge
- lower tree density inside water and near immediate shore

## Material and Biome Masks

Large features should also output material/biome hints, not just height.

Examples:

```ts
interface TerrainSample {
  readonly heightMeters: number
  readonly grass: number
  readonly dirt: number
  readonly sand: number
  readonly pineNeedles: number
  readonly rock: number
  readonly water: number
}
```

This lets terrain rendering transition between grass, dirt, sand, forest floor, rock, and water-adjacent materials.

## Persistence Model

Do not persist each large landform separately per chunk as independent random data. Instead:

1. Persist global/world feature definitions.
2. Generate chunks by sampling those global features.
3. Persist visited chunk snapshots as terrain memory.

Possible save shape:

```ts
interface WorldFeatureSave {
  readonly version: number
  readonly worldSeed: number
  readonly generatorVersion: number
  readonly rivers: RiverFeature[]
  readonly lakes: LakeFeature[]
  readonly mountainRanges: MountainRangeFeature[]
  readonly hills: HillFeature[]
}
```

This keeps newly generated chunks aligned with old chunks, while chunk persistence preserves the exact terrain the player has already seen.

## Suggested Implementation Phases

### Phase 1: Better Noise-Based Landforms

- Add regional elevation noise.
- Add rolling hill noise.
- Add ridge/mountain noise.
- Add basic material masks.

### Phase 2: Lakes and Ponds

- Generate deterministic lake/pond basin features.
- Carve terrain around basins.
- Add simple water planes.
- Add shore material masks.

### Phase 3: Rivers

- Generate deterministic river polylines.
- Carve river channels.
- Add water strip meshes.
- Add bank smoothing/materials.

### Phase 4: Explicit World Feature Registry

- Add `WorldFeatureGenerator` / `WorldFeatureRegistry`.
- Persist world feature definitions through the data layer.
- Add debug visualization for feature paths, basins, and regions.

## Rule of Thumb

If a feature can cross a chunk boundary, generate it in world space and let chunks sample it. Do not let chunks invent large features independently.
