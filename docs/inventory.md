# Backpack and Item System

## Purpose

The backpack is the player's basic inventory. It should support the survival/hiking fantasy without turning Stick into a fast loot/crafting game.

The player carries a small set of core items from the start and can find rare additional items in the world. Every item should be discardable, including core items, so inventory choices can have consequences later.

## Item Classes

There are two broad classes of items:

### Core Items

Core items are present at the start of a new game.

Initial core list:

- flint & steel
- knife
- canteen
- solar flashlight
- blank paper map

### Found Items

Found items are discovered through exploration.

Examples:

- canned food
- water bottle
- first aid supplies
- tarp
- rope
- batteries
- map scraps
- radio parts

Found items should be rare and meaningful.

## Starting Backpack

The current starting backpack should contain:

```text
flint & steel
knife
canteen
solar flashlight
blank map
```

The blank map starts empty except for its grid, scale, and starting `X`. See [Cartography and Paper Map Design](cartography.md).

## Item Interface Direction

Every item should implement a shared `Item` interface.

Initial shape:

```ts
export interface Item {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly source: "core" | "found"
  readonly discardable: boolean

  use(): ItemUseResult
}
```

For now, item `use()` methods can return a simple result message. Later they can receive a richer context for player state, terrain, time, weather, animation, sounds, and UI.

## One Selected Item

The player can have one selected item at a time.

Initial behavior:

- Open backpack/inventory with a key.
- Click an item to select it.
- Press a use key to use the selected item.
- Track and display which item is selected.

For now, using an item only confirms that the selected item is being invoked. Deeper mechanics come later.

## Controls

Initial prototype controls:

```text
I = open/close backpack
Click item = select item
U = use selected item
Escape = close backpack
```

These are prototype bindings and can change later.

## Future Item Behavior Ideas

### Flint & Steel

- Start campfire when tinder/fuel is available.
- Fail or take longer in rain/wet conditions.
- Support warmth, cooking, boiling water, and night visibility.

### Knife

- Cut branches/tinder.
- Prepare food.
- Interact with rope/tarp.
- Emergency defense if animals exist later.

### Canteen

- Store water.
- Refill at ponds/streams.
- Require purification later.

### Solar Flashlight

- Provide limited night visibility.
- Recharge during sunny daylight.
- Become less useful in heavy shade/weather.

### Map

- Open the paper map interface.
- Support manual cartography tools.
- Persist player-created marks, strokes, notes, and symbols.

## Open Questions

- Should the backpack have weight/capacity limits?
- Should item discard require confirmation for core items?
- Should some core items be replaceable if discarded?
- Should the player hold/use the selected item in first-person view?
- Should using an item be a key press, mouse click, or context action?
- Should backpack interaction pause the game or leave the world running?
