import { useRef } from "preact/hooks"

export interface CompassProps {
  readonly headingDegrees: number
}

const cardinalDirections = ["N", "E", "S", "W"] as const
const tickCount = 32

export function Compass({ headingDegrees }: CompassProps) {
  const previousNeedleRotation = useRef<number | null>(null)
  const normalizedHeading = ((headingDegrees % 360) + 360) % 360
  const needleRotation = getNearestContinuousRotation(normalizedHeading, previousNeedleRotation.current)

  previousNeedleRotation.current = needleRotation

  return (
    <div class="stick-compass" aria-label={`Heading ${Math.round(normalizedHeading)} degrees`}>
      <div class="stick-compass-rim" />
      <div class="stick-compass-face">
        <svg class="stick-compass-card" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="stick-compass-card-ring" cx="50" cy="50" r="39" />
          {Array.from({ length: tickCount }, (_, index) => {
            const angle = (index / tickCount) * 360
            const isMajor = index % 8 === 0
            const isMid = index % 4 === 0
            const length = isMajor ? 9 : isMid ? 6 : 3.5

            return (
              <line
                key={index}
                class={isMajor ? "stick-compass-tick-major" : "stick-compass-tick"}
                x1="50"
                y1={11}
                x2="50"
                y2={11 + length}
                transform={`rotate(${angle} 50 50)`}
              />
            )
          })}
          {cardinalDirections.map((direction, index) => {
            const angle = index * 90
            const radians = (angle - 90) * (Math.PI / 180)
            const x = 50 + Math.cos(radians) * 28
            const y = 50 + Math.sin(radians) * 28

            return (
              <text key={direction} class="stick-compass-cardinal" x={x} y={y} text-anchor="middle" dominant-baseline="middle">
                {direction}
              </text>
            )
          })}
        </svg>
        <div class="stick-compass-needle" style={{ transform: `translate(-50%, -50%) rotate(${needleRotation}deg)` }}>
          <div class="stick-compass-needle-north" />
          <div class="stick-compass-needle-south" />
        </div>
        <div class="stick-compass-pin" />
      </div>
      <div class="stick-compass-glass" />
    </div>
  )
}

function getNearestContinuousRotation(normalizedHeading: number, previousRotation: number | null): number {
  if (previousRotation === null) {
    return normalizedHeading
  }

  const turns = Math.round((previousRotation - normalizedHeading) / 360)
  const candidate = normalizedHeading + turns * 360
  const alternateCandidate = candidate + (candidate < previousRotation ? 360 : -360)

  return Math.abs(candidate - previousRotation) <= Math.abs(alternateCandidate - previousRotation)
    ? candidate
    : alternateCandidate
}
