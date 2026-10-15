import type { ManifestResource } from '@/lib/api'
import { RESOURCE_GROUPS } from '@/features/_shared/resourceGroups'
import { RESOURCE_KIND_GROUPS } from '@/features/_shared/resourceKindGroups'
import type { ResourceKind, SelectedResource } from '@/store/ui'

const builtinKinds = new Set(RESOURCE_GROUPS.flatMap((group) => group.items).map((item) => item.kind))

export function manifestResourceTarget(item: ManifestResource, context: string): SelectedResource {
  const [group, version] = item.apiVersion.includes('/') ? item.apiVersion.split('/') : ['', item.apiVersion]
  const kind = item.kind as ResourceKind
  const target: SelectedResource = { context, namespace: item.namespace, name: item.name, kind }
  if (!builtinKinds.has(kind) || RESOURCE_KIND_GROUPS[kind] !== group)
    target.gvr = { group, version, resource: item.resource }
  return target
}
