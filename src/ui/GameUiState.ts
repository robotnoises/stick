import type { GameSettings } from "../app/GameSettings"

export interface GameUiWorldTime {
  readonly day: number
  readonly timeOfDayHours: number
}

export interface GameUiSurvivalStatus {
  readonly fatigue: number
  readonly hunger: number
  readonly thirst: number
}

export interface GameUiState {
  readonly isMenuOpen: boolean
  readonly isSaving: boolean
  readonly saveStatus: string
  readonly settings: GameSettings
  readonly headingDegrees: number
  readonly isDebugVisible: boolean
  readonly survivalStatus: GameUiSurvivalStatus
  readonly worldTime: GameUiWorldTime
}

export interface GameUiCommands {
  readonly onSettingsChanged: (settings: GameSettings) => void
  readonly onSaveGame: () => Promise<void>
  readonly onDebugVisibleChanged: (visible: boolean) => void
  readonly getDebugVisible: () => boolean
  readonly getHeadingDegrees: () => number
  readonly getSurvivalStatus: () => GameUiSurvivalStatus
  readonly getWorldTime: () => GameUiWorldTime
}
