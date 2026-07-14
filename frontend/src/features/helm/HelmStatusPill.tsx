export function HelmStatusPill({ status }: { status: string }) {
  if (!status) return <span className="text-muted-foreground/70">—</span>
  const normalized = status.trim().toLowerCase()
  const className =
    normalized === 'deployed'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : normalized === 'failed'
        ? 'bg-destructive/15 text-destructive'
        : normalized.startsWith('pending-') || normalized === 'uninstalling'
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          : 'bg-muted text-muted-foreground'
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${className}`}
    >
      {status}
    </span>
  )
}
