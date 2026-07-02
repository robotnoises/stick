# Tasks

## Menu and Save Flow

- [ ] Add a save game option to the menu.
- [ ] Rename “Options” to “Menu”.
- [ ] Persist last player position to the database when saving.
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

## Survival and Player State

- [ ] Add player vitals:
  - [ ] health
  - [ ] fatigue
  - [ ] hunger
  - [ ] thirst
  - [ ] body temperature / exposure
  - [ ] injury status

## Story and Progression

- [ ] Add a state machine for tracking player progress.
- [ ] Add story/progression content coupled to the state machine:
  - [ ] player goals/objectives
  - [ ] tutorial mission to start
  - [ ] follow-up missions or survival prompts

## Terrain and Environment Variety

- [ ] Add more terrain generation variety:
  - [ ] grass
  - [ ] dirt
  - [ ] sand
  - [ ] pine needles / forest floor
- [ ] Add more tree types.
- [ ] Add animals.
- [ ] Add more flora; this should be a major investment area.
- [ ] Add tree states:
  - [ ] alive
  - [ ] dead
  - [ ] fallen/log variants
- [ ] Add water features:
  - [ ] lakes
  - [ ] ponds
  - [ ] rivers
