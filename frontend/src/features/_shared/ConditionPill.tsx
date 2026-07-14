// Small status pill for the True / False / Unknown value of a metav1.Condition,
// shared across detail views (Gateway, CSR, Flux, cert-manager, PVC, PDB).
// Generic semantics: True=good, False=bad, anything else=warning. Do not use it
// for kinds whose conditions are inverted (e.g. HPA ScalingLimited, several Node
// conditions where True is the failure) — those need type-aware coloring.
export function ConditionPill({ status }: { status: string }) {
  if (!status) {
    return <span className="text-muted-foreground/70">—</span>
  }
  const cls =
    status === 'True'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : status === 'False'
        ? 'bg-destructive/15 text-destructive'
        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  )
}
