import { useCallback, useEffect, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CRDInfo, type CustomResourceInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useCRDStore, crdKey } from '@/store/crds'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<CustomResourceInfo>()

const EMPTY_CRS: CustomResourceInfo[] = []

type Props = {
  crd: CRDInfo
}

export function CustomResourceView({ crd }: Props) {
  const key = crdKey(crd)
  const selectedContext = useUIStore((s) => s.selectedContext)
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
      cols.push(columnHelper.accessor('namespace', { header: 'Namespace' }))
    }
    cols.push(columnHelper.accessor('name', { header: 'Name' }))
    cols.push(
      columnHelper.accessor('createdAt', {
        header: 'Age',
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    )
    return cols
  }, [crd.scope])

  const setData = useCallback(
    (list: CustomResourceInfo[]) => setCustomResources(key, list),
    [key, setCustomResources],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) =>
      api.listCustomResources(ctx, crd.group, crd.version, crd.resource, ns),
    [crd.group, crd.version, crd.resource],
  )
  const onRowClick = useCallback(
    (row: CustomResourceInfo) =>
      setSelectedResource({
        kind: crd.kind,
        namespace: row.namespace,
        name: row.name,
        gvr: { group: crd.group, version: crd.version, resource: crd.resource },
      }),
    [crd.group, crd.version, crd.resource, crd.kind, setSelectedResource],
  )
  const noun = useMemo(
    () => ({ singular: crd.singular || crd.kind.toLowerCase(), plural: crd.resource }),
    [crd.singular, crd.kind, crd.resource],
  )

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
      data={customResources}
      setData={setData}
      fetch={fetch}
      columns={columns}
      onRowClick={onRowClick}
    />
  )
}
