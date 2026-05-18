import { useEffect, useRef, useState } from 'react'
import { Check, Plus, Tag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useUIStore, MAX_TAGS_PER_CONTEXT } from '@/store/ui'

const EMPTY_TAG_LIST: readonly string[] = Object.freeze([])
import {
  BUILT_IN_TAGS,
  BUILT_IN_TAG_ORDER,
  COLOR_PALETTE,
  TAG_COLOR_ORDER,
  type TagColor,
  deriveShortLabel,
  makeTagSlug,
  resolveTagMeta,
} from './contextTagMeta'

function NewTagForm({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void
  onCancel: () => void
}) {
  const customTags = useUIStore((s) => s.customTags)
  const addCustomTag = useUIStore((s) => s.addCustomTag)
  const [label, setLabel] = useState('')
  const [color, setColor] = useState<TagColor>('blue')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const trimmed = label.trim()
  const canSave = trimmed.length > 0

  const handleSave = () => {
    if (!canSave) return
    const existing = new Set<string>([
      ...Object.keys(BUILT_IN_TAGS),
      ...Object.keys(customTags),
    ])
    const id = makeTagSlug(trimmed, existing)
    addCustomTag({
      id,
      label: trimmed,
      shortLabel: deriveShortLabel(trimmed),
      color,
    })
    onCreated(id)
  }

  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      <Input
        ref={inputRef}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleSave()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        placeholder="Tag name"
        className="h-7 text-xs"
        maxLength={32}
      />
      <div className="flex flex-wrap gap-1.5">
        {TAG_COLOR_ORDER.map((c) => {
          const isSelected = c === color
          return (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              className={`flex size-5 items-center justify-center rounded-full ${COLOR_PALETTE[c].dotClass} ${isSelected ? 'ring-2 ring-offset-1 ring-offset-popover ring-foreground/50' : ''}`}
            >
              {isSelected && <Check className="size-3 text-white" />}
            </button>
          )
        })}
      </div>
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={handleSave}
          disabled={!canSave}
        >
          Save
        </Button>
      </div>
    </div>
  )
}

export function ContextTagMenuContent({
  contextName,
  onClose,
}: {
  contextName: string
  onClose: () => void
}) {
  const customTags = useUIStore((s) => s.customTags)
  const contextTagsMap = useUIStore((s) => s.contextTags)
  const selectedTags = contextTagsMap[contextName] ?? EMPTY_TAG_LIST
  const toggleContextTag = useUIStore((s) => s.toggleContextTag)
  const clearContextTags = useUIStore((s) => s.clearContextTags)
  const removeCustomTag = useUIStore((s) => s.removeCustomTag)
  const [creating, setCreating] = useState(false)

  const customIds = Object.keys(customTags).sort((a, b) =>
    customTags[a].label.localeCompare(customTags[b].label),
  )

  const selectedSet = new Set(selectedTags)
  const atLimit = selectedTags.length >= MAX_TAGS_PER_CONTEXT

  if (creating) {
    return (
      <NewTagForm
        onCreated={(id) => {
          if (!selectedSet.has(id) && !atLimit) {
            toggleContextTag(contextName, id)
          }
          onClose()
        }}
        onCancel={() => setCreating(false)}
      />
    )
  }

  const renderToggleRow = (id: string, label: string, dotClass: string) => {
    const isSelected = selectedSet.has(id)
    const disabled = !isSelected && atLimit
    return (
      <button
        type="button"
        disabled={disabled}
        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${disabled ? 'opacity-40' : 'hover:bg-accent'}`}
        onClick={() => toggleContextTag(contextName, id)}
      >
        <span className="flex size-3.5 shrink-0 items-center justify-center">
          {isSelected ? (
            <Check className="size-3.5 text-foreground" />
          ) : (
            <span className={`inline-block size-2 rounded-full ${dotClass}`} />
          )}
        </span>
        <span className="truncate">{label}</span>
      </button>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Tags</span>
        <span>
          {selectedTags.length}/{MAX_TAGS_PER_CONTEXT}
        </span>
      </div>
      <button
        type="button"
        disabled={selectedTags.length === 0}
        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${selectedTags.length === 0 ? 'opacity-40' : 'hover:bg-accent'}`}
        onClick={() => {
          clearContextTags(contextName)
          onClose()
        }}
      >
        <span className="flex size-3.5 shrink-0 items-center justify-center">
          <span className="inline-block size-2 rounded-full border border-muted-foreground/40" />
        </span>
        Clear all
      </button>
      {BUILT_IN_TAG_ORDER.map((id) => {
        const m = BUILT_IN_TAGS[id]
        return <div key={id}>{renderToggleRow(id, m.label, m.dotClass)}</div>
      })}
      {customIds.length > 0 && <div className="my-1 h-px bg-border" />}
      {customIds.map((id) => {
        const m = resolveTagMeta(id, customTags)
        if (!m) return null
        const isSelected = selectedSet.has(id)
        const disabled = !isSelected && atLimit
        return (
          <div key={id} className="group/tag flex items-center rounded hover:bg-accent">
            <button
              type="button"
              disabled={disabled}
              className={`flex flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm ${disabled ? 'opacity-40' : ''}`}
              onClick={() => toggleContextTag(contextName, id)}
            >
              <span className="flex size-3.5 shrink-0 items-center justify-center">
                {isSelected ? (
                  <Check className="size-3.5 text-foreground" />
                ) : (
                  <span className={`inline-block size-2 rounded-full ${m.dotClass}`} />
                )}
              </span>
              <span className="truncate">{m.label}</span>
            </button>
            <button
              type="button"
              aria-label={`Delete tag ${m.label}`}
              className="mr-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/tag:opacity-100 focus-visible:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                removeCustomTag(id)
              }}
            >
              <X className="size-3" />
            </button>
          </div>
        )
      })}
      <div className="my-1 h-px bg-border" />
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={() => setCreating(true)}
      >
        <Plus className="size-3.5" />
        New tag…
      </button>
    </>
  )
}

export function ContextTagPicker() {
  const [open, setOpen] = useState(false)
  const selectedContext = useUIStore((s) => s.selectedContext)
  const customTags = useUIStore((s) => s.customTags)
  const contextTagsMap = useUIStore((s) => s.contextTags)

  if (!selectedContext) return null

  const tagIds = contextTagsMap[selectedContext] ?? EMPTY_TAG_LIST

  const metas = tagIds
    .map((id) => resolveTagMeta(id, customTags))
    .filter((m): m is NonNullable<ReturnType<typeof resolveTagMeta>> => m !== null)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={metas.length === 0 ? 'text-muted-foreground' : 'gap-1.5 px-2'}
          aria-label={
            metas.length > 0
              ? `Context tags: ${metas.map((m) => m.label).join(', ')}`
              : 'Tag context'
          }
        >
          {metas.length === 0 ? (
            <Tag className="size-3.5" />
          ) : (
            metas.map((m) => (
              <span
                key={m.id}
                className={`rounded border px-1 py-px text-[10px] font-semibold tracking-wider ${m.badgeClass}`}
              >
                {m.shortLabel}
              </span>
            ))
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1">
        <ContextTagMenuContent contextName={selectedContext} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
