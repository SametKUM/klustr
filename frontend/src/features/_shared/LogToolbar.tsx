import { useId, type ReactNode } from 'react'
import { ArrowDownToLine, Circle, Download, Ellipsis, Eraser, Filter, History, Radio, Regex, TextWrap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { LogTerminal } from './useLogTerminal'

type Props = {
  source: ReactNode
  view: Pick<LogTerminal, 'reset' | 'wrap'>
  onSave: () => void
  onToggleWrap: () => void
  filterValue: string
  onFilterChange: (value: string) => void
  useRegex: boolean
  onRegexChange: (value: boolean) => void
  filterError: string | null
  streaming: boolean
  live: boolean
  onLiveChange: (value: boolean) => void
  onJumpToNow: () => void
  previous?: boolean
}

export function LogToolbar({
  source,
  view,
  onSave,
  onToggleWrap,
  filterValue,
  onFilterChange,
  useRegex,
  onRegexChange,
  filterError,
  streaming,
  live,
  onLiveChange,
  onJumpToNow,
  previous = false,
}: Props) {
  const filterId = useId()
  const errorId = `${filterId}-error`
  const following = live && !previous

  return (
    <div className="@container/log-toolbar shrink-0 border-b border-border" data-log-toolbar>
      <div className="grid min-w-0 gap-2 px-4 py-2 text-xs">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2" role="group" aria-label="Log source">
            {source}
          </div>
          <span
            role="status"
            title={previous ? 'Logs from the previous terminated container instance' : undefined}
            className={[
              'inline-flex min-w-14 shrink-0 items-center justify-end gap-1.5 whitespace-nowrap',
              previous ? 'text-primary' : following && streaming ? 'text-emerald-500' : 'text-muted-foreground',
            ].join(' ')}
          >
            {previous ? <History className="size-3" /> : <Circle className={`size-2 ${following && streaming ? 'fill-current' : ''}`} />}
            {previous ? 'previous' : !following ? 'snapshot' : streaming ? 'live' : 'idle'}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <label htmlFor={filterId} className="sr-only">Filter logs</label>
          <InputGroup className="h-7 min-w-0 flex-1 rounded-md" data-log-filter>
            <InputGroupAddon align="inline-start">
              <Filter className="size-3 text-muted-foreground/70" />
            </InputGroupAddon>
            <InputGroupInput
              id={filterId}
              type="text"
              aria-label="Filter logs"
              aria-invalid={!!filterError}
              aria-describedby={filterError ? errorId : undefined}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              value={filterValue}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder={useRegex ? 'Filter logs with regex…' : 'Filter logs…'}
              className="h-full min-w-0 px-1 text-xs placeholder:text-muted-foreground/70 md:text-xs"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                variant={useRegex ? 'secondary' : 'ghost'}
                aria-pressed={useRegex}
                aria-label="Toggle regex mode"
                title="Use a regular expression"
                onClick={() => onRegexChange(!useRegex)}
              >
                <Regex />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {/* The title sits on a wrapper because a disabled button gets no
              pointer events, so it would never show its own tooltip. */}
          <span
            className="inline-flex shrink-0"
            title={
              previous
                ? 'A terminated container instance has no new lines'
                : live
                  ? 'Stop following new lines'
                  : 'Follow new lines as they arrive'
            }
          >
            <Button
              type="button"
              size="sm"
              variant={following ? 'secondary' : 'ghost'}
              className="w-7 px-0 transition-colors @min-[38rem]/log-toolbar:w-16"
              aria-label="Follow live logs"
              aria-pressed={following}
              disabled={previous}
              onClick={() => onLiveChange(!live)}
            >
              <Radio />
              <span className="hidden @min-[38rem]/log-toolbar:inline">Live</span>
            </Button>
          </span>
          {!following && !previous && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-7 px-0 transition-colors @min-[38rem]/log-toolbar:w-28"
              aria-label="Jump to now"
              title="Reload the latest lines"
              onClick={onJumpToNow}
            >
              <ArrowDownToLine />
              <span className="hidden @min-[38rem]/log-toolbar:inline">Jump to now</span>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={view.wrap ? 'secondary' : 'ghost'}
            className="w-7 px-0 transition-colors @min-[38rem]/log-toolbar:w-18"
            aria-pressed={view.wrap}
            aria-label="Wrap long lines"
            title="Wrap long lines — turn off to scroll sideways (Shift+wheel)"
            onClick={onToggleWrap}
          >
            <TextWrap />
            <span className="hidden @min-[38rem]/log-toolbar:inline">Wrap</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="More log actions" title="More log actions">
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Log view</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onSave}>
                <Download />
                Save logs…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => view.reset()}>
                <Eraser />
                Clear view
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {filterError && (
        <div id={errorId} className="border-t border-destructive/40 bg-destructive/10 px-4 py-1 text-xs font-mono text-destructive break-words">
          {filterError}
        </div>
      )}
    </div>
  )
}
