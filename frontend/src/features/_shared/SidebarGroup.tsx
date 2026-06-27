import { Fragment, type Ref } from 'react'
import { ChevronRight, EyeOff } from 'lucide-react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import type { ResourceGroup } from '@/features/_shared/resourceGroups'
import type { ResourceView, SidebarMode } from '@/store/ui'

type Props = {
  group: ResourceGroup
  mode: SidebarMode
  collapsed: boolean
  onToggleCollapse: () => void
  selectedView: ResourceView
  selectedCRDKey: string | null
  onSelectView: (view: ResourceView) => void
  onHideItem?: (view: ResourceView) => void
  activeItemRef?: Ref<HTMLLIElement>
}

export function SidebarGroup({
  group,
  mode,
  collapsed,
  onToggleCollapse,
  selectedView,
  selectedCRDKey,
  onSelectView,
  onHideItem,
  activeItemRef,
}: Props) {
  if (mode === 'icons') {
    const GroupIcon = group.icon
    const containsActive = group.items.some(
      (item) =>
        item.view !== undefined && item.view === selectedView && selectedCRDKey === null,
    )
    return (
      <HoverCard openDelay={80} closeDelay={120}>
        <HoverCardTrigger asChild>
          <button
            ref={containsActive ? (activeItemRef as Ref<HTMLButtonElement>) : undefined}
            type="button"
            aria-label={group.label}
            className={[
              'relative flex size-8 items-center justify-center rounded transition-colors',
              containsActive
                ? 'bg-sidebar-accent text-primary'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            ].join(' ')}
          >
            {containsActive && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
              />
            )}
            {GroupIcon ? <GroupIcon className="size-4" aria-hidden /> : null}
          </button>
        </HoverCardTrigger>
        <HoverCardContent side="right" sideOffset={6} align="start" className="min-w-44 p-1">
          <div className="px-2 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </div>
          <ul className="flex flex-col">
            {group.items.map((item) => {
              const Icon = item.icon
              const enabled = item.view !== undefined
              const active =
                item.view !== undefined &&
                item.view === selectedView &&
                selectedCRDKey === null
              return (
                <li
                  key={item.label}
                  aria-disabled={!enabled}
                  onClick={() => {
                    if (item.view) onSelectView(item.view)
                  }}
                  className={[
                    'group/sidebar-item flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors',
                    enabled
                      ? 'cursor-pointer text-popover-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      : 'cursor-default text-muted-foreground/60',
                    active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : '',
                  ].join(' ')}
                >
                  {Icon ? (
                    <Icon
                      className={`size-4 shrink-0 ${enabled ? '' : 'opacity-50'}`}
                      aria-hidden
                    />
                  ) : null}
                  <span className="flex-1 truncate">{item.label}</span>
                  {onHideItem && item.view && (
                    <button
                      type="button"
                      aria-label={`Hide ${item.label} from sidebar`}
                      title="Hide from sidebar"
                      onClick={(e) => {
                        e.stopPropagation()
                        onHideItem(item.view!)
                      }}
                      className="ml-auto flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover/sidebar-item:opacity-100"
                    >
                      <EyeOff className="size-3" aria-hidden />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </HoverCardContent>
      </HoverCard>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-1 px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-sidebar-foreground"
      >
        <ChevronRight
          className={`size-3 shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`}
        />
        <span>{group.label}</span>
      </button>
      {!collapsed && (
        <ul className="flex flex-col">
          {group.items.map((item) => {
            const Icon = item.icon
            const enabled = item.view !== undefined
            const active =
              item.view !== undefined && item.view === selectedView && selectedCRDKey === null
            const row = (
              <li
                ref={active ? activeItemRef : undefined}
                aria-disabled={!enabled}
                className={[
                  'group/sidebar-item flex items-center gap-2 rounded border-l-2 pl-2 pr-1 py-1 text-sm transition-colors',
                  enabled
                    ? 'cursor-pointer text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    : 'cursor-default text-muted-foreground/60',
                  active
                    ? 'border-primary bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'border-transparent',
                ].join(' ')}
                onClick={() => {
                  if (item.view) onSelectView(item.view)
                }}
              >
                {Icon ? (
                  <Icon
                    className={`size-4 shrink-0 ${enabled ? '' : 'opacity-50'}`}
                    aria-hidden
                  />
                ) : null}
                <span className="flex-1 truncate">{item.label}</span>
                {onHideItem && item.view && (
                  <button
                    type="button"
                    aria-label={`Hide ${item.label} from sidebar`}
                    title="Hide from sidebar"
                    onClick={(e) => {
                      e.stopPropagation()
                      onHideItem(item.view!)
                    }}
                    className="ml-auto flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover/sidebar-item:opacity-100"
                  >
                    <EyeOff className="size-3" aria-hidden />
                  </button>
                )}
              </li>
            )
            if (!onHideItem || !item.view) return <Fragment key={item.label}>{row}</Fragment>
            const view = item.view
            return (
              <ContextMenu key={item.label}>
                <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => onHideItem(view)}>
                    <EyeOff className="size-3.5" aria-hidden />
                    Hide from sidebar
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </ul>
      )}
    </div>
  )
}
