type Props = {
  status: string
  suspended?: boolean
  title?: string
}

// ReadyPill renders the status of a resource's Ready condition, the headline
// health signal of Flux, cert-manager, Karpenter and Kyverno objects, in the
// same words everywhere. A suspended Flux object is not reconciled, so its
// Ready status is stale and the pill says Suspended instead.
export function ReadyPill({ status, suspended = false, title }: Props) {
  if (suspended) return <Pill className="bg-muted text-muted-foreground" label="Suspended" title={title} />
  switch (status) {
    case 'True':
      return (
        <Pill className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" label="Ready" title={title} />
      )
    case 'False':
      return <Pill className="bg-destructive/15 text-destructive" label="Not ready" title={title} />
    case '':
      return <span className="text-muted-foreground/70">—</span>
    default:
      return (
        <Pill className="bg-amber-500/15 text-amber-700 dark:text-amber-300" label={status} title={title} />
      )
  }
}

function Pill({ className, label, title }: { className: string; label: string; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  )
}
