import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type TektonTaskInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { TEKTON_GROUP, TEKTON_TASK_RESOURCE } from './tektonKinds'

const columnHelper = createColumnHelper<TektonTaskInfo>()

export function TektonTasksView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('stepCount', { header: 'Steps', size: COL_XS }),
      columnHelper.accessor('paramCount', { header: 'Params', size: COL_XS }),
      columnHelper.accessor('resultCount', { header: 'Results', size: COL_XS }),
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
      resource={TEKTON_TASK_RESOURCE}
      kind="Task"
      noun={{ singular: 'task', plural: 'tasks' }}
      scope="namespaced"
      fetch={api.listTektonTasks}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Tekton Pipelines is not installed in the active contexts."
    />
  )
}
