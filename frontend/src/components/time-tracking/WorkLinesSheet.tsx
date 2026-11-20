import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * Dialog shell for editing work lines. On phones it is a full-height bottom
 * sheet with a sticky footer (so the remaining counter and submit button stay
 * in reach above the keyboard); from the `md` breakpoint it is a centered
 * wide modal.
 */
export default function WorkLinesSheet({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children,
  wide = true,
}: {
  open: boolean
  title: string
  subtitle?: ReactNode
  onClose: () => void
  footer: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  // Callers often pass an inline onClose; read the latest one through a ref
  // so the open/close effect below runs only when `open` changes. Re-running
  // it on every render would move focus off the field being typed in.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex h-[100dvh] w-full flex-col bg-white shadow-xl outline-none md:h-auto md:max-h-[90vh] md:rounded-2xl ${wide ? 'md:max-w-5xl' : 'md:max-w-lg'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-neutral-warm px-4 py-3 md:px-6 md:py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-primary-dark">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-text-muted">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-lg text-2xl leading-none text-text-muted hover:bg-secondary"
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6">{children}</div>
        <footer
          className="border-t border-neutral-warm bg-white px-4 py-3 md:rounded-b-2xl md:px-6"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {footer}
        </footer>
      </div>
    </div>
  )
}
