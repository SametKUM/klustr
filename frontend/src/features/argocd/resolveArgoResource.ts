import type { ArgoApplicationResource, CRDInfo } from '@/lib/api'
import { RESOURCE_GROUPS } from '@/features/_shared/resourceGroups'
import { RESOURCE_KIND_GROUPS } from '@/features/_shared/resourceKindGroups'
import type { ResourceKind, SelectedResource } from '@/store/ui'

// Derive the clickable built-in kinds from the same static sidebar groups that
// drive ResourceDetailPanel dispatch, so a kind with a detail view can never
// drift out of this allow-list (CR-backed groups are handled via the CRD list,
// not here).
const BUILTIN_KINDS: ReadonlySet<ResourceKind> = new Set(
  RESOURCE_GROUPS.flatMap((g) => g.items)
    .map((i) => i.kind)
    .filter((k): k is ResourceKind => k !== undefined),
)

// A row is a built-in only in the built-in's own API group: Knative's
// serving.knative.dev Service shares the kind name with the core Service and
// must resolve through its CRD instead.
function builtinKind(row: ArgoApplicationResource): ResourceKind | null {
  const kind = row.kind as ResourceKind
  if (!BUILTIN_KINDS.has(kind)) return null
  return RESOURCE_KIND_GROUPS[kind] === row.group ? kind : null
}

function findCRD(row: ArgoApplicationResource, crds: readonly CRDInfo[]): CRDInfo | undefined {
  return crds.find((c) => c.group === row.group && c.kind === row.kind)
}

// resolveArgoResource maps a managed-resource row to the detail panel target,
// or null when Klustr has no view for it.
export function resolveArgoResource(
  row: ArgoApplicationResource,
  contextName: string,
  crds: readonly CRDInfo[],
): SelectedResource | null {
  const kind = builtinKind(row)
  if (kind) {
    return { kind, namespace: row.namespace, name: row.name, context: contextName }
  }
  const crd = findCRD(row, crds)
  if (!crd) return null
  return {
    kind: row.kind,
    namespace: row.namespace,
    name: row.name,
    context: contextName,
    gvr: { group: crd.group, version: crd.version, resource: crd.resource },
  }
}

export function isArgoResourceClickable(
  row: ArgoApplicationResource,
  crds: readonly CRDInfo[],
): boolean {
  return builtinKind(row) !== null || findCRD(row, crds) !== undefined
}
