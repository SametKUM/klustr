import { useCallback } from 'react'
import { api, type IngressDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function IngressDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getIngress(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<IngressDetail>(contextName, 'Ingress', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Ingress">
        <Field label="Class">{detail.class || '—'}</Field>
        <Field label="Addresses" mono>{detail.addresses.length > 0 ? <Copyable value={detail.addresses.join(',')}>{detail.addresses.join(', ')}</Copyable> : '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      {detail.rules.length > 0 && (
        <Section title="Rules">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Host</Th>
                  <Th>Path</Th>
                  <Th>Type</Th>
                  <Th>Backend</Th>
                </tr>
              </thead>
              <tbody>
                {detail.rules.flatMap((r, ri) =>
                  r.paths.length === 0
                    ? [
                        <tr key={`${ri}-h`} className="border-t border-border">
                          <Td className="font-mono">{r.host ? <Copyable value={r.host} /> : '*'}</Td>
                          <Td>—</Td>
                          <Td>—</Td>
                          <Td>—</Td>
                        </tr>,
                      ]
                    : r.paths.map((p, pi) => (
                        <tr key={`${ri}-${pi}`} className="border-t border-border">
                          <Td className="font-mono">{r.host ? <Copyable value={r.host} /> : '*'}</Td>
                          <Td className="font-mono">{p.path || '/'}</Td>
                          <Td>{p.pathType}</Td>
                          <Td className="font-mono"><Copyable value={`${p.serviceName}:${p.servicePort}`} /></Td>
                        </tr>
                      )),
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {detail.tls.length > 0 && (
        <Section title="TLS">
          <div className="space-y-1.5">
            {detail.tls.map((t, i) => (
              <Field key={i} label={t.secretName}>{t.hosts.join(', ') || '*'}</Field>
            ))}
          </div>
        </Section>
      )}
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
