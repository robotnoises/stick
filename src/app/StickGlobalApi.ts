import type { DebugOverlay } from "../debug/DebugOverlay"

export interface StickDebugApi {
  show(visible: boolean): void
  toggle(): boolean
  visible(): boolean
}

export interface StickGlobalApi {
  readonly debug: StickDebugApi
}

export class StickGlobalApiInstaller {
  public static install(debugOverlay: DebugOverlay): StickGlobalApi {
    const api: StickGlobalApi = {
      debug: {
        show: (visible) => debugOverlay.setVisible(visible),
        toggle: () => debugOverlay.toggleVisible(),
        visible: () => debugOverlay.visible,
      },
    }

    window.stick = api

    return api
  }

  public static uninstall(api: StickGlobalApi): void {
    if (window.stick === api) {
      delete window.stick
    }
  }
}

declare global {
  interface Window {
    stick?: StickGlobalApi
  }
}
