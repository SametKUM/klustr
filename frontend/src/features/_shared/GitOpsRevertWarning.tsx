import { TriangleAlert } from 'lucide-react'
import type { ResourceManager } from '@/lib/api'
import { cn } from '@/lib/utils'
import { revertingManagers, revertWarning } from './managedBy'

// GitOpsRevertWarning tells the user before a live edit that the resource's
// owner will undo it. field narrows the check to one JSON pointer, so a scale
// is not flagged when the owner ignores /spec/replicas.
export function GitOpsRevertWarning({
  managers,
  field,
  className,
}: {
  managers: ResourceManager[]
  field?: string
  className?: string
}) {
  const reverting = revertingManagers(managers, field)
  if (reverting.length === 0) return null
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-2 border-amber-500/40 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300',
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      <div className="space-y-0.5">
        {reverting.map((m) => (
          <p key={`${m.tool}|${m.kind}|${m.context}|${m.namespace}|${m.name}`}>{revertWarning(m)}</p>
        ))}
        <p>Change it in the source instead.</p>
      </div>
    </div>
  )
}
