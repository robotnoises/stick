import { useEffect, useState } from "preact/hooks"
import type { GameSettings } from "../app/GameSettings"
import { Hud } from "./components/Hud"
import { InGameMenu } from "./components/InGameMenu"
import type { GameUiCommands, GameUiState } from "./GameUiState"

export interface GameUiAppProps {
  readonly commands: GameUiCommands
  readonly initialSettings: GameSettings
}

export function GameUiApp({ commands, initialSettings }: GameUiAppProps) {
  const [state, setState] = useState<GameUiState>({
    isMenuOpen: false,
    isSaving: false,
    saveStatus: "",
    settings: initialSettings,
    isDebugVisible: commands.getDebugVisible(),
  })

  useEffect(() => {
    const interval = window.setInterval(() => {
      const visible = commands.getDebugVisible()

      setState((current) =>
        current.isDebugVisible === visible ? current : { ...current, isDebugVisible: visible },
      )
    }, 250)

    return () => window.clearInterval(interval)
  }, [commands])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return
      }

      event.preventDefault()
      setState((current) => ({ ...current, isMenuOpen: !current.isMenuOpen }))
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

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
      <Hud onMenuOpen={() => setMenuOpen(true)} />
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
