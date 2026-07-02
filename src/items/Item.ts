export type ItemSource = "core" | "found"

export interface ItemUseResult {
  readonly success: boolean
  readonly message: string
}

export interface Item {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly source: ItemSource
  readonly discardable: boolean

  use(): ItemUseResult
}
