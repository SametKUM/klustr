import { useCallback, useEffect, useState } from 'react'
import { api, type JobInfo, type OwnerRef } from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import { useNowTick } from '@/lib/nowTick'
import { formatAge } from '@/lib/time'
import { ErrorBox, Td, Th } from '@/features/_shared/DetailPrimitives'
import { OwnerLink } from '@/features/_shared/OwnerLink'

function jobStatusClass(status: string): string | undefined {
  switch (status) {
    case 'Complete':
      return 'text-emerald-700 dark:text-emerald-300'
    case 'Failed':
      return 'text-destructive'
    default:
      return undefined
  }
}

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

// KEDAScaledJobJobsTab lists the Jobs a ScaledJob created, newest first, and
// follows the Job informer so new and finishing Jobs show without a refresh.
export function KEDAScaledJobJobsTab({ contextName, namespace, name }: Props) {
  // A running Job's duration and every Age cell are relative to now; the
  // heartbeat keeps them moving between Job events.
  useNowTick()
  const [rows, setRows] = useState<JobInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!contextName) return
    try {
      setRows(await api.listKEDAScaledJobJobs(contextName, namespace, name))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [contextName, namespace, name])

  useEffect(() => {
    if (!contextName) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The first read starts this subscription's lifecycle.
    void refresh()
    return onKubeChange('Job', (ctx) => {
      if (ctx === contextName) void refresh()
    })
  }, [contextName, refresh])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
      {error && <ErrorBox>{error}</ErrorBox>}
      {!error && rows === null && <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>}
      {!error && rows && rows.length === 0 && (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No Jobs from this ScaledJob. KEDA creates them while a trigger is active.
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Completions</Th>
                <Th>Duration</Th>
                <Th>Age</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.name} className="border-t border-border">
                  <Td className="font-mono">
                    <OwnerLink owner={{ kind: 'Job', name: j.name } as OwnerRef} namespace={namespace} context={contextName} />
                  </Td>
                  <Td className={jobStatusClass(j.status)}>{j.status || '—'}</Td>
                  <Td className="tabular-nums">{j.completions || '—'}</Td>
                  <Td>{j.duration || (j.startTime ? formatAge(j.startTime) : '—')}</Td>
                  <Td>{formatAge(j.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
