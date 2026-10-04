import { useMemo } from 'react'
import { createColumnHelper, type SortingState } from '@tanstack/react-table'
import { api, type TektonTaskRunInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { resourceContext } from '@/features/_shared/resourceContext'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useUIStore } from '@/store/ui'
import { CancelTektonRunButton } from './CancelTektonRunButton'
import { TektonStatePill } from './TektonStatePill'
import { isTektonRunActive, tektonElapsed } from './tektonFormat'
import { TEKTON_GROUP, TEKTON_TASKRUN_RESOURCE } from './tektonKinds'

const columnHelper = createColumnHelper<TektonTaskRunInfo>()
const NEWEST_FIRST: SortingState = [{ id: 'createdAt', desc: true }]

export function TektonTaskRunsView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('task', {
        header: 'Task',
        size: COL_MD,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('pipelineRun', {
        header: 'PipelineRun',
        size: COL_MD,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('state', {
        header: 'Status',
        size: COL_MD,
        cell: (i) => (
          <TektonStatePill
            state={i.getValue()}
            reason={i.row.original.reason}
            message={i.row.original.message}
          />
        ),
      }),
      columnHelper.accessor((row) => (row.stepsTotal ? `${row.stepsDone}/${row.stepsTotal}` : ''), {
        id: 'steps',
        header: 'Steps',
        size: COL_XS,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('startTime', {
        header: 'Started',
        size: COL_SM,
        cell: (i) => formatAge(i.getValue()),
        sortingFn: 'datetime',
      }),
      columnHelper.accessor('duration', {
        header: 'Duration',
        size: COL_SM,
        // Rows re-render on the shared clock tick, so a running run keeps counting.
        cell: (i) => tektonElapsed(i.getValue(), i.row.original.startTime, i.row.original.state),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        size: 100,
        cell: (i) => <RowActions row={i.row.original} />,
      }),
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
      resource={TEKTON_TASKRUN_RESOURCE}
      kind="TaskRun"
      noun={{ singular: 'task run', plural: 'task runs' }}
      scope="namespaced"
      fetch={api.listTektonTaskRuns}
      columns={columns}
      defaultSort={NEWEST_FIRST}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Tekton Pipelines is not installed in the active contexts."
    />
  )
}

function RowActions({ row }: { row: TektonTaskRunInfo }) {
  const readOnly = useUIStore((s) => s.globalReadOnly)
  const contextName = resourceContext(row)
  if (readOnly || !contextName || !isTektonRunActive(row.state)) return null
  return (
    <CancelTektonRunButton
      contextName={contextName}
      kind="TaskRun"
      namespace={row.namespace}
      name={row.name}
      variant="row"
    />
  )
}
