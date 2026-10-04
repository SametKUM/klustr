import { useCallback } from 'react'
import { api, type KyvernoPolicyDetail, type KyvernoRule } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { failureActionClass, ruleSummary } from './kyvernoFormat'

type Props = {
  contextName: string | null
  namespace: string
  name: string
  cluster: boolean
}

export function KyvernoPolicyDetailBody({ contextName, namespace, name, cluster }: Props) {
  const load = useCallback(
    (ctx: string) => (cluster ? api.getKyvernoClusterPolicy(ctx, name) : api.getKyvernoPolicy(ctx, namespace, name)),
    [cluster, namespace, name],
  )
  const { detail, error } = useResourceDetail<KyvernoPolicyDetail>(
    contextName,
    cluster ? 'ClusterPolicy' : 'Policy',
    namespace,
    name,
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={cluster ? 'ClusterPolicy' : 'Policy'}>
          {detail.title && <Field label="Title">{detail.title}</Field>}
          {detail.description && (
            <Field label="Description">
              <span className="whitespace-pre-wrap">{detail.description}</span>
            </Field>
          )}
          <Field label="Category">{detail.category || '—'}</Field>
          <Field label="Severity">{detail.severity || '—'}</Field>
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>
        <Section title="Status">
          <Field label="Ready">
            <span className="inline-flex items-center gap-2">
              <ConditionPill status={detail.ready} />
              {detail.message && detail.message !== 'Ready' && (
                <span className="text-xs text-muted-foreground">{detail.message}</span>
              )}
            </span>
          </Field>
          <Field label="Action">
            {detail.action ? <span className={failureActionClass(detail.action)}>{detail.action}</span> : '—'}
          </Field>
          <Field label="Rules">{ruleSummary(detail)}</Field>
          <Field label="Admission">{detail.admission ? 'yes' : 'no'}</Field>
          <Field label="Background scans">{detail.background ? 'yes' : 'no'}</Field>
          <Field label="Generated VAP">
            {detail.vapGenerated ? 'yes' : detail.vapMessage ? <span className="text-muted-foreground">{detail.vapMessage}</span> : 'no'}
          </Field>
        </Section>
      </div>

      <Section title={`Rules (${detail.rules.length})`}>
        <RulesTable rules={detail.rules} />
      </Section>

      {detail.autogenRules.length > 0 && (
        <Section title={`Autogen rules (${detail.autogenRules.length})`}>
          <div className="mb-2 text-xs text-muted-foreground">
            Kyverno applies the Pod rules to Pod controllers through these generated rules; reports and
            exceptions refer to them by name.
          </div>
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Rule</Th>
                  <Th>Kinds</Th>
                </tr>
              </thead>
              <tbody>
                {detail.autogenRules.map((r) => (
                  <tr key={r.name} className="border-t border-border align-top">
                    <Td className="font-mono">{r.name}</Td>
                    <Td>{r.kinds.join(', ') || '—'}</Td>
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

function RulesTable({ rules }: { rules: KyvernoRule[] }) {
  if (rules.length === 0) return <div className="text-xs text-muted-foreground">This policy has no rules.</div>
  return (
    <div className="overflow-hidden rounded border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <Th>Rule</Th>
            <Th>Type</Th>
            <Th>Action</Th>
            <Th>Match</Th>
            <Th>Exclude</Th>
            <Th>Message</Th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.name} className="border-t border-border align-top">
              <Td className="font-mono">{r.name}</Td>
              <Td className="whitespace-nowrap">
                {r.type || '—'}
                {r.subtype && <span className="text-muted-foreground"> ({r.subtype})</span>}
                {r.preconditions && <div className="text-muted-foreground">with preconditions</div>}
              </Td>
              <Td>
                {r.failureAction ? <span className={failureActionClass(r.failureAction)}>{r.failureAction}</span> : '—'}
              </Td>
              <Td>
                <FilterClauses mode={r.matchMode} clauses={r.match} />
              </Td>
              <Td>
                <FilterClauses mode={r.excludeMode} clauses={r.exclude} />
              </Td>
              <Td className="max-w-[24rem] whitespace-pre-wrap break-words">{r.message || '—'}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// FilterClauses renders a match or exclude filter: "any" clauses are
// alternatives, "all" clauses must hold together.
export function FilterClauses({ mode, clauses }: { mode: string; clauses: string[] }) {
  if (clauses.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <div className="space-y-0.5">
      {clauses.length > 1 && mode && <div className="text-muted-foreground">{mode} of:</div>}
      {clauses.map((c) => (
        <div key={c} className="font-mono">
          {c}
        </div>
      ))}
    </div>
  )
}
