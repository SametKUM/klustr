import { useCallback } from 'react'
import { api, type FlowSchemaDetail } from '@/lib/api'
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
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function FlowSchemaDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getFlowSchema(ctx, name), [name])
  const { detail, error } = useResourceDetail<FlowSchemaDetail>(contextName, 'FlowSchema', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="FlowSchema">
        <Field label="Priority level" mono>
          {detail.priorityLevel}
        </Field>
        <Field label="Matching precedence">{detail.matchingPrecedence}</Field>
        <Field label="Distinguisher">{detail.distinguisher || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.rules.length > 0 && (
        <Section title="Rules">
          <div className="space-y-3">
            {detail.rules.map((r, i) => (
              <div key={i} className="rounded border border-border p-2">
                {r.subjects.length > 0 && (
                  <div className="mb-1.5 text-xs">
                    <span className="text-muted-foreground">Subjects: </span>
                    <span className="font-mono">{r.subjects.join(', ')}</span>
                  </div>
                )}
                {r.resourceRules.length > 0 && (
                  <div className="text-xs">
                    <div className="text-muted-foreground">Resource rules:</div>
                    <ul className="ml-2 font-mono">
                      {r.resourceRules.map((rule, j) => (
                        <li key={j}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.nonResourceURLs.length > 0 && (
                  <div className="text-xs">
                    <div className="text-muted-foreground">Non-resource URLs:</div>
                    <ul className="ml-2 font-mono">
                      {r.nonResourceURLs.map((u, j) => (
                        <li key={j}>{u}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {detail.conditions.map((c, i) => (
                  <tr key={`${c.type}-${i}`} className="border-t border-border">
                    <Td className="font-mono">{c.type}</Td>
                    <Td>
                      <ConditionPill status={c.status} />
                    </Td>
                    <Td className="font-mono">{c.reason || '—'}</Td>
                    <Td>{c.message || '—'}</Td>
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
