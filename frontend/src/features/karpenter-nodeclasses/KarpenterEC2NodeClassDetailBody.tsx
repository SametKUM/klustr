import { useCallback } from 'react'
import { api, type KarpenterResolvedResource } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section, Th, Td } from '@/features/_shared/DetailPrimitives'
import { ConditionsSection } from '@/features/_shared/ConditionsTable'
import { ReadyPill } from '@/features/_shared/ReadyPill'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function KarpenterEC2NodeClassDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((context: string) => api.getKarpenterEC2NodeClass(context, name), [name])
  const { detail, error } = useResourceDetail(contextName, 'EC2NodeClass', '', name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="EC2 node class">
        <Field label="Ready">
          <ReadyPill status={detail.ready} />
        </Field>
        <Field label="Status message">{detail.status || '—'}</Field>
        <Field label="AMI family">{detail.amiFamily || '—'}</Field>
        <Field label="Role" mono>
          {detail.role || '—'}
        </Field>
        <Field label="Instance profile" mono>
          {detail.instanceProfile || '—'}
        </Field>
        <Field label="Resolved profile" mono>
          {detail.resolvedInstanceProfile || '—'}
        </Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      <ResolvedResources
        title="Subnets"
        resources={detail.subnets}
        selectors={detail.subnetSelectors}
      />
      <ResolvedResources
        title="Security groups"
        resources={detail.securityGroups}
        selectors={detail.securityGroupSelectors}
      />
      <ResolvedResources
        title="AMIs"
        resources={detail.amis}
        selectors={detail.amiSelectors}
        showRequirements
      />
      <ConditionsSection conditions={detail.conditions} />
    </div>
  )
}

function ResolvedResources({
  title,
  resources,
  selectors,
  showRequirements = false,
}: {
  title: string
  resources: KarpenterResolvedResource[]
  selectors: string[]
  showRequirements?: boolean
}) {
  return (
    <Section title={`${title} (${new Set(resources.map((resource) => resource.id)).size})`}>
      <Field label="Selector terms" mono>
        {selectors.length ? (
          <ul className="space-y-1">
            {selectors.map((selector, index) => (
              <li key={index}>{selector}</li>
            ))}
          </ul>
        ) : (
          '—'
        )}
      </Field>
      {resources.length ? (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>{showRequirements ? 'Requirements' : 'Zone'}</Th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource, index) => (
                // Karpenter can report one AMI under multiple requirement sets.
                <tr key={`${resource.id}:${index}`} className="border-t border-border">
                  <Td className="font-mono">{resource.id}</Td>
                  <Td>{resource.name || '—'}</Td>
                  <Td>
                    {showRequirements ? (
                      resource.requirements.length ? (
                        <ul className="space-y-1 font-mono">
                          {resource.requirements.map((requirement, requirementIndex) => (
                            <li key={`${requirement.key}:${requirementIndex}`}>
                              {requirement.key} {requirement.operator}
                              {requirement.values.length
                                ? ` [${requirement.values.join(', ')}]`
                                : ''}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '—'
                      )
                    ) : (
                      resource.zone || '—'
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No resources resolved yet.</div>
      )}
    </Section>
  )
}
