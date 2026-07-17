# Sound and Music Plan

This document tracks the audio plan for the game. The current first step is background music; sound effects will come later.

## Asset Layout

Use `assets/sounds/` as the root for authored audio files.

```text
assets/sounds/
  music/
    pinewing_path.mp3
  effects/
    walking/
    swimming/
    inventory/
    fire/
    ui/
```

Current music asset:

- `assets/sounds/music/pinewing_path.mp3`

## Music Module Goals

Add a small Music module/system that:

- Discovers or imports all playable songs from `assets/sounds/music/`.
- Randomly selects one song when music starts.
- Plays songs as non-positional background audio.
- Can later advance to another random song when the current one ends.
- Supports volume control separately from effects.
- Can be paused/resumed with game pause/menu behavior.
- Avoids restarting music on routine UI state changes.

## Initial Implementation Shape

Current files:

```text
src/sounds/MusicSystem.ts
src/sounds/MusicLibrary.ts
src/ui/components/MusicToggle.tsx
```

Music is enabled by default through `GameSettings.musicEnabled`. The bottom-right HUD toggle persists the setting to local storage and switches between the `volume-on` and `volume-off` icons.

### `MusicLibrary`

Responsible for exposing available music tracks. With Vite, this can use `import.meta.glob` to collect files from the music folder, for example:

```ts
const musicModules = import.meta.glob("../../assets/sounds/music/*.{mp3,wav,ogg}", {
  eager: true,
  query: "?url",
  import: "default",
})
```

The library should return typed track objects:

```ts
interface MusicTrack {
  readonly id: string
  readonly name: string
  readonly url: string
}
```

### `MusicSystem`

Responsible for playback lifecycle:

- Choose a random track from `MusicLibrary`.
- Create and manage a browser `HTMLAudioElement`.
- Start playback after a user gesture if browser autoplay policy requires it.
- Use `ended` to choose the next random track.
- Expose `setVolume`, `play`, `pause`, `setEnabled`, and `dispose`.

For the first version, `HTMLAudioElement` is enough for music because background music does not need 3D positioning.

## Browser Autoplay Note

Browsers usually block audio until the player interacts with the page. The first implementation should start or unlock music from an existing user gesture, such as:

- clicking the game canvas,
- clicking a menu button,
- pressing a key after the game loads.

If autoplay fails, the music system should fail quietly and retry after the next user interaction.

## Sound Effects Later

Effects should live under `assets/sounds/effects/` and be grouped by use case:

- `walking/` for footsteps by terrain/material.
- `swimming/` for water movement, splashes, and submersion.
- `fire/` for campfire ignite/burn/extinguish.
- `inventory/` for pack open/close/item interactions.
- `ui/` for menu and modal sounds.

Effects will likely need a separate `EffectsSystem` or `SoundEffects` service with support for:

- short one-shot playback,
- randomized variants,
- cooldowns/rate limits,
- volume separate from music,
- optional positional audio for world sounds.

## Open Questions

- Should background music loop one track or shuffle continuously?
- Should music be disabled by default until the player opts in?
- Where should music/effects volume settings live in save/settings data?
- Should nighttime/daytime/exploration states influence track selection?
