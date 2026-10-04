import { useEffect, useState } from 'react'
import { api, type PolicyReportDetail } from '@/lib/api'
import { findCRD, useCRDStore } from '@/store/crds'
import { CLUSTERPOLICYREPORT_RESOURCE, POLICY_REPORT_GROUP, POLICYREPORT_RESOURCE } from './kyvernoKinds'

// useResourcePolicyReport fetches the policy report Kyverno keeps for one
// resource, or null when there is none. It asks only when the context serves
// the report CRD, so resource details on clusters without Kyverno make no
// extra call. The lookup is a single GET by the resource's UID.
export function useResourcePolicyReport(
  contextName: string | null,
  kind: string,
  namespace: string,
  name: string,
): PolicyReportDetail | null {
  const served = useCRDStore((s) =>
    contextName
      ? findCRD(
          s.byContext,
          contextName,
          POLICY_REPORT_GROUP,
          namespace ? POLICYREPORT_RESOURCE : CLUSTERPOLICYREPORT_RESOURCE,
        ) !== null
      : false,
  )
  const [state, setState] = useState<{ key: string; report: PolicyReportDetail | null }>({ key: '', report: null })
  const key = `${contextName}\u0000${kind}\u0000${namespace}\u0000${name}`

  useEffect(() => {
    if (!contextName || !served) return
    let cancelled = false
    api
      .policyReportForResource(contextName, kind, namespace, name)
      .then((report) => {
        if (!cancelled) setState({ key, report: report ?? null })
      })
      // A failed lookup only means no Policy tab; the rest of the detail works.
      .catch(() => {
        if (!cancelled) setState({ key, report: null })
      })
    return () => {
      cancelled = true
    }
  }, [contextName, served, kind, namespace, name, key])

  return served && state.key === key ? state.report : null
}
