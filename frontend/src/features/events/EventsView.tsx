import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api, type EventInfo } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { formatAge } from '@/lib/time'
import { namespaceQuery } from '@/lib/namespaceFilter'
import { ErrorBox, Th, Td } from '@/features/_shared/DetailPrimitives'
import { useActiveContexts, useIsAggregated, useUIStore } from '@/store/ui'

type TaggedEvent = EventInfo & { contextName: string }

export function EventsView() {
  const activeContexts = useActiveContexts()
  const isAggregated = useIsAggregated()
  const selectedNamespaces = useUIStore((s) => s.selectedNamespaces)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const [events, setEvents] = useState<TaggedEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const ctxKey = activeContexts.join('|')

  const refresh = useCallback(async () => {
    if (activeContexts.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const { apiNamespace, matches } = namespaceQuery(selectedNamespaces)
      const results = await Promise.all(
        activeContexts.map((ctx) =>
          api
            .listEvents(ctx, apiNamespace, '', '')
            .then((list) =>
              list.map((e) => Object.assign(e, { contextName: ctx }) as TaggedEvent),
            )
            .catch(() => [] as TaggedEvent[]),
        ),
      )
      const merged: TaggedEvent[] = []
      for (const list of results) {
        for (const e of list) {
          if (selectedNamespaces.length > 1 && !matches(e.namespace)) continue
          merged.push(e)
        }
      }
      merged.sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''))
      setEvents(merged)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, selectedNamespaces])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (activeContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Select a kubeconfig context to see events.
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span>
          {loading ? 'Loading…' : `${events.length} event${events.length === 1 ? '' : 's'}`}
          {selectedNamespaces.length === 0
            ? ' across all namespaces'
            : selectedNamespaces.length === 1
              ? ` in ${selectedNamespaces[0]}`
              : ` in ${selectedNamespaces.length} namespaces`}
          {isAggregated ? ` across ${activeContexts.length} contexts` : ''}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={refresh}
          disabled={loading}
          className="ml-auto h-7 gap-1.5 text-xs"
        >
          <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        {!error && events.length === 0 && !loading && (
          <div className="py-8 text-center text-xs text-muted-foreground">No events.</div>
        )}
        {events.length > 0 && (
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  {isAggregated && <Th>Context</Th>}
                  <Th>Type</Th>
                  <Th>Reason</Th>
                  <Th>Age</Th>
                  <Th>Namespace</Th>
                  <Th>Object</Th>
                  <Th>From</Th>
                  <Th>Count</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr
                    key={e.contextName + '/' + e.namespace + '/' + e.name}
                    className="cursor-pointer border-t border-border align-top hover:bg-muted/40"
                    onClick={() => {
                      if (!e.objectKind || !e.objectName) return
                      setSelectedResource({
                        kind: e.objectKind as any,
                        namespace: e.namespace,
                        name: e.objectName,
                        context: e.contextName,
                      })
                    }}
                  >
                    {isAggregated && <Td className="font-mono text-xs">{e.contextName}</Td>}
                    <Td><span className={typeClass(e.type)}>{e.type}</span></Td>
                    <Td className="font-mono">{e.reason}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{formatAge(e.lastSeen)}</Td>
                    <Td>{e.namespace || '—'}</Td>
                    <Td className="font-mono text-xs">{e.objectKind}/{e.objectName}</Td>
                    <Td className="text-muted-foreground">{e.source || '—'}</Td>
                    <Td className="font-mono">{e.count}</Td>
                    <Td className="max-w-[28rem] whitespace-pre-wrap break-words">{e.message}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function typeClass(type: string): string {
  if (type === 'Warning') return 'text-amber-600 dark:text-amber-400 font-medium'
  if (type === 'Error') return 'text-destructive font-medium'
  return 'text-muted-foreground'
}
