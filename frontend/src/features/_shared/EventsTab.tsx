import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api, type EventInfo } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { formatAge } from '@/lib/time'
import { ErrorBox, Th, Td } from './DetailPrimitives'

type Props = {
  contextName: string | null
  namespace: string
  kind: string
  name: string
}

export function EventsTab({ contextName, namespace, kind, name }: Props) {
  const [events, setEvents] = useState<EventInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!contextName) return
    setLoading(true)
    setError(null)
    try {
      const list = await api.listEvents(contextName, namespace, kind, name)
      setEvents(list)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [contextName, namespace, kind, name])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial load belongs to this subscription lifecycle.
    refresh()
  }, [refresh])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-2">
        <div className="text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${events.length} event${events.length === 1 ? '' : 's'}`}
        </div>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} className="h-7 gap-1.5 text-xs">
          <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        {!error && events.length === 0 && !loading && (
          <div className="py-8 text-center text-xs text-muted-foreground">No events for this resource.</div>
        )}
        {events.length > 0 && (
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Type</Th>
                  <Th>Reason</Th>
                  <Th>Age</Th>
                  <Th>From</Th>
                  <Th>Count</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.namespace + '/' + e.name} className="border-t border-border align-top">
                    <Td>
                      <span className={typeClass(e.type)}>{e.type}</span>
                    </Td>
                    <Td className="font-mono">{e.reason}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{formatAge(e.lastSeen)}</Td>
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
