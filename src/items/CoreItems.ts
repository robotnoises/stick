import { Backpack } from "./Backpack"
import type { FlashlightUseAction } from "./FlashlightController"
import { CanteenItem } from "./canteen/CanteenItem"
import { FlashlightItem } from "./flashlight/FlashlightItem"
import { FlintAndSteelItem } from "./flint-and-steel/FlintAndSteelItem"
import { KnifeItem } from "./knife/KnifeItem"

export function createCoreBackpack(flashlightUseAction: FlashlightUseAction): Backpack {
  return new Backpack([
    new FlintAndSteelItem(),
    new KnifeItem(),
    new CanteenItem(),
    new FlashlightItem(flashlightUseAction),
  ])
}
