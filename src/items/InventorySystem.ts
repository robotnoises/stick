import type { GameSystem } from "../app/GameSystem"
import type { Backpack } from "./Backpack"

export class InventorySystem implements GameSystem {
  public constructor(private readonly _backpack: Backpack) {}

  public get items() {
    return this._backpack.items
  }

  public get selectedItemId(): string | null {
    return this._backpack.selectedItem?.id ?? null
  }

  public get selectedItemName(): string | null {
    return this._backpack.selectedItem?.name ?? null
  }

  public selectItem(itemId: string): boolean {
    return this._backpack.selectItem(itemId)
  }

  public useSelectedItem(): string {
    return this._backpack.useSelectedItem().message
  }

  public update(_deltaSeconds: number): void {}
}
