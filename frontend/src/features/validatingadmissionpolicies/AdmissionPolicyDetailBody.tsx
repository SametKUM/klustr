import type { AdmissionPolicyDetail } from '@/lib/api'
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

type Loader = (ctx: string) => Promise<AdmissionPolicyDetail>

export function AdmissionPolicyDetailBody({
  contextName,
  kind,
  name,
  loader,
}: {
  contextName: string | null
  kind: string
  name: string
  loader: Loader
}) {
  const { detail, error } = useResourceDetail<AdmissionPolicyDetail>(contextName, kind, '', name, loader)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Policy">
        <Field label="Failure policy">{detail.failPolicy || '—'}</Field>
        <Field label="Param kind" mono>
          {detail.paramKind || '—'}
        </Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.matchResources.length > 0 && (
        <Section title="Match constraints">
          <ul className="space-y-0.5 font-mono text-xs">
            {detail.matchResources.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Section>
      )}

      {detail.validations.length > 0 && (
        <Section title="Validations">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Expression</Th>
                  <Th>Reason</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {detail.validations.map((v, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <Td className="font-mono">{v.expression}</Td>
                    <Td>{v.reason || '—'}</Td>
                    <Td>{v.message || v.messageExpression || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {detail.mutations.length > 0 && (
        <Section title="Mutations">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Patch type</Th>
                  <Th>Description</Th>
                </tr>
              </thead>
              <tbody>
                {detail.mutations.map((m, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <Td>{m.patchType}</Td>
                    <Td className="font-mono">{m.description}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {detail.matchConditions.length > 0 && (
        <Section title="Match conditions">
          <ul className="space-y-1 font-mono text-xs">
            {detail.matchConditions.map((c, i) => (
              <li key={i}>
                <span className="text-muted-foreground">{c.name}: </span>
                {c.expression}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {detail.variables.length > 0 && (
        <Section title="Variables">
          <ul className="space-y-1 font-mono text-xs">
            {detail.variables.map((v, i) => (
              <li key={i}>
                <span className="text-muted-foreground">{v.name}: </span>
                {v.expression}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {detail.auditAnnotations.length > 0 && (
        <Section title="Audit annotations">
          <ul className="space-y-1 font-mono text-xs">
            {detail.auditAnnotations.map((a, i) => (
              <li key={i}>
                <span className="text-muted-foreground">{a.key}: </span>
                {a.valueExpression}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <MaybeSection
        title="Labels"
        items={detail.labels}
        render={() => <Chips items={detail.labels} />}
      />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}
