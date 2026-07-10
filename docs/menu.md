# Menu and HUD Direction

## Goal

The game UI should feel like part of the survival kit rather than a generic web app overlay.

Visual direction:

- rustic
- tactile
- field-journal / trail-kit inspired
- light skeuomorphism
- parchment, leather, wood, canvas, brass, and worn paper accents
- readable and simple, not overly ornate

## Current State

The current in-game menu is implemented with Preact and rendered into `#ui-root`.

Current behavior:

- `Escape` toggles the menu.
- The menu supports saving, settings, and debug overlay visibility.
- Debug can also be controlled from the console through:

```ts
window.stick.debug.show(true)
window.stick.debug.show(false)
window.stick.debug.toggle()
window.stick.debug.visible()
```

## Intended HUD Direction

Long term, the standalone top-right `Menu` button should probably be replaced by a bottom HUD tray.

Initial concept:

```text
| [ Pack ] [ Compass ] [ Notebook ] |
```

This tray should sit near the bottom of the screen and feel like a small collection of field-kit objects rather than normal app buttons.

## Proposed Button Roles

### Pack

Future role:

- opens inventory
- shows carried items
- manages usable tools and resources

Initial implementation can be a disabled/no-op placeholder until inventory UI is ready.

### Compass

Future role:

- opens/toggles compass view
- may show heading or inspect the compass item
- could later integrate with navigation/map mechanics

Initial implementation can be a disabled/no-op placeholder or simple heading display.

### Notebook

Current likely role:

- opens the existing menu

Possible future roles:

- pause/menu/settings
- save/load access
- discovered notes
- plant/animal observations
- map annotations
- survival journal
- objectives/clues
- personal log

The exact gameplay purpose is still undecided, but “notebook” is a good flexible metaphor for player-facing meta UI.

## Asset Direction

Eventually replace text buttons with simple icons or object-like UI elements.

Suggested source asset paths:

```text
assets/source/textures/ui/icons/pack.png
assets/source/textures/ui/icons/compass.png
assets/source/textures/ui/icons/notebook.png
```

Suggested exported paths:

```text
assets/exported/textures/ui/icons/pack.png
assets/exported/textures/ui/icons/compass.png
assets/exported/textures/ui/icons/notebook.png
```

SVG icons would also be acceptable if they fit the art direction.

## Implementation Plan

Suggested first implementation:

```text
src/ui/components/HudTray.tsx
```

`HudTray` should render:

```text
[Pack] [Compass] [Notebook]
```

Initial behavior:

- Pack: placeholder
- Compass: placeholder
- Notebook: opens the current Preact menu
- Escape: continues to toggle the menu

Later behavior:

- Pack opens inventory UI.
- Compass opens compass/navigation UI.
- Notebook opens journal/menu/map notes.

## Design Notes

- Prefer in-world metaphors over generic labels like “Menu”.
- Keep the HUD minimal to preserve wilderness immersion.
- Do not let the HUD compete visually with the environment.
- Controls should remain accessible by keyboard even if visual buttons change.
- UI components should dispatch commands; they should not directly manipulate game internals.
