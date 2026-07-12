import type { GameSettings } from "../app/GameSettings"

import type { WorldBounds } from "../app/GameConfig"
import type { MapDrawing } from "../cartography/MapDrawing"

export interface GameUiWorldTime {
  readonly day: number
  readonly timeOfDayHours: number
}

export interface GameUiSurvivalStatus {
  readonly fatigue: number
  readonly hunger: number
  readonly thirst: number
}

export interface GameUiMapPosition {
  readonly headingDegrees: number
  readonly x: number
  readonly z: number
}

export interface GameUiState {
  readonly isMapOpen: boolean
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
  readonly onMapDrawingsSaved: (drawings: readonly MapDrawing[]) => Promise<void>
  readonly getDebugVisible: () => boolean
  readonly getHeadingDegrees: () => number
  readonly getMapDrawings: () => readonly MapDrawing[]
  readonly getMapPosition: () => GameUiMapPosition
  readonly getSurvivalStatus: () => GameUiSurvivalStatus
  readonly getWorldBounds: () => WorldBounds
  readonly getWorldTime: () => GameUiWorldTime
}
