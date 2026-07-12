import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CRDInfo, type CustomResourceInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useContextResourceData } from '@/features/_shared/useContextResourceData'
import { useCustomResourceCapability } from '@/features/_shared/useCustomResourceCapability'
import { CustomResourcePartialWarning } from '@/features/_shared/CustomResourcePartialWarning'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useUIStore, type SelectedResource } from '@/store/ui'

const columnHelper = createColumnHelper<CustomResourceInfo>()

type Props = {
  crd: CRDInfo
}

export function CustomResourceView({ crd }: Props) {
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const capability = useCustomResourceCapability(crd.group, crd.resource)
  const { data, setData } = useContextResourceData<CustomResourceInfo>(capability.activeContexts)

  const columns = useMemo(() => {
    const cols = []
    if (crd.scope === 'Namespaced') {
      cols.push(
        columnHelper.accessor('namespace', {
          header: 'Namespace',
          size: COL_MD,
        }),
      )
    }
    cols.push(columnHelper.accessor('name', { header: 'Name' }))
    for (const pc of crd.printerColumns ?? []) {
      cols.push(
        columnHelper.accessor((row) => row.cells?.[pc.name] ?? '', {
          id: `pc:${pc.name}`,
          header: pc.name,
          ...(pc.type === 'date' ||
          pc.type === 'boolean' ||
          pc.type === 'integer' ||
          pc.type === 'number'
            ? { size: COL_SM }
            : {}),
          cell: (info) => {
            const v = info.getValue()
            if (pc.type === 'date' && v) return formatAge(v as string)
            return v
          },
          ...(pc.type === 'date' ? { sortingFn: 'datetime' as const } : {}),
        }),
      )
    }
    cols.push(
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    )
    return cols
  }, [crd.scope, crd.printerColumns])

  const fetch = useCallback(
    (ctx: string, ns: string) => {
      const contextCRD = capability.crdsByContext[ctx]
      return contextCRD
        ? api.listCustomResources(
            ctx,
            contextCRD.group,
            contextCRD.version,
            contextCRD.resource,
            ns,
          )
        : Promise.resolve([])
    },
    [capability.crdsByContext],
  )
  const rowResource = useCallback(
    (row: CustomResourceInfo, ctx: string): SelectedResource => ({
      kind: capability.crdsByContext[ctx]?.kind ?? crd.kind,
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: capability.crdsByContext[ctx]
        ? {
            group: capability.crdsByContext[ctx].group,
            version: capability.crdsByContext[ctx].version,
            resource: capability.crdsByContext[ctx].resource,
          }
        : undefined,
    }),
    [capability.crdsByContext, crd.kind],
  )
  const onRowClick = useCallback(
    (row: CustomResourceInfo, ctx: string) => setSelectedResource(rowResource(row, ctx)),
    [rowResource, setSelectedResource],
  )
  const noun = useMemo(
    () => ({
      singular: crd.singular || crd.kind.toLowerCase(),
      plural: crd.resource,
    }),
    [crd.singular, crd.kind, crd.resource],
  )

  if (!capability.pending && capability.readyContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for {crd.kind}: {Object.values(capability.errors).join('; ')}
      </div>
    )
  }

  if (capability.pending) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for {crd.kind}…
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <CustomResourcePartialWarning errors={capability.errors} />
      <ResourceTable
        kind={`cr:${crd.group}/${crd.resource}`}
        noun={noun}
        scope={crd.scope === 'Namespaced' ? 'namespaced' : 'cluster'}
        data={data}
        setData={setData}
        fetch={fetch}
        contexts={capability.supportedContexts}
        columns={columns}
        onRowClick={onRowClick}
        rowResource={rowResource}
      />
    </div>
  )
}
