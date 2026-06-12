import { useUIStore } from '@/store/ui'

export function NodeLink({ name, context }: { name: string; context?: string | null }) {
  const openResource = useUIStore((s) => s.openResource)
  if (!name) return <span className="text-muted-foreground">—</span>
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openResource({ kind: 'Node', namespace: '', name, context: context ?? undefined })
      }}
      className="cursor-pointer text-left hover:underline"
    >
      {name}
    </button>
  )
}
