# Tasks

## Menu, Pause, and Save Flow

- [ ] Add pause game behavior.
  - [ ] Stop or gate gameplay simulation updates while paused.
  - [ ] Keep pause/menu UI interactive while paused.
  - [ ] Decide whether inventory/backpack and paper map pause the world or leave time running.
- [x] Add a save game option to the menu.
- [x] Rename “Options” to “Menu”.
- [x] Persist last player position to the database when saving.
- [ ] Prevent accidental refresh/close. Short term: use a browser alert/confirmation.

## UI and Design System

- [ ] Install Tailwind.
- [ ] Begin a small design system for common UI elements.
- [ ] Start with menu panels, buttons, form controls, overlays, and debug/dev-only elements.

## Player Movement and Feedback

- [ ] Add sounds.
- [ ] Add walking head-bob: camera should bounce up/down subtly based on movement speed.
- [ ] Add running.
- [ ] Add jumping.
- [ ] Add general collision detection.

## Backpack and Items

- [ ] Use [Backpack and Item System](inventory.md) as the mechanics source for inventory.
- [ ] Add item implementations for core items:
  - [ ] flint & steel
  - [ ] knife
  - [ ] canteen
  - [x] solar flashlight
  - [ ] blank paper map
- [ ] Add backpack UI for viewing items.
- [ ] Add one-selected-item behavior.
- [ ] Add item use key behavior.
- [ ] Add item discard behavior and confirmation design for important items.
- [ ] Add found-item pickup flow for rare loot.

## Survival and Player State

- [ ] Add player vitals:
  - [ ] health
  - [ ] fatigue
  - [ ] hunger
  - [ ] thirst
  - [ ] body temperature / exposure
  - [ ] injury status
- [ ] Add fire-making with flint and steel:
  - [ ] collect or use tinder/fuel
  - [ ] start a campfire
  - [ ] maintain/let fire burn down over time
  - [ ] connect fire warmth to exposure/body temperature later

## Story and Progression

- [ ] Use [Story and Game Objective](story.md) as the current narrative/design source for player goals.
- [ ] Add a state machine for tracking player progress.
- [ ] Add story/progression content coupled to the state machine:
  - [ ] player goals/objectives
  - [ ] tutorial mission to start
  - [ ] follow-up missions or survival prompts
  - [ ] objective to locate a safe pickup/extraction point
- [ ] Add rare exploration discoveries:
  - [ ] abandoned campsites
  - [ ] supply caches or lost backpacks
  - [ ] caves/overhangs
  - [ ] trail markers/signs
  - [ ] map scraps or notes

## Terrain and Environment Variety

- [ ] Define finite playable world/map bounds before adding large landforms, so generated features and streamed chunks have a maximum extent.
  - [ ] Add deterministic boundary landforms for world-edge enforcement: mountains/cliffs, wide rivers/canyons, horizon lakes, dense deadfall/forest, or road/closure barriers.
  - [ ] Add a hard collision/clamp fallback behind natural boundary features.
- [ ] Add more terrain generation variety:
  - [x] grass
  - [x] dirt
  - [x] sand
  - [x] pine needles / forest floor
- [ ] Improve tree rendering; see [Tree Rendering and Pine Improvement Plan](trees.md).
  - [x] Document procedural pine branch/node/foliage card plan.
  - [x] Add deterministic pine branch generation.
  - [x] Add secondary branch nodes/twigs.
  - [x] Add textured pine needle/foliage cards.
  - [x] Add pine profile variants.
  - [x] Polish dead pine branch generation.
  - [x] Add fallen log branch stubs.
  - [x] Add pine needle ground litter cards.
  - [ ] Tune performance and silhouette readability.
- [x] Add deterministic forest composition patches for dense stands, sparse clearings, deadfall zones, and mixed tree ages.
- [ ] Add more tree types.
- [ ] Add animals.
- [ ] Add more flora; this should be a major investment area.
- [ ] Add tree states:
  - [x] alive
  - [x] dead
  - [x] fallen/log variants
- [ ] Add water features:
  - [x] lakes
  - [x] ponds
  - [x] rivers

## World Streaming and Terrain Generation

- [x] Add a terrain generation worker and keep Babylon mesh creation on the main thread unless benchmarks prove otherwise.
- [x] Add a per-frame terrain streaming budget so loading chunks does not hitch gameplay. See [Terrain Streaming Budget](terrain-streaming-budget.md).
- [x] Add regional elevation, rolling hills, and ridge/mountain noise layers.
- [ ] Add terrain material masks for grass, dirt, sand, pine needles / forest floor, rock, shore, and water-adjacent areas.
- [ ] Add deterministic world-space feature generation for large landforms that cross chunk boundaries.
- [ ] Add deterministic lake and pond basin features with simple water planes.
- [x] Add deterministic river path features with carved channels, bank smoothing, and water strip meshes.
- [ ] Polish river rendering; see [Water Features](water.md).
  - [ ] Replace cell-based river water with smoother river ribbon meshes.
  - [ ] Improve river edge clipping/shape against carved channels.
  - [ ] Add river bank material transitions for wet sand, mud, gravel, and stones.
  - [ ] Tune river carving to reduce jagged or overly steep banks.
  - [ ] Add downstream water-level profiles and simple flow visuals.
- [ ] Add a world feature registry/save shape for rivers, lakes, hills, and mountain ranges.
- [ ] Add debug visualization for chunk boundaries, feature paths, water basins, and biome/material masks.
  - [x] Show chunk boundaries on the revealed debug world map.
  - [x] Show lake basins and shore falloff on the revealed debug world map.
  - [x] Show river paths, water width, and bank falloff on the revealed debug world map.
  - [ ] Add terrain material / biome mask visualization.
  - [x] Show terrain streaming stats in the debug overlay.
  - [x] Add in-world debug overlay toggle for nearby chunk boundaries.
  - [ ] Add in-world debug overlays for water masks.
- [ ] Remove or fully retire `TestTerrainSystem` once progressive terrain is the only terrain path.

## Persistence and Save Data

- [x] Add a `SaveGameRepository` for high-level save state.
- [x] Persist and restore time of day and elapsed world time.
- [ ] Persist and restore survival state once vitals exist.
- [ ] Add save slots or world IDs and prefix chunk keys to avoid collisions between worlds.
- [ ] Add chunk dirty-state tracking, mutation saves, and debounced autosave/safety saves.
- [ ] Add schema version migration handling for save games, world features, and persisted chunks.
- [ ] Add reset/delete-world cleanup for save state, world features, and terrain chunks.

## Navigation and Environment Systems

- [ ] Add an in-game compass item or inspection overlay instead of relying only on debug heading text.
- [ ] Use [Cartography and Paper Map Design](cartography.md) as the mechanics source for the paper map.
- [ ] Add a blank paper map/cartography system for player-made landmarks, routes, notes, and approximate area mapping.
- [ ] Add starting map details:
  - [ ] center `X` marking the starting point
  - [ ] gridlines
  - [ ] configurable map scale
  - [ ] scale bar / legend placeholder
- [ ] Add distance-from-last-marker tracking for dead reckoning.
- [ ] Add manual marker placement; do not auto-place exact player position.
- [ ] Add freehand drawing tools for rivers, trails, routes, and terrain notes.
- [ ] Add colored pencil/pen support for player-defined map meaning.
- [ ] Keep navigation free of minimap/GPS-style HUD elements; use landmarks, compass bearings, trails, rivers, slopes, sun position, and player-made maps.
- [ ] Add trail/path generation and trail material masks.
- [ ] Add weather placeholder systems and connect weather to exposure/body temperature later.
- [ ] Expand day/night lighting with moonlight and night readability tuning.
  - [x] Add gradient sky dome for dawn/dusk/day/night.
  - [x] Add deterministic batched star field.

## Assets and Art Pipeline

- [ ] Create the proposed asset folder structure under `assets/` for source and exported content.
- [ ] Pick a temporary Idaho summer forest color palette.
- [ ] Build or import `Pack 001: Forest Blockout`:
  - [ ] pine small / medium / large
  - [ ] dead tree
  - [ ] fallen log
  - [ ] small / medium / large rock
  - [ ] grass clump
  - [ ] bush
  - [ ] compass placeholder
  - [ ] flint and steel placeholder
  - [ ] knife placeholder
  - [ ] canteen placeholder
  - [ ] solar flashlight placeholder
- [ ] Validate imported assets for meter scale, ground-contact origin, clean naming, and instancing performance.
- [ ] Add placeholder paper map and mapping tool assets.

## Testing and Quality Gates

- [ ] Ban new uses of the TypeScript `any` keyword in application and test code.
  - [ ] Replace existing `as any` test internals access with typed test helpers or public debug/test APIs.
  - [ ] Add linting or a typecheck-adjacent gate to prevent future `any` usage.
- [ ] Add or maintain unit coverage for terrain generation, chunk coordinate math, repository serialization, save data, and survival logic.
- [ ] Run required checks before completing TypeScript work:
  - [ ] `npm run typecheck`
  - [ ] `npm run test:coverage`
  - [ ] `npm run build`
