import { useEffect, useRef, useState, type ComponentType, type SVGAttributes } from 'react'
import { GitBranch } from 'lucide-react'
import { toast } from 'sonner'
import { api, type ResourceManager } from '@/lib/api'
import { findCRD, useCRDStore } from '@/store/crds'
import { useUIStore } from '@/store/ui'
import { cn } from '@/lib/utils'
import { Flux, SiArgo, SiHelm } from './brandIcons'
import { ensureWatchUntilSynced } from './customResourceModel'
import { TOOL_LABEL, managerResource, managerTitle } from './managedBy'

const TOOL_ICON: Record<string, ComponentType<SVGAttributes<SVGElement>>> = {
  argocd: SiArgo,
  flux: Flux,
  helm: SiHelm,
}

const CHIP =
  'inline-flex min-w-0 max-w-64 items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px]'

export function ManagedByChips({
  contextName,
  managers,
}: {
  contextName: string | null
  managers: ResourceManager[]
}) {
  if (managers.length === 0) return null
  return (
    <>
      {managers.map((m) => (
        <ManagedByChip key={`${m.tool}|${m.kind}|${m.context}|${m.namespace}|${m.name}`} contextName={contextName} manager={m} />
      ))}
    </>
  )
}

function ManagedByChip({ contextName, manager }: { contextName: string | null; manager: ResourceManager }) {
  const openResource = useUIStore((s) => s.openResource)
  const crd = useCRDStore((s) =>
    manager.group && manager.context ? findCRD(s.byContext, manager.context, manager.group, manager.resource) : null,
  )
  const [pending, setPending] = useState(false)
  const requestRef = useRef(0)
  // The chips unmount when the panel closes or moves to another resource; a
  // watch still syncing must not then open the owner over that choice.
  useEffect(
    () => () => {
      requestRef.current += 1
    },
    [],
  )
  const Icon = TOOL_ICON[manager.tool] ?? GitBranch
  const elsewhere = manager.context && manager.context !== contextName ? ` in ${manager.context}` : ''
  const title = [
    `Managed by ${managerTitle(manager)}${elsewhere}`,
    manager.suspended ? 'Suspended' : '',
    manager.revertsDrift ? `Reverts live changes: ${manager.revertReason}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  const label = (
    <>
      <Icon className="size-3 shrink-0" />
      <span className="shrink-0 uppercase tracking-wide text-muted-foreground">{TOOL_LABEL[manager.tool] ?? manager.tool}</span>
      <span className="truncate font-mono font-medium text-foreground">{manager.name}</span>
    </>
  )
  // A CR owner opens once its context serves the CRD; a Helm release needs
  // only its namespace and name.
  const openable = manager.resolved && (!manager.group || crd !== null)
  if (!openable) {
    return (
      <span className={CHIP} title={title}>
        {label}
      </span>
    )
  }

  const open = async () => {
    const request = ++requestRef.current
    if (!crd) {
      openResource(managerResource(manager))
      return
    }
    setPending(true)
    try {
      await ensureWatchUntilSynced(
        () => api.ensureCustomResourceWatch(manager.context, crd.group, crd.version, crd.resource),
        () => request !== requestRef.current,
      )
      if (request === requestRef.current) openResource(managerResource(manager, crd.version))
    } catch (error) {
      if (request === requestRef.current) toast.error(`Could not open ${managerTitle(manager)}: ${String(error)}`)
    } finally {
      if (request === requestRef.current) setPending(false)
    }
  }

  return (
    <button
      type="button"
      title={title}
      disabled={pending}
      onClick={() => void open()}
      className={cn(
        CHIP,
        'cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait',
      )}
    >
      {label}
    </button>
  )
}
