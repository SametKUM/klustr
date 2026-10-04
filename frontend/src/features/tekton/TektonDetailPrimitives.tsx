import type { ReactNode } from 'react'
import type {
  TektonParam,
  TektonParamSpec,
  TektonResultSpec,
  TektonWorkspaceBinding,
  TektonWorkspaceSpec,
} from '@/lib/api'
import { Copyable } from '@/features/_shared/Copyable'
import { Section, Td, Th } from '@/features/_shared/DetailPrimitives'

// Small shared tables for the Tekton detail bodies. Each renders nothing when
// its list is empty, so a Task without results shows no empty section.

export function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded text-left font-mono text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  )
}

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <Th key={h}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function ValuesTable({ title, values }: { title: string; values: TektonParam[] }) {
  if (values.length === 0) return null
  return (
    <Section title={`${title} (${values.length})`}>
      <Table headers={['Name', 'Value']}>
        {values.map((v) => (
          <tr key={v.name} className="border-t border-border align-top">
            <Td className="whitespace-nowrap font-mono">{v.name}</Td>
            <Td className="max-w-[40rem] break-all font-mono">
              {v.value ? <Copyable value={v.value} /> : <span className="text-muted-foreground">""</span>}
            </Td>
          </tr>
        ))}
      </Table>
    </Section>
  )
}

export function WorkspaceBindingsTable({ workspaces }: { workspaces: TektonWorkspaceBinding[] }) {
  if (workspaces.length === 0) return null
  return (
    <Section title={`Workspaces (${workspaces.length})`}>
      <Table headers={['Name', 'Source']}>
        {workspaces.map((w) => (
          <tr key={w.name} className="border-t border-border align-top">
            <Td className="whitespace-nowrap font-mono">{w.name}</Td>
            <Td className="font-mono">{w.source}</Td>
          </tr>
        ))}
      </Table>
    </Section>
  )
}

export function ParamSpecsTable({ params }: { params: TektonParamSpec[] }) {
  if (params.length === 0) return null
  return (
    <Section title={`Params (${params.length})`}>
      <Table headers={['Name', 'Type', 'Default', 'Description']}>
        {params.map((p) => (
          <tr key={p.name} className="border-t border-border align-top">
            <Td className="whitespace-nowrap font-mono">{p.name}</Td>
            <Td className="text-muted-foreground">{p.type}</Td>
            <Td className="max-w-[20rem] break-all font-mono">
              {p.hasDefault ? p.default || '""' : <span className="text-muted-foreground">required</span>}
            </Td>
            <Td className="max-w-[24rem] whitespace-pre-wrap break-words">{p.description || '—'}</Td>
          </tr>
        ))}
      </Table>
    </Section>
  )
}

export function WorkspaceSpecsTable({ workspaces }: { workspaces: TektonWorkspaceSpec[] }) {
  if (workspaces.length === 0) return null
  return (
    <Section title={`Workspaces (${workspaces.length})`}>
      <Table headers={['Name', 'Optional', 'Description']}>
        {workspaces.map((w) => (
          <tr key={w.name} className="border-t border-border align-top">
            <Td className="whitespace-nowrap font-mono">{w.name}</Td>
            <Td>{w.optional ? 'yes' : 'no'}</Td>
            <Td className="whitespace-pre-wrap break-words">{w.description || '—'}</Td>
          </tr>
        ))}
      </Table>
    </Section>
  )
}

export function ResultSpecsTable({ results }: { results: TektonResultSpec[] }) {
  if (results.length === 0) return null
  // A Pipeline result carries the expression it takes; a Task result a type.
  const hasValue = results.some((r) => r.value)
  return (
    <Section title={`Results (${results.length})`}>
      <Table headers={['Name', hasValue ? 'Value' : 'Type', 'Description']}>
        {results.map((r) => (
          <tr key={r.name} className="border-t border-border align-top">
            <Td className="whitespace-nowrap font-mono">{r.name}</Td>
            <Td className="max-w-[24rem] break-all font-mono">
              {(hasValue ? r.value : r.type) || <span className="text-muted-foreground">—</span>}
            </Td>
            <Td className="whitespace-pre-wrap break-words">{r.description || '—'}</Td>
          </tr>
        ))}
      </Table>
    </Section>
  )
}
