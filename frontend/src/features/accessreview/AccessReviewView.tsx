import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ScanSearch, ShieldAlert, Sparkles, User as UserIcon, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, type AccessSubject, type SubjectAccess, type SubjectAccessRule } from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import { useActiveContexts, useIsAggregated } from '@/store/ui'

const VERB_COLUMNS = [
  'get',
  'list',
  'watch',
  'create',
  'update',
  'patch',
  'delete',
  'deletecollection',
] as const

type Verb = (typeof VERB_COLUMNS)[number]

type EffectiveCell = {
  granted: boolean
  wildcard: boolean
  resourceNames: string[]
  sources: SubjectAccessRule[]
}

type MatrixRow = {
  scope: string
  apiGroup: string
  resource: string
  cells: Record<Verb, EffectiveCell>
}

export function AccessReviewView() {
  const activeContexts = useActiveContexts()
  const isAggregated = useIsAggregated()
  const [subject, setSubject] = useState<AccessSubject | null>(null)
  const [subjects, setSubjects] = useState<Record<string, AccessSubject[]>>({})
  const [access, setAccess] = useState<Record<string, SubjectAccess | null>>({})
  const ctxKey = activeContexts.join('|')

  useEffect(() => {
    if (activeContexts.length === 0) return
    let cancelled = false
    const reload = (ctx: string) => {
      api
        .listAccessSubjects(ctx)
        .then((list) => {
          if (!cancelled) setSubjects((prev) => ({ ...prev, [ctx]: list ?? [] }))
        })
        .catch(() => {
          if (!cancelled) setSubjects((prev) => ({ ...prev, [ctx]: [] }))
        })
    }
    for (const ctx of activeContexts) reload(ctx)
    const unsubs = ['ServiceAccount', 'RoleBinding', 'ClusterRoleBinding'].map((k) =>
      onKubeChange(k, (ctx) => {
        if (activeContexts.includes(ctx)) reload(ctx)
      }),
    )
    return () => {
      cancelled = true
      unsubs.forEach((u) => u())
    }
  }, [ctxKey, activeContexts])

  const subjectOptions = useMemo<AccessSubject[]>(() => {
    const seen = new Map<string, AccessSubject>()
    for (const ctx of activeContexts) {
      for (const s of subjects[ctx] ?? []) {
        seen.set(subjectKey(s), s)
      }
    }
    return Array.from(seen.values()).sort(compareSubject)
  }, [subjects, activeContexts])

  useEffect(() => {
    if (!subject || activeContexts.length === 0) {
      setAccess({})
      return
    }
    let cancelled = false
    const reload = (ctx: string) => {
      api
        .getSubjectAccess(ctx, subject.kind, subject.namespace ?? '', subject.name)
        .then((res) => {
          if (!cancelled) setAccess((prev) => ({ ...prev, [ctx]: res }))
        })
        .catch(() => {
          if (!cancelled) setAccess((prev) => ({ ...prev, [ctx]: null }))
        })
    }
    setAccess({})
    for (const ctx of activeContexts) reload(ctx)
    const unsubs = ['Role', 'RoleBinding', 'ClusterRole', 'ClusterRoleBinding'].map((k) =>
      onKubeChange(k, (ctx) => {
        if (activeContexts.includes(ctx)) reload(ctx)
      }),
    )
    return () => {
      cancelled = true
      unsubs.forEach((u) => u())
    }
  }, [subject, ctxKey, activeContexts])

  if (activeContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Select a context to review access.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ScanSearch className="size-4 text-muted-foreground" aria-hidden />
          Access Review
        </div>
        <span className="text-xs text-muted-foreground">
          Who can do what? Pick a subject to see effective permissions.
        </span>
        <div className="ml-auto">
          <SubjectPicker
            options={subjectOptions}
            value={subject}
            onChange={setSubject}
            disabled={subjectOptions.length === 0}
          />
        </div>
      </div>

      {!subject && (
        <EmptyHero count={subjectOptions.length} />
      )}

      {subject && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {activeContexts.map((ctx, idx) => (
            <ContextSection
              key={ctx}
              contextName={ctx}
              isAggregated={isAggregated}
              access={access[ctx] ?? null}
              isFirst={idx === 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyHero({ count }: { count: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <ScanSearch className="size-8 opacity-40" aria-hidden />
      <div>
        Pick a subject to inspect.{' '}
        {count > 0 && <span className="opacity-70">({count} discovered)</span>}
      </div>
      <div className="max-w-md text-xs opacity-70">
        Resolves the subject against every Role + ClusterRole binding in the cluster — including
        implicit groups like <code className="font-mono text-[11px]">system:serviceaccounts</code>{' '}
        and <code className="font-mono text-[11px]">system:authenticated</code>.
      </div>
    </div>
  )
}

function ContextSection({
  contextName,
  isAggregated,
  access,
  isFirst,
}: {
  contextName: string
  isAggregated: boolean
  access: SubjectAccess | null
  isFirst: boolean
}) {
  const rows = useMemo(() => buildMatrixRows(access?.rules ?? []), [access?.rules])

  return (
    <section className={isFirst ? '' : 'border-t border-border'}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-6 py-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium">{contextName}</span>
          {access && (
            <span className="text-muted-foreground">
              {access.rules.length === 0
                ? 'no permissions'
                : `${rows.length} resource type${rows.length === 1 ? '' : 's'} · ${access.rules.length} rule${access.rules.length === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {access?.clusterAdmin && (
            <Badge tone="danger" icon={<ShieldAlert className="size-3" />}>
              cluster-admin
            </Badge>
          )}
          {access?.hasWildcard && !access?.clusterAdmin && (
            <Badge tone="warn" icon={<Sparkles className="size-3" />}>
              wildcard rule
            </Badge>
          )}
        </div>
      </div>

      {!access && <Status text="Loading…" />}
      {access && access.rules.length === 0 && (
        <Status text={isAggregated ? 'No access in this context.' : 'This subject has no access.'} />
      )}
      {access && access.rules.length > 0 && <Matrix rows={rows} />}
    </section>
  )
}

function Status({ text }: { text: string }) {
  return (
    <div className="px-6 py-6 text-center text-xs text-muted-foreground">{text}</div>
  )
}

function Matrix({ rows }: { rows: MatrixRow[] }) {
  const scopes = useMemo(() => groupByScope(rows), [rows])
  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      {scopes.map((g) => (
        <div key={g.scope} className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Scope: {g.scope === '*' ? 'cluster-wide' : g.scope}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {g.rows.length} resource{g.rows.length === 1 ? '' : 's'}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">API Group</th>
                  <th className="px-3 py-2 font-medium">Resource</th>
                  {VERB_COLUMNS.map((v) => (
                    <th key={v} className="px-2 py-2 text-center font-medium">
                      {verbLabel(v)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.rows.map((row, i) => (
                  <tr
                    key={`${row.apiGroup}|${row.resource}|${i}`}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-3 py-1.5 align-top font-mono text-[11px] text-muted-foreground">
                      {row.apiGroup || 'core'}
                    </td>
                    <td className="px-3 py-1.5 align-top font-mono text-[11px] text-foreground">
                      {row.resource}
                    </td>
                    {VERB_COLUMNS.map((v) => (
                      <td key={v} className="px-2 py-1.5 text-center align-top">
                        <VerbCell cell={row.cells[v]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function VerbCell({ cell }: { cell: EffectiveCell }) {
  if (!cell.granted) {
    return <span aria-hidden className="text-muted-foreground/30">·</span>
  }
  const label = cell.resourceNames.length > 0 ? cell.resourceNames.join(', ') : null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={[
            'inline-flex size-5 items-center justify-center rounded',
            cell.wildcard
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
          ].join(' ')}
        >
          {cell.wildcard ? '*' : '✓'}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <div className="space-y-1 text-[11px]">
          {label && (
            <div className="font-mono opacity-80">
              limited to: {label}
            </div>
          )}
          <div className="font-medium">Granted via</div>
          {cell.sources.map((s, idx) => (
            <div key={idx} className="font-mono leading-snug opacity-90">
              {s.bindingKind}/{s.bindingName}
              {s.bindingNamespace && <span className="opacity-60"> ({s.bindingNamespace})</span>}
              {' → '}
              {s.roleKind}/{s.roleName}
              {s.roleNamespace && <span className="opacity-60"> ({s.roleNamespace})</span>}
              {s.viaGroup && (
                <div className="opacity-60">via {s.viaGroup}</div>
              )}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function SubjectPicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: AccessSubject[]
  value: AccessSubject | null
  onChange: (s: AccessSubject | null) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const grouped = useMemo(() => groupSubjects(options), [options])

  const label = value ? subjectLabel(value) : 'Select subject…'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <SubjectIcon kind={value?.kind} />
          <span className="max-w-[22rem] truncate font-mono text-[11px]">{label}</span>
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[26rem] max-w-[90vw] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search subjects…" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No subjects match.</CommandEmpty>
            {grouped.map((g, gi) => (
              <div key={g.kind}>
                {gi > 0 && <CommandSeparator />}
                <CommandGroup heading={kindHeading(g.kind, g.items.length)}>
                  {g.items.map((s) => (
                    <CommandItem
                      key={subjectKey(s)}
                      value={`${s.kind} ${s.namespace ?? ''} ${s.name}`}
                      onSelect={() => {
                        onChange(s)
                        setOpen(false)
                      }}
                    >
                      <SubjectIcon kind={s.kind} />
                      <span className="flex-1 truncate font-mono text-[11px]">
                        {subjectLabel(s)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function SubjectIcon({ kind }: { kind?: string }) {
  if (kind === 'Group') return <Users className="size-3.5" aria-hidden />
  if (kind === 'User') return <UserIcon className="size-3.5" aria-hidden />
  return <UserIcon className="size-3.5" aria-hidden />
}

function Badge({
  tone,
  icon,
  children,
}: {
  tone: 'warn' | 'danger'
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  const cls =
    tone === 'danger'
      ? 'bg-destructive/15 text-destructive'
      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {icon}
      {children}
    </span>
  )
}

function buildMatrixRows(rules: SubjectAccessRule[]): MatrixRow[] {
  const byKey = new Map<string, MatrixRow>()
  for (const r of rules) {
    const apiGroups = r.apiGroups.length === 0 ? [''] : r.apiGroups
    const resources = r.resources.length === 0 ? r.nonResourceURLs : r.resources
    for (const g of apiGroups) {
      for (const res of resources) {
        const key = `${r.scope}|${g}|${res}`
        let row = byKey.get(key)
        if (!row) {
          row = {
            scope: r.scope,
            apiGroup: g,
            resource: res,
            cells: emptyCells(),
          }
          byKey.set(key, row)
        }
        applyVerbs(row.cells, r)
      }
    }
  }
  const out = Array.from(byKey.values())
  out.sort((a, b) => {
    if (a.scope !== b.scope) {
      if (a.scope === '*') return -1
      if (b.scope === '*') return 1
      return a.scope.localeCompare(b.scope)
    }
    if (a.apiGroup !== b.apiGroup) return a.apiGroup.localeCompare(b.apiGroup)
    return a.resource.localeCompare(b.resource)
  })
  return out
}

function applyVerbs(cells: Record<Verb, EffectiveCell>, rule: SubjectAccessRule) {
  const wildcard = rule.verbs.includes('*')
  const verbs: Verb[] = wildcard
    ? [...VERB_COLUMNS]
    : (rule.verbs.filter((v) => (VERB_COLUMNS as readonly string[]).includes(v)) as Verb[])
  for (const v of verbs) {
    const cell = cells[v]
    cell.granted = true
    if (wildcard) cell.wildcard = true
    for (const rn of rule.resourceNames) {
      if (!cell.resourceNames.includes(rn)) cell.resourceNames.push(rn)
    }
    cell.sources.push(rule)
  }
}

function emptyCells(): Record<Verb, EffectiveCell> {
  const cells = {} as Record<Verb, EffectiveCell>
  for (const v of VERB_COLUMNS) {
    cells[v] = { granted: false, wildcard: false, resourceNames: [], sources: [] }
  }
  return cells
}

function groupByScope(rows: MatrixRow[]): { scope: string; rows: MatrixRow[] }[] {
  const out: { scope: string; rows: MatrixRow[] }[] = []
  for (const r of rows) {
    let g = out.find((s) => s.scope === r.scope)
    if (!g) {
      g = { scope: r.scope, rows: [] }
      out.push(g)
    }
    g.rows.push(r)
  }
  return out
}

function groupSubjects(options: AccessSubject[]): { kind: string; items: AccessSubject[] }[] {
  const order = ['ServiceAccount', 'User', 'Group']
  const buckets: Record<string, AccessSubject[]> = {}
  for (const s of options) {
    if (!buckets[s.kind]) buckets[s.kind] = []
    buckets[s.kind].push(s)
  }
  return order
    .filter((k) => buckets[k]?.length)
    .map((k) => ({ kind: k, items: buckets[k] }))
}

function kindHeading(kind: string, count: number): string {
  const noun = kind === 'ServiceAccount' ? 'Service Accounts' : kind === 'User' ? 'Users' : 'Groups'
  return `${noun} (${count})`
}

function subjectKey(s: AccessSubject): string {
  return `${s.kind}|${s.namespace ?? ''}|${s.name}`
}

function compareSubject(a: AccessSubject, b: AccessSubject): number {
  const rank = (k: string) => (k === 'ServiceAccount' ? 0 : k === 'User' ? 1 : 2)
  if (a.kind !== b.kind) return rank(a.kind) - rank(b.kind)
  if ((a.namespace ?? '') !== (b.namespace ?? ''))
    return (a.namespace ?? '').localeCompare(b.namespace ?? '')
  return a.name.localeCompare(b.name)
}

function subjectLabel(s: AccessSubject): string {
  if (s.kind === 'ServiceAccount') return `${s.namespace}/${s.name}`
  return s.name
}

function verbLabel(v: Verb): string {
  if (v === 'deletecollection') return 'del-coll'
  return v
}
