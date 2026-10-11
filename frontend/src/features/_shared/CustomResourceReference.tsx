import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useCRDStore } from '@/store/crds'
import { useUIStore } from '@/store/ui'
import { ensureWatchUntilSynced } from './customResourceModel'

type Props = {
  contextName: string | null | undefined
  group: string
  resource: string
  kind: string
  namespace: string
  name: string
  loadSuspended?: (
    contextName: string,
    namespace: string,
    name: string,
  ) => Promise<{ suspended: boolean }>
}

export function CustomResourceReference({
  contextName,
  group,
  resource,
  kind,
  namespace,
  name,
  loadSuspended,
}: Props) {
  const crd = useCRDStore((state) =>
    contextName
      ? state.byContext[contextName]?.find(
          (item) => item.group === group && item.resource === resource,
        )
      : undefined,
  )
  const openResource = useUIStore((state) => state.openResource)
  const identity = [contextName, group, crd?.version, resource, kind, namespace, name].join(
    '\u0000',
  )
  const [pendingIdentity, setPendingIdentity] = useState<string | null>(null)
  const pending = pendingIdentity === identity
  const requestRef = useRef(0)
  useEffect(
    () => () => {
      requestRef.current += 1
    },
    [identity],
  )
  if (!name) return <span className="text-muted-foreground">—</span>
  if (!contextName || !crd) return <span className="font-mono text-xs">{name}</span>

  return (
    <button
      type="button"
      disabled={pending}
      className="min-h-6 cursor-pointer rounded-sm text-left font-mono text-xs hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
      title={`${crd.kind}/${namespace ? `${namespace}/` : ''}${name}`}
      onClick={async (event) => {
        event.stopPropagation()
        const request = ++requestRef.current
        setPendingIdentity(identity)
        try {
          await ensureWatchUntilSynced(
            () => api.ensureCustomResourceWatch(contextName, group, crd.version, resource),
            () => request !== requestRef.current,
          )
          if (request !== requestRef.current) return
          const target = loadSuspended
            ? await loadSuspended(contextName, namespace, name)
            : undefined
          if (request !== requestRef.current) return
          openResource({
            kind,
            namespace,
            name,
            context: contextName,
            gvr: { group, version: crd.version, resource },
            ...(target ? { suspended: target.suspended } : {}),
          })
        } catch (error) {
          if (request === requestRef.current)
            toast.error(`Could not open ${crd.kind}: ${String(error)}`)
        } finally {
          if (request === requestRef.current) setPendingIdentity(null)
        }
      }}
    >
      {name}
    </button>
  )
}
