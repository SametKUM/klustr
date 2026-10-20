import { useUIStore } from '@/store/ui'

export function NodeLink({ name, context }: { name: string; context?: string | null }) {
  const openResource = useUIStore((s) => s.openResource)
  const openResourceFromList = useUIStore((s) => s.openResourceFromList)
  if (!name) return <span className="text-muted-foreground">—</span>
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        // A list cell opens the node as a list open, starting a new history,
        // as in CustomResourceReference.
        const open = e.currentTarget.closest('[data-resource-list]') ? openResourceFromList : openResource
        open({ kind: 'Node', namespace: '', name, context: context ?? undefined })
      }}
      className="cursor-pointer text-left hover:underline"
    >
      {name}
    </button>
  )
}
