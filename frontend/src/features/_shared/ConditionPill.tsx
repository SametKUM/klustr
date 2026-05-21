// Small status pill used by Gateway API views to render the True / False /
// Unknown status of a status condition (Programmed, Accepted, ResolvedRefs…).
export function ConditionPill({ status }: { status: string }) {
  if (!status) {
    return <span className="text-muted-foreground/70">—</span>
  }
  const cls =
    status === 'True'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : status === 'False'
        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  )
}
