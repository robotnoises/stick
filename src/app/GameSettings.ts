export interface GameSettings {
  invertMouseY: boolean
  musicEnabled: boolean
}

export const defaultGameSettings: GameSettings = {
  invertMouseY: false,
  musicEnabled: true,
}

const storageKey = "stick.settings"

export function loadGameSettings(): GameSettings {
  const stored = window.localStorage.getItem(storageKey)

  if (!stored) {
    return { ...defaultGameSettings }
  }

  try {
    const parsed = JSON.parse(stored) as Partial<GameSettings>

    return {
      invertMouseY: parsed.invertMouseY ?? defaultGameSettings.invertMouseY,
      musicEnabled: parsed.musicEnabled ?? defaultGameSettings.musicEnabled,
    }
  } catch {
    return { ...defaultGameSettings }
  }
}

export function saveGameSettings(settings: GameSettings): void {
  window.localStorage.setItem(storageKey, JSON.stringify(settings))
}
