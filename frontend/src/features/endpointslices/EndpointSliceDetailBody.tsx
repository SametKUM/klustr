import { useCallback } from 'react'
import { api, type EndpointSliceDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function EndpointSliceDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getEndpointSlice(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<EndpointSliceDetail>(contextName, 'EndpointSlice', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Address Type">{detail.addressType}</Field>
        <Field label="Service">{detail.service ? <Copyable value={detail.service} /> : '—'}</Field>
        <Field label="Endpoints">{detail.endpoints.length}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      {detail.ports.length > 0 && (
        <Section title="Ports">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr><Th>Name</Th><Th>Port</Th><Th>Protocol</Th></tr>
              </thead>
              <tbody>
                {detail.ports.map((p, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td>{p.name || '—'}</Td>
                    <Td className="font-mono">{p.port}</Td>
                    <Td>{p.protocol}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {detail.endpoints.length > 0 && (
        <Section title="Endpoints">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr><Th>Addresses</Th><Th>Node</Th><Th>Hostname</Th><Th>Ready</Th></tr>
              </thead>
              <tbody>
                {detail.endpoints.map((e, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <Td className="font-mono"><Copyable value={e.addresses.join(',')}>{e.addresses.join(', ')}</Copyable></Td>
                    <Td>{e.nodeName || '—'}</Td>
                    <Td>{e.hostname || '—'}</Td>
                    <Td className={e.ready ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                      {e.ready ? '✓' : '·'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
