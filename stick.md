# Stick

## Game Overview

Stick is a web-based, first-person wilderness exploration and survival game set in a stylized but grounded Idaho forest during the summer.

The player is dropped into an unfamiliar area of a large open world with minimal supplies. There is no GPS, no minimap, and no exact starting-location marker. The objective is to explore, survive, chart the land, and find a safe pickup or extraction point.

The game should feel like a slow, tense hiking and camping simulator rather than a fast crafting-loop survival game. Travel, fatigue, daylight, water, food, terrain, and navigation all matter.

For the current story and objective direction, see [`docs/story.md`](docs/story.md).

---

## Core Fantasy

You are alone in the backcountry.

You have a few tools, a compass, flint and steel, a blank sheet of paper, and limited supplies. You need to understand the land well enough to make your way out.

The wilderness is not necessarily hostile in an action-game sense. It is large, quiet, beautiful, and indifferent. Getting lost, overextending, running out of daylight, becoming exhausted, or failing to find water should create the main tension.

---

## Primary Objective

Reach safety.

Possible safe destinations include:

- ranger station
- trailhead
- road
- fire lookout tower
- radio site
- pickup clearing
- river crossing
- abandoned structure with useful communication equipment

The player should not begin with a clear route. They must discover useful terrain, landmarks, paths, water sources, campsites, and clues through exploration.

---

## Core Pillars

### 1. Realistic Pace

- Survival pressure builds over hours, not minutes.
- Walking and running consume stamina and increase fatigue.
- Travel distance, slope, daylight, hunger, thirst, rest, and sleep should feel believable.
- `1 Babylon unit = 1 meter`.

### 2. Landmark-Based Navigation

- No minimap.
- No GPS-style HUD.
- Compass bearings matter.
- Terrain silhouettes, rivers, ponds, ridgelines, trails, slopes, sun position, and memorable landmarks are the main navigation tools.

### 3. Player-Made Cartography

- The player starts with a blank sheet of paper.
- Mapping is an active part of play.
- The player charts landmarks, routes, safe places, water sources, campsites, caves, and discoveries.
- The map should represent the player’s understanding, not perfect omniscient world data.

### 4. Resource Scarcity and Consequence

- Starting supplies are minimal.
- Loot exists but is rare and meaningful.
- The player must manage fatigue, hunger, thirst, exposure, injury, and daylight.
- Decisions to push forward, rest, camp, or turn back should matter.

### 5. Stylized Realism

- Visual target: readable, low-to-mid-poly, Firewatch-inspired wilderness.
- Art should prioritize strong silhouettes, navigation readability, mood, scale, and performance.

---

## Starting Inventory

Initial baseline:

- flint and steel for making fire
- hunting knife
- canteen
- solar flashlight
- blank paper map w/grid lines

Possible later additions depending on difficulty and story framing:

- small amount of food
- water bottle or canteen
- tent, tarp, or emergency shelter
- pencil/charcoal for mapmaking
- lighter, matches, or backup firestarter

---

## Core Gameplay Loop

```text
Observe surroundings
  ↓
Pick a direction, landmark, or short-term survival goal
  ↓
Travel by walking, climbing, descending, or following terrain
  ↓
Spend stamina, daylight, food, and water
  ↓
Discover landmarks, water, shelter, loot, or clues
  ↓
Mark useful information on the paper map
  ↓
Rest, sleep, eat, drink, or set up camp
  ↓
Use accumulated knowledge to travel farther
  ↓
Find a safe extraction/pickup location
```

---

## Exploration Discoveries

Rare discoveries should make the world feel inhabited and should reward careful exploration.

Examples:

- abandoned campsite
- fire ring
- lost backpack
- small supply cache
- cave or overhang
- pond, stream, or creek crossing
- trail marker or sign
- ranger note
- map scrap
- animal tracks
- lookout tower
- abandoned hunting blind
- broken radio equipment

Loot should be uncommon. Finding supplies should feel important rather than routine.

---

## Player-Created Places

The player can make the world more navigable and survivable by creating or improving places.

Examples:

- campsite
- tent location
- safe cave camp
- fire ring
- stash/cache
- marked route
- cairn or trail marker
- mapped water source

These places become personal landmarks and return points.

---

## Technology Stack

| Area | Technology | Notes |
| :--- | :--- | :--- |
| Language | TypeScript | Strict typing and class-based architecture |
| Engine | Babylon.js | Standard Babylon.js API |
| Graphics | WebGPU preferred | Use `WebGPUEngine`; document fallback decisions later |
| Persistence | IndexedDB via `localForage` | Save player/session state and persisted terrain chunks |
| Generation | Web Workers eventually | Terrain/noise generation should move off main thread after behavior is proven |
| Build | Vite | Existing web app setup |
| Tests | Vitest | Coverage target documented in `docs/coding-standards.md` |

---

## Architecture Direction

Stick uses explicit, class-based OOP systems with dependency injection through shared context objects.

High-level runtime shape:

```text
App
└── Game
    ├── EngineContext
    ├── PlayerSystem
    │   ├── PlayerController
    │   ├── Compass
    │   ├── PlayerSurvivalState
    │   ├── Backpack / InventorySystem
    │   └── Cartography / PaperMap
    ├── WorldSystem
    │   ├── ProgressiveTerrainSystem
    │   ├── ChunkManager
    │   ├── TerrainGenerator
    │   ├── WorldFeatureRegistry
    │   └── PropPlacementSystem
    ├── EnvironmentSystem
    │   ├── TimeOfDaySystem
    │   ├── LightingController
    │   └── WeatherSystem
    ├── PersistenceSystem
    │   ├── SaveGameRepository
    │   ├── ChunkRepository
    │   └── WorldFeatureRepository
    └── DebugSystem
```

Key rules:

- Gameplay systems should not directly import IndexedDB/localForage.
- Persistence should be hidden behind repository classes/interfaces.
- Terrain chunks should sample world-space generation so features continue across chunk boundaries.
- Large landforms such as rivers, lakes, valleys, and mountain ridges should be generated as world features, not invented independently per chunk.
- Babylon mesh creation should stay on the main thread unless later profiling proves worker mesh generation is worth the complexity.

---

## Persistence Direction

Persistence should support:

- player position and orientation
- time of day and elapsed world time
- survival state
- backpack contents and selected item
- player-created map data
- discovered/mapped locations
- created camps/stashes/markers
- terrain chunk snapshots
- terrain/prop mutations
- world feature definitions

Chunk snapshots preserve visited terrain even if generation algorithms change later. Save slots/world IDs should eventually prefix chunk keys to avoid collisions between worlds.

See [`docs/data.md`](docs/data.md) and [`docs/progressive-terrain.md`](docs/progressive-terrain.md).

---

## Important Design Constraints

- No minimap or GPS-style player marker by default.
- Navigation should be grounded in observation, compass use, terrain, landmarks, and player-made cartography.
- Survival pressure should be slow and believable.
- Running should be possible but costly.
- Camping, fire-making, rest, sleep, food, and water should be necessary for longer travel.
- Loot should be rare and valuable.
- The player should be able to get meaningfully lost.
- The world should reward planning, note-taking, mapping, and cautious exploration.

---

## Documentation Map

- [`docs/story.md`](docs/story.md) — story, objective, player fantasy, discoveries
- [`docs/cartography.md`](docs/cartography.md) — homemade paper map, grid scale, dead reckoning, and drawing mechanics
- [`docs/inventory.md`](docs/inventory.md) — backpack, core items, found items, selection, and use mechanics
- [`docs/planning.md`](docs/planning.md) — product direction, pillars, MVP, milestones
- [`docs/architecture.md`](docs/architecture.md) — current architecture plan and source layout
- [`docs/progressive-terrain.md`](docs/progressive-terrain.md) — streaming terrain plan
- [`docs/terrain-streaming-budget.md`](docs/terrain-streaming-budget.md) — per-frame terrain streaming budget plan
- [`docs/landforms.md`](docs/landforms.md) — large world feature generation
- [`docs/water.md`](docs/water.md) — lake, pond, and river generation notes and polish backlog
- [`docs/data.md`](docs/data.md) — persistence boundaries and repository contracts
- [`docs/art-assets.md`](docs/art-assets.md) — art direction and asset pipeline
- [`docs/tasks.md`](docs/tasks.md) — current task list
- [`docs/coding-standards.md`](docs/coding-standards.md) — quality gates and testing expectations
- [`docs/code-style.md`](docs/code-style.md) — TypeScript style guide
