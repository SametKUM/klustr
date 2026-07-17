import { cn } from '@/lib/utils'

type Props = {
  contextName: string | null
  label?: string
  className?: string
}

export function ContextBadge({ contextName, label = 'Context', className }: Props) {
  if (!contextName) return null

  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px]',
        className,
      )}
      title={`${label}: ${contextName}`}
    >
      <span className="shrink-0 uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="truncate font-mono font-medium text-foreground">{contextName}</span>
    </span>
  )
}
