import { useContext } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sameResource, type SelectedResource } from '@/store/ui'
import { ResourceNavigationContext } from './resourceNavigation'

export function ResourceListNavigator({ resource }: { resource: SelectedResource }) {
  const navigation = useContext(ResourceNavigationContext)
  if (!navigation || !sameResource(navigation.resource, resource)) return null

  return (
    <div role="group" aria-label="Browse filtered resources" className="flex items-center gap-0.5">
      <Button
        size="icon"
        variant="ghost"
        className="size-6"
        aria-label="Previous resource"
        aria-keyshortcuts="Alt+ArrowUp"
        title="Previous resource (Alt+↑)"
        disabled={!navigation.previous}
        onClick={() => navigation.previous?.()}
      >
        <ChevronUp className="size-3.5" />
      </Button>
      <span
        aria-live="polite"
        aria-atomic="true"
        className="min-w-12 text-center text-xs tabular-nums text-muted-foreground"
      >
        {navigation.index + 1} of {navigation.total}
      </span>
      <Button
        size="icon"
        variant="ghost"
        className="size-6"
        aria-label="Next resource"
        aria-keyshortcuts="Alt+ArrowDown"
        title="Next resource (Alt+↓)"
        disabled={!navigation.next}
        onClick={() => navigation.next?.()}
      >
        <ChevronDown className="size-3.5" />
      </Button>
    </div>
  )
}
