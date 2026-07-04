import { useMemo, useState } from 'react'
import { EyeOff, Plus } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ALL_SIDEBAR_GROUPS, type NavItem } from '@/features/_shared/resourceGroups'
import type { ResourceView, SidebarMode } from '@/store/ui'

type Props = {
  hiddenItems: ResourceView[]
  mode: SidebarMode
  onShowItem: (view: ResourceView) => void
  onClearAll: () => void
}

// Lookup runs over every group klustr ever renders. We don't try to honour
// the conditional-group gates (Gateway/Argo/Karpenter/…) here — if the user
// hid `gateways` in a cluster that had Gateway API and later switched to
// one that doesn't, the entry should still surface so they can restore it.
const ITEMS_BY_VIEW = new Map<string, NavItem>(
  ALL_SIDEBAR_GROUPS.flatMap((g) => g.items)
    .filter((i) => i.view !== undefined)
    .map((i) => [i.view as string, i]),
)

export function HiddenSidebarItemsButton({ hiddenItems, mode, onShowItem, onClearAll }: Props) {
  const [open, setOpen] = useState(false)

  const items = useMemo(() => {
    const out: NavItem[] = []
    for (const view of hiddenItems) {
      const found = ITEMS_BY_VIEW.get(view)
      if (found) out.push(found)
    }
    return out
  }, [hiddenItems])

  if (items.length === 0) return null

  const count = items.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Show ${count} hidden sidebar items`}
          className={
            mode === 'icons'
              ? 'relative flex size-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              : 'flex w-full items-center gap-2 rounded px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          }
        >
          <EyeOff className="size-3.5 shrink-0" aria-hidden />
          {mode === 'icons' ? (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground"
            >
              {count}
            </span>
          ) : (
            <span className="truncate">
              {count} hidden item{count === 1 ? '' : 's'}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={6}
        className="w-64 p-1"
      >
        <div className="flex items-center justify-between px-2 pb-1 pt-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Hidden items
          </span>
          <button
            type="button"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              onClearAll()
              setOpen(false)
            }}
          >
            Restore all
          </button>
        </div>
        <ul className="flex flex-col">
          {items.map((item) => {
            const Icon = item.icon
            const view = item.view
            if (!view) return null
            return (
              <li key={view}>
                <button
                  type="button"
                  onClick={() => {
                    onShowItem(view)
                    if (items.length === 1) setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm text-popover-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  {Icon ? <Icon className="size-4 shrink-0 opacity-70" aria-hidden /> : null}
                  <span className="flex-1 truncate">{item.label}</span>
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
