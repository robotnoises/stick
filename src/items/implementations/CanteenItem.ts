import type { Item, ItemUseResult, ItemSource } from "../Item"

export class CanteenItem implements Item {
  public readonly id = "core_canteen"
  public readonly name = "Canteen"
  public readonly description = "A small canteen for carrying drinking water."
  public readonly source: ItemSource = "core"
  public readonly discardable = true

  public use(): ItemUseResult {
    return { success: true, message: "You check the canteen." }
  }
}
