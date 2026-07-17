import { useEffect, useState } from "preact/hooks"
import type { GameSettings } from "../app/GameSettings"
import { GameIndicators } from "./components/GameIndicators"
import { Hud } from "./components/Hud"
import { InGameMenu } from "./components/InGameMenu"
import { MapModal } from "./components/MapModal"
import { MusicToggle } from "./components/MusicToggle"
import { PackModal } from "./components/PackModal"
import type { GameUiCommands, GameUiState } from "./GameUiState"

export interface GameUiAppProps {
  readonly commands: GameUiCommands
  readonly initialSettings: GameSettings
}

export function GameUiApp({ commands, initialSettings }: GameUiAppProps) {
  const [state, setState] = useState<GameUiState>({
    isMapOpen: false,
    isMenuOpen: false,
    isPackOpen: false,
    isSaving: false,
    isMusicEnabled: commands.getMusicEnabled(),
    saveStatus: "",
    settings: initialSettings,
    headingDegrees: commands.getHeadingDegrees(),
    inventoryItems: commands.getInventoryItems(),
    isDebugVisible: commands.getDebugVisible(),
    selectedItem: commands.getSelectedInventoryItem(),
    survivalStatus: commands.getSurvivalStatus(),
    worldTime: commands.getWorldTime(),
  })

  useEffect(() => {
    const interval = window.setInterval(() => {
      const visible = commands.getDebugVisible()
      const headingDegrees = commands.getHeadingDegrees()
      const inventoryItems = commands.getInventoryItems()
      const isMusicEnabled = commands.getMusicEnabled()
      const selectedItem = commands.getSelectedInventoryItem()
      const survivalStatus = commands.getSurvivalStatus()
      const worldTime = commands.getWorldTime()

      setState((current) =>
        current.isDebugVisible === visible &&
        Math.abs(current.headingDegrees - headingDegrees) < 0.1 &&
        current.inventoryItems === inventoryItems &&
        current.isMusicEnabled === isMusicEnabled &&
        current.selectedItem?.id === selectedItem?.id &&
        Math.abs(current.survivalStatus.fatigue - survivalStatus.fatigue) < 0.01 &&
        Math.abs(current.survivalStatus.hunger - survivalStatus.hunger) < 0.01 &&
        Math.abs(current.survivalStatus.thirst - survivalStatus.thirst) < 0.01 &&
        current.worldTime.day === worldTime.day &&
        Math.abs(current.worldTime.timeOfDayHours - worldTime.timeOfDayHours) < 0.01
          ? current
          : {
              ...current,
              headingDegrees,
              inventoryItems,
              isDebugVisible: visible,
              isMusicEnabled,
              selectedItem,
              survivalStatus,
              worldTime,
            },
      )
    }, 50)

    return () => window.clearInterval(interval)
  }, [commands])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() === "m") {
        event.preventDefault()
        setState((current) => ({ ...current, isMapOpen: !current.isMapOpen }))
        return
      }

      if (event.key.toLowerCase() === "p") {
        event.preventDefault()
        setState((current) => ({ ...current, isPackOpen: !current.isPackOpen }))
        return
      }

      if (event.key !== "Escape") {
        return
      }

      event.preventDefault()
      setState((current) => {
        if (current.isMapOpen) {
          return { ...current, isMapOpen: false }
        }

        if (current.isPackOpen) {
          return { ...current, isPackOpen: false }
        }

        return { ...current, isMenuOpen: !current.isMenuOpen }
      })
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const setMapOpen = (isMapOpen: boolean): void => {
    setState((current) => ({ ...current, isMapOpen }))
  }

  const setMenuOpen = (isMenuOpen: boolean): void => {
    setState((current) => ({ ...current, isMenuOpen }))
  }

  const setPackOpen = (isPackOpen: boolean): void => {
    setState((current) => ({ ...current, isPackOpen }))
  }

  const selectInventoryItem = (itemId: string): void => {
    commands.onInventoryItemSelected(itemId)
    setState((current) => ({
      ...current,
      inventoryItems: commands.getInventoryItems(),
      selectedItem: commands.getSelectedInventoryItem(),
    }))
  }

  const setSettings = (settings: GameSettings): void => {
    commands.onSettingsChanged(settings)
    setState((current) => ({ ...current, settings }))
  }

  const setDebugVisible = (visible: boolean): void => {
    commands.onDebugVisibleChanged(visible)
    setState((current) => ({ ...current, isDebugVisible: visible }))
  }

  const toggleMusic = (): void => {
    setState((current) => {
      const isMusicEnabled = !current.isMusicEnabled

      commands.onMusicEnabledChanged(isMusicEnabled)

      return { ...current, isMusicEnabled }
    })
  }

  const saveGame = (): void => {
    setState((current) => ({ ...current, isSaving: true, saveStatus: "Saving…" }))
    void commands
      .onSaveGame()
      .then(() => {
        setState((current) => ({ ...current, saveStatus: "Game saved." }))
      })
      .catch((error: unknown) => {
        console.warn("Failed to save game.", error)
        setState((current) => ({ ...current, saveStatus: "Save failed." }))
      })
      .finally(() => {
        setState((current) => ({ ...current, isSaving: false }))
      })
  }

  return (
    <>
      <GameIndicators
        day={state.worldTime.day}
        fatigue={state.survivalStatus.fatigue}
        hunger={state.survivalStatus.hunger}
        thirst={state.survivalStatus.thirst}
        timeOfDayHours={state.worldTime.timeOfDayHours}
      />
      <MusicToggle enabled={state.isMusicEnabled} onToggle={toggleMusic} />
      <Hud
        headingDegrees={state.headingDegrees}
        onMapOpen={() => setMapOpen(true)}
        onMenuOpen={() => setMenuOpen(true)}
        onPackOpen={() => setPackOpen(true)}
        onSelectedItemUsed={commands.onSelectedItemUsed}
        selectedItemName={state.selectedItem?.name ?? null}
      />
      {state.isMapOpen ? (
        <MapModal
          drawings={commands.getMapDrawings()}
          onClose={() => setMapOpen(false)}
          onSaveDrawings={commands.onMapDrawingsSaved}
          playerHeadingDegrees={commands.getMapPosition().headingDegrees}
          playerX={commands.getMapPosition().x}
          playerZ={commands.getMapPosition().z}
          worldBounds={commands.getWorldBounds()}
        />
      ) : null}
      {state.isPackOpen ? (
        <PackModal
          items={state.inventoryItems}
          onClose={() => setPackOpen(false)}
          onItemSelected={selectInventoryItem}
          selectedItemId={state.selectedItem?.id ?? null}
        />
      ) : null}
      <InGameMenu
        isDebugVisible={state.isDebugVisible}
        isMenuOpen={state.isMenuOpen}
        isSaving={state.isSaving}
        onClose={() => setMenuOpen(false)}
        onDebugVisibleChanged={setDebugVisible}
        onSaveGame={saveGame}
        onSettingsChanged={setSettings}
        saveStatus={state.saveStatus}
        settings={state.settings}
      />
    </>
  )
}
