import { useEffect, useState } from "preact/hooks"
import type { GameSettings } from "../app/GameSettings"
import { GameIndicators } from "./components/GameIndicators"
import { Hud } from "./components/Hud"
import { InGameMenu } from "./components/InGameMenu"
import { MapModal } from "./components/MapModal"
import type { GameUiCommands, GameUiState } from "./GameUiState"

export interface GameUiAppProps {
  readonly commands: GameUiCommands
  readonly initialSettings: GameSettings
}

export function GameUiApp({ commands, initialSettings }: GameUiAppProps) {
  const [state, setState] = useState<GameUiState>({
    isMapOpen: false,
    isMenuOpen: false,
    isSaving: false,
    saveStatus: "",
    settings: initialSettings,
    headingDegrees: commands.getHeadingDegrees(),
    isDebugVisible: commands.getDebugVisible(),
    survivalStatus: commands.getSurvivalStatus(),
    worldTime: commands.getWorldTime(),
  })

  useEffect(() => {
    const interval = window.setInterval(() => {
      const visible = commands.getDebugVisible()
      const headingDegrees = commands.getHeadingDegrees()
      const survivalStatus = commands.getSurvivalStatus()
      const worldTime = commands.getWorldTime()

      setState((current) =>
        current.isDebugVisible === visible &&
        Math.abs(current.headingDegrees - headingDegrees) < 0.1 &&
        Math.abs(current.survivalStatus.fatigue - survivalStatus.fatigue) < 0.01 &&
        Math.abs(current.survivalStatus.hunger - survivalStatus.hunger) < 0.01 &&
        Math.abs(current.survivalStatus.thirst - survivalStatus.thirst) < 0.01 &&
        current.worldTime.day === worldTime.day &&
        Math.abs(current.worldTime.timeOfDayHours - worldTime.timeOfDayHours) < 0.01
          ? current
          : { ...current, headingDegrees, isDebugVisible: visible, survivalStatus, worldTime },
      )
    }, 50)

    return () => window.clearInterval(interval)
  }, [commands])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return
      }

      event.preventDefault()
      setState((current) => {
        if (current.isMapOpen) {
          return { ...current, isMapOpen: false }
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

  const setSettings = (settings: GameSettings): void => {
    commands.onSettingsChanged(settings)
    setState((current) => ({ ...current, settings }))
  }

  const setDebugVisible = (visible: boolean): void => {
    commands.onDebugVisibleChanged(visible)
    setState((current) => ({ ...current, isDebugVisible: visible }))
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
      <Hud
        headingDegrees={state.headingDegrees}
        onMapOpen={() => setMapOpen(true)}
        onMenuOpen={() => setMenuOpen(true)}
      />
      {state.isMapOpen ? (
        <MapModal
          onClose={() => setMapOpen(false)}
          playerHeadingDegrees={commands.getMapPosition().headingDegrees}
          playerX={commands.getMapPosition().x}
          playerZ={commands.getMapPosition().z}
          worldBounds={commands.getWorldBounds()}
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
