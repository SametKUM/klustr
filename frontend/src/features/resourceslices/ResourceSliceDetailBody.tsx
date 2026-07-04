import { useCallback } from 'react'
import { api, type ResourceSliceDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import {
  Chips,
  ErrorBox,
  Field,
  MaybeSection,
  Section,
  Td,
  Th,
} from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function ResourceSliceDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getResourceSlice(ctx, name), [name])
  const { detail, error } = useResourceDetail<ResourceSliceDetail>(contextName, 'ResourceSlice', '', name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="ResourceSlice">
        <Field label="Driver" mono>
          <Copyable value={detail.driver} />
        </Field>
        <Field label="Pool" mono>
          <Copyable value={detail.poolName} />
        </Field>
        <Field label="Node">{detail.nodeName || (detail.allNodes ? 'all nodes' : '—')}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      {detail.devices.length > 0 && (
        <Section title="Devices">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Name</Th>
                  <Th>Attributes</Th>
                  <Th>Capacity</Th>
                  <Th>Binds</Th>
                  <Th>Taints</Th>
                </tr>
              </thead>
              <tbody>
                {detail.devices.map((d, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <Td className="font-mono"><Copyable value={d.name} /></Td>
                    <Td className="font-mono">{d.attributes.join(', ') || '—'}</Td>
                    <Td className="font-mono">{d.capacities.join(', ') || '—'}</Td>
                    <Td>{d.bindsToNode ? 'node-bound' : '—'}</Td>
                    <Td>{d.taints}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}
