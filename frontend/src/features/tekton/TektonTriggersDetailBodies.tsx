import { useCallback } from 'react'
import { api, type OwnerRef, type TektonTriggerSpec } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ConditionsSection } from '@/features/_shared/ConditionsTable'
import { CustomResourceReference } from '@/features/_shared/CustomResourceReference'
import { Chips, ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { OwnerLink } from '@/features/_shared/OwnerLink'
import { ReadyPill } from '@/features/_shared/ReadyPill'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import type { IntegrationDetailProps } from '@/features/integrationDetails'
import { ParamSpecsTable, ValuesTable } from './TektonDetailPrimitives'
import { templateRunRef } from './tektonFormat'
import {
  TEKTON_CLUSTERTRIGGERBINDING_RESOURCE,
  TEKTON_EVENTLISTENER_RESOURCE,
  TEKTON_GROUP,
  TEKTON_PIPELINE_RESOURCE,
  TEKTON_TASK_RESOURCE,
  TEKTON_TRIGGERBINDING_RESOURCE,
  TEKTON_TRIGGER_RESOURCE,
  TEKTON_TRIGGERS_GROUP,
  TEKTON_TRIGGERTEMPLATE_RESOURCE,
} from './tektonKinds'

function TriggersRef({
  contextName,
  resource,
  kind,
  namespace,
  name,
}: {
  contextName: string | null
  resource: string
  kind: string
  namespace: string
  name: string
}) {
  return (
    <CustomResourceReference
      contextName={contextName}
      group={TEKTON_TRIGGERS_GROUP}
      resource={resource}
      kind={kind}
      namespace={namespace}
      name={name}
    />
  )
}

// TriggerChain renders one trigger as the path an event takes: the
// interceptors it passes, the bindings that read its params, the template
// they fill.
function TriggerChain({
  contextName,
  namespace,
  spec,
}: {
  contextName: string | null
  namespace: string
  spec: TektonTriggerSpec
}) {
  if (spec.triggerRef) {
    return (
      <Field label="Trigger">
        <TriggersRef contextName={contextName} resource={TEKTON_TRIGGER_RESOURCE} kind="Trigger" namespace={namespace} name={spec.triggerRef} />
      </Field>
    )
  }
  return (
    <>
      <Field label="Interceptors">
        {spec.interceptors.length === 0 ? (
          '—'
        ) : (
          <ol className="space-y-1.5">
            {spec.interceptors.map((ic, i) => (
              <li key={i} className="text-xs">
                <span className="font-mono">{ic.ref || ic.name || (ic.webhook ? `webhook ${ic.webhook}` : '—')}</span>
                {ic.kind && <span className="text-muted-foreground"> ({ic.kind})</span>}
                {ic.params.map((p) => (
                  <div key={p.name} className="ml-3 break-all font-mono text-muted-foreground">
                    {p.name}: {p.value}
                  </div>
                ))}
              </li>
            ))}
          </ol>
        )}
      </Field>
      <Field label="Bindings">
        {spec.bindings.length === 0 ? (
          '—'
        ) : (
          <div className="space-y-0.5">
            {spec.bindings.map((b, i) =>
              b.ref ? (
                <div key={i} className="font-mono text-xs">
                  <TriggersRef
                    contextName={contextName}
                    resource={b.kind === 'ClusterTriggerBinding' ? TEKTON_CLUSTERTRIGGERBINDING_RESOURCE : TEKTON_TRIGGERBINDING_RESOURCE}
                    kind={b.kind}
                    namespace={b.kind === 'ClusterTriggerBinding' ? '' : namespace}
                    name={b.ref}
                  />
                  {b.kind === 'ClusterTriggerBinding' && <span className="text-muted-foreground"> (cluster)</span>}
                </div>
              ) : (
                <div key={i} className="font-mono text-xs">
                  {b.name}: {b.value}
                </div>
              ),
            )}
          </div>
        )}
      </Field>
      <Field label="Template">
        {spec.template ? (
          <TriggersRef
            contextName={contextName}
            resource={TEKTON_TRIGGERTEMPLATE_RESOURCE}
            kind="TriggerTemplate"
            namespace={namespace}
            name={spec.template}
          />
        ) : spec.templateInline ? (
          'inline'
        ) : (
          '—'
        )}
      </Field>
      {spec.serviceAccount && (
        <Field label="Service account" mono>
          {spec.serviceAccount}
        </Field>
      )}
    </>
  )
}

export function TektonEventListenerDetailBody({ contextName, namespace, name }: IntegrationDetailProps) {
  const load = useCallback((ctx: string) => api.getTektonEventListener(ctx, namespace, name), [namespace, name])
  const { detail: d, error } = useResourceDetail(contextName, 'EventListener', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  const link = (kind: string) => (
    <OwnerLink owner={{ kind, name: d.generatedName } as OwnerRef} namespace={namespace} context={contextName} />
  )
  return (
    <div className="space-y-6">
      <Section title="EventListener">
        <Field label="Ready">
          <ReadyPill status={d.ready} />
        </Field>
        <Field label="Status message">{d.status || '—'}</Field>
        <Field label="Address" mono>
          {d.address || '—'}
        </Field>
        {d.generatedName && (
          <Field label="Runs as">
            <span className="space-x-3 font-mono text-xs">
              <span>Deployment {link('Deployment')}</span>
              <span>Service {link('Service')}</span>
            </span>
          </Field>
        )}
        <Field label="Service">
          {d.serviceType || 'ClusterIP'}
          {d.servicePort > 0 && `, port ${d.servicePort}`}
          {d.replicas > 0 && `, ${d.replicas} replicas`}
        </Field>
        <Field label="Service account" mono>
          {d.serviceAccount || '—'}
        </Field>
        {d.namespaceSelector.length > 0 && (
          <Field label="Namespaces">{d.namespaceSelector.join(', ')}</Field>
        )}
        {Object.keys(d.labelSelector).length > 0 && (
          <Field label="Trigger selector">
            <Chips items={d.labelSelector} />
          </Field>
        )}
        {d.triggerGroups.length > 0 && <Field label="Trigger groups">{d.triggerGroups.join(', ')}</Field>}
        <Field label="Age">{formatAge(d.createdAt)}</Field>
      </Section>
      {d.triggerList.map((t, i) => (
        <Section key={`${t.name}-${i}`} title={`Trigger ${t.name || t.triggerRef || i + 1}`}>
          <TriggerChain contextName={contextName} namespace={namespace} spec={t} />
        </Section>
      ))}
      <ConditionsSection conditions={d.conditions} />
    </div>
  )
}

export function TektonTriggerDetailBody({ contextName, namespace, name }: IntegrationDetailProps) {
  const load = useCallback((ctx: string) => api.getTektonTrigger(ctx, namespace, name), [namespace, name])
  const { detail: d, error } = useResourceDetail(contextName, 'Trigger', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <div className="space-y-6">
      <Section title="Trigger">
        <TriggerChain contextName={contextName} namespace={namespace} spec={d.spec} />
        <Field label="EventListeners">
          {d.eventListeners.length === 0 ? (
            <span className="text-muted-foreground">No watched EventListener refers to it by name.</span>
          ) : (
            <span className="space-x-3">
              {d.eventListeners.map((n) => (
                <TriggersRef key={n} contextName={contextName} resource={TEKTON_EVENTLISTENER_RESOURCE} kind="EventListener" namespace={namespace} name={n} />
              ))}
            </span>
          )}
        </Field>
        <Field label="Age">{formatAge(d.createdAt)}</Field>
      </Section>
    </div>
  )
}

export function TektonTriggerTemplateDetailBody({ contextName, namespace, name }: IntegrationDetailProps) {
  const load = useCallback((ctx: string) => api.getTektonTriggerTemplate(ctx, namespace, name), [namespace, name])
  const { detail: d, error } = useResourceDetail(contextName, 'TriggerTemplate', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <div className="space-y-6">
      <Section title={`Creates (${d.resources.length})`}>
        {d.resources.length === 0 ? (
          <p className="text-xs text-muted-foreground">No resource templates.</p>
        ) : (
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Kind</Th>
                  <Th>Name</Th>
                  <Th>Runs</Th>
                </tr>
              </thead>
              <tbody>
                {d.resources.map((r, i) => {
                  const ref = templateRunRef(r, namespace)
                  return (
                    <tr key={i} className="border-t border-border align-top">
                      <Td>
                        {r.kind}
                        <div className="text-muted-foreground">{r.apiVersion}</div>
                      </Td>
                      <Td className="font-mono">
                        {r.name ? `${r.namespace ? `${r.namespace}/` : ''}${r.name}` : '—'}
                      </Td>
                      <Td className="font-mono">
                        {!ref ? (
                          '—'
                        ) : ref.linkable ? (
                          <CustomResourceReference
                            contextName={contextName}
                            group={TEKTON_GROUP}
                            resource={ref.kind === 'Pipeline' ? TEKTON_PIPELINE_RESOURCE : TEKTON_TASK_RESOURCE}
                            kind={ref.kind}
                            namespace={ref.namespace}
                            name={ref.name}
                          />
                        ) : (
                          ref.name
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <ParamSpecsTable params={d.paramSpecs} />
      <p className="text-xs text-muted-foreground">Age {formatAge(d.createdAt)}</p>
    </div>
  )
}

export function TektonTriggerBindingDetailBody({
  contextName,
  namespace,
  name,
  cluster,
}: IntegrationDetailProps & { cluster: boolean }) {
  const load = useCallback(
    (ctx: string) => (cluster ? api.getTektonClusterTriggerBinding(ctx, name) : api.getTektonTriggerBinding(ctx, namespace, name)),
    [cluster, namespace, name],
  )
  const { detail: d, error } = useResourceDetail(contextName, cluster ? 'ClusterTriggerBinding' : 'TriggerBinding', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <div className="space-y-6">
      <ValuesTable title="Params" values={d.paramList} />
      {d.paramList.length === 0 && <p className="text-xs text-muted-foreground">This binding declares no params.</p>}
      <p className="text-xs text-muted-foreground">Age {formatAge(d.createdAt)}</p>
    </div>
  )
}
