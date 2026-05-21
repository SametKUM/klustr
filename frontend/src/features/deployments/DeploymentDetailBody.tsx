import { useCallback } from 'react'
import { api, type DeploymentDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { ContainersTable } from '@/features/_shared/containerSummary'
import { RelatedPods } from '@/features/_shared/RelatedPods'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function DeploymentDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getDeployment(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<DeploymentDetail>(contextName, 'Deployment', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Status">
          <Field label="Strategy">{detail.strategy}</Field>
          <Field label="Rollout">
            {detail.paused ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  paused
                </span>
                <span className="text-xs text-muted-foreground">
                  template changes are queued until resumed
                </span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">active</span>
            )}
          </Field>
          <Field label="Replicas">{`${detail.ready}/${detail.replicas} ready · ${detail.updated} updated · ${detail.available} available · ${detail.unavailable} unavailable`}</Field>
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>
        <MaybeSection title="Selector" items={detail.selector} render={() => <Chips items={detail.selector} />} />
      </div>
      <ContainersTable title="Containers" containers={detail.containers} />
      {detail.conditions.length > 0 && (
        <Section title="Conditions">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {detail.conditions.map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td>{c.type}</Td>
                    <Td className={c.status === 'True' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>{c.status}</Td>
                    <Td>{c.reason || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <RelatedPods contextName={contextName} kind="Deployment" namespace={namespace} name={name} />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
