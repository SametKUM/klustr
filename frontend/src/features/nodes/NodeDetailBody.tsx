import { useCallback } from 'react'
import { api, type NodeDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { RelatedPods } from '@/features/_shared/RelatedPods'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function NodeDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getNode(ctx, name), [name])
  const { detail, error } = useResourceDetail<NodeDetail>(contextName, 'Node', '', name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Status">
          <Field label="Status">{detail.status}</Field>
          <Field label="Roles">{detail.roles}</Field>
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>
        <Section title="Network">
          <Field label="Internal IP" mono><Copyable value={detail.internalIP} /></Field>
          {detail.hostname && <Field label="Hostname"><Copyable value={detail.hostname} /></Field>}
        </Section>
      </div>
      <Section title="System">
        <Field label="Kubelet">{detail.version}</Field>
        <Field label="OS">{detail.osImage}</Field>
        <Field label="Kernel">{detail.kernelVersion}</Field>
        <Field label="Container runtime">{detail.containerRuntime}</Field>
        <Field label="Architecture">{detail.architecture}</Field>
      </Section>
      {Object.keys(detail.capacity ?? {}).length > 0 && (
        <Section title="Capacity / Allocatable">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Resource</Th>
                  <Th>Capacity</Th>
                  <Th>Allocatable</Th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(detail.capacity)
                  .sort()
                  .map((k) => (
                    <tr key={k} className="border-t border-border">
                      <Td>{k}</Td>
                      <Td className="font-mono">{detail.capacity[k]}</Td>
                      <Td className="font-mono">{detail.allocatable?.[k] ?? '—'}</Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {detail.taints.length > 0 && (
        <Section title="Taints">
          <div className="space-y-1">
            {detail.taints.map((t, i) => (
              <div key={i} className="font-mono text-xs">
                {t.key}
                {t.value ? `=${t.value}` : ''}:{t.effect}
              </div>
            ))}
          </div>
        </Section>
      )}
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
                    <Td
                      className={
                        c.type === 'Ready'
                          ? c.status === 'True'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-destructive'
                          : c.status === 'False'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {c.status}
                    </Td>
                    <Td>{c.reason || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <RelatedPods contextName={contextName} kind="Node" namespace="" name={detail.name} />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
