import type { GameSystem } from '../app/GameSystem';

export class TimeOfDaySystem implements GameSystem {
  private _timeOfDayHours: number;
  private _elapsedWorldSeconds = 0;

  public constructor(
    startTimeOfDayHours: number,
    private readonly _timeScale: number,
  ) {
    this._timeOfDayHours = startTimeOfDayHours;
  }

  public get timeOfDayHours(): number {
    return this._timeOfDayHours;
  }

  public get elapsedWorldSeconds(): number {
    return this._elapsedWorldSeconds;
  }

  public update(deltaSeconds: number): void {
    const worldDelta = deltaSeconds * this._timeScale;
    this._elapsedWorldSeconds += worldDelta;
    this._timeOfDayHours = (this._timeOfDayHours + worldDelta / 3600) % 24;
  }
}
