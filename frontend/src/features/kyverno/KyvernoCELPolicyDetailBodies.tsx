import { useCallback, type ReactNode } from 'react'
import {
  api,
  type ConditionDetail,
  type KyvernoCELExpression,
} from '@/lib/api'
import { formatAge, formatTimestamp } from '@/lib/time'
import { ConditionsSection } from '@/features/_shared/ConditionsTable'
import { ReadyPill } from '@/features/_shared/ReadyPill'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import type { IntegrationDetailProps } from '@/features/integrationDetails'
import { CodeBlock, ExpressionsTable, MatchesSection, ValidationRules } from './KyvernoCELShared'
import { failureActionClass, generatedOnPolicyDelete } from './kyvernoFormat'

type Props = IntegrationDetailProps & { namespaced: boolean }

const yesNo = (v: boolean) => (v ? 'yes' : 'no')

// CELPolicyLayout is the frame every CEL policy body shares: the kind's own
// fields beside what it matches, its body, then match conditions, variables
// and the controller's conditions.
function CELPolicyLayout({
  title,
  fields,
  matches,
  children,
  matchConditions,
  variables,
  conditions,
}: {
  title: string
  fields: ReactNode
  matches: ReactNode
  children: ReactNode
  matchConditions: KyvernoCELExpression[]
  variables: KyvernoCELExpression[]
  conditions: ConditionDetail[]
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={title}>{fields}</Section>
        {matches}
      </div>
      {children}
      <ExpressionsTable title="Match conditions" rows={matchConditions} nameHeader="Name" />
      <ExpressionsTable title="Variables" rows={variables} nameHeader="Name" />
      <ConditionsSection conditions={conditions} hideWhenEmpty />
    </div>
  )
}

function Common({ ready, createdAt }: { ready: string; createdAt: string }) {
  return (
    <>
      <Field label="Ready">
        <ReadyPill status={ready} />
      </Field>
      <Field label="Age">{formatAge(createdAt)}</Field>
    </>
  )
}

export function KyvernoMutatingPolicyDetailBody({ contextName, namespace, name, namespaced }: Props) {
  const load = useCallback(
    (ctx: string) =>
      namespaced ? api.getKyvernoNamespacedMutatingPolicy(ctx, namespace, name) : api.getKyvernoMutatingPolicy(ctx, name),
    [namespaced, namespace, name],
  )
  const kind = namespaced ? 'NamespacedMutatingPolicy' : 'MutatingPolicy'
  const { detail: d, error } = useResourceDetail(contextName, kind, namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <CELPolicyLayout
      title={kind}
      fields={
        <>
          <Field label="Failure policy">{d.failurePolicy || 'Fail'}</Field>
          <Field label="Admission">{yesNo(d.admission)}</Field>
          <Field label="Mutate existing">{yesNo(d.mutateExisting)}</Field>
          {d.reinvocationPolicy && <Field label="Reinvocation">{d.reinvocationPolicy}</Field>}
          <Common ready={d.ready} createdAt={d.createdAt} />
        </>
      }
      matches={<MatchesSection resources={d.resources} namespaceSelector={d.namespaceSelector} objectSelector={d.objectSelector} />}
      matchConditions={d.matchConditions}
      variables={d.variables}
      conditions={d.conditions}
    >
      <Section title={`Mutations (${d.mutationList.length})`}>
        {d.mutationList.length === 0 ? (
          <div className="text-xs text-muted-foreground">This policy declares no mutations.</div>
        ) : (
          <div className="space-y-3">
            {d.mutationList.map((m, i) => (
              <div key={i} className="rounded border border-border">
                <div className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground">{m.patchType || 'ApplyConfiguration'}</div>
                <CodeBlock>{m.expression}</CodeBlock>
              </div>
            ))}
          </div>
        )}
      </Section>
      {d.mutateExisting && (
        <Section title="Existing objects">
          <Field label="Targets">
            {d.targetResources.length || d.targetExpression ? (
              <div className="space-y-1 font-mono text-xs">
                {d.targetResources.map((r) => (
                  <div key={r}>{r}</div>
                ))}
                {d.targetExpression && <div className="whitespace-pre-wrap break-all">{d.targetExpression}</div>}
              </div>
            ) : (
              'the matched resources'
            )}
          </Field>
          {d.targetMatchConditions.length > 0 && (
            <Field label="Target conditions" mono>
              {d.targetMatchConditions.map((c) => (
                <div key={c.name}>
                  {c.name}: {c.expression}
                </div>
              ))}
            </Field>
          )}
        </Section>
      )}
    </CELPolicyLayout>
  )
}

export function KyvernoGeneratingPolicyDetailBody({ contextName, namespace, name, namespaced }: Props) {
  const load = useCallback(
    (ctx: string) =>
      namespaced ? api.getKyvernoNamespacedGeneratingPolicy(ctx, namespace, name) : api.getKyvernoGeneratingPolicy(ctx, name),
    [namespaced, namespace, name],
  )
  const kind = namespaced ? 'NamespacedGeneratingPolicy' : 'GeneratingPolicy'
  const { detail: d, error } = useResourceDetail(contextName, kind, namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <CELPolicyLayout
      title={kind}
      fields={
        <>
          <Field label="Synchronize">{yesNo(d.synchronize)}</Field>
          <Field label="Generate existing">{yesNo(d.generateExisting)}</Field>
          <Field label="On policy delete">{generatedOnPolicyDelete(d.synchronize, d.orphanOnDelete)}</Field>
          <Common ready={d.ready} createdAt={d.createdAt} />
        </>
      }
      matches={
        <MatchesSection
          title="Triggers"
          resources={d.resources}
          namespaceSelector={d.namespaceSelector}
          objectSelector={d.objectSelector}
        />
      }
      matchConditions={d.matchConditions}
      variables={d.variables}
      conditions={d.conditions}
    >
      <Section title={`Generates (${d.generationList.length})`}>
        {d.generationList.length === 0 ? (
          <div className="text-xs text-muted-foreground">This policy declares nothing to generate.</div>
        ) : (
          <div className="space-y-3">
            {d.generationList.map((g, i) => (
              <div key={i} className="rounded border border-border">
                <div className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
                  {g.expression ? 'Expression' : `Template${g.interpolate ? ` (${g.interpolate})` : ''}`}
                </div>
                <CodeBlock>{g.expression || g.template}</CodeBlock>
              </div>
            ))}
          </div>
        )}
      </Section>
    </CELPolicyLayout>
  )
}

export function KyvernoDeletingPolicyDetailBody({ contextName, namespace, name, namespaced }: Props) {
  const load = useCallback(
    (ctx: string) =>
      namespaced ? api.getKyvernoNamespacedDeletingPolicy(ctx, namespace, name) : api.getKyvernoDeletingPolicy(ctx, name),
    [namespaced, namespace, name],
  )
  const kind = namespaced ? 'NamespacedDeletingPolicy' : 'DeletingPolicy'
  const { detail: d, error } = useResourceDetail(contextName, kind, namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <CELPolicyLayout
      title={kind}
      fields={
        <>
          <Field label="Schedule" mono>
            {d.schedule || '—'}
          </Field>
          <Field label="Last run">
            {d.lastExecution ? <span title={d.lastExecution}>{formatTimestamp(d.lastExecution)}</span> : 'not yet'}
          </Field>
          <Field label="Next run">
            {d.nextExecution ? <span title={d.nextExecution}>{formatTimestamp(d.nextExecution)}</span> : '—'}
          </Field>
          <Field label="Propagation">{d.propagation || 'Background'}</Field>
          <Common ready={d.ready} createdAt={d.createdAt} />
        </>
      }
      matches={<MatchesSection resources={d.resources} namespaceSelector={d.namespaceSelector} objectSelector={d.objectSelector} />}
      matchConditions={d.matchConditions}
      variables={d.variables}
      conditions={d.conditions}
    >
      <ExpressionsTable title="Deletes when" rows={d.deleteConditions} nameHeader="Name" />
      {d.deleteConditions.length === 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          No conditions: every matched object is deleted on each run.
        </p>
      )}
    </CELPolicyLayout>
  )
}

export function KyvernoImageValidatingPolicyDetailBody({ contextName, namespace, name, namespaced }: Props) {
  const load = useCallback(
    (ctx: string) =>
      namespaced
        ? api.getKyvernoNamespacedImageValidatingPolicy(ctx, namespace, name)
        : api.getKyvernoImageValidatingPolicy(ctx, name),
    [namespaced, namespace, name],
  )
  const kind = namespaced ? 'NamespacedImageValidatingPolicy' : 'ImageValidatingPolicy'
  const { detail: d, error } = useResourceDetail(contextName, kind, namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <CELPolicyLayout
      title={kind}
      fields={
        <>
          <Field label="Actions">
            {d.actions.length ? (
              <span className="space-x-2">
                {d.actions.map((a) => (
                  <span key={a} className={failureActionClass(a)}>
                    {a}
                  </span>
                ))}
              </span>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Failure policy">{d.failurePolicy || 'Fail'}</Field>
          <Field label="Admission">{yesNo(d.admission)}</Field>
          <Field label="Background scans">{yesNo(d.background)}</Field>
          <Field label="Digest">
            {[d.verifyDigest ? 'verified' : 'not verified', d.mutateDigest ? 'tags replaced with digests' : 'tags kept'].join(', ')}
          </Field>
          <Field label="Signature required">{yesNo(d.required)}</Field>
          <Common ready={d.ready} createdAt={d.createdAt} />
        </>
      }
      matches={
        <Section title="Matches">
          <Field label="Images" mono>
            {d.images.length ? d.images.map((i) => <div key={i}>{i}</div>) : 'all'}
          </Field>
          <Field label="Resources" mono>
            {d.resources.length ? d.resources.map((r) => <div key={r}>{r}</div>) : '—'}
          </Field>
          {(d.credentialProviders.length > 0 || d.credentialSecrets.length > 0) && (
            <Field label="Registry credentials">
              {[...d.credentialProviders, ...d.credentialSecrets.map((s) => `Secret ${s}`)].join(', ')}
              {d.allowInsecure && ', insecure registries allowed'}
            </Field>
          )}
        </Section>
      }
      matchConditions={d.matchConditions}
      variables={d.variables}
      conditions={d.conditions}
    >
      <Section title={`Attestors (${d.attestorList.length})`}>
        {d.attestorList.length === 0 ? (
          <div className="text-xs text-muted-foreground">No attestors.</div>
        ) : (
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Trusts</Th>
                </tr>
              </thead>
              <tbody>
                {d.attestorList.map((a) => (
                  <tr key={a.name} className="border-t border-border align-top">
                    <Td className="font-mono">{a.name}</Td>
                    <Td>{a.type || '—'}</Td>
                    <Td className="break-all font-mono">
                      {a.details.length ? a.details.map((x, i) => <div key={i}>{x}</div>) : '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      {d.attestations.length > 0 && (
        <Section title={`Attestations (${d.attestations.length})`}>
          {d.attestations.map((a) => (
            <Field key={a.name} label={a.name}>
              {a.kind} <span className="font-mono text-xs">{a.type}</span>
            </Field>
          ))}
        </Section>
      )}
      <ValidationRules rules={d.validationRules} />
      <ExpressionsTable title="Image extractors" rows={d.imageExtractors} nameHeader="Name" />
    </CELPolicyLayout>
  )
}
