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

export interface MapDrawingLabel {
  readonly id: string
  readonly type: "label"
  readonly point: MapDrawingPoint
  readonly text: string
}

export type MapDrawing = MapDrawingLabel | MapDrawingStroke
