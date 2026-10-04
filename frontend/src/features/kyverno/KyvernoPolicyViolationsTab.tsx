import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type PolicyViolation } from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import { formatAge } from '@/lib/time'
import { ErrorBox, Td, Th } from '@/features/_shared/DetailPrimitives'
import { ensureWatchUntilSynced } from '@/features/_shared/customResourceModel'
import { findCRD, useCRDStore } from '@/store/crds'
import { PolicyResultPill } from './PolicyResults'
import { CLUSTERPOLICYREPORT_RESOURCE, POLICY_REPORT_GROUP, POLICYREPORT_RESOURCE } from './kyvernoKinds'
import { useOpenKyvernoResource } from './useOpenKyvernoResource'

type Props = {
  contextName: string | null
  // How reports name the policy: "<name>", or "<namespace>/<name>" for a
  // namespaced one.
  policyKey: string
}

const REPORT_RESOURCES = [POLICYREPORT_RESOURCE, CLUSTERPOLICYREPORT_RESOURCE]

// KyvernoPolicyViolationsTab lists the resources a policy fails or warns on,
// from every PolicyReport and ClusterPolicyReport. Opening it starts the
// report watches; they then keep the list current.
export function KyvernoPolicyViolationsTab({ contextName, policyKey }: Props) {
  const catalog = useCRDStore((s) => s.byContext)
  const crds = useMemo(
    () =>
      contextName
        ? REPORT_RESOURCES.map((r) => findCRD(catalog, contextName, POLICY_REPORT_GROUP, r)).filter(
            (c): c is NonNullable<typeof c> => c !== null,
          )
        : [],
    [catalog, contextName],
  )
  const { openTarget } = useOpenKyvernoResource(contextName)
  const [rows, setRows] = useState<PolicyViolation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!contextName) return
    try {
      setRows(await api.policyViolationsFor(contextName, policyKey))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [contextName, policyKey])

  useEffect(() => {
    if (!contextName || crds.length === 0) return
    let cancelled = false
    Promise.all(
      crds.map((crd) =>
        ensureWatchUntilSynced(
          () => api.ensureCustomResourceWatch(contextName, crd.group, crd.version, crd.resource),
          () => cancelled,
        ),
      ),
    )
      .then(() => {
        if (!cancelled) void refresh()
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    const unsubs = REPORT_RESOURCES.map((r) =>
      onKubeChange(`cr:${POLICY_REPORT_GROUP}/${r}`, (ctx) => {
        if (ctx === contextName) void refresh()
      }),
    )
    return () => {
      cancelled = true
      unsubs.forEach((u) => u())
    }
  }, [contextName, crds, refresh])

  if (crds.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-xs text-muted-foreground">
        The wgpolicyk8s.io report CRDs are not present, so there are no results to show.
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
      {error && <ErrorBox>{error}</ErrorBox>}
      {!error && rows === null && <div className="py-8 text-center text-xs text-muted-foreground">Loading reports…</div>}
      {!error && rows && rows.length === 0 && (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No report lists a failing or warning result for this policy.
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <Th>Result</Th>
                <Th>Resource</Th>
                <Th>Rule</Th>
                <Th>Message</Th>
                <Th>Age</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v, i) => (
                <tr key={`${v.kind}/${v.namespace}/${v.name}/${v.rule}/${i}`} className="border-t border-border align-top">
                  <Td>
                    <PolicyResultPill result={v.result} />
                  </Td>
                  <Td className="font-mono">
                    <button
                      type="button"
                      onClick={() => openTarget(v)}
                      className="rounded text-left text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {v.kind} {v.namespace ? `${v.namespace}/` : ''}
                      {v.name}
                    </button>
                  </Td>
                  <Td className="font-mono">{v.rule || '—'}</Td>
                  <Td className="max-w-[32rem] whitespace-pre-wrap break-words">{v.message || '—'}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {v.timestamp ? formatAge(v.timestamp) : '—'}
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
