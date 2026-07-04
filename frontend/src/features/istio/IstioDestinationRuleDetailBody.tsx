import { useCallback } from 'react'
import { api, type IstioDestinationRuleDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

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
  const { detail, error } = useResourceDetail<IstioDestinationRuleDetail>(contextName, 'IstioDestinationRule', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="DestinationRule">
        <Field label="Host">
          {detail.host ? <Copyable className="font-mono text-xs" value={detail.host} /> : '—'}
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
