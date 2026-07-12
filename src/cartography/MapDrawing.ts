export interface MapDrawingPoint {
  readonly x: number
  readonly z: number
}

export interface MapDrawingStroke {
  readonly id: string
  readonly type: "stroke"
  readonly points: readonly MapDrawingPoint[]
  readonly color: string
  readonly widthMeters: number
}

export type MapDrawing = MapDrawingStroke
