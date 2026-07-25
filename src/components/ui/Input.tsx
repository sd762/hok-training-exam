import { cn } from '@/lib/utils'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-200 disabled:bg-surface-muted disabled:text-ink-muted',
        className,
      )}
      {...props}
    />
  )
}
