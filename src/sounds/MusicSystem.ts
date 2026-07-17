import type { GameSystem } from "../app/GameSystem"
import { getMusicTracks, type MusicTrack } from "./MusicLibrary"

export class MusicSystem implements GameSystem {
  private readonly _tracks = getMusicTracks()
  private readonly _audio: HTMLAudioElement
  private _enabled: boolean
  private _currentTrack: MusicTrack | null = null
  private _pendingPlayback = false

  public constructor(
    enabled = true,
    private readonly _random: () => number = Math.random,
  ) {
    this._enabled = enabled
    this._audio = new Audio()
    this._audio.loop = false
    this._audio.volume = 0.18
    this._audio.addEventListener("ended", this._handleEnded)
  }

  public get enabled(): boolean {
    return this._enabled
  }

  public get currentTrack(): MusicTrack | null {
    return this._currentTrack
  }

  public initialize(): void {
    window.addEventListener("pointerdown", this._handleUserGesture)
    window.addEventListener("keydown", this._handleUserGesture)

    if (this._enabled) {
      this.play()
    }
  }

  public setEnabled(enabled: boolean): void {
    this._enabled = enabled

    if (enabled) {
      this.play()
      return
    }

    this.pause()
  }

  public toggle(): boolean {
    this.setEnabled(!this._enabled)

    return this._enabled
  }

  public setVolume(volume: number): void {
    this._audio.volume = Math.min(Math.max(volume, 0), 1)
  }

  public update(_deltaSeconds: number): void {
    // Browser audio playback is event-driven; this satisfies the GameSystem lifecycle.
  }

  public play(): void {
    if (!this._enabled || this._tracks.length === 0) {
      return
    }

    if (!this._currentTrack) {
      this._setTrack(this._selectRandomTrack())
    }

    this._pendingPlayback = true
    void this._audio
      .play()
      .then(() => {
        this._pendingPlayback = false
      })
      .catch(() => {
        this._pendingPlayback = true
      })
  }

  public pause(): void {
    this._pendingPlayback = false
    this._audio.pause()
  }

  public dispose(): void {
    window.removeEventListener("pointerdown", this._handleUserGesture)
    window.removeEventListener("keydown", this._handleUserGesture)
    this._audio.removeEventListener("ended", this._handleEnded)
    this._audio.pause()
    this._audio.src = ""
  }

  private _setTrack(track: MusicTrack): void {
    this._currentTrack = track
    this._audio.src = track.url
  }

  private _selectRandomTrack(exclude: MusicTrack | null = null): MusicTrack {
    const candidates =
      this._tracks.length > 1 && exclude
        ? this._tracks.filter((track) => track.id !== exclude.id)
        : this._tracks
    const index = Math.floor(this._random() * candidates.length)

    return candidates[Math.min(index, candidates.length - 1)]!
  }

  private readonly _handleEnded = (): void => {
    if (!this._enabled) {
      return
    }

    this._setTrack(this._selectRandomTrack(this._currentTrack))
    this.play()
  }

  private readonly _handleUserGesture = (): void => {
    if (this._enabled && this._pendingPlayback) {
      this.play()
    }
  }
}
