import type { Item, ItemCategory, ItemUseResult, ItemSource } from "../Item"

export class KnifeItem implements Item {
  public readonly id = "core_knife"
  public readonly name = "Knife"
  public readonly description = "A hunting knife for cutting, preparing tinder, and close survival tasks."
  public readonly source: ItemSource = "core"
  public readonly category: ItemCategory = "tool"
  public readonly consumable = false
  public readonly discardable = true
  public readonly maxQuantity = 1
  public quantity = 1

  public use(): ItemUseResult {
    return { success: true, message: "You grip the knife." }
  }
}
