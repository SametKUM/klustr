import { useCallback } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ResourceTable } from './ResourceTable'
import { useContextResourceData } from './useContextResourceData'
import { useCustomResourceCapability } from './useCustomResourceCapability'
import { useUIStore, type SelectedResource } from '@/store/ui'
import { CustomResourcePartialWarning } from './CustomResourcePartialWarning'
import { buildCustomResourceSelection } from './customResourceModel'

type Props<T> = {
  group: string
  resource: string
  kind: string
  noun: { singular: string; plural: string }
  scope: 'namespaced' | 'cluster'
  columns: ColumnDef<T, unknown>[]
  fetch: (contextName: string, namespace: string) => Promise<T[]>
  identity: (row: T) => { namespace: string; name: string }
  extras?: (row: T) => Partial<SelectedResource>
  unavailableMessage: string
}

export function CustomResourceTable<T>({
  group,
  resource,
  kind,
  noun,
  scope,
  columns,
  fetch: fetchResource,
  identity,
  extras,
  unavailableMessage,
}: Props<T>) {
  const setSelectedResource = useUIStore((state) => state.setSelectedResource)
  const capability = useCustomResourceCapability(group, resource)
  const { data, setData } = useContextResourceData<T>(capability.activeContexts)
  const fetch = useCallback(
    (contextName: string, namespace: string) =>
      capability.crdsByContext[contextName]
        ? fetchResource(contextName, namespace)
        : Promise.resolve([]),
    [capability.crdsByContext, fetchResource],
  )
  const rowResource = useCallback(
    (row: T, contextName: string): SelectedResource => {
      return buildCustomResourceSelection(
        row,
        contextName,
        capability.crdsByContext,
        kind,
        identity,
        extras,
      )
    },
    [capability.crdsByContext, extras, identity, kind],
  )

  if (capability.supportedContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm">
        {unavailableMessage}
      </div>
    )
  }
  if (capability.pending) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watches for {noun.singular}…
      </div>
    )
  }
  if (capability.readyContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watches for {noun.singular}: {Object.values(capability.errors).join('; ')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <CustomResourcePartialWarning errors={capability.errors} />
      <ResourceTable
        kind={`cr:${group}/${resource}`}
        noun={noun}
        scope={scope}
        data={data}
        setData={setData}
        fetch={fetch}
        columns={columns}
        rowResource={rowResource}
        onRowClick={(row, contextName) => setSelectedResource(rowResource(row, contextName))}
      />
    </div>
  )
}
