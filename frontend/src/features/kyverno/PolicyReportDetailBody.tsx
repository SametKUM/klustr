import { useCallback } from 'react'
import { api, type PolicyReportDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { PolicyResultsTable, ReportTally } from './PolicyResults'
import { useOpenKyvernoResource } from './useOpenKyvernoResource'

type Props = {
  contextName: string | null
  namespace: string
  name: string
  cluster: boolean
}

export function PolicyReportDetailBody({ contextName, namespace, name, cluster }: Props) {
  const load = useCallback(
    (ctx: string) => (cluster ? api.getClusterPolicyReport(ctx, name) : api.getPolicyReport(ctx, namespace, name)),
    [cluster, namespace, name],
  )
  const { detail, error } = useResourceDetail<PolicyReportDetail>(
    contextName,
    cluster ? 'ClusterPolicyReport' : 'PolicyReport',
    namespace,
    name,
    load,
  )
  const { canOpenKyverno, openKyverno, openTarget } = useOpenKyvernoResource(contextName)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title={cluster ? 'ClusterPolicyReport' : 'PolicyReport'}>
        <Field label="Resource">
          {detail.scopeKind ? (
            <button
              type="button"
              onClick={() =>
                openTarget({
                  apiVersion: detail.scopeApiVersion,
                  kind: detail.scopeKind,
                  namespace: detail.scopeNamespace,
                  name: detail.scopeName,
                })
              }
              className="rounded text-left font-mono text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {detail.scopeKind} {detail.scopeNamespace ? `${detail.scopeNamespace}/` : ''}
              {detail.scopeName}
            </button>
          ) : (
            <span className="text-muted-foreground">Not scoped to one resource</span>
          )}
        </Field>
        <Field label="Results">
          <ReportTally report={detail} />
        </Field>
        <Field label="Source">{detail.source || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      <Section title={`Results (${detail.results.length})`}>
        <PolicyResultsTable results={detail.results} canOpenPolicy={canOpenKyverno} onOpenPolicy={openKyverno} />
      </Section>
    </div>
  )
}
