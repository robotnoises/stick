import type { GameSettings } from "../app/GameSettings"

export interface GameUiState {
  readonly isMenuOpen: boolean
  readonly isSaving: boolean
  readonly saveStatus: string
  readonly settings: GameSettings
  readonly headingDegrees: number
  readonly isDebugVisible: boolean
}

export interface GameUiCommands {
  readonly onSettingsChanged: (settings: GameSettings) => void
  readonly onSaveGame: () => Promise<void>
  readonly onDebugVisibleChanged: (visible: boolean) => void
  readonly getDebugVisible: () => boolean
  readonly getHeadingDegrees: () => number
}
