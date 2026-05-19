import { useCallback, useEffect, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CRDInfo, type CustomResourceInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore, crdKey } from '@/store/crds'
import { useIsAggregated, useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<CustomResourceInfo>()

const EMPTY_CRS: CustomResourceInfo[] = []

type Props = {
  crd: CRDInfo
}

export function CustomResourceView({ crd }: Props) {
  const key = crdKey(crd)
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const customResources = useCRDStore((s) => s.customResources[key] ?? EMPTY_CRS)
  const setCustomResources = useCRDStore((s) => s.setCustomResources)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedContext) return
    let cancelled = false
    setReady(false)
    setError(null)
    api
      .ensureCustomResourceWatch(selectedContext, crd.group, crd.version, crd.resource)
      .then(() => {
        if (cancelled) return
        setReady(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [selectedContext, crd.group, crd.version, crd.resource])

  const columns = useMemo(() => {
    const cols = []
    if (crd.scope === 'Namespaced') {
      cols.push(columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }))
    }
    cols.push(columnHelper.accessor('name', { header: 'Name' }))
    for (const pc of crd.printerColumns ?? []) {
      cols.push(
        columnHelper.accessor((row) => row.cells?.[pc.name] ?? '', {
          id: `pc:${pc.name}`,
          header: pc.name,
          ...(pc.type === 'date' || pc.type === 'boolean' || pc.type === 'integer' || pc.type === 'number'
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

  const data = useMemo<ByContext<CustomResourceInfo>>(
    () => (selectedContext ? { [selectedContext]: customResources } : {}),
    [selectedContext, customResources],
  )
  const setData = useCallback(
    (_ctx: string, list: CustomResourceInfo[]) => setCustomResources(key, list),
    [key, setCustomResources],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) =>
      api.listCustomResources(ctx, crd.group, crd.version, crd.resource, ns),
    [crd.group, crd.version, crd.resource],
  )
  const onRowClick = useCallback(
    (row: CustomResourceInfo, ctx: string) =>
      setSelectedResource({
        kind: crd.kind,
        namespace: row.namespace,
        name: row.name,
        context: ctx,
        gvr: { group: crd.group, version: crd.version, resource: crd.resource },
      }),
    [crd.group, crd.version, crd.resource, crd.kind, setSelectedResource],
  )
  const noun = useMemo(
    () => ({ singular: crd.singular || crd.kind.toLowerCase(), plural: crd.resource }),
    [crd.singular, crd.kind, crd.resource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Custom resources are only available in single-context mode. Pick one context to browse{' '}
        {crd.kind}.
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for {crd.kind}: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for {crd.kind}…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${crd.group}/${crd.resource}`}
      noun={noun}
      scope={crd.scope === 'Namespaced' ? 'namespaced' : 'cluster'}
      data={data}
      setData={setData}
      fetch={fetch}
      columns={columns}
      onRowClick={onRowClick}
    />
  )
}
