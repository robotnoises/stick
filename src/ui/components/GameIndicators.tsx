export interface GameIndicatorsProps {
  readonly day: number
  readonly fatigue: number
  readonly hunger: number
  readonly thirst: number
  readonly timeOfDayHours: number
}

export function GameIndicators({ day, fatigue, hunger, thirst, timeOfDayHours }: GameIndicatorsProps) {
  return (
    <aside class="stick-game-indicators" aria-label="World status">
      <IndicatorBar icon="fatigue" label="Fatigue" value={fatigue} />
      <IndicatorBar icon="food" label="Hunger" value={hunger} />
      <IndicatorBar icon="drink" label="Thirst" value={thirst} />
      <div class="stick-indicator-text stick-indicator-time">{formatTimeOfDay(timeOfDayHours)}</div>
      <div class="stick-indicator-text">Day {day}</div>
    </aside>
  )
}

interface IndicatorBarProps {
  readonly icon: "drink" | "fatigue" | "food"
  readonly label: string
  readonly value: number
}

function IndicatorBar({ icon, label, value }: IndicatorBarProps) {
  const percent = Math.round(clamp01(value) * 100)

  return (
    <div class="stick-indicator-bar-row" aria-label={`${label}: ${percent}%`} title={`${label}: ${percent}%`}>
      <span class="stick-indicator-bar-track">
        <span class="stick-indicator-bar-fill" style={{ width: `${percent}%` }} />
      </span>
      <span class={`stick-indicator-icon stick-indicator-icon-${icon}`} aria-hidden="true" />
    </div>
  )
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

function formatTimeOfDay(timeOfDayHours: number): string {
  const normalizedHours = ((timeOfDayHours % 24) + 24) % 24
  const hours = Math.floor(normalizedHours)
  const minutes = Math.floor((normalizedHours - hours) * 60)

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}
