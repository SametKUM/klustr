import { useCallback } from 'react'
import { api, type CSINodeDetail } from '@/lib/api'
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
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function CSINodeDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getCSINode(ctx, name), [name])
  const { detail, error } = useResourceDetail<CSINodeDetail>(contextName, 'CSINode', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="CSI node">
        <Field label="Node">{detail.name}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.drivers.length > 0 && (
        <Section title="Drivers">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Driver</Th>
                  <Th>Node ID</Th>
                  <Th>Topology keys</Th>
                  <Th>Max volumes</Th>
                </tr>
              </thead>
              <tbody>
                {detail.drivers.map((d) => (
                  <tr key={d.name} className="border-t border-border">
                    <Td className="font-mono">{d.name}</Td>
                    <Td className="font-mono break-all">{d.nodeID}</Td>
                    <Td className="font-mono">{d.topologyKeys.join(', ') || '—'}</Td>
                    <Td>{d.allocatableMax || '—'}</Td>
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
