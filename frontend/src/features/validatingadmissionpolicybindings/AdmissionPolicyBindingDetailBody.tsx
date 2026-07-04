import type { AdmissionPolicyBindingDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import {
  Chips,
  ErrorBox,
  Field,
  MaybeSection,
  Section,
} from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

type Loader = (ctx: string) => Promise<AdmissionPolicyBindingDetail>

export function AdmissionPolicyBindingDetailBody({
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
  const { detail, error } = useResourceDetail<AdmissionPolicyBindingDetail>(contextName, kind, '', name, loader)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Binding">
        <Field label="Policy" mono>
          {detail.policyName}
        </Field>
        <Field label="Param ref" mono>
          {detail.paramRef || '—'}
        </Field>
        {detail.validationActions.length > 0 && (
          <Field label="Validation actions">{detail.validationActions.join(', ')}</Field>
        )}
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.matchResources.length > 0 && (
        <Section title="Match resources">
          <ul className="space-y-0.5 font-mono text-xs">
            {detail.matchResources.map((m, i) => (
              <li key={i}>{m}</li>
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
