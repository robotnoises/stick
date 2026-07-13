import { useState } from "preact/hooks"
import type { GameUiInventoryCategory, GameUiInventoryItem } from "../GameUiState"
import { Modal } from "./Modal"

export interface PackModalProps {
  readonly items: readonly GameUiInventoryItem[]
  readonly onClose: () => void
  readonly onItemSelected: (itemId: string) => void
  readonly selectedItemId: string | null
}

const tabs: readonly { readonly category: GameUiInventoryCategory; readonly label: string }[] = [
  { category: "tool", label: "Tools" },
  { category: "supply", label: "Supplies" },
]

export function PackModal({ items, onClose, onItemSelected, selectedItemId }: PackModalProps) {
  const [activeCategory, setActiveCategory] = useState<GameUiInventoryCategory>("tool")
  const visibleItems = items.filter((item) => item.category === activeCategory)
  const supplySlots = Array.from({ length: 16 }, (_, index) => visibleItems[index] ?? null)

  const selectItem = (itemId: string): void => {
    onItemSelected(itemId)
    onClose()
  }

  return (
    <Modal dismissOnBackdropClick showClose onClose={onClose} subtitle="Inventory" title="Pack">
      <div class="stick-pack-modal-content">
        <div class="stick-pack-tabs" role="tablist" aria-label="Pack categories">
          {tabs.map((tab) => (
            <button
              key={tab.category}
              class={activeCategory === tab.category ? "stick-pack-tab stick-pack-tab-active" : "stick-pack-tab"}
              type="button"
              role="tab"
              aria-selected={activeCategory === tab.category}
              onClick={() => setActiveCategory(tab.category)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeCategory === "supply" ? (
          <div class="stick-pack-supply-grid" role="listbox" aria-label="Supply slots">
            {supplySlots.map((item, index) =>
              item ? (
                <button
                  key={item.id}
                  class={item.id === selectedItemId ? "stick-pack-supply-slot stick-pack-supply-slot-filled stick-pack-supply-slot-selected" : "stick-pack-supply-slot stick-pack-supply-slot-filled"}
                  type="button"
                  role="option"
                  aria-label={item.name}
                  aria-selected={item.id === selectedItemId}
                  title={item.description}
                  onClick={() => selectItem(item.id)}
                >
                  <span>{item.name.slice(0, 2)}</span>
                  {item.maxQuantity > 1 ? <span class="stick-pack-supply-quantity">{item.quantity}</span> : null}
                </button>
              ) : (
                <div key={`empty-${index}`} class="stick-pack-supply-slot" role="presentation" />
              ),
            )}
          </div>
        ) : visibleItems.length > 0 ? (
          <div class="stick-pack-list" role="listbox" aria-label="Pack items">
            {visibleItems.map((item) => {
              const selected = item.id === selectedItemId

              return (
                <button
                  key={item.id}
                  class={selected ? "stick-pack-item stick-pack-item-selected" : "stick-pack-item"}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => selectItem(item.id)}
                >
                  <span class="stick-pack-item-name">{item.name}</span>
                  <span class="stick-pack-item-description">{item.description}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <p class="stick-pack-empty">No tools yet.</p>
        )}
      </div>
    </Modal>
  )
}
