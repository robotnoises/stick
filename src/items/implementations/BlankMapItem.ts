import type { Item, ItemUseResult, ItemSource } from "../Item"

export class BlankMapItem implements Item {
  public readonly id = "core_blank_map"
  public readonly name = "Blank map"
  public readonly description = "A gridded paper map that begins blank except for your starting point."
  public readonly source: ItemSource = "core"
  public readonly discardable = true

  public use(): ItemUseResult {
    return { success: true, message: "You unfold the blank map." }
  }
}
