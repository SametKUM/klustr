import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type SecretInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<SecretInfo>()

function shortenSecretType(t: string): string {
  const slash = t.indexOf('/')
  return slash >= 0 ? t.slice(slash + 1) : t
}

export function SecretsView() {
  const secrets = useResources((s) => s.secrets)
  const setSecrets = useResources((s) => s.setSecrets)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace' }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('type', {
        header: 'Type',
        cell: (info) => <span className="font-mono text-xs">{shortenSecretType(info.getValue())}</span>,
      }),
      columnHelper.accessor('keys', { header: 'Keys' }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )

  return (
    <ResourceTable
      kind="Secret"
      noun={{ singular: 'secret', plural: 'secrets' }}
      scope="namespaced"
      data={secrets}
      setData={setSecrets}
      fetch={api.listSecrets}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'Secret', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
