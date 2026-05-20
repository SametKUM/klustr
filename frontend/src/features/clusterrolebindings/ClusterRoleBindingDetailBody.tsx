import { useCallback } from 'react'
import { api, type ClusterRoleBindingDetail } from '@/lib/api'
import { Chips, ErrorBox, MaybeSection } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { RoleRefBlock, SubjectsTable } from '@/features/rolebindings/RoleBindingDetailBody'

export function ClusterRoleBindingDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getClusterRoleBinding(ctx, name), [name])
  const { detail, error } = useResourceDetail<ClusterRoleBindingDetail>(
    contextName,
    'ClusterRoleBinding',
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <RoleRefBlock contextName={contextName} namespace="" roleRef={detail.roleRef} createdAt={detail.createdAt} />
      <SubjectsTable contextName={contextName} fallbackNamespace="" subjects={detail.subjects} />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}
