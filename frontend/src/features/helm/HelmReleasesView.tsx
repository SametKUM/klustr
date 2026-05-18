import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type HelmReleaseInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { type ByContext } from '@/store/resources'
import { useHelmStore } from '@/store/helm'
import { useIsAggregated, useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<HelmReleaseInfo>()

export function HelmReleasesView() {
  const releases = useHelmStore((s) => s.releases)
  const setReleases = useHelmStore((s) => s.setReleases)
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace' }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('chartName', { header: 'Chart' }),
      columnHelper.accessor('chartVersion', { header: 'Chart ver.' }),
      columnHelper.accessor('appVersion', { header: 'App ver.' }),
      columnHelper.accessor('status', { header: 'Status' }),
      columnHelper.accessor('revision', {
        header: 'Rev',
        cell: (info) => `#${info.getValue()}`,
      }),
      columnHelper.accessor('updated', {
        header: 'Updated',
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )

  const data = useMemo<ByContext<HelmReleaseInfo>>(
    () => (selectedContext ? { [selectedContext]: releases } : {}),
    [selectedContext, releases],
  )

  const setData = useCallback(
    (_ctx: string, list: HelmReleaseInfo[]) => setReleases(list),
    [setReleases],
  )

  const fetch = useCallback(
    async (ctx: string, ns: string) => {
      const list = await api.listHelmReleases(ctx, ns)
      return list
    },
    [],
  )

  const onRowClick = useCallback(
    (row: HelmReleaseInfo, ctx: string) =>
      setSelectedResource({
        kind: 'HelmRelease',
        namespace: row.namespace,
        name: row.name,
        context: ctx,
      }),
    [setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Helm releases are only available in single-context mode. Pick one context to browse
        releases.
      </div>
    )
  }

  return (
    <ResourceTable
      kind="HelmRelease"
      noun={{ singular: 'release', plural: 'releases' }}
      scope="namespaced"
      data={data}
      setData={setData}
      fetch={fetch}
      columns={columns}
      onRowClick={onRowClick}
    />
  )
}
