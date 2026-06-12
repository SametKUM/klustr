import { useCallback, useEffect, useState } from 'react'
import { type NodeInfo } from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import { formatAge } from '@/lib/time'
import { useUIStore } from '@/store/ui'
import { ErrorBox, Section, Td, Th } from '@/features/_shared/DetailPrimitives'

function nodeStatusClass(status: string): string {
  if (status.startsWith('Ready')) {
    return status.includes('SchedulingDisabled')
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400'
  }
  if (status.startsWith('NotReady')) return 'text-destructive'
  return 'text-muted-foreground'
}

type Props = {
  contextName: string | null
  name: string
  load: (contextName: string, name: string) => Promise<NodeInfo[]>
  title: string
  emptyMessage: string
}

export function KarpenterNodesTab({ contextName, name, load, title, emptyMessage }: Props) {
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const openResource = useUIStore((s) => s.openResource)

  const refresh = useCallback(async () => {
    if (!contextName) {
      setNodes([])
      return
    }
    try {
      const list = await load(contextName, name)
      setNodes(list ?? [])
      setError(null)
    } catch (err) {
      setError(String(err))
    }
  }, [contextName, name, load])

  useEffect(() => {
    refresh()
    if (!contextName) return
    return onKubeChange('Node', (ctx) => {
      if (ctx === contextName) refresh()
    })
  }, [refresh, contextName])

  return (
    <div className="px-6 py-4">
      <Section title={`${title} (${nodes.length})`}>
        {error && <ErrorBox>{error}</ErrorBox>}
        {!error && nodes.length === 0 && (
          <div className="py-3 text-xs text-muted-foreground">{emptyMessage}</div>
        )}
        {nodes.length > 0 && (
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Name</Th>
                  <Th>Status</Th>
                  <Th>Instance</Th>
                  <Th>Capacity</Th>
                  <Th>Version</Th>
                  <Th>Age</Th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <tr
                    key={n.name}
                    className="cursor-pointer border-t border-border align-top hover:bg-muted/40"
                    onClick={() =>
                      openResource({
                        kind: 'Node',
                        namespace: '',
                        name: n.name,
                        context: contextName ?? undefined,
                      })
                    }
                  >
                    <Td className="font-mono">{n.name}</Td>
                    <Td className={nodeStatusClass(n.status)}>{n.status}</Td>
                    <Td className="font-mono text-muted-foreground">{n.instanceType || '—'}</Td>
                    <Td
                      className={
                        n.capacityType === 'spot'
                          ? 'text-amber-600 dark:text-amber-400'
                          : n.capacityType
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-muted-foreground'
                      }
                    >
                      {n.capacityType || '—'}
                    </Td>
                    <Td className="text-muted-foreground">{n.version}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {formatAge(n.createdAt)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
