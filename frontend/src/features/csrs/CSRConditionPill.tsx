// CSR has more terminal states than a plain True/False/Unknown condition:
// Pending → Approved → Issued is the happy path, while Denied and Failed are
// terminal failure modes. Map each to its own pill color so the list shows
// pipeline state at a glance.
export function CSRConditionPill({ condition }: { condition: string }) {
  const cls =
    condition === 'Issued'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : condition === 'Approved'
        ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
        : condition === 'Denied'
          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
          : condition === 'Failed'
            ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300'
            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {condition || 'Unknown'}
    </span>
  )
}
