# Stick Story and Game Objective

## High Concept

Stick is an open-world wilderness exploration, hiking, camping, and survival game.

The player is dropped into an unfamiliar part of a large Idaho forest with minimal supplies. There is no GPS, no minimap, and no reliable outside help at the starting location. The main objective is to explore, understand the land, survive long enough to travel, and find a safe place where rescue or pickup is possible.

The game should feel less like a fast crafting survival loop and more like a tense backcountry navigation simulator: walk, observe, rest, map, conserve energy, and make decisions carefully.

## Core Premise

You are alone in the wilderness after being dropped into a random area of the map. You do not know exactly where you are. You have a few basic tools, flint and steel, barely enough supplies, and a blank sheet of paper.

To survive, you must:

1. Figure out where you are.
2. Explore and chart the surrounding area.
3. Find water, food, shelter, and safe rest locations.
4. Manage fatigue, hunger, thirst, temperature, and injury risk.
5. Use your hand-drawn map, compass, terrain memory, and landmarks to navigate.
6. Reach a safe extraction or pickup location.

## Player Objective

The primary objective is to reach safety.

Safety could take different forms depending on the final story framing:

- a ranger station
- a trailhead
- a road
- a fire lookout tower
- a radio site
- a known pickup clearing
- a river crossing or marked evacuation point
- an abandoned structure with communication equipment

The player should not begin with a clear route. They may know only a vague goal, such as:

> “Find high ground, locate a landmark, and make your way to a pickup point.”

The exact safe location may be discovered through exploration, environmental clues, rare found maps/notes, trails, signs, or high-visibility landmarks.

## Game Loop

The core loop is:

```text
Observe surroundings
  ↓
Choose a travel direction or local objective
  ↓
Walk / climb / descend / follow terrain
  ↓
Consume stamina, daylight, food, and water
  ↓
Find or create map information
  ↓
Rest, sleep, camp, or resupply when needed
  ↓
Use the player-made map to navigate farther
  ↓
Eventually find a route to safety
```

The player should feel that moving across the world is meaningful. Every trip away from camp or a known landmark has risk because getting lost, tired, thirsty, or caught out at night matters.

## Starting Situation

The player starts with minimal gear:

- hunting knife
- lensatic compass
- trench shovel
- blank sheet of paper for mapmaking
- flint and steel for making fire
- very limited food and water, or possibly none depending on difficulty
- basic clothing suitable for summer but not extreme exposure

Possible later additions:

- small tent or tarp
- matches/lighter/backup firestarter
- water bottle or canteen
- simple backpack inventory
- pencil/charcoal for mapmaking

## Cartography and Player-Made Map

Cartography is a core identity feature.

The player has a blank paper map. It should start empty and become useful only through exploration. The map is not a GPS. It should not automatically reveal exact player position like a modern game map. See [Cartography and Paper Map Design](cartography.md) for the detailed map mechanics direction.

Possible map mechanics:

- Player can sketch landmarks, trails, rivers, ponds, caves, campsites, ridges, and clearings.
- Player can mark discovered locations manually.
- Player can annotate bearings or approximate distances.
- The map can be inaccurate if the player estimates poorly.
- Higher vantage points make mapping easier.
- Following a compass bearing and counting distance/time can improve map accuracy.
- Found notes or partial maps can add clues without fully solving navigation.

The intended feeling is that the player builds their own understanding of the wilderness.

## Exploration Discoveries

The world should contain rare but meaningful discoveries.

Examples:

- abandoned campsite
- old fire ring
- lost backpack
- empty or partially stocked supply cache
- ranger sign
- trail marker
- cave or overhang
- pond or creek
- animal tracks
- abandoned lookout or structure
- old hunting blind
- broken radio equipment
- weathered note or partial map scrap

Loot should be rare. Finding something should feel significant, not routine.

Possible loot:

- canned food
- water bottle/canteen
- matches/lighter
- rope
- tarp
- first aid supplies
- batteries
- map fragment
- compass accessory or repair item
- flashlight
- radio part

## Player-Created Places

The player should be able to make the world more navigable by creating or improving places.

Examples:

- campsite
- tent location
- fire ring
- marked trail or cairn
- stash/cache
- mapped landmark
- safe cave camp
- water collection spot near a pond or stream

These places become personal landmarks and survival anchors. The player may return to them to rest, sleep, eat, refill water, or reorient themselves.

## Survival Pressure

Survival pressure should build slowly and realistically.

Important resources:

- fatigue / stamina
- hunger
- thirst
- body temperature / exposure
- injury status
- daylight
- morale or stress, possibly later

Walking and running should make the player tired. Running should be useful but costly. Long travel should require stops, rest, sleep, food, and water.

Camping should matter:

- setting up a tent or shelter
- making and maintaining a fire with flint and steel
- choosing safe, flat, dry ground
- managing warmth and exposure
- sleeping to recover fatigue
- deciding whether to travel at night or wait for daylight

## Tone

The tone should be quiet, grounded, and tense.

The wilderness is beautiful but indifferent. The game does not need constant threats. Getting lost, making poor route choices, running low on water, or misjudging daylight should provide much of the tension.

The player should feel small in a large landscape.

## Story Delivery

Story should mostly be environmental and systemic rather than cutscene-heavy.

Possible delivery methods:

- environmental clues
- abandoned campsites
- signs and trail markers
- map scraps
- journal notes
- radio/static messages if a radio is added
- distant visible landmarks
- tutorial prompts framed as survival instincts or player thoughts

The main story question is simple:

> “Can you understand this place well enough to make it out?”

## Design Rules

- No GPS-style player marker by default.
- No minimap.
- Navigation should depend on compass, landmarks, terrain, sun position, trails, rivers, and the player-made map.
- Loot should be uncommon and valuable.
- Survival should be slow-paced, not arcade-fast.
- The player should be able to get meaningfully lost.
- The world should reward observation and preparation.

## Open Questions

- Why was the player dropped into the wilderness?
- Is the starting location random for every new game?
- Is there one extraction point, several possible safe points, or a dynamic rescue objective?
- Does the player know the broad region, or are they completely disoriented?
- Should difficulty change starting supplies?
- How manual should map drawing be?
- Can the player make inaccurate map marks?
- Should discovered campsites be hand-authored, procedural, or a mix?
- Is there a time limit for rescue, weather, injury, or exposure?
