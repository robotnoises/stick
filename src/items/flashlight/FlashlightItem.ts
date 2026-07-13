import type { FlashlightUseAction } from "../FlashlightController"
import type { Item, ItemCategory, ItemSource, ItemUseResult } from "../Item"

export class FlashlightItem implements Item {
  public readonly id = "core_solar_flashlight"
  public readonly name = "Flashlight"
  public readonly description = "A small flashlight for local visibility at night."
  public readonly source: ItemSource = "core"
  public readonly category: ItemCategory = "tool"
  public readonly consumable = false
  public readonly discardable = true
  public readonly maxQuantity = 1
  public quantity = 1

  public constructor(private readonly _flashlightUseAction: FlashlightUseAction) {}

  public use(): ItemUseResult {
    const result = this._flashlightUseAction.toggle()

    return { success: true, message: result.message }
  }
}
