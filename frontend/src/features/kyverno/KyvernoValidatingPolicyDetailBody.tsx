import { useCallback } from 'react'
import { api, type KyvernoCELExpression, type KyvernoValidatingPolicyDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { failureActionClass } from './kyvernoFormat'

type Props = {
  contextName: string | null
  namespace: string
  name: string
  namespaced: boolean
}

export function KyvernoValidatingPolicyDetailBody({ contextName, namespace, name, namespaced }: Props) {
  const load = useCallback(
    (ctx: string) =>
      namespaced
        ? api.getKyvernoNamespacedValidatingPolicy(ctx, namespace, name)
        : api.getKyvernoValidatingPolicy(ctx, name),
    [namespaced, namespace, name],
  )
  const { detail, error } = useResourceDetail<KyvernoValidatingPolicyDetail>(
    contextName,
    namespaced ? 'NamespacedValidatingPolicy' : 'ValidatingPolicy',
    namespace,
    name,
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={namespaced ? 'NamespacedValidatingPolicy' : 'ValidatingPolicy'}>
          <Field label="Actions">
            {detail.actions.length ? (
              <span className="space-x-2">
                {detail.actions.map((a) => (
                  <span key={a} className={failureActionClass(a)}>
                    {a}
                  </span>
                ))}
              </span>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Failure policy">{detail.failurePolicy || 'Fail'}</Field>
          {detail.mode && <Field label="Mode">{detail.mode}</Field>}
          <Field label="Admission">{detail.admission ? 'yes' : 'no'}</Field>
          <Field label="Background scans">{detail.background ? 'yes' : 'no'}</Field>
          <Field label="Ready">
            <ConditionPill status={detail.ready} />
          </Field>
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>
        <Section title="Matches">
          <Field label="Resources">
            {detail.resources.length ? (
              <div className="font-mono text-xs">
                {detail.resources.map((r) => (
                  <div key={r}>{r}</div>
                ))}
              </div>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Namespace selector" mono>
            {detail.namespaceSelector || '—'}
          </Field>
          <Field label="Object selector" mono>
            {detail.objectSelector || '—'}
          </Field>
        </Section>
      </div>

      <Section title={`Validations (${detail.validationRules.length})`}>
        {detail.validationRules.length === 0 ? (
          <div className="text-xs text-muted-foreground">This policy declares no validations.</div>
        ) : (
          <div className="space-y-3">
            {detail.validationRules.map((v, i) => (
              <div key={i} className="rounded border border-border">
                <pre className="overflow-x-auto border-b border-border bg-muted/40 px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all">
                  {v.expression}
                </pre>
                <div className="space-y-1 px-3 py-2 text-xs">
                  <div>{v.message || <span className="text-muted-foreground">No message</span>}</div>
                  {v.messageExpression && (
                    <div className="font-mono text-muted-foreground">message: {v.messageExpression}</div>
                  )}
                  {v.reason && <div className="text-muted-foreground">reason: {v.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <ExpressionsTable title="Match conditions" rows={detail.matchConditions} nameHeader="Name" />
      <ExpressionsTable title="Variables" rows={detail.variables} nameHeader="Name" />
      <ExpressionsTable title="Audit annotations" rows={detail.auditAnnotations} nameHeader="Key" />

      {detail.conditions.length > 0 && (
        <Section title={`Conditions (${detail.conditions.length})`}>
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Reason</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {detail.conditions.map((c) => (
                  <tr key={c.type} className="border-t border-border align-top">
                    <Td className="font-mono">{c.type}</Td>
                    <Td>
                      <ConditionPill status={c.status} />
                    </Td>
                    <Td className="font-mono">{c.reason || '—'}</Td>
                    <Td className="whitespace-pre-wrap break-words">{c.message || '—'}</Td>
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

function ExpressionsTable({
  title,
  rows,
  nameHeader,
}: {
  title: string
  rows: KyvernoCELExpression[]
  nameHeader: string
}) {
  if (rows.length === 0) return null
  return (
    <Section title={`${title} (${rows.length})`}>
      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>{nameHeader}</Th>
              <Th>Expression</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}-${i}`} className="border-t border-border align-top">
                <Td className="whitespace-nowrap font-mono">{r.name || '—'}</Td>
                <Td className="font-mono break-all">{r.expression}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
