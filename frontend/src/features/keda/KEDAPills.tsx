import { type KEDAPauseFields, kedaPauseLabel } from './kedaPause'

// KEDAActivityPill shows the Active condition: whether any trigger currently
// asks for replicas above the minimum.
export function KEDAActivityPill({ status }: { status: string }) {
  if (!status) return <span className="text-muted-foreground/70">—</span>
  const [label, cls] =
    status === 'True'
      ? ['Active', 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300']
      : status === 'False'
        ? ['Idle', 'bg-muted text-muted-foreground']
        : [status, 'bg-amber-500/15 text-amber-700 dark:text-amber-300']
  return <Pill className={cls} label={label} />
}

export function KEDAPausedPill({ state }: { state: KEDAPauseFields }) {
  const label = kedaPauseLabel(state)
  if (!label) return <span className="text-muted-foreground/70">—</span>
  return <Pill className="bg-amber-500/15 text-amber-700 dark:text-amber-300" label={label} />
}

// KEDAFallbackPill marks a ScaledObject running on its fallback replica count
// because a trigger keeps failing.
export function KEDAFallbackPill({ status }: { status: string }) {
  if (status !== 'True') return <span className="text-muted-foreground/70">—</span>
  return <Pill className="bg-destructive/15 text-destructive" label="Fallback" />
}

function Pill({ className, label }: { className: string; label: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  )
}
