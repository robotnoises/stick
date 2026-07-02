import type { Item, ItemUseResult, ItemSource } from "../Item"

export class KnifeItem implements Item {
  public readonly id = "core_knife"
  public readonly name = "Knife"
  public readonly description = "A hunting knife for cutting, preparing tinder, and close survival tasks."
  public readonly source: ItemSource = "core"
  public readonly discardable = true

  public use(): ItemUseResult {
    return { success: true, message: "You grip the knife." }
  }
}
