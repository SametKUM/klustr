import { useUIStore } from '@/store/ui'

export function ServiceAccountLink({
  namespace,
  name,
  context,
}: {
  namespace: string
  name: string
  context?: string | null
}) {
  const openResource = useUIStore((s) => s.openResource)
  if (!name) return <span className="text-muted-foreground">—</span>
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openResource({ kind: 'ServiceAccount', namespace, name, context: context ?? undefined })
      }}
      className="cursor-pointer text-left hover:underline"
    >
      {name}
    </button>
  )
}
