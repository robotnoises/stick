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

export type GameUiInventoryCategory = "supply" | "tool"

export interface GameUiInventoryItem {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly category: GameUiInventoryCategory
  readonly consumable: boolean
  readonly maxQuantity: number
  readonly quantity: number
}

export interface GameUiSelectedItem {
  readonly id: string
  readonly name: string
}

export interface GameUiState {
  readonly isMapOpen: boolean
  readonly isMenuOpen: boolean
  readonly isPackOpen: boolean
  readonly isSaving: boolean
  readonly saveStatus: string
  readonly settings: GameSettings
  readonly headingDegrees: number
  readonly inventoryItems: readonly GameUiInventoryItem[]
  readonly isDebugVisible: boolean
  readonly selectedItem: GameUiSelectedItem | null
  readonly survivalStatus: GameUiSurvivalStatus
  readonly worldTime: GameUiWorldTime
}

export interface GameUiCommands {
  readonly onSettingsChanged: (settings: GameSettings) => void
  readonly onSaveGame: () => Promise<void>
  readonly onDebugVisibleChanged: (visible: boolean) => void
  readonly onInventoryItemSelected: (itemId: string) => void
  readonly onMapDrawingsSaved: (drawings: readonly MapDrawing[]) => Promise<void>
  readonly onSelectedItemUsed: () => void
  readonly getDebugVisible: () => boolean
  readonly getHeadingDegrees: () => number
  readonly getInventoryItems: () => readonly GameUiInventoryItem[]
  readonly getMapDrawings: () => readonly MapDrawing[]
  readonly getMapPosition: () => GameUiMapPosition
  readonly getSelectedInventoryItem: () => GameUiSelectedItem | null
  readonly getSurvivalStatus: () => GameUiSurvivalStatus
  readonly getWorldBounds: () => WorldBounds
  readonly getWorldTime: () => GameUiWorldTime
}
