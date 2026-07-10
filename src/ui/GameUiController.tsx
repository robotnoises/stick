import { render } from "preact"
import type { GameSettings } from "../app/GameSettings"
import { GameUiApp } from "./GameUiApp"
import type { GameUiCommands } from "./GameUiState"

export class GameUiController {
  public constructor(
    private readonly _root: HTMLElement,
    private readonly _initialSettings: GameSettings,
    private readonly _commands: GameUiCommands,
  ) {}

  public mount(): void {
    render(<GameUiApp commands={this._commands} initialSettings={this._initialSettings} />, this._root)
  }

  public dispose(): void {
    render(null, this._root)
  }
}
