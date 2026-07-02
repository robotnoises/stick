import type { GameSystem } from "../app/GameSystem"

export class TimeOfDaySystem implements GameSystem {
  private _day = 1
  private _timeOfDayHours: number
  private _elapsedWorldSeconds = 0

  public constructor(
    startTimeOfDayHours: number,
    private readonly _timeScale: number,
  ) {
    this._timeOfDayHours = this._normalizeTimeOfDayHours(startTimeOfDayHours)
  }

  public get day(): number {
    return this._day
  }

  public get timeOfDayHours(): number {
    return this._timeOfDayHours
  }

  public get elapsedWorldSeconds(): number {
    return this._elapsedWorldSeconds
  }

  public setTimeOfDayHours(timeOfDayHours: number): void {
    this._timeOfDayHours = this._normalizeTimeOfDayHours(timeOfDayHours)
  }

  public setDay(day: number): void {
    this._day = Math.max(1, Math.floor(day))
  }

  public setWorldTime(day: number, timeOfDayHours: number): void {
    this.setDay(day)
    this.setTimeOfDayHours(timeOfDayHours)
  }

  public update(deltaSeconds: number): void {
    const worldDelta = deltaSeconds * this._timeScale
    const totalHours = this._timeOfDayHours + worldDelta / 3600
    const elapsedDays = Math.floor(totalHours / 24)

    this._elapsedWorldSeconds += worldDelta
    this._day += elapsedDays
    this._timeOfDayHours = this._normalizeTimeOfDayHours(totalHours)
  }

  private _normalizeTimeOfDayHours(timeOfDayHours: number): number {
    return ((timeOfDayHours % 24) + 24) % 24
  }
}
