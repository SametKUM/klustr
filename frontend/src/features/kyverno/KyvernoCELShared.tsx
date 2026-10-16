import type { KyvernoCELExpression, KyvernoCELValidation } from '@/lib/api'
import { Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'

// Pieces the Kyverno CEL policy detail bodies share.

export function ExpressionsTable({
  title,
  rows,
  nameHeader,
}: {
  title: string
  rows: KyvernoCELExpression[]
  nameHeader: string
}) {
  if (rows.length === 0) return null
  return (
    <Section title={`${title} (${rows.length})`}>
      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>{nameHeader}</Th>
              <Th>Expression</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}-${i}`} className="border-t border-border align-top">
                <Td className="whitespace-nowrap font-mono">{r.name || '—'}</Td>
                <Td className="font-mono break-all">{r.expression}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

export function ValidationRules({ rules }: { rules: KyvernoCELValidation[] }) {
  return (
    <Section title={`Validations (${rules.length})`}>
      {rules.length === 0 ? (
        <div className="text-xs text-muted-foreground">This policy declares no validations.</div>
      ) : (
        <div className="space-y-3">
          {rules.map((v, i) => (
            <div key={i} className="rounded border border-border">
              <CodeBlock>{v.expression}</CodeBlock>
              <div className="space-y-1 px-3 py-2 text-xs">
                <div>{v.message || <span className="text-muted-foreground">No message</span>}</div>
                {v.messageExpression && (
                  <div className="font-mono text-muted-foreground">message: {v.messageExpression}</div>
                )}
                {v.reason && <div className="text-muted-foreground">reason: {v.reason}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto border-b border-border bg-muted/40 px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all last:border-b-0">
      {children}
    </pre>
  )
}

export function MatchesSection({
  resources,
  namespaceSelector,
  objectSelector,
  title = 'Matches',
}: {
  resources: string[]
  namespaceSelector: string
  objectSelector: string
  title?: string
}) {
  return (
    <Section title={title}>
      <Field label="Resources">
        {resources.length ? (
          <div className="font-mono text-xs">
            {resources.map((r) => (
              <div key={r}>{r}</div>
            ))}
          </div>
        ) : (
          '—'
        )}
      </Field>
      <Field label="Namespace selector" mono>
        {namespaceSelector || '—'}
      </Field>
      <Field label="Object selector" mono>
        {objectSelector || '—'}
      </Field>
    </Section>
  )
}
