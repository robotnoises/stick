# Cartography and Paper Map Design

## Purpose

The homemade paper map is a core game mechanic for Stick.

The player begins in an unfamiliar wilderness area with no GPS and no minimap. The map is not an automatic reveal of the world. It is a tool the player uses to record their own understanding of the terrain.

The fun should come from observation, estimation, imperfect memory, and manual placement. A good map is earned through careful travel.

## Core Fantasy

You are lost in the backcountry with a compass, a blank map sheet, and enough discipline to chart your way out.

The player should feel like they are doing real field navigation:

- choose a bearing
- walk a measured distance
- identify terrain features
- mark a point
- sketch rivers, ponds, ridges, trails, camps, caves, and landmarks
- use the map later to return, reroute, or find safety

## Starting Map

The player starts with a paper map that contains:

- an `X` at the center marking the starting point
- gridlines
- a printed or handwritten scale
- blank space for symbols, routes, notes, and sketches

The starting `X` is not a world-coordinate GPS marker. It is the player’s known origin for relative navigation.

Example framing:

```text
You know where you started.
You do not know where that point is in the larger world.
```

## Scale and Gridlines

The map needs a scale that is useful for hiking and survival decisions.

### Real-World Reference

The game uses `1 Babylon unit = 1 meter`.

Useful conversions:

```text
1 mile = 1,609 meters
1 square mile = about 2.59 square kilometers
Current terrain chunk default = 64 meters
1 mile = about 25 terrain chunks
```

### Candidate Grid Scales

#### Option A: 1 major square = 1 mile

Pros:

- Familiar real-world hiking scale.
- Encourages long-distance planning.
- Makes “walk one mile north, then mark the point” feel meaningful.

Cons:

- A one-mile grid square is large; many local details may need subdivisions.
- If the early world is small, the map may feel too coarse.

Possible solution:

- Use bold major gridlines every 1 mile.
- Use faint minor gridlines every quarter mile or 250 meters.

#### Option B: 1 major square = 1 kilometer

Pros:

- Aligns directly with metric world units.
- Easier implementation and distance math.
- Similar enough to hiking-scale navigation.

Cons:

- Less familiar for players thinking in miles.
- Still somewhat coarse for local campsite/pond/cave details.

Possible solution:

- Show metric scale by default, optionally label mile equivalents.

#### Option C: 1 major square = 500 meters

Pros:

- Better for dense exploration and local detail.
- Easier to map nearby discoveries.

Cons:

- Larger wilderness journeys require more map space.
- May make navigation feel more game-like and less backcountry-scale.

### Current Recommendation

Start with:

```text
Major grid: 1 mile
Minor grid: 1/4 mile
Scale bar: 0.25 mi / 0.5 mi / 1 mi, with metric equivalent if useful
```

This supports the opening strategy of walking a cardinal direction for about one mile and placing a new marker.

If the playable world starts smaller, prototype with:

```text
Major grid: 1 kilometer
Minor grid: 250 meters
```

The map UI should make scale configurable so this can be tuned.

## Basic Mapping Loop

The player’s early mapping strategy might be:

1. Start at the center `X`.
2. Pick a direction using the compass, such as north.
3. Walk a straight-ish line while watching heading and terrain.
4. Track distance from the last marker.
5. After one mile, stop and manually place a new mark on the paper map.
6. Add notes about what was seen along the way.
7. Repeat to build a rough coordinate system around the start point.

The map should not place the mark automatically. The player chooses where it goes.

This creates satisfying imperfection:

- Did they really walk straight?
- Did slopes and detours change the route?
- Did they overestimate or underestimate distance?
- Did they place the marker in the right grid square?

## Information Available to the Player

The map should be powerful, but not magical.

### Allowed / Intended Information

- compass heading
- distance from the last marker or last reset point
- rough elapsed travel time
- visible terrain and landmarks
- player memory
- map notes and symbols the player created

### Avoid by Default

- automatic exact player position
- full terrain reveal
- GPS trail line
- automatic river/trail tracing
- auto-corrected map marks

## Distance From Last Marker

The only precise-ish travel information the player has is “distance from last marker.”

This could be framed as one of these mechanics:

### Option A: Pace Count / Odometer Approximation

The game displays or exposes a rough distance traveled since the player last reset their count or placed a marker.

Pros:

- Supports deliberate dead reckoning.
- Easy for players to understand.
- Good for early gameplay.

Cons:

- If too exact, it becomes GPS-like.

Tuning idea:

- Give distance rounded to broad increments, such as 25m, 50m, or 0.05 miles.
- Make steep terrain, running, injuries, or fatigue reduce accuracy later.

### Option B: Manual Pace Counting

The game gives no number, but the player can use time and walking speed to estimate distance.

Pros:

- Very immersive and hardcore.

Cons:

- May be too tedious or inaccessible.

### Option C: Difficulty-Based Distance Precision

Different difficulties expose different levels of distance help.

Example:

```text
Guided: distance since last marker shown clearly
Standard: rounded estimate only
Hardcore: no distance readout; use time and pace
```

### Current Recommendation

Prototype with a readable “distance from last marker” value, then tune precision downward if it feels too exact.

## Manual Map Tools

The map should support a small set of drawing and annotation tools.

### Point Markers

Examples:

- start point
- current estimate
- campsite
- water source
- cave
- abandoned camp
- cache/stash
- lookout
- trail marker
- danger or obstacle

### Lines

Examples:

- traveled route
- river/creek
- trail/path
- ridge line
- planned route
- boundary/impassable slope

### Areas

Examples:

- pond/lake
- dense forest
- clearing
- marsh/wet ground
- rocky area
- safe camp area

### Notes

Freeform notes or short labels:

- “good camp”
- “water here”
- “steep climb”
- “heard river east”
- “old campsite, empty cans”

## Drawing Materials

The player may have multiple writing tools.

Possible tools:

- pencil for normal map marks
- colored pencils for terrain categories
- pen for confirmed routes/features
- charcoal or improvised marking tool if pencil is lost/broken

Color can support player-created meaning:

- blue: water
- green: forest/vegetation
- brown: trails/ridges/terrain
- red: danger, objective, or important notes
- black/gray: confirmed structures or camps

This should remain flexible. The player can invent their own legend.

## Symbols and Legend

The map should allow symbols that are fast to place.

Possible default symbols:

```text
X = start or important point
△ = high point / ridge / lookout
○ = camp
~ = water
□ = structure
! = danger / important note
* = landmark
```

The player may also draw freely.

A small optional legend panel could remind players of symbols, but the map should not force one interpretation.

## Mapping Terrain Features

### Rivers and Creeks

If the player finds a river, they may choose to follow it for a while and sketch its path on the grid.

Important behavior:

- The game does not automatically draw the river.
- The player draws the approximate curve based on what they saw.
- Following rivers can become a reliable navigation strategy.

### Ponds and Lakes

Water bodies are valuable map targets because they are survival resources and landmarks.

The player can mark:

- shape/shoreline estimate
- safe drinking spot
- nearby camp location
- direction of inflow/outflow if visible

### Ridges and High Ground

High ground should be especially useful for mapping.

Possible mechanic:

- At higher vantage points, the player can identify distant landmarks and place approximate bearing lines.
- The player still chooses where marks go.

### Trails and Clearings

Trails, paths, and clearings are important because they connect places and aid navigation.

The player can draw them as confirmed or estimated routes.

## Accuracy and Error

Map inaccuracy is part of the design.

Sources of error:

- walking off bearing
- detouring around obstacles
- slope affecting travel distance perception
- poor visibility
- night travel
- fatigue or injury
- player misplacement
- confusing similar landmarks

The game should generally avoid punishing small errors too harshly. Instead, map inaccuracy should create interesting navigation decisions.

## Interaction Model

Possible interaction flow:

1. Open paper map.
2. Choose tool: marker, line, free draw, note, erase.
3. Pan/zoom the paper.
4. Place or draw manually.
5. Optionally attach a compass bearing or distance note.
6. Close map and continue traveling.

The map should feel tactile and slightly imperfect, not like a sterile digital editor.

## Possible Endgame Uses

The map can become part of the endgame identity.

Ideas:

### Map Overlay Reveal

At the end of a run, overlay the player’s handmade map on top of the actual terrain/map.

This can show:

- how accurate their routes were
- where they missed key features
- how close they came to danger or safety
- the true shape of rivers, ponds, ridges, and trails

### Rescue / Extraction Requirement

The player may need enough mapped knowledge to identify or reach a pickup point.

Examples:

- Find high ground, identify a landmark, and navigate to a clearing.
- Discover a radio site and describe/mark your location.
- Reach a road/trailhead using your own route map.

### Score / Debrief

The final screen could include map-based stats:

- distance traveled
- camps made
- water sources found
- map accuracy
- landmarks discovered
- unused safe routes nearby

Map accuracy should be interesting feedback, not necessarily a strict score unless that becomes fun.

## Data Model Direction

The map should persist as player-created data, not generated world truth.

Possible shape:

```ts
export interface PaperMapSaveData {
  readonly version: number
  readonly worldId: string
  readonly originWorldPosition: [number, number, number]
  readonly scaleMetersPerMajorGrid: number
  readonly scaleMetersPerMinorGrid: number
  readonly marks: PaperMapMark[]
  readonly strokes: PaperMapStroke[]
  readonly notes: PaperMapNote[]
}

export interface PaperMapMark {
  readonly id: string
  readonly type: "start" | "camp" | "water" | "cave" | "cache" | "landmark" | "danger" | "custom"
  readonly mapPosition: [number, number]
  readonly label?: string
  readonly color?: string
}

export interface PaperMapStroke {
  readonly id: string
  readonly tool: "pencil" | "pen" | "coloredPencil" | "eraser"
  readonly color: string
  readonly points: Array<[number, number]>
  readonly label?: string
}

export interface PaperMapNote {
  readonly id: string
  readonly mapPosition: [number, number]
  readonly text: string
}
```

Important: `mapPosition` is paper-space. It should not imply the mark is exactly correct in world space.

## Implementation Phases

### Phase 1: Static Paper Map

- Open/close paper map UI.
- Show gridlines, scale, and starting `X`.
- Allow placing manual point markers.
- Persist map marks.

### Phase 2: Distance and Bearing Workflow

- Add distance-from-last-marker tracking.
- Allow reset/set marker as a distance origin.
- Let player attach bearing/distance notes to marks.

### Phase 3: Drawing Tools

- Add freehand pencil/pen strokes.
- Add colored drawing tools.
- Add eraser or undo.
- Add labels/notes.

### Phase 4: Feature Mapping

- Add quick symbols for water, camp, cave, structure, trail, danger, and landmark.
- Add area/shape tools for ponds, clearings, and forests.
- Add optional map legend.

### Phase 5: Endgame Overlay / Debrief

- Compare player map to actual terrain after extraction or death.
- Show overlay, accuracy, discoveries, and missed routes.

## Open Questions

- Should the starting `X` be perfectly centered on the paper, or can starts near the edge create different challenges?
- Should one map sheet cover the whole world, or should the player need multiple sheets/pages?
- Should the player be able to run out of drawing materials?
- Should rain/water damage the map?
- Should the game ever provide found partial maps?
- Should the paper map be rotatable, or always north-up?
- How exact should “distance from last marker” be?
- Can players share/export their maps after a run?
- Should map accuracy affect rescue, scoring, or only postgame feedback?
