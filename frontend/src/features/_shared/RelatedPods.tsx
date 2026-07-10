import { useCallback, useEffect, useState } from 'react'
import { api, type PodInfo } from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import { formatAge } from '@/lib/time'
import { useUIStore } from '@/store/ui'
import { ErrorBox, Section, Td, Th } from './DetailPrimitives'
import { NodeLink } from './NodeLink'

type Props = {
  contextName: string | null
  kind: 'Node' | 'Deployment' | 'StatefulSet' | 'DaemonSet' | 'ReplicaSet'
  namespace: string
  name: string
  title?: string
}

const HEALTHY = new Set(['Running'])
const TERMINAL = new Set(['Completed', 'Succeeded'])
const PROGRESSING = new Set(['Pending', 'ContainerCreating', 'PodInitializing', 'Terminating'])
const FAILURE = new Set([
  'CrashLoopBackOff',
  'ImagePullBackOff',
  'ErrImagePull',
  'CreateContainerConfigError',
  'CreateContainerError',
  'InvalidImageName',
  'Error',
  'OOMKilled',
  'Failed',
  'Evicted',
  'DeadlineExceeded',
])

function statusClass(status: string): string {
  if (HEALTHY.has(status)) return 'text-emerald-600 dark:text-emerald-400'
  if (TERMINAL.has(status)) return 'text-muted-foreground'
  if (PROGRESSING.has(status) || status.startsWith('Init:')) return 'text-amber-600 dark:text-amber-400'
  if (FAILURE.has(status) || status.startsWith('Signal:') || status.startsWith('ExitCode:')) {
    return 'text-destructive'
  }
  return 'text-foreground'
}

export function RelatedPods({ contextName, kind, namespace, name, title }: Props) {
  const [pods, setPods] = useState<PodInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  // Distinguish "still loading the first list" from "loaded, genuinely empty"
  // so the initial render doesn't flash a false "No pods" before data lands.
  // Background onKubeChange refreshes keep loaded=true, so the table doesn't
  // flicker on unrelated pod churn.
  const [loaded, setLoaded] = useState(false)
  const openResource = useUIStore((s) => s.openResource)

  const refresh = useCallback(async () => {
    if (!contextName) {
      setPods([])
      setLoaded(true)
      return
    }
    try {
      const list = await api.podsForOwner(contextName, kind, namespace, name)
      setPods(list ?? [])
      setError(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoaded(true)
    }
  }, [contextName, kind, namespace, name])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Resource identity invalidates the previous remote snapshot.
    setLoaded(false)
    setPods([])
    refresh()
    if (!contextName) return
    return onKubeChange('Pod', (ctx, delta) => {
      if (ctx !== contextName) return
      // For a workload owner only this namespace's pods are relevant, so skip
      // bursts that don't touch it (the event carries the changed/removed pods).
      // A Node owner's pods span namespaces, and an absent/reset delta is
      // unfiltered, so both fall through to a refresh.
      if (kind !== 'Node' && delta && !delta.reset) {
        const touches =
          (delta.upserts as Array<{ namespace?: string }>).some((u) => u?.namespace === namespace) ||
          delta.removed.some((k) => k.startsWith(`${namespace}/`))
        if (!touches) return
      }
      refresh()
    })
  }, [refresh, contextName, kind, namespace])

  const showNamespace = kind === 'Node'
  const showNode = kind !== 'Node'
  const heading = title ?? 'Pods'

  return (
    <Section title={`${heading} (${pods.length})`}>
      {error && <ErrorBox>{error}</ErrorBox>}
      {!error && !loaded && (
        <div className="py-3 text-xs text-muted-foreground">Loading pods…</div>
      )}
      {!error && loaded && pods.length === 0 && (
        <div className="py-3 text-xs text-muted-foreground">No pods match this resource.</div>
      )}
      {pods.length > 0 && (
        <div className="overflow-hidden rounded border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                {showNamespace && <Th>Namespace</Th>}
                <Th>Name</Th>
                <Th>Ready</Th>
                <Th>Status</Th>
                <Th>Restarts</Th>
                {showNode && <Th>Node</Th>}
                <Th>Age</Th>
              </tr>
            </thead>
            <tbody>
              {pods.map((p) => {
                const open = () =>
                  openResource({
                    kind: 'Pod',
                    namespace: p.namespace,
                    name: p.name,
                    context: contextName ?? undefined,
                  })
                return (
                <tr
                  key={`${p.namespace}/${p.name}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open pod ${p.name}`}
                  className="cursor-pointer border-t border-border align-top hover:bg-muted/40 focus:bg-muted/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      open()
                    }
                  }}
                >
                  {showNamespace && <Td className="text-muted-foreground">{p.namespace}</Td>}
                  <Td className="font-mono">{p.name}</Td>
                  <Td>{p.ready}</Td>
                  <Td className={statusClass(p.status)}>{p.status}</Td>
                  <Td>{p.restarts}</Td>
                  {showNode && (
                    <Td className="text-muted-foreground">
                      {p.node ? <NodeLink name={p.node} context={contextName} /> : '—'}
                    </Td>
                  )}
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {formatAge(p.createdAt)}
                  </Td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}
