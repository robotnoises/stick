import { Backpack } from "./Backpack"
import type { FlashlightUseAction } from "./FlashlightController"
import { BlankMapItem } from "./implementations/BlankMapItem"
import { CanteenItem } from "./implementations/CanteenItem"
import { FlintAndSteelItem } from "./implementations/FlintAndSteelItem"
import { KnifeItem } from "./implementations/KnifeItem"
import { SolarFlashlightItem } from "./implementations/SolarFlashlightItem"

export function createCoreBackpack(flashlightUseAction: FlashlightUseAction): Backpack {
  return new Backpack([
    new FlintAndSteelItem(),
    new KnifeItem(),
    new CanteenItem(),
    new SolarFlashlightItem(flashlightUseAction),
    new BlankMapItem(),
  ])
}
