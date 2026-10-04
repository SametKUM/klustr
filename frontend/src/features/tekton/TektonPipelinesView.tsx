import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type TektonPipelineInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { TEKTON_GROUP, TEKTON_PIPELINE_RESOURCE } from './tektonKinds'

const columnHelper = createColumnHelper<TektonPipelineInfo>()

export function TektonPipelinesView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('taskCount', { header: 'Tasks', size: COL_XS }),
      columnHelper.accessor('finallyCount', { header: 'Finally', size: COL_XS }),
      columnHelper.accessor('paramCount', { header: 'Params', size: COL_XS }),
      columnHelper.accessor('workspaceCount', { header: 'Workspaces', size: COL_SM }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (i) => formatAge(i.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )

  return (
    <CustomResourceTable
      group={TEKTON_GROUP}
      resource={TEKTON_PIPELINE_RESOURCE}
      kind="Pipeline"
      noun={{ singular: 'pipeline', plural: 'pipelines' }}
      scope="namespaced"
      fetch={api.listTektonPipelines}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Tekton Pipelines is not installed in the active contexts."
    />
  )
}
