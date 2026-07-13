import type { Item, ItemUseResult } from "./Item"

export class Backpack {
  private readonly _items = new Map<string, Item>()
  private _selectedItemId: string | null = null

  public constructor(items: Item[] = []) {
    for (const item of items) {
      this.addItem(item)
    }
  }

  public get items(): Item[] {
    return [...this._items.values()]
  }

  public get selectedItem(): Item | null {
    if (!this._selectedItemId) {
      return null
    }

    return this.getItem(this._selectedItemId)
  }

  public addItem(item: Item, quantity = item.quantity): void {
    const existingItem = this.getItem(item.id)

    if (existingItem) {
      existingItem.quantity = Math.min(existingItem.quantity + quantity, existingItem.maxQuantity)
      return
    }

    item.quantity = Math.min(Math.max(quantity, 0), item.maxQuantity)
    this._items.set(item.id, item)
  }

  public getItem(id: string): Item | null {
    return this._items.get(id) ?? null
  }

  public removeItemQuantity(id: string, quantity = 1): boolean {
    const item = this.getItem(id)

    if (!item || quantity <= 0 || item.quantity < quantity) {
      return false
    }

    item.quantity -= quantity

    if (item.quantity <= 0) {
      return this.discardItem(id)
    }

    return true
  }

  public selectItem(id: string): boolean {
    if (!this.getItem(id)) {
      return false
    }

    this._selectedItemId = id
    return true
  }

  public clearSelection(): void {
    this._selectedItemId = null
  }

  public discardItem(id: string): boolean {
    const deleted = this._items.delete(id)

    if (this._selectedItemId === id) {
      this.clearSelection()
    }

    return deleted
  }

  public useSelectedItem(): ItemUseResult {
    const item = this.selectedItem

    if (!item) {
      return { success: false, message: "No item selected." }
    }

    return item.use()
  }
}
