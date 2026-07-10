import type { ComponentChildren } from "preact"
import { useId } from "preact/hooks"

export interface ModalProps {
  readonly children: ComponentChildren
  readonly dismissOnBackdropClick?: boolean
  readonly onClose: () => void
  readonly showClose?: boolean
  readonly subtitle: string
  readonly title: string
}

export function Modal({
  children,
  dismissOnBackdropClick = false,
  onClose,
  showClose = false,
  subtitle,
  title,
}: ModalProps) {
  const titleId = useId()

  return (
    <div className="stick-modal" role="presentation">
      <button
        className="stick-modal-backdrop"
        type="button"
        aria-label="Close modal"
        onClick={dismissOnBackdropClick ? onClose : undefined}
      />
      <div className="stick-modal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="stick-modal-header">
          <div>
            <p className="stick-menu-kicker">{subtitle}</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          {showClose ? (
            <button className="stick-modal-close" type="button" aria-label="Close modal" onClick={onClose}>
              ×
            </button>
          ) : null}
        </header>
        {children}
      </div>
    </div>
  )
}
