import { useId, type ReactNode } from 'react'
import { Circle, Download, Ellipsis, Eraser, Filter, History, Pause, Play, Regex, TextWrap } from 'lucide-react'
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
  view: Pick<LogTerminal, 'paused' | 'pending' | 'setPaused' | 'reset' | 'wrap'>
  onSave: () => void
  onToggleWrap: () => void
  filterValue: string
  onFilterChange: (value: string) => void
  useRegex: boolean
  onRegexChange: (value: boolean) => void
  filterError: string | null
  streaming: boolean
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
  previous = false,
}: Props) {
  const filterId = useId()
  const errorId = `${filterId}-error`
  const pauseLabel = view.paused ? 'Resume logs' : 'Pause logs'
  const pauseDescription = view.paused && view.pending > 0
    ? `Resume logs (${view.pending.toLocaleString('en-US')} buffered lines)`
    : pauseLabel

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
              view.paused ? 'text-amber-500' : previous ? 'text-primary' : streaming ? 'text-emerald-500' : 'text-muted-foreground',
            ].join(' ')}
          >
            {view.paused && view.pending > 0 && (
              <span aria-hidden="true" className="text-muted-foreground tabular-nums" title={`${view.pending.toLocaleString('en-US')} buffered lines`}>
                +{view.pending.toLocaleString('en-US')}
              </span>
            )}
            {view.paused ? <Pause className="size-3" /> : previous ? <History className="size-3" /> : <Circle className={`size-2 ${streaming ? 'fill-current' : ''}`} />}
            {view.paused ? 'paused' : previous ? 'previous' : streaming ? 'live' : 'idle'}
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-7 px-0 transition-colors @min-[38rem]/log-toolbar:w-22"
            aria-label={pauseLabel}
            title={pauseDescription}
            onClick={() => view.setPaused(!view.paused)}
          >
            {view.paused ? <Play /> : <Pause />}
            <span className="hidden @min-[38rem]/log-toolbar:inline">{view.paused ? 'Resume' : 'Pause'}</span>
          </Button>
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
