import type { Item, ItemUseResult, ItemSource } from "../Item"

export class SolarFlashlightItem implements Item {
  public readonly id = "core_solar_flashlight"
  public readonly name = "Solar flashlight"
  public readonly description = "A small solar flashlight for local visibility at night."
  public readonly source: ItemSource = "core"
  public readonly discardable = true

  public use(): ItemUseResult {
    return { success: true, message: "You test the solar flashlight." }
  }
}
