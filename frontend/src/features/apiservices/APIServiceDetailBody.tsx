import { useCallback } from 'react'
import { api, type APIServiceDetail } from '@/lib/api'
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

export function APIServiceDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getAPIService(ctx, name), [name])
  const { detail, error } = useResourceDetail<APIServiceDetail>(contextName, 'APIService', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="APIService">
        <Field label="Group" mono>
          {detail.group || '—'}
        </Field>
        <Field label="Version" mono>
          {detail.version}
        </Field>
        <Field label="Backend" mono>
          {detail.service}
        </Field>
        <Field label="Group priority">{detail.groupPriorityMinimum}</Field>
        <Field label="Version priority">{detail.versionPriority}</Field>
        <Field label="CA bundle">{detail.hasCABundle ? 'present' : 'absent'}</Field>
        <Field label="Insecure TLS">{detail.insecureSkipTLSVerify ? 'yes' : 'no'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

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
