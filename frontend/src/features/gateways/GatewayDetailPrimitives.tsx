import type { ParentRefDetail } from '@/lib/api'
import { useUIStore } from '@/store/ui'
import { Copyable } from '@/features/_shared/Copyable'
import { Td, Th } from '@/features/_shared/DetailPrimitives'
import { gatewayReferenceLabel, gatewayReferenceResource, type GatewayReference } from './gatewayReferences'

export function GatewayReferenceLink({ reference, namespace, contextName }: {
  reference: GatewayReference
  namespace: string
  contextName: string | null
}) {
  const openResource = useUIStore((state) => state.openResource)
  const target = gatewayReferenceResource(reference, namespace, contextName)
  const label = gatewayReferenceLabel(reference, namespace)
  return (
    <Copyable value={label}>
      {target ? (
        <button
          type="button"
          className="min-h-6 cursor-pointer rounded text-left text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => openResource(target)}
          title={`Open ${reference.kind} ${target.namespace}/${target.name}`}
        >
          {label}
        </button>
      ) : label}
    </Copyable>
  )
}

export function GatewayReferences({ references, namespace, contextName }: {
  references: ParentRefDetail[]
  namespace: string
  contextName: string | null
}) {
  if (references.length === 0) {
    return <p className="text-xs text-muted-foreground">No references configured.</p>
  }
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr><Th>Group / kind</Th><Th>Name</Th><Th>Section</Th><Th>Port</Th></tr>
        </thead>
        <tbody>
          {references.map((reference, index) => (
            <tr key={index} className="border-t border-border">
              <Td className="font-mono">{reference.group || 'core'} / {reference.kind}</Td>
              <Td className="font-mono"><GatewayReferenceLink reference={reference} namespace={namespace} contextName={contextName} /></Td>
              <Td className="font-mono">{reference.sectionName || '—'}</Td>
              <Td className="text-right font-mono tabular-nums">{reference.port || '—'}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
