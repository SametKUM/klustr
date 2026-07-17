import { useCallback } from 'react'
import { api, type IstioPeerAuthenticationDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function IstioPeerAuthenticationDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getIstioPeerAuthentication(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<IstioPeerAuthenticationDetail>(contextName, 'IstioPeerAuthentication', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  const hasSelector = detail.selectorLabels && Object.keys(detail.selectorLabels).length > 0

  return (
    <div className="space-y-6">
      <Section title="PeerAuthentication">
        <Field label="mTLS mode">{detail.mtlsMode}</Field>
        <Field label="Selector">
          {hasSelector ? (
            <Chips items={detail.selectorLabels} />
          ) : (
            <span className="text-muted-foreground">namespace-wide</span>
          )}
        </Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.portLevel && detail.portLevel.length > 0 && (
        <Section title={`Port-level mTLS (${detail.portLevel.length})`}>
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Port</Th>
                  <Th>Mode</Th>
                </tr>
              </thead>
              <tbody>
                {detail.portLevel.map((p) => (
                  <tr key={p.port} className="border-t border-border">
                    <Td className="font-mono">{p.port}</Td>
                    <Td>{p.mode}</Td>
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
