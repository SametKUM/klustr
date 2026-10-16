import { useCallback } from 'react'
import { api, type IstioDestinationRuleDetail, type OwnerRef } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { OwnerLink } from '@/features/_shared/OwnerLink'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { WorkloadLinks } from './IstioDetailBodies'
import { useIstioRelationsReload } from './useIstioRelationsReload'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function IstioDestinationRuleDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getIstioDestinationRule(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error, reload } = useResourceDetail<IstioDestinationRuleDetail>(contextName, 'IstioDestinationRule', namespace, name, load)
  useIstioRelationsReload(contextName, ['Service', 'Pod'], reload)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="DestinationRule">
        <Field label="Host">
          {detail.host ? <Copyable className="font-mono text-xs" value={detail.host} /> : '—'}
        </Field>
        <Field label="Service" mono>
          {detail.service.name ? (
            <OwnerLink
              owner={{ kind: 'Service', name: detail.service.name } as OwnerRef}
              namespace={detail.service.namespace}
              context={contextName}
            />
          ) : (
            <span className="text-muted-foreground">not a Service of this cluster</span>
          )}
        </Field>
        <Field label="TLS mode">{detail.tlsMode || '—'}</Field>
        <Field label="Load balancer">{detail.loadBalancer || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.subsetDetails && detail.subsetDetails.length > 0 && (
        <Section title={`Subsets (${detail.subsetDetails.length})`}>
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Name</Th>
                  <Th>Labels</Th>
                  {detail.service.name && <Th>Pods</Th>}
                </tr>
              </thead>
              <tbody>
                {detail.subsetDetails.map((s) => (
                  <tr key={s.name} className="border-t border-border align-top">
                    <Td className="font-mono">{s.name}</Td>
                    <Td>
                      {s.labels && Object.keys(s.labels).length > 0 ? (
                        <Chips items={s.labels} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    {detail.service.name && (
                      <Td>
                        <WorkloadLinks
                          contextName={contextName}
                          workloads={s.workloads}
                          empty="No pod of the Service carries these labels."
                        />
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}
