import { useCallback } from 'react'
import { api, type CiliumReference, type CiliumResourceDetail } from '@/lib/api'
import { findCRD, useCRDStore } from '@/store/crds'
import { useUIStore, type SelectedResource } from '@/store/ui'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { CILIUM_GROUP, CILIUM_RESOURCES, type CiliumView } from './ciliumKinds'

type Props = { contextName: string | null; resource: CiliumView; namespace: string; name: string }

export function CiliumResourceDetailBody({ contextName, resource, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getCiliumResource(ctx, resource, namespace, name),
    [resource, namespace, name],
  )
  const { detail, error } = useResourceDetail<CiliumResourceDetail>(
    contextName, CILIUM_RESOURCES[resource].kind, namespace, name, load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return <div className="space-y-6">
    <Section title={detail.kind}>
      <Field label="Reported status">{detail.state || '—'}</Field>
      {detail.fields.map((field) => <Field key={field.label} label={field.label} mono>{field.value || '—'}</Field>)}
    </Section>
    {detail.references.length > 0 && <Section title="Related resources">
      {detail.references.map((ref) => <ReferenceLink key={`${ref.kind}/${ref.namespace}/${ref.name}`} contextName={contextName} reference={ref} />)}
    </Section>}
    {detail.tables.map((table) => <Section key={table.title} title={`${table.title} (${table.rows.length})`}>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground"><tr>{table.columns.map((column) => <Th key={column}>{column}</Th>)}</tr></thead>
          <tbody>{table.rows.map((row, index) => <tr key={index} className="border-t border-border align-top">
            {row.map((value, cell) => <Td key={cell} className="min-w-24 whitespace-pre-wrap break-words font-mono">{value || '—'}</Td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </Section>)}
  </div>
}

function ReferenceLink({ contextName, reference }: { contextName: string | null; reference: CiliumReference }) {
  const openResource = useUIStore((s) => s.openResource)
  const catalog = useCRDStore((s) => s.byContext)
  const crd = contextName && reference.resource ? findCRD(catalog, contextName, CILIUM_GROUP, reference.resource) : null
  const target: SelectedResource | null = contextName && (!reference.resource || crd) ? {
    kind: reference.kind,
    namespace: reference.namespace,
    name: reference.name,
    context: contextName,
    ...(crd ? { gvr: { group: crd.group, version: crd.version, resource: crd.resource } } : {}),
  } : null
  const label = `${reference.kind}/${reference.namespace ? `${reference.namespace}/` : ''}${reference.name}`
  return <div className="text-xs font-mono">
    {target ? <button type="button" className="text-primary hover:underline" onClick={() => openResource(target)}>{label}</button> : label}
  </div>
}
