# Water Features

## Current State

Stick currently supports deterministic world-space water features through `WorldFeatureGenerator`.

Implemented feature types:

- lakes / ponds
- rivers

Terrain chunks sample these world features during generation so water features can cross chunk boundaries without being invented independently per chunk.

## Lakes and Ponds

Current lake behavior:

- Deterministic basin features are generated inside finite world bounds.
- Terrain is carved down inside the lake footprint.
- Shore terrain is smoothed toward the water level.
- Simple water planes render at the lake water level.
- Shore and underwater samples use sand material.
- Props are skipped underwater and near shore.

## Rivers

Current river behavior:

- Deterministic river polylines are generated in world space.
- Terrain samples distance to river centerlines.
- River channels are carved down from the base terrain.
- Banks are smoothed around the river width/falloff.
- River water is rendered as per-chunk terrain-following mesh patches, not one flat plane across the world.
- Props are skipped underwater and near immediate river banks.
- River paths appear on the revealed debug world map.

This fixes the first prototype issue where river water floated through empty space when the surrounding terrain elevation changed sharply.

## Known River Visual Issues

The current river water is intentionally rough and prototype-grade.

Known issues:

- River edges can look blocky or jagged because water visibility is currently based on terrain grid cells.
- Water edges may not line up perfectly with the visually carved channel edge.
- Steep river banks can expose abrupt terrain/water intersections.
- River width can appear quantized at low terrain resolution.
- Water does not yet have flow direction, animation, foam, ripples, or current cues.
- River water height follows local carved terrain rather than a physically simulated downstream gradient.

## River Polish Backlog

Future improvements:

1. Generate a smoother river ribbon mesh from the river centerline instead of cell-based quads.
2. Clip or shape the ribbon against the carved channel more cleanly.
3. Add shore/bank material transitions for wet sand, mud, gravel, and river stones.
4. Increase water mesh subdivision independently from terrain chunk resolution.
5. Add slight edge smoothing or noise so river borders do not look tiled.
6. Tune river carving so banks are less jagged and less steep by default.
7. Add a downstream water-level profile so river water descends believably across the map.
8. Add simple flow visuals: scrolling texture, subtle normal/wave movement, foam at sharp bends or steep drops.
9. Add river-specific prop rules: reeds, wet rocks, driftwood, gravel bars, fallen logs, and sparse vegetation.
10. Add debug overlays for river centerlines, width, bank falloff, underwater cells, and generated water mesh patches.

## Gameplay Water Volume

Water rendering is not yet enough for animals or player physics. Fish and future swimming/wading behavior should query a gameplay water volume rather than testing against Babylon water meshes.

The planned direction is to add a water query service that reports surface height, bed height, depth, shore distance, current direction, and whether a world-space point is submerged. See [Animals and Water Physics Plan](animals.md) for the fish-driven implementation plan.

## Design Notes

Rivers should be important navigation features. They should be visible and memorable from a distance, useful for orientation, and risky or costly to cross depending on future survival mechanics.

Long term, rivers should feel like landscape-shaping features rather than decorative strips of water. Terrain generation should continue to treat them as large world features sampled by chunks, not as per-chunk random content.
