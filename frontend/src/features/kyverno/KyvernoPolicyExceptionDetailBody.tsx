import { useCallback } from 'react'
import { api, type KyvernoPolicyExceptionDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { FilterClauses } from './KyvernoPolicyDetailBody'
import { useOpenKyvernoResource } from './useOpenKyvernoResource'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function KyvernoPolicyExceptionDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getKyvernoPolicyException(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<KyvernoPolicyExceptionDetail>(
    contextName,
    'PolicyException',
    namespace,
    name,
    load,
  )
  const { canOpenKyverno, openKyverno } = useOpenKyvernoResource(contextName)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="PolicyException">
        <Field label="Applies to">
          <FilterClauses mode={detail.matchMode} clauses={detail.match} />
        </Field>
        {detail.exclude.length > 0 && (
          <Field label="Except">
            <FilterClauses mode={detail.excludeMode} clauses={detail.exclude} />
          </Field>
        )}
        {detail.conditions && <Field label="Conditions">yes</Field>}
        <Field label="Background scans">{detail.background ? 'yes' : 'no'}</Field>
        {detail.podSecurity.length > 0 && (
          <Field label="Pod security controls">{detail.podSecurity.join(', ')}</Field>
        )}
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <Section title={`Exempted rules (${detail.targets.length})`}>
        <div className="overflow-hidden rounded border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <Th>Policy</Th>
                <Th>Rules</Th>
              </tr>
            </thead>
            <tbody>
              {detail.targets.map((t, i) => {
                // A policyName with a slash points at a namespaced Policy.
                const slash = t.policyName.indexOf('/')
                const kind = slash > 0 ? 'Policy' : 'ClusterPolicy'
                const policyNamespace = slash > 0 ? t.policyName.slice(0, slash) : ''
                const policyName = slash > 0 ? t.policyName.slice(slash + 1) : t.policyName
                return (
                  <tr key={`${t.policyName}-${i}`} className="border-t border-border align-top">
                    <Td className="font-mono">
                      {canOpenKyverno(kind) ? (
                        <button
                          type="button"
                          onClick={() => openKyverno(kind, policyNamespace, policyName)}
                          className="rounded text-left text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {t.policyName}
                        </button>
                      ) : (
                        t.policyName
                      )}
                    </Td>
                    <Td className="font-mono">{t.ruleNames.join(', ') || 'all rules'}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
