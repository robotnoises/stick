import type { FlashlightUseAction } from "../FlashlightController"
import type { Item, ItemSource, ItemUseResult } from "../Item"

export class SolarFlashlightItem implements Item {
  public readonly id = "core_solar_flashlight"
  public readonly name = "Solar flashlight"
  public readonly description = "A small solar flashlight for local visibility at night."
  public readonly source: ItemSource = "core"
  public readonly discardable = true

  public constructor(private readonly _flashlightUseAction: FlashlightUseAction) {}

  public use(): ItemUseResult {
    const result = this._flashlightUseAction.toggle()

    return { success: true, message: result.message }
  }
}
