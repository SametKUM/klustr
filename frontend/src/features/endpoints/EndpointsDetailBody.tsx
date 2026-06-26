import { useCallback } from 'react'
import { api, type EndpointsDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function EndpointsDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getEndpoints(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<EndpointsDetail>(contextName, 'Endpoints', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Subsets">{detail.subsets.length}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      {detail.subsets.map((s, i) => (
        <Section key={i} title={`Subset ${i + 1}`}>
          {s.ports.length > 0 && (
            <div className="mb-3 overflow-hidden rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr><Th>Port Name</Th><Th>Port</Th><Th>Protocol</Th></tr>
                </thead>
                <tbody>
                  {s.ports.map((p, j) => (
                    <tr key={j} className="border-t border-border">
                      <Td>{p.name || '—'}</Td>
                      <Td className="font-mono">{p.port}</Td>
                      <Td>{p.protocol}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {s.addresses.length > 0 && (
            <div className="overflow-hidden rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr><Th>IP</Th><Th>Hostname</Th><Th>Node</Th><Th>Ready</Th></tr>
                </thead>
                <tbody>
                  {s.addresses.map((a, j) => (
                    <tr key={j} className="border-t border-border">
                      <Td className="font-mono"><Copyable value={a.ip} /></Td>
                      <Td>{a.hostname ? <Copyable value={a.hostname} /> : '—'}</Td>
                      <Td>{a.nodeName || '—'}</Td>
                      <Td className={a.ready ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                        {a.ready ? '✓' : '·'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      ))}
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
