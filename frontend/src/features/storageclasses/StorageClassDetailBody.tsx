import { useCallback } from 'react'
import { api, type StorageClassDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function StorageClassDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getStorageClass(ctx, name), [name])
  const { detail, error } = useResourceDetail<StorageClassDetail>(contextName, 'StorageClass', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Provisioner"><Copyable value={detail.provisioner} /></Field>
        <Field label="Reclaim Policy">{detail.reclaimPolicy || '—'}</Field>
        <Field label="Volume Binding">{detail.volumeBindingMode || '—'}</Field>
        <Field label="Allow Expansion">{detail.allowExpansion ? 'Yes' : 'No'}</Field>
        <Field label="Default">{detail.isDefault ? 'Yes' : 'No'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      {detail.mountOptions.length > 0 && (
        <Section title="Mount Options">
          <div className="font-mono text-xs">{detail.mountOptions.join(' ')}</div>
        </Section>
      )}
      <MaybeSection title="Parameters" items={detail.parameters} render={() => <Chips items={detail.parameters} />} />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
