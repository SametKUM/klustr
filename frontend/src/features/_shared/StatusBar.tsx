import { useEffect, useState } from 'react'
import { Boxes, Folder, Network } from 'lucide-react'
import { useActiveContexts, useIsAggregated, useUIStore } from '@/store/ui'
import { usePortForwards } from '@/store/portForwards'
import { api } from '@/lib/api'

type ConnStatus = 'idle' | 'connecting' | 'connected' | 'error'

export function StatusBar() {
  const activeContexts = useActiveContexts()
  const isAggregated = useIsAggregated()
  const selectedContext = useUIStore((s) => s.selectedContext)
  const selectedNamespaces = useUIStore((s) => s.selectedNamespaces)
  const portForwards = usePortForwards((s) => s.list)
  const contextText = isAggregated
    ? `${activeContexts.length} contexts`
    : (selectedContext ?? 'no context')
  const namespaceText =
    selectedNamespaces.length === 0
      ? 'all namespaces'
      : selectedNamespaces.length === 1
        ? selectedNamespaces[0]
        : `${selectedNamespaces.length} namespaces`
  const [serverVersion, setServerVersion] = useState<string | null>(null)
  const [status, setStatus] = useState<ConnStatus>('idle')
  const [appVersion, setAppVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .version()
      .then((v) => {
        if (!cancelled) setAppVersion(v)
      })
      .catch(() => {
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedContext) {
      setServerVersion(null)
      setStatus('idle')
      return
    }
    let cancelled = false
    setStatus('connecting')
    api
      .pingContext(selectedContext)
      .then((v) => {
        if (cancelled) return
        setServerVersion(v.gitVersion)
        setStatus('connected')
      })
      .catch(() => {
        if (cancelled) return
        setServerVersion(null)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [selectedContext])

  const dotClass =
    status === 'connected'
      ? 'bg-emerald-500'
      : status === 'connecting'
        ? 'bg-amber-500 animate-pulse'
        : status === 'error'
          ? 'bg-destructive'
          : 'bg-muted-foreground/40'

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-background px-3 text-[10px] text-muted-foreground">
      <span
        className="inline-flex items-center gap-1.5"
        title={isAggregated ? activeContexts.join(', ') : undefined}
      >
        <span
          aria-label={`Cluster ${status}`}
          className={['inline-block size-2 rounded-full', dotClass].join(' ')}
        />
        <Boxes className="size-3" />
        {contextText}
      </span>
      {activeContexts.length > 0 && (
        <span
          className="inline-flex items-center gap-1.5"
          title={
            selectedNamespaces.length > 1 ? selectedNamespaces.join(', ') : undefined
          }
        >
          <Folder className="size-3" />
          {namespaceText}
        </span>
      )}
      {serverVersion && (
        <span className="font-mono">
          Kubernetes {serverVersion}
        </span>
      )}
      {portForwards.length > 0 && (
        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <Network className="size-3" />
          {portForwards.length} forward{portForwards.length === 1 ? '' : 's'}
        </span>
      )}
      <span
        className="ml-auto cursor-help font-mono text-muted-foreground/80 hover:text-foreground"
        title="Press ? to view keyboard shortcuts"
      >
        Press <kbd className="rounded border border-border bg-muted px-1 py-px text-[9px] text-foreground">?</kbd> for shortcuts
      </span>
      {appVersion && <span className="font-mono">Klustr {appVersion}</span>}
    </footer>
  )
}
