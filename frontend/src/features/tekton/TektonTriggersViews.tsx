import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import {
  api,
  type TektonEventListenerInfo,
  type TektonTriggerBindingInfo,
  type TektonTriggerInfo,
  type TektonTriggerTemplateInfo,
} from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { ReadyPill } from '@/features/_shared/ReadyPill'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import {
  TEKTON_CLUSTERTRIGGERBINDING_RESOURCE,
  TEKTON_EVENTLISTENER_RESOURCE,
  TEKTON_TRIGGERBINDING_RESOURCE,
  TEKTON_TRIGGER_RESOURCE,
  TEKTON_TRIGGERS_GROUP,
  TEKTON_TRIGGERTEMPLATE_RESOURCE,
} from './tektonKinds'

const age = { header: 'Age', size: COL_SM, sortingFn: 'datetime' as const }

const el = createColumnHelper<TektonEventListenerInfo>()

export function TektonEventListenersView() {
  const columns = useMemo(
    () => [
      el.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      el.accessor('name', { header: 'Name' }),
      el.accessor('ready', { header: 'Ready', size: COL_SM, cell: (i) => <ReadyPill status={i.getValue()} title={i.row.original.status} /> }),
      el.accessor('address', { header: 'Address', size: 280, cell: (i) => <span className="font-mono text-xs">{i.getValue() || '—'}</span> }),
      el.accessor('triggers', { header: 'Triggers', size: COL_SM, cell: (i) => <span className="tabular-nums">{i.getValue()}</span> }),
      el.accessor('serviceAccount', { header: 'Service account', size: 160, cell: (i) => i.getValue() || '—' }),
      el.accessor('createdAt', { ...age, cell: (i) => formatAge(i.getValue()) }),
    ],
    [],
  )
  return (
    <CustomResourceTable
      group={TEKTON_TRIGGERS_GROUP}
      resource={TEKTON_EVENTLISTENER_RESOURCE}
      kind="EventListener"
      noun={{ singular: 'event listener', plural: 'event listeners' }}
      scope="namespaced"
      fetch={api.listTektonEventListeners}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Tekton Triggers EventListeners are not available in the active contexts."
    />
  )
}

const tr = createColumnHelper<TektonTriggerInfo>()

export function TektonTriggersView() {
  const columns = useMemo(
    () => [
      tr.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      tr.accessor('name', { header: 'Name' }),
      tr.accessor((r) => r.interceptors.join(', '), {
        id: 'interceptors',
        header: 'Interceptors',
        size: 200,
        cell: (i) => i.getValue() || '—',
      }),
      tr.accessor('bindings', { header: 'Bindings', size: COL_SM, cell: (i) => <span className="tabular-nums">{i.getValue()}</span> }),
      tr.accessor('template', { header: 'Template', size: 200, cell: (i) => <span className="font-mono text-xs">{i.getValue() || 'inline'}</span> }),
      tr.accessor('createdAt', { ...age, cell: (i) => formatAge(i.getValue()) }),
    ],
    [],
  )
  return (
    <CustomResourceTable
      group={TEKTON_TRIGGERS_GROUP}
      resource={TEKTON_TRIGGER_RESOURCE}
      kind="Trigger"
      noun={{ singular: 'trigger', plural: 'triggers' }}
      scope="namespaced"
      fetch={api.listTektonTriggers}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Tekton Triggers are not available in the active contexts."
    />
  )
}

const tt = createColumnHelper<TektonTriggerTemplateInfo>()

export function TektonTriggerTemplatesView() {
  const columns = useMemo(
    () => [
      tt.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      tt.accessor('name', { header: 'Name' }),
      tt.accessor('params', { header: 'Params', size: COL_SM, cell: (i) => <span className="tabular-nums">{i.getValue()}</span> }),
      tt.accessor((r) => r.creates.join(', '), { id: 'creates', header: 'Creates', size: 200, cell: (i) => i.getValue() || '—' }),
      tt.accessor('createdAt', { ...age, cell: (i) => formatAge(i.getValue()) }),
    ],
    [],
  )
  return (
    <CustomResourceTable
      group={TEKTON_TRIGGERS_GROUP}
      resource={TEKTON_TRIGGERTEMPLATE_RESOURCE}
      kind="TriggerTemplate"
      noun={{ singular: 'trigger template', plural: 'trigger templates' }}
      scope="namespaced"
      fetch={api.listTektonTriggerTemplates}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Tekton TriggerTemplates are not available in the active contexts."
    />
  )
}

const tb = createColumnHelper<TektonTriggerBindingInfo>()

export function TektonTriggerBindingsView({ cluster }: { cluster: boolean }) {
  const columns = useMemo(
    () => [
      ...(cluster ? [] : [tb.accessor('namespace', { header: 'Namespace', size: COL_MD })]),
      tb.accessor('name', { header: 'Name' }),
      tb.accessor('params', { header: 'Params', size: COL_SM, cell: (i) => <span className="tabular-nums">{i.getValue()}</span> }),
      tb.accessor('createdAt', { ...age, cell: (i) => formatAge(i.getValue()) }),
    ],
    [cluster],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) => (cluster ? api.listTektonClusterTriggerBindings(ctx) : api.listTektonTriggerBindings(ctx, ns)),
    [cluster],
  )
  return (
    <CustomResourceTable
      group={TEKTON_TRIGGERS_GROUP}
      resource={cluster ? TEKTON_CLUSTERTRIGGERBINDING_RESOURCE : TEKTON_TRIGGERBINDING_RESOURCE}
      kind={cluster ? 'ClusterTriggerBinding' : 'TriggerBinding'}
      noun={
        cluster
          ? { singular: 'cluster trigger binding', plural: 'cluster trigger bindings' }
          : { singular: 'trigger binding', plural: 'trigger bindings' }
      }
      scope={cluster ? 'cluster' : 'namespaced'}
      fetch={fetch}
      columns={columns}
      identity={(row) => ({ namespace: cluster ? '' : row.namespace, name: row.name })}
      unavailableMessage={`Tekton ${cluster ? 'ClusterTriggerBindings' : 'TriggerBindings'} are not available in the active contexts.`}
    />
  )
}
