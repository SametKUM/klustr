import { useCallback } from 'react'
import { api, type PolicyRuleDetail, type RoleDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function RoleDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getRole(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<RoleDetail>(contextName, 'Role', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Metadata">
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
        <Field label="Rules">{detail.rules.length}</Field>
      </Section>
      {detail.rules.length > 0 && <RulesTable rules={detail.rules} />}
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}

export function RulesTable({ rules }: { rules: PolicyRuleDetail[] }) {
  return (
    <Section title="Rules">
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>API Groups</Th>
              <Th>Resources</Th>
              <Th>Resource Names</Th>
              <Th>Non-Resource URLs</Th>
              <Th>Verbs</Th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={i} className="border-t border-border align-top">
                <Td className="font-mono">{joinOrDash(r.apiGroups, '*')}</Td>
                <Td className="font-mono">{joinOrDash(r.resources)}</Td>
                <Td className="font-mono">{joinOrDash(r.resourceNames)}</Td>
                <Td className="font-mono">{joinOrDash(r.nonResourceURLs)}</Td>
                <Td className="font-mono">{joinOrDash(r.verbs)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function joinOrDash(list: string[] | null | undefined, emptyAs: string = '—'): string {
  if (!list || list.length === 0) return emptyAs
  return list.map((v) => (v === '' ? '""' : v)).join(', ')
}
