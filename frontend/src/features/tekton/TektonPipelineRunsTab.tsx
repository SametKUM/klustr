import { useCallback, useEffect, useState } from 'react'
import { api, type TektonPipelineRunInfo } from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import { formatAge } from '@/lib/time'
import { useNowTick } from '@/lib/nowTick'
import { ErrorBox, Td, Th } from '@/features/_shared/DetailPrimitives'
import { ensureWatchUntilSynced } from '@/features/_shared/customResourceModel'
import { findCRD, useCRDStore } from '@/store/crds'
import { TektonStatePill } from './TektonStatePill'
import { tektonElapsed, tektonTaskSummary } from './tektonFormat'
import { TEKTON_GROUP, TEKTON_PIPELINERUN_RESOURCE } from './tektonKinds'
import { useOpenTektonResource } from './useOpenTektonResource'

type Props = {
  contextName: string | null
  namespace: string
  pipeline: string
}

// TektonPipelineRunsTab lists a Pipeline's runs, newest first, and follows the
// PipelineRun informer so a new or finishing run shows up without a refresh.
export function TektonPipelineRunsTab({ contextName, namespace, pipeline }: Props) {
  useNowTick()
  const crd = useCRDStore((s) =>
    contextName ? findCRD(s.byContext, contextName, TEKTON_GROUP, TEKTON_PIPELINERUN_RESOURCE) : null,
  )
  const openTekton = useOpenTektonResource(contextName)
  const [rows, setRows] = useState<TektonPipelineRunInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!contextName) return
    try {
      setRows(await api.tektonPipelineRunsForPipeline(contextName, namespace, pipeline))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [contextName, namespace, pipeline])

  useEffect(() => {
    if (!contextName || !crd) return
    let cancelled = false
    ensureWatchUntilSynced(
      () => api.ensureCustomResourceWatch(contextName, crd.group, crd.version, crd.resource),
      () => cancelled,
    )
      .then(() => {
        if (!cancelled) void refresh()
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    const unsub = onKubeChange(`cr:${TEKTON_GROUP}/${TEKTON_PIPELINERUN_RESOURCE}`, (ctx) => {
      if (ctx === contextName) void refresh()
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [contextName, crd, refresh])

  if (!crd) {
    return (
      <div className="px-6 py-8 text-center text-xs text-muted-foreground">
        The pipelineruns.tekton.dev CRD is not present.
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
      {error && <ErrorBox>{error}</ErrorBox>}
      {!error && rows === null && <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>}
      {!error && rows && rows.length === 0 && (
        <div className="py-8 text-center text-xs text-muted-foreground">No runs of this pipeline.</div>
      )}
      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Tasks</Th>
                <Th>Started</Th>
                <Th>Duration</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.name}
                  className="cursor-pointer border-t border-border align-top hover:bg-muted/30"
                  onClick={() => openTekton('PipelineRun', row.namespace, row.name)}
                >
                  <Td className="font-mono">{row.name}</Td>
                  <Td>
                    <TektonStatePill state={row.state} reason={row.reason} message={row.message} />
                  </Td>
                  <Td>{tektonTaskSummary(row.tasks)}</Td>
                  <Td className="whitespace-nowrap">{formatAge(row.startTime)}</Td>
                  <Td className="whitespace-nowrap">
                    {tektonElapsed(row.duration, row.startTime, row.state)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
