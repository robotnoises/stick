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

- [ ] Add `CampfireSystem`.
- [ ] Track placed wood piles in world coordinates.
- [ ] Track active fires in world coordinates.
- [ ] Track remaining burn time per fire.
- [ ] Update burn timers using world time.
- [ ] Extinguish fires when burn time reaches zero.
- [ ] Dispose campfire meshes/lights cleanly.

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

- [ ] Add small flame visual for low fire.
- [ ] Add warm point light for low fire.
- [ ] Keep initial fire low and not super bright.
- [ ] Add subtle flicker to light intensity.
- [ ] Add ember/glow visual near kindling.
- [ ] Add smoke later, if desired.
- [ ] Scale visuals with burn intensity later.

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
