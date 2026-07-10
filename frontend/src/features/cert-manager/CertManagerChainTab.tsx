import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { ErrorBox, Th, Td } from '@/features/_shared/DetailPrimitives'
import { useCRDStore } from '@/store/crds'
import { useUIStore } from '@/store/ui'

type ChainRow = { name: string; namespace: string }

type Props<T extends ChainRow> = {
  contextName: string | null
  parentNamespace: string
  parentName: string
  // childGroup/childResource identify the CR one step down the issuance chain;
  // they drive the CRD lookup (for the served version + gvr) and the on-demand
  // watch. childKind is what a row click opens in a nested detail dialog.
  childGroup: string
  childResource: string
  childKind: string
  headers: string[]
  load: (contextName: string, namespace: string, parentName: string) => Promise<T[]>
  renderCells: (row: T) => ReactNode[]
  absentLabel: string
  emptyLabel: string
}

export function CertManagerChainTab<T extends ChainRow>({
  contextName,
  parentNamespace,
  parentName,
  childGroup,
  childResource,
  childKind,
  headers,
  load,
  renderCells,
  absentLabel,
  emptyLabel,
}: Props<T>) {
  const openResource = useUIStore((s) => s.openResource)
  const crd = useCRDStore(
    (s) => s.crds.find((c) => c.group === childGroup && c.resource === childResource) ?? null,
  )

  const [rows, setRows] = useState<T[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!contextName || !crd) return
    setLoading(true)
    setError(null)
    try {
      await api.ensureCustomResourceWatch(contextName, crd.group, crd.version, crd.resource)
      const list = await load(contextName, parentNamespace, parentName)
      setRows(list ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [contextName, crd, load, parentNamespace, parentName])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial load belongs to this resource lifecycle.
    refresh()
  }, [refresh])

  if (!crd) {
    return <div className="px-6 py-8 text-center text-xs text-muted-foreground">{absentLabel}</div>
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-2">
        <div className="text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${rows?.length ?? 0} ${childKind}${rows?.length === 1 ? '' : 's'}`}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={refresh}
          disabled={loading}
          className="h-7 gap-1.5 text-xs"
        >
          <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        {!error && rows && rows.length === 0 && !loading && (
          <div className="py-8 text-center text-xs text-muted-foreground">{emptyLabel}</div>
        )}
        {rows && rows.length > 0 && (
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  {headers.map((h) => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.namespace}/${row.name}`}
                    className="cursor-pointer border-t border-border align-top hover:bg-muted/30"
                    onClick={() =>
                      openResource({
                        kind: childKind,
                        namespace: row.namespace,
                        name: row.name,
                        context: contextName ?? undefined,
                        gvr: { group: crd.group, version: crd.version, resource: crd.resource },
                      })
                    }
                  >
                    {renderCells(row).map((cell, idx) => (
                      <Td key={idx}>{cell}</Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
