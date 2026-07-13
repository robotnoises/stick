# Fire System Checklist

## Design Decisions

- [ ] Use the wood terms: **tinder**, **kindling**, and **fuel**.
- [ ] Decide exact starter rule:
  - [ ] Tinder starts fires, kindling sustains small fire.
  - [ ] Or kindling starts fires, matching earlier gameplay phrasing.
- [ ] Decide whether to replace the starting knife with a **hatchet**.
- [ ] Decide whether supplies represent individual units or stack slots.

## Inventory / Supplies

- [x] Add stackable supply item support.
- [ ] Add supply quantities to the Pack supplies grid.
- [ ] Add supply item: tinder/kindling starter material.
- [ ] Add supply item: kindling/small wood.
- [ ] Add supply item: fuel/log wood.
- [ ] Add burn-time metadata:
  - [ ] Starter/kindling: 15 in-game minutes.
  - [ ] Tinder/kindling: 1 in-game hour.
  - [ ] Fuel: 2 in-game hours.
- [ ] Decrement supply quantity when placing or adding wood.
- [ ] Prevent using wood supplies when quantity is zero.

## Gathering

- [ ] Gather starter/kindling from the ground.
- [ ] Gather tinder/kindling from small dead trees.
- [ ] Gather fuel from fallen logs.
- [ ] Require hatchet/axe for dead trees.
- [ ] Require hatchet/axe for fallen logs.
- [ ] Add feedback when gathering succeeds.
- [ ] Add feedback when the player lacks the required tool.
- [ ] Add feedback when the Pack is full.

## Campfire System

- [x] Add `CampfireSystem`.
- [ ] Track placed wood piles in world coordinates.
- [x] Track active fires in world coordinates.
- [x] Track remaining burn time per fire.
- [x] Update burn timers using world time.
- [x] Extinguish fires when burn time reaches zero.
- [x] Dispose campfire meshes/lights cleanly.

## Placing Wood

- [ ] Selecting starter/kindling and using it places a pile in the world.
- [ ] Placement targets the ground in front of the player.
- [ ] Placement uses terrain height at target point.
- [ ] Placement removes one supply unit from inventory.
- [ ] Placed pile has a visible small wood/kindling mesh.
- [ ] Prevent placement too far from player.
- [ ] Prevent placement outside world bounds.
- [ ] Prevent placement underwater or in invalid terrain, if needed.

## Flint & Steel / Spark

- [ ] Using Flint & steel creates a spark projectile.
- [ ] Spark starts near player/camera/tool position.
- [ ] Spark initially travels forward along aim direction.
- [ ] Spark curves downward under gravity.
- [ ] Spark has a short lifetime.
- [ ] Spark disappears on ground impact if it does not ignite anything.
- [ ] Spark has a small visible emissive mesh/particle.
- [ ] Spark collision is forgiving enough to feel usable.

## Ignition

- [ ] Spark can collide with placed starter/kindling.
- [ ] Valid collision ignites the pile.
- [ ] Ignited pile becomes a low fire.
- [ ] Low fire starts with 15 in-game minutes of burn time.
- [ ] Failed spark impact provides subtle feedback.
- [ ] Prevent already-lit piles from being ignited again.

## Fire Visuals

- [x] Add small flame visual for low fire.
- [x] Add warm point light for low fire.
- [x] Keep initial fire low and not super bright.
- [x] Add subtle flicker to light intensity.
- [x] Add ember/glow visual near kindling.
- [ ] Add smoke later, if desired.
- [ ] Scale visuals with burn intensity later.

## Fire Lighting Investigation

Current status:

- [x] Campfire has visible procedural 3D flame geometry.
- [x] Campfire has a Babylon `PointLight` and downward `SpotLight`.
- [x] Terrain materials have `maxSimultaneousLights = 8`.
- [x] Campfire lights use high `renderPriority`.
- [x] Campfire creation calls `scene.markAllMaterialsAsDirty(Material.LightDirtyFlag)`.
- [ ] Real campfire lights visibly illuminate terrain/nearby props.

Observed behavior:

- Fireflies appear to glow, but their visible glow is mostly a small emissive billboard/halo mesh, not strong terrain illumination.
- Campfire point/spot lights do not visibly illuminate terrain, even at very high intensity/range.
- Fake flat ground-glow discs can make the ground look lit, but they create obvious artifacts on slopes/terrain seams.
- Billboard-style fire halo creates a large flat orange arch and is not suitable for campfires.

Working theory:

- Babylon punctual lights are either not being selected by terrain/prop materials at runtime, or the scene/material setup makes their contribution too weak/invisible compared with existing ambient/emissive/vertex-color terrain shading.
- Since the terrain is chunked and materials are shared/compiled before campfire lights are created, dynamic lights may require a more deliberate lighting strategy than simply adding more `PointLight`s.
- The reliable visual approach is probably a custom fire illumination layer rather than relying entirely on Babylon's standard lighting.

Possible next approach: terrain-conforming fire light overlay:

- [ ] Create a dedicated `FireLightOverlaySystem` or integrate into `CampfireSystem`.
- [ ] Generate a terrain-conforming radial mesh around each fire by sampling terrain height.
- [ ] Use vertex alpha/color for warm falloff.
- [ ] Keep it very subtle and texture/noise-modulated so it reads as illumination, not an orange disk.
- [ ] Break the overlay into irregular/noisy patches to avoid a perfect circular edge.
- [ ] Use multiple rings with low alpha and warm color blended into terrain.
- [ ] Offset just above terrain to avoid z-fighting.
- [ ] Rebuild/update overlay if fire position or terrain chunk changes.
- [ ] Fade overlay with burn intensity/flicker.
- [ ] Consider clipping overlay to loaded terrain chunks if needed.

Alternative/parallel approach:

- [ ] Add a small emissive local glow around the fire/flames only, similar to fireflies but much smaller.
- [ ] Keep actual `PointLight` for props if it eventually works.
- [ ] Test a simple isolated material/plane near fire to verify whether campfire light affects any standard material at all.
- [ ] If isolated test works, compare terrain material configuration against test material.
- [ ] If isolated test does not work, investigate scene light limits, light masks, render groups, and material compilation.

## Adding More Wood

- [ ] Allow adding tinder/kindling to an active fire.
- [ ] Allow adding fuel to an active fire.
- [ ] Adding wood increases remaining burn time.
- [ ] Adding better wood may increase fire brightness/intensity later.
- [ ] Prevent adding wood when not near a fire.
- [ ] Show feedback for added burn time.

## Persistence

- [ ] Save placed unlit wood piles.
- [ ] Save active fires.
- [ ] Save remaining burn time.
- [ ] Restore fire state on load.
- [ ] Account for elapsed world time while away, if applicable.

## UX / Feedback

- [ ] HUD selected item shows currently selected wood/tool.
- [ ] Item use messages explain what happened.
- [ ] Pack supplies show wood quantities.
- [ ] Fire interaction should remain physical, not menu-driven.
- [ ] Tune spark aim and collision radius for usability.
- [ ] Tune burn durations against night length.
