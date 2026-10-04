import { useCallback, useMemo } from 'react'
import { createColumnHelper, type SortingState } from '@tanstack/react-table'
import { api, type PolicyReportInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { policyResultClass } from './kyvernoFormat'
import { CLUSTERPOLICYREPORT_RESOURCE, POLICY_REPORT_GROUP, POLICYREPORT_RESOURCE } from './kyvernoKinds'

const columnHelper = createColumnHelper<PolicyReportInfo>()
const MOST_FAILURES_FIRST: SortingState = [{ id: 'fail', desc: true }]

function CountCell({ value, result }: { value: number; result: string }) {
  if (!value) return <span className="text-muted-foreground">0</span>
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${policyResultClass(result)}`}>{value}</span>
}

// PolicyReports and ClusterPolicyReports share the row shape. Kyverno writes
// one report per resource, so the subject column names the resource.
export function PolicyReportsView({ cluster }: { cluster: boolean }) {
  const columns = useMemo(
    () => [
      ...(cluster ? [] : [columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD })]),
      columnHelper.accessor((row) => (row.scopeKind ? `${row.scopeKind}/${row.scopeName}` : row.name), {
        id: 'subject',
        header: 'Resource',
        cell: (i) => <span className="font-mono text-xs">{i.getValue()}</span>,
      }),
      ...(['fail', 'error', 'warn', 'skip', 'pass'] as const).map((result) =>
        columnHelper.accessor(result, {
          header: result[0].toUpperCase() + result.slice(1),
          size: COL_XS,
          cell: (i) => <CountCell value={i.getValue()} result={result} />,
        }),
      ),
      columnHelper.accessor('source', {
        header: 'Source',
        size: COL_MD,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (i) => formatAge(i.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [cluster],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) => (cluster ? api.listClusterPolicyReports(ctx) : api.listPolicyReports(ctx, ns)),
    [cluster],
  )

  return (
    <CustomResourceTable
      group={POLICY_REPORT_GROUP}
      resource={cluster ? CLUSTERPOLICYREPORT_RESOURCE : POLICYREPORT_RESOURCE}
      kind={cluster ? 'ClusterPolicyReport' : 'PolicyReport'}
      noun={
        cluster
          ? { singular: 'cluster policy report', plural: 'cluster policy reports' }
          : { singular: 'policy report', plural: 'policy reports' }
      }
      scope={cluster ? 'cluster' : 'namespaced'}
      fetch={fetch}
      columns={columns}
      defaultSort={MOST_FAILURES_FIRST}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Policy reports are not available in the active contexts."
    />
  )
}
