import { cn } from '@/lib/utils'

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-200',
        className,
      )}
      {...props}
    />
  )
}
