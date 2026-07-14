import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type HelmReleaseInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useContextResourceData } from '@/features/_shared/useContextResourceData'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useActiveContexts, useUIStore } from '@/store/ui'
import { HelmStatusPill } from './HelmStatusPill'

const columnHelper = createColumnHelper<HelmReleaseInfo>()

export function HelmReleasesView() {
  const activeContexts = useActiveContexts()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const { data, setData } = useContextResourceData<HelmReleaseInfo>(activeContexts)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('chartName', { header: 'Chart' }),
      columnHelper.accessor('chartVersion', { header: 'Chart ver.', size: COL_SM }),
      columnHelper.accessor('appVersion', { header: 'App ver.', size: COL_SM }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: COL_SM,
        cell: (info) => <HelmStatusPill status={info.getValue()} />,
      }),
      columnHelper.accessor('revision', {
        header: 'Rev',
        size: COL_XS,
        cell: (info) => `#${info.getValue()}`,
      }),
      columnHelper.accessor('updated', {
        header: 'Updated',
        size: COL_SM,
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
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
