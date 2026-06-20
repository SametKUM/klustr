import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api, type SystemTerminal } from '@/lib/api'
import { useTerminalStore } from '@/store/terminals'
import {
  useActiveContexts,
  useUIStore,
  type ContextTag,
  type CustomTagDef,
} from '@/store/ui'
import { resolveTagMeta } from '@/features/contexts/contextTagMeta'
import { TerminalAppPickerDialog } from './TerminalAppPickerDialog'
import { TerminalTab } from './TerminalTab'

export function TerminalDrawer() {
  const drawerOpen = useTerminalStore((s) => s.drawerOpen)
  const drawerHeight = useTerminalStore((s) => s.drawerHeight)
  const setDrawerHeightLive = useTerminalStore((s) => s.setDrawerHeightLive)
  const persistDrawerHeight = useTerminalStore((s) => s.persistDrawerHeight)
  const setDrawerOpen = useTerminalStore((s) => s.setDrawerOpen)
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const openTab = useTerminalStore((s) => s.openTab)
  const closeTab = useTerminalStore((s) => s.closeTab)
  const setActiveTab = useTerminalStore((s) => s.setActiveTab)

  const preferredAppId = useTerminalStore((s) => s.preferredAppId)

  const activeContexts = useActiveContexts()
  const selectedContext = useUIStore((s) => s.selectedContext)
  const contextTags = useUIStore((s) => s.contextTags)
  const customTags = useUIStore((s) => s.customTags)

  const [externalCtx, setExternalCtx] = useState<string | null>(null)
  const [systemTerminals, setSystemTerminals] = useState<SystemTerminal[]>([])
  useEffect(() => {
    api
      .listSystemTerminals()
      .then((list) => setSystemTerminals(list ?? []))
      .catch(() => setSystemTerminals([]))
  }, [])
  const preferredApp = systemTerminals.find((t) => t.id === preferredAppId) ?? null

  // Click → if a default app is remembered, launch directly and skip the
  // picker. Alt+click forces the picker so the user can change apps
  // without having to clear the default first.
  const handleExternal = useCallback(
    (contextName: string, event: React.MouseEvent) => {
      const pref = useTerminalStore.getState().preferredAppId
      if (pref && !event.altKey) {
        api.openInSystemTerminal(contextName, pref).catch((e) => {
          toast.error('Could not open system terminal', { description: String(e) })
          setExternalCtx(contextName)
        })
        return
      }
      setExternalCtx(contextName)
    },
    [],
  )

  const draggingRef = useRef(false)
  const onMouseDownResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      draggingRef.current = true
      const startY = e.clientY
      const startHeight = drawerHeight
      const onMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return
        const delta = startY - ev.clientY
        // In-memory only during the drag; persist once on mouseup.
        setDrawerHeightLive(startHeight + delta)
      }
      const onUp = () => {
        draggingRef.current = false
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        persistDrawerHeight()
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [drawerHeight, setDrawerHeightLive, persistDrawerHeight],
  )

  // Auto-create the first tab when the drawer is opened with the active
  // single context — saves a needless click on the empty state.
  useEffect(() => {
    if (!drawerOpen) return
    if (tabs.length > 0) return
    if (activeContexts.length === 1) {
      openTab(activeContexts[0])
    }
  }, [drawerOpen, tabs.length, activeContexts, openTab])

  if (!drawerOpen) return null

  const addPickerContexts = activeContexts.length > 0 ? activeContexts : selectedContext ? [selectedContext] : []

  const handleAdd = () => {
    if (addPickerContexts.length === 1) {
      openTab(addPickerContexts[0])
    }
  }


  return (
    <div
      className="flex shrink-0 flex-col border-t border-border bg-card"
      style={{ height: drawerHeight }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        title="Drag to resize"
        onMouseDown={onMouseDownResize}
        className="-mt-px h-1 cursor-row-resize bg-transparent hover:bg-primary/40"
      />
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-1">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <TabPill
              key={tab.tabId}
              contextName={tab.contextName}
              active={tab.tabId === activeTabId}
              tags={contextTags[tab.contextName] ?? []}
              customTags={customTags}
              preferredAppName={preferredApp?.name ?? null}
              onSelect={() => setActiveTab(tab.tabId)}
              onClose={() => closeTab(tab.tabId)}
              onOpenExternal={(e) => handleExternal(tab.contextName, e)}
            />
          ))}
          {addPickerContexts.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="ml-1 shrink-0"
                  aria-label="New terminal"
                  title="New terminal"
                >
                  <Plus />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {addPickerContexts.map((ctx) => (
                  <DropdownMenuItem key={ctx} onSelect={() => openTab(ctx)}>
                    <span className="font-mono text-xs">{ctx}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="ml-1 shrink-0"
              aria-label="New terminal"
              title="New terminal"
              onClick={handleAdd}
              disabled={addPickerContexts.length === 0}
            >
              <Plus />
            </Button>
          )}
        </div>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Close terminal panel"
          title="Hide terminal panel (Cmd/Ctrl+`)"
          onClick={() => setDrawerOpen(false)}
        >
          <X />
        </Button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {tabs.length === 0 ? (
          <EmptyState
            contexts={addPickerContexts}
            onPick={(ctx) => openTab(ctx)}
          />
        ) : (
          tabs.map((tab) => (
            <TerminalTab
              key={tab.tabId}
              tabId={tab.tabId}
              contextName={tab.contextName}
              active={tab.tabId === activeTabId}
            />
          ))
        )}
      </div>

      <TerminalAppPickerDialog
        open={externalCtx !== null}
        description={
          externalCtx ? (
            <>
              Launch a terminal app outside Klustr with{' '}
              <span className="font-mono text-foreground">{externalCtx}</span> already
              selected.
            </>
          ) : undefined
        }
        onClose={() => setExternalCtx(null)}
        onLaunch={(appID) =>
          externalCtx ? api.openInSystemTerminal(externalCtx, appID) : Promise.resolve()
        }
      />
    </div>
  )
}

type PillProps = {
  contextName: string
  active: boolean
  tags: ContextTag[]
  customTags: Record<string, CustomTagDef>
  preferredAppName: string | null
  onSelect: () => void
  onClose: () => void
  onOpenExternal: (event: React.MouseEvent) => void
}

function TabPill({
  contextName,
  active,
  tags,
  customTags,
  preferredAppName,
  onSelect,
  onClose,
  onOpenExternal,
}: PillProps) {
  const primary = tags[0]
  const meta = primary ? resolveTagMeta(primary, customTags) : null
  const dotClass = meta?.dotClass ?? null
  return (
    <div
      className={`group flex h-7 items-center gap-1.5 rounded border px-2 text-xs transition ${
        active
          ? 'border-border bg-background text-foreground shadow-sm'
          : 'border-transparent text-muted-foreground hover:bg-muted/50'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 items-center gap-1.5 outline-none"
      >
        {dotClass && <span className={`size-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />}
        <span className="max-w-[200px] truncate font-mono">{contextName}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close tab"
        title="Close tab"
        className="ml-0.5 flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-60 transition hover:bg-muted hover:text-foreground hover:opacity-100"
      >
        <X className="size-3" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onOpenExternal(e)
        }}
        aria-label="Open in system terminal"
        title={
          preferredAppName
            ? `Open in ${preferredAppName} (Alt+click to choose another app)`
            : 'Open in system terminal'
        }
        className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-60 transition hover:bg-muted hover:text-foreground hover:opacity-100"
      >
        <ExternalLink className="size-3" />
      </button>
    </div>
  )
}

function EmptyState({ contexts, onPick }: { contexts: string[]; onPick: (ctx: string) => void }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
      {contexts.length === 0 ? (
        <span>Connect to a context to open a terminal.</span>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <span>Open a terminal pinned to a context:</span>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {contexts.map((ctx) => (
              <button
                key={ctx}
                type="button"
                onClick={() => onPick(ctx)}
                className="rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground transition hover:bg-muted"
              >
                {ctx}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

