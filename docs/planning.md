# Stick Planning Notes

## Product Direction

Stick is a web-based, first-person survival simulator set in a stylized but grounded Idaho forest. The design target is slow, tense, methodical wilderness survival rather than fast crafting-loop survival. See [Story and Game Objective](story.md) for the current narrative and objective direction.

## Core Pillars

1. **Realistic pace**
   - Time, distance, hunger, thirst, fatigue, and travel should feel believable.
   - Survival pressure builds over hours, not minutes.

2. **Landmark-based navigation**
   - No minimap or GPS-style HUD.
   - The player uses terrain silhouettes, compass bearings, trails, rivers, slopes, sun position, and memorable landmarks.
   - The player builds knowledge through a blank paper map/cartography system rather than automatic map reveal. See [Cartography and Paper Map Design](cartography.md).

3. **Resource scarcity and consequence**
   - The starting kit is minimal: hunting knife, lensatic compass, trench shovel, flint and steel, and blank paper map.
   - Survival actions should be deliberate and somewhat costly.

4. **Stylized realism**
   - Visual inspiration: Firewatch-like readability and color design, but more open-ended and systemic.
   - Low-poly/stylized art should support clarity, scale, and performance.

## Initial MVP Goal

Build a playable vertical slice proving scale, navigation, terrain streaming, and basic survival state.

### MVP Features

- First-person controller with walking, sprinting, crouching, jumping disabled or limited.
- WebGPU Babylon.js render loop with fallback decision documented later.
- Procedural terrain chunks around player.
- World-space landform generation for rivers, lakes, hills, mountains, and other multi-chunk terrain features.
- Stylized terrain material.
- Tree/rock/grass prop instancing.
- Compass item with accurate heading.
- Blank paper map/cartography prototype for player-made landmarks, route notes, grid scale, and distance-from-last-marker navigation.
- Day/night lighting cycle.
- Basic survival state:
  - hydration
  - hunger
  - stamina/fatigue
  - body temperature placeholder
- Basic persistence:
  - save player position
  - save time of day
  - save mutated chunk data
- Debug overlay only for development, not core gameplay.

## Suggested Milestones

### Milestone 0: Project Foundation

- Vite + TypeScript project.
- Babylon.js WebGPU bootstrap.
- Strict TypeScript config.
- EngineContext abstraction.
- Main game loop and lifecycle.

### Milestone 1: Movement and World Scale

- First-person camera/controller.
- 1 Babylon unit = 1 meter.
- Gravity and slope handling.
- Walking speed tuned to hiking pace.
- Compass heading calculation.

### Milestone 2: Terrain Prototype

See [Progressive Terrain Plan](progressive-terrain.md) and [Large Landforms and World Features](landforms.md).

- Deterministic seed-based chunk coordinates.
- First-generate terrain into memory, then persist visited chunk snapshots to IndexedDB.
- Rehydrate persisted chunks when the player returns to an area.
- Dispose distant rendered terrain and evict far raw chunk data from memory.
- Heightmap generation in worker.
- Chunk mesh generation on main thread or worker-assisted pipeline.
- Load/unload chunks around player.
- Basic terrain material.

### Milestone 3: Environmental Readability

- Landmark-scale terrain features.
- Tree/rock placement using deterministic procedural rules.
- Prop instancing and disposal.
- Biome/region rules placeholder.

### Milestone 4: Survival Loop

- Hunger/hydration/fatigue model.
- Stamina interaction with movement.
- Time scale configuration.
- Rest/wait prototype.
- Fire-making prototype using flint and steel.

### Milestone 5: Persistence

- IndexedDB/localForage save layer.
- Save player/session state.
- Save chunk mutations.
- Resume game flow.

## Open Design Questions

- Is the world finite, infinite, or practically infinite with seeded terrain?
- Should the terrain be based on real Idaho GIS/elevation data later, or fully procedural?
- What is the intended session length?
- Should permadeath exist?
- How realistic should injury, exposure, and water purification become?
- Will there be animals, NPCs, or only environmental pressure?
- Is crafting intentionally minimal, or just not defined yet?
