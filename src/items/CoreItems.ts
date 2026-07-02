import { Backpack } from "./Backpack"
import { BlankMapItem } from "./implementations/BlankMapItem"
import { CanteenItem } from "./implementations/CanteenItem"
import { FlintAndSteelItem } from "./implementations/FlintAndSteelItem"
import { KnifeItem } from "./implementations/KnifeItem"
import { SolarFlashlightItem } from "./implementations/SolarFlashlightItem"

export function createCoreBackpack(): Backpack {
  return new Backpack([
    new FlintAndSteelItem(),
    new KnifeItem(),
    new CanteenItem(),
    new SolarFlashlightItem(),
    new BlankMapItem(),
  ])
}
