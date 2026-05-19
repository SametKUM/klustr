import type { ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-card/40 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

export function Field({
  label,
  children,
  mono,
}: {
  label: string
  children: ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <div className="w-32 shrink-0 text-xs text-muted-foreground">{label}</div>
      <div className={['min-w-0 flex-1 break-words', mono ? 'font-mono text-xs' : ''].join(' ')}>
        {children}
      </div>
    </div>
  )
}

export function Chips({ items }: { items: Record<string, string> | undefined | null }) {
  if (!items) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(items).map(([k, v]) => (
        <span
          key={k}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground"
        >
          {k}
          {v ? `=${v}` : ''}
        </span>
      ))}
    </div>
  )
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="px-2 py-1.5 text-left font-medium uppercase tracking-wide">{children}</th>
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={['px-2 py-1.5 align-top', className].filter(Boolean).join(' ')}>{children}</td>
  )
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs font-mono text-destructive break-words">
      {children}
    </div>
  )
}

export function MaybeSection({
  title,
  items,
  render,
}: {
  title: string
  items: unknown[] | Record<string, unknown> | null | undefined
  render: () => ReactNode
}) {
  const isArray = Array.isArray(items)
  const empty = items === null || items === undefined || (isArray ? items.length === 0 : Object.keys(items).length === 0)
  if (empty) return null
  return <Section title={title}>{render()}</Section>
}
