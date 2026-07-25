import { X } from 'lucide-react'
import { Card } from './Card'

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <Card
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="rounded-lg p-1 text-ink-muted hover:bg-surface-muted"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </Card>
    </div>
  )
}
