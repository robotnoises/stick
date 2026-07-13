import type { Item, ItemCategory, ItemUseResult, ItemSource } from "../Item"

export class FlintAndSteelItem implements Item {
  public readonly id = "core_flint_and_steel"
  public readonly name = "Flint & steel"
  public readonly description = "A reliable fire-starting kit for campfires and emergency warmth."
  public readonly source: ItemSource = "core"
  public readonly category: ItemCategory = "tool"
  public readonly consumable = false
  public readonly discardable = true
  public readonly maxQuantity = 1
  public quantity = 1

  public use(): ItemUseResult {
    return { success: true, message: "You ready the flint and steel." }
  }
}
