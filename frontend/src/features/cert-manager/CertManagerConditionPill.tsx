type ConditionKind = 'ready' | 'approved' | 'denied'
type ConditionStatus = 'true' | 'false' | 'unknown'
type Tone = 'success' | 'danger' | 'warning' | 'neutral'

const DISPLAY: Record<ConditionKind, Record<ConditionStatus, { label: string; tone: Tone }>> = {
  ready: {
    true: { label: 'Ready', tone: 'success' },
    false: { label: 'Failed', tone: 'danger' },
    unknown: { label: 'Reconciling', tone: 'warning' },
  },
  approved: {
    true: { label: 'Approved', tone: 'success' },
    false: { label: 'Not approved', tone: 'neutral' },
    unknown: { label: 'Approval pending', tone: 'warning' },
  },
  denied: {
    true: { label: 'Denied', tone: 'danger' },
    false: { label: 'Not denied', tone: 'success' },
    unknown: { label: 'Unknown', tone: 'warning' },
  },
}

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  danger: 'bg-destructive/15 text-destructive',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  neutral: 'bg-muted text-muted-foreground',
}

export function CertManagerConditionPill({
  kind,
  status,
}: {
  kind: ConditionKind
  status: string
}) {
  if (!status) return <span className="text-muted-foreground/70">—</span>
  const normalized = status.trim().toLowerCase()
  const display = DISPLAY[kind][normalized as ConditionStatus] ?? {
    label: status,
    tone: 'warning' as const,
  }
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TONE_CLASS[display.tone]}`}
    >
      {display.label}
    </span>
  )
}
