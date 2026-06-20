import { useState } from 'react'
import { Columns3, GripVertical, RotateCcw } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import type { Column, Table } from '@tanstack/react-table'

type Props<T> = {
  table: Table<T>
  onReset: () => void
}

export function ColumnControls<T>({ table, onReset }: Props<T>) {
  const orderedColumns = table.getAllLeafColumns()
  const visibleLeafCount = table.getVisibleLeafColumns().length
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = orderedColumns.map((c) => c.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    const next = ids.slice()
    next.splice(from, 1)
    next.splice(to, 0, dragId)
    table.setColumnOrder(next)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs">
          <Columns3 className="size-3" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
          <span className="font-medium">Columns</span>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            Reset
          </button>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {orderedColumns.map((col) => {
            const label = labelFor(col)
            const isOver = overId === col.id && dragId !== null && dragId !== col.id
            const dragging = dragId === col.id
            // Block unchecking the last visible column (an all-hidden table is
            // confusing) and honor enableHiding so identity columns can be pinned.
            const toggleDisabled =
              !col.getCanHide() || (col.getIsVisible() && visibleLeafCount <= 1)
            return (
              <li
                key={col.id}
                draggable
                onDragStart={(e) => {
                  setDragId(col.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  if (!dragId) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (overId !== col.id) setOverId(col.id)
                }}
                onDragLeave={() => {
                  if (overId === col.id) setOverId(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  drop(col.id)
                  setDragId(null)
                  setOverId(null)
                }}
                onDragEnd={() => {
                  setDragId(null)
                  setOverId(null)
                }}
                className={[
                  'flex items-center gap-2 px-2 py-1 text-xs',
                  isOver ? 'border-t-2 border-primary' : 'border-t-2 border-transparent',
                  dragging ? 'opacity-40' : 'hover:bg-muted/40',
                ].join(' ')}
              >
                <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
                <input
                  type="checkbox"
                  disabled={toggleDisabled}
                  title={
                    col.getIsVisible() && visibleLeafCount <= 1
                      ? 'At least one column must stay visible'
                      : undefined
                  }
                  className={`size-3.5 accent-foreground ${toggleDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  checked={col.getIsVisible()}
                  onChange={() => {
                    if (!toggleDisabled) col.toggleVisibility()
                  }}
                />
                <span className="flex-1 truncate">{label}</span>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function labelFor<T>(col: Column<T, unknown>): string {
  const h = col.columnDef.header
  if (typeof h === 'string') return h
  return col.id
}
