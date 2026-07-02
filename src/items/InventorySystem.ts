import type { GameSystem } from "../app/GameSystem"
import type { Backpack } from "./Backpack"

export class InventorySystem implements GameSystem {
  private readonly _element: HTMLElement
  private _isOpen = false
  private _lastUseMessage = "No item selected."

  public constructor(private readonly _backpack: Backpack) {
    this._element = document.createElement("section")
    this._element.id = "inventory-panel"
    this._element.hidden = true
    this._element.addEventListener("click", this._handlePanelClick)

    document.body.appendChild(this._element)
    window.addEventListener("keydown", this._handleKeyDown)
    this._render()
  }

  public get selectedItemName(): string | null {
    return this._backpack.selectedItem?.name ?? null
  }

  public update(_deltaSeconds: number): void {}

  public dispose(): void {
    window.removeEventListener("keydown", this._handleKeyDown)
    this._element.removeEventListener("click", this._handlePanelClick)
    this._element.remove()
  }

  private _toggleOpen(): void {
    this._isOpen = !this._isOpen
    this._element.hidden = !this._isOpen
    this._render()
  }

  private _close(): void {
    this._isOpen = false
    this._element.hidden = true
  }

  private _useSelectedItem(): void {
    this._lastUseMessage = this._backpack.useSelectedItem().message
    this._render()
  }

  private _selectItem(itemId: string): void {
    this._backpack.selectItem(itemId)
    this._lastUseMessage = `${this._backpack.selectedItem!.name} selected.`
    this._render()
  }

  private _render(): void {
    const selectedItemId = this._backpack.selectedItem?.id ?? ""
    const title = document.createElement("h2")
    const help = document.createElement("p")
    const list = document.createElement("div")
    const status = document.createElement("p")

    title.textContent = "Backpack"
    help.textContent = "I: close/open · click: select · U: use selected"
    list.className = "inventory-item-list"
    status.className = "inventory-status"
    status.textContent = `Selected: ${this.selectedItemName ?? "none"}. ${this._lastUseMessage}`

    for (const item of this._backpack.items) {
      const button = document.createElement("button")

      button.type = "button"
      button.className = item.id === selectedItemId ? "inventory-item selected" : "inventory-item"
      button.dataset.itemId = item.id
      button.textContent = item.name
      button.title = item.description
      list.appendChild(button)
    }

    this._element.replaceChildren(title, help, list, status)
  }

  private readonly _handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "KeyI") {
      event.preventDefault()
      this._toggleOpen()
    }

    if (event.code === "Escape") {
      event.preventDefault()
      this._close()
    }

    if (event.code === "KeyU") {
      event.preventDefault()
      this._useSelectedItem()
    }
  }

  private readonly _handlePanelClick = (event: MouseEvent): void => {
    event.stopPropagation()

    const target = event.target as HTMLElement
    const itemId = target.dataset.itemId

    if (itemId) {
      this._selectItem(itemId)
    }
  }
}
