import { useCallback } from 'react'
import { api, type KEDATrigger, type OwnerRef } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ConditionsSection } from '@/features/_shared/ConditionsTable'
import { CustomResourceReference } from '@/features/_shared/CustomResourceReference'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { OwnerLink } from '@/features/_shared/OwnerLink'
import { ReadyPill } from '@/features/_shared/ReadyPill'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { humanizeTrigger } from '@/features/hpas/triggers'
import type { IntegrationDetailProps } from '@/features/integrationDetails'
import { KEDAActivityPill, KEDAFallbackPill, KEDAPausedPill } from './KEDAPills'
import { kedaPauseLabel } from './kedaPause'
import {
  KEDA_CLUSTERTRIGGERAUTHENTICATION_RESOURCE,
  KEDA_GROUP,
  KEDA_SCALEDJOB_RESOURCE,
  KEDA_SCALEDOBJECT_RESOURCE,
  KEDA_TRIGGERAUTHENTICATION_RESOURCE,
} from './kedaKinds'

function seconds(n: number) {
  return `${n}s`
}

function link(kind: string, name: string, namespace: string, contextName: string | null) {
  return <OwnerLink owner={{ kind, name } as OwnerRef} namespace={namespace} context={contextName} />
}

export function KEDAScaledObjectDetailBody({ contextName, namespace, name }: IntegrationDetailProps) {
  const load = useCallback((ctx: string) => api.getKEDAScaledObject(ctx, namespace, name), [namespace, name])
  const { detail: d, error } = useResourceDetail(contextName, 'ScaledObject', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <div className="space-y-6">
      <Section title="Scaled object">
        <Field label="Ready">
          <ReadyPill status={d.ready} />
        </Field>
        <Field label="Status message">{d.status || '—'}</Field>
        <Field label="Active">
          <KEDAActivityPill status={d.active} />
        </Field>
        {d.fallback === 'True' && (
          <Field label="Fallback">
            <KEDAFallbackPill status={d.fallback} />
          </Field>
        )}
        {kedaPauseLabel(d) && (
          <Field label="Paused">
            <KEDAPausedPill state={d} />
          </Field>
        )}
        <Field label="Target">
          <span className="font-mono text-xs">
            {d.targetKind}/{link(d.targetKind, d.targetName, namespace, contextName)}
          </span>
        </Field>
        {d.envSourceContainer && (
          <Field label="Env source" mono>
            {d.envSourceContainer}
          </Field>
        )}
        <Field label="HPA" mono>
          {d.hpaName ? link('HorizontalPodAutoscaler', d.hpaName, namespace, contextName) : '—'}
        </Field>
        <Field label="Last active">{d.lastActiveTime ? formatAge(d.lastActiveTime) : '—'}</Field>
        <Field label="Age">{formatAge(d.createdAt)}</Field>
      </Section>
      <Section title="Scaling">
        <Field label="Replicas">
          <span className="tabular-nums">
            {d.minReplicas}–{d.maxReplicas}
            {d.idleReplicas !== '' && ` (idle ${d.idleReplicas})`}
          </span>
        </Field>
        <Field label="Polling interval">{seconds(d.pollingInterval)}</Field>
        <Field label="Cooldown period">{seconds(d.cooldownPeriod)}</Field>
        {d.initialCooldownPeriod > 0 && <Field label="Initial cooldown">{seconds(d.initialCooldownPeriod)}</Field>}
        {d.fallbackReplicas !== '' && (
          <Field label="Fallback">
            {d.fallbackReplicas} replicas after {d.fallbackFailureThreshold || '?'} failures
            {d.fallbackBehavior && ` (${d.fallbackBehavior})`}
          </Field>
        )}
        {d.scalingFormula && (
          <Field label="Formula" mono>
            {d.scalingFormula}
            {d.scalingTarget && ` → target ${d.scalingTarget}`}
          </Field>
        )}
        {d.restoreOriginalReplicas && (
          <Field label="On delete">
            Restores {d.originalReplicas !== '' ? `${d.originalReplicas} replicas` : 'the original replica count'}
          </Field>
        )}
      </Section>
      <KEDATriggersSection contextName={contextName} namespace={namespace} triggers={d.triggers} />
      {d.health.length > 0 && (
        <Section title="Trigger health">
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Metric</Th>
                  <Th>Status</Th>
                  <Th>Failures</Th>
                </tr>
              </thead>
              <tbody>
                {d.health.map((h) => (
                  <tr key={h.metric} className="border-t border-border">
                    <Td className="font-mono">{h.metric}</Td>
                    <Td className={h.status === 'Failing' ? 'text-destructive' : undefined}>{h.status || '—'}</Td>
                    <Td className="tabular-nums">{h.failures}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <ConditionsSection conditions={d.conditions} />
    </div>
  )
}

export function KEDAScaledJobDetailBody({ contextName, namespace, name }: IntegrationDetailProps) {
  const load = useCallback((ctx: string) => api.getKEDAScaledJob(ctx, namespace, name), [namespace, name])
  const { detail: d, error } = useResourceDetail(contextName, 'ScaledJob', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <div className="space-y-6">
      <Section title="Scaled job">
        <Field label="Ready">
          <ReadyPill status={d.ready} />
        </Field>
        <Field label="Status message">{d.status || '—'}</Field>
        <Field label="Active">
          <KEDAActivityPill status={d.active} />
        </Field>
        {kedaPauseLabel(d) && (
          <Field label="Paused">
            <KEDAPausedPill state={d} />
          </Field>
        )}
        <Field label="Last active">{d.lastActiveTime ? formatAge(d.lastActiveTime) : '—'}</Field>
        <Field label="Age">{formatAge(d.createdAt)}</Field>
      </Section>
      <Section title="Scaling">
        <Field label="Jobs">
          <span className="tabular-nums">
            {d.minReplicas}–{d.maxReplicas}
          </span>
        </Field>
        <Field label="Strategy">{d.scalingStrategy}</Field>
        {d.multipleScalers && <Field label="Multiple scalers">{d.multipleScalers}</Field>}
        <Field label="Rollout">{d.rolloutStrategy}</Field>
        <Field label="Polling interval">{seconds(d.pollingInterval)}</Field>
        <Field label="History kept">
          {d.successfulJobsHistoryLimit} succeeded, {d.failedJobsHistoryLimit} failed
        </Field>
      </Section>
      <Section title="Job template">
        {d.containers.map((c) => (
          <Field key={c.name} label={c.name} mono>
            {c.image}
          </Field>
        ))}
        {d.parallelism && <Field label="Parallelism">{d.parallelism}</Field>}
        {d.completions && <Field label="Completions">{d.completions}</Field>}
        {d.backoffLimit && <Field label="Backoff limit">{d.backoffLimit}</Field>}
        {d.activeDeadlineSeconds && <Field label="Deadline">{seconds(Number(d.activeDeadlineSeconds))}</Field>}
        {d.envSourceContainer && (
          <Field label="Env source" mono>
            {d.envSourceContainer}
          </Field>
        )}
      </Section>
      <KEDATriggersSection contextName={contextName} namespace={namespace} triggers={d.triggers} />
      <ConditionsSection conditions={d.conditions} />
    </div>
  )
}

function KEDATriggersSection({
  contextName,
  namespace,
  triggers,
}: {
  contextName: string | null
  namespace: string
  triggers: KEDATrigger[]
}) {
  return (
    <Section title={`Triggers (${triggers.length})`}>
      {triggers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No triggers.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <Th>Type</Th>
                <Th>Settings</Th>
                <Th>Metric</Th>
                <Th>Authentication</Th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((t, i) => (
                <tr key={`${t.type}-${t.name}-${i}`} className="border-t border-border align-top">
                  <Td className="font-mono">
                    {t.type}
                    {t.name && <div className="text-muted-foreground">{t.name}</div>}
                  </Td>
                  <Td className="min-w-48 max-w-[28rem] break-words">
                    {t.summary ? humanizeTrigger(`${t.type} (${t.summary})`) : <TriggerMetadata metadata={t.metadata} />}
                  </Td>
                  <Td>
                    {t.metricType || '—'}
                    {t.useCachedMetrics && <div className="text-muted-foreground">cached</div>}
                  </Td>
                  <Td>
                    {t.authName ? (
                      <CustomResourceReference
                        contextName={contextName}
                        group={KEDA_GROUP}
                        resource={
                          t.authKind === 'ClusterTriggerAuthentication'
                            ? KEDA_CLUSTERTRIGGERAUTHENTICATION_RESOURCE
                            : KEDA_TRIGGERAUTHENTICATION_RESOURCE
                        }
                        kind={t.authKind}
                        namespace={t.authKind === 'ClusterTriggerAuthentication' ? '' : namespace}
                        name={t.authName}
                      />
                    ) : (
                      '—'
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function TriggerMetadata({ metadata }: { metadata: Record<string, string> }) {
  const entries = Object.entries(metadata).sort(([a], [b]) => a.localeCompare(b))
  if (entries.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <div className="space-y-0.5 font-mono">
      {entries.map(([k, v]) => (
        <div key={k}>
          <span className="text-muted-foreground">{k}=</span>
          {v}
        </div>
      ))}
    </div>
  )
}

export function KEDATriggerAuthenticationDetailBody({
  contextName,
  namespace,
  name,
  cluster,
}: IntegrationDetailProps & { cluster: boolean }) {
  const load = useCallback(
    (ctx: string) =>
      cluster ? api.getKEDAClusterTriggerAuthentication(ctx, name) : api.getKEDATriggerAuthentication(ctx, namespace, name),
    [cluster, namespace, name],
  )
  const kind = cluster ? 'ClusterTriggerAuthentication' : 'TriggerAuthentication'
  const { detail: d, error } = useResourceDetail(contextName, kind, namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  // Secrets and ConfigMaps a ClusterTriggerAuthentication names live in KEDA's
  // own namespace, which the object does not record, so they stay unlinked.
  const refLink = (source: string, refName: string) =>
    !cluster && (source === 'Secret' || source === 'ConfigMap')
      ? link(source, refName, namespace, contextName)
      : refName
  return (
    <div className="space-y-6">
      <Section title={cluster ? 'Cluster trigger authentication' : 'Trigger authentication'}>
        <Field label="Sources">{d.sources.join(', ') || '—'}</Field>
        {d.filePath && (
          <Field label="File path" mono>
            {d.filePath}
          </Field>
        )}
        <Field label="Age">{formatAge(d.createdAt)}</Field>
      </Section>
      {d.parameters.length > 0 && (
        <Section title="Parameters">
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Parameter</Th>
                  <Th>Source</Th>
                  <Th>From</Th>
                  <Th>Key</Th>
                </tr>
              </thead>
              <tbody>
                {d.parameters.map((p, i) => (
                  <tr key={`${p.parameter}-${i}`} className="border-t border-border align-top">
                    <Td className="font-mono">{p.parameter}</Td>
                    <Td>{p.source}</Td>
                    <Td className="font-mono break-all">
                      {refLink(p.source, p.name)}
                      {p.container && <div className="text-muted-foreground">container {p.container}</div>}
                      {p.version && <div className="text-muted-foreground">version {p.version}</div>}
                    </Td>
                    <Td className="font-mono">{p.key || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {d.providers.map((provider) => (
        <Section key={provider.kind} title={provider.kind}>
          {provider.fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">No settings.</p>
          ) : (
            provider.fields.map((f) => (
              <Field key={f.label} label={f.label} mono>
                {f.value}
              </Field>
            ))
          )}
        </Section>
      ))}
      <Section title="Used by">
        <UsersField label="ScaledObjects" names={d.scaledObjects} resource={KEDA_SCALEDOBJECT_RESOURCE} kind="ScaledObject" namespace={namespace} contextName={contextName} />
        <UsersField label="ScaledJobs" names={d.scaledJobs} resource={KEDA_SCALEDJOB_RESOURCE} kind="ScaledJob" namespace={namespace} contextName={contextName} />
      </Section>
    </div>
  )
}

// UsersField links each user. A TriggerAuthentication's users share its
// namespace; a ClusterTriggerAuthentication's come as "<namespace>/<name>",
// or as a bare name when the cache could not place them, which has nothing to
// link to.
function UsersField({
  label,
  names,
  resource,
  kind,
  namespace,
  contextName,
}: {
  label: string
  names: string[]
  resource: string
  kind: string
  namespace: string
  contextName: string | null
}) {
  return (
    <Field label={label}>
      {names.length === 0 ? (
        '—'
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {names.map((n) => {
            const [ns, objName] = n.includes('/') ? n.split('/', 2) : [namespace, n]
            if (!ns) {
              return (
                <span key={n} className="font-mono text-xs">
                  {n}
                </span>
              )
            }
            return (
              <CustomResourceReference
                key={n}
                contextName={contextName}
                group={KEDA_GROUP}
                resource={resource}
                kind={kind}
                namespace={ns}
                name={objName}
              />
            )
          })}
        </div>
      )}
    </Field>
  )
}
