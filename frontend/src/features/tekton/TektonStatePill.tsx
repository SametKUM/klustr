import { tektonStateClass, tektonStateLabel } from './tektonFormat'

export function TektonStatePill({
  state,
  reason,
  message,
}: {
  state: string
  reason?: string
  message?: string
}) {
  if (!state) return <span className="text-muted-foreground/70">—</span>
  return (
    <span
      className={`inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tektonStateClass(state)}`}
      title={message || undefined}
    >
      {tektonStateLabel(state, reason)}
    </span>
  )
}
