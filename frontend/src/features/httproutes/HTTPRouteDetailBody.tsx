import { Fragment, useCallback } from 'react'
import { BrowserOpenURL } from '@/lib/wails/wailsjs/runtime/runtime'
import {
  api,
  type HTTPRouteDetail,
  type BackendRefDetail,
  type HTTPRouteMatchDetail,
} from '@/lib/api'
import { formatAge } from '@/lib/time'
import {
  Chips,
  ErrorBox,
  Field,
  MaybeSection,
  Section,
  Td,
  Th,
} from '@/features/_shared/DetailPrimitives'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

function backendLabel(b: BackendRefDetail, ownNS: string): string {
  const ns = b.namespace && b.namespace !== ownNS ? `${b.namespace}/` : ''
  const port = b.port ? `:${b.port}` : ''
  return `${ns}${b.name}${port}`
}

function parentLabel(p: { namespace?: string; name: string }, ownNS: string): string {
  return p.namespace && p.namespace !== ownNS ? `${p.namespace}/${p.name}` : p.name
}

function matchLabel(m: HTTPRouteMatchDetail): string {
  const parts: string[] = []
  if (m.path) {
    const t = m.pathType === 'Exact' ? '==' : m.pathType === 'RegularExpression' ? '~=' : '^'
    parts.push(`path ${t} ${m.path}`)
  }
  if (m.method) parts.push(`method=${m.method}`)
  for (const h of m.headers) parts.push(`header[${h}]`)
  for (const q of m.queryParams) parts.push(`query[${q}]`)
  return parts.join(' • ') || 'any'
}

export function HTTPRouteDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback(
    (ctx: string) => api.getHTTPRoute(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<HTTPRouteDetail>(contextName, 'HTTPRoute', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="HTTPRoute">
        <Field label="Hostnames" mono>
          {detail.hostnames.length > 0
            ? detail.hostnames.map((h, i) => (
                <Fragment key={h}>
                  {i > 0 && ', '}
                  <Copyable value={h}>
                    {h.startsWith('*') ? (
                      h
                    ) : (
                      <button
                        type="button"
                        className="cursor-pointer text-left hover:underline"
                        onClick={() => BrowserOpenURL(`https://${h}`)}
                        title={`Open https://${h}`}
                      >
                        {h}
                      </button>
                    )}
                  </Copyable>
                </Fragment>
              ))
            : '*'}
        </Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.parents.length > 0 && (
        <Section title="Parents">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Kind</Th>
                  <Th>Name</Th>
                  <Th>Section</Th>
                  <Th>Port</Th>
                </tr>
              </thead>
              <tbody>
                {detail.parents.map((p, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td>{p.kind || 'Gateway'}</Td>
                    <Td className="font-mono">
                      <Copyable value={parentLabel(p, detail.namespace)} />
                    </Td>
                    <Td className="font-mono">{p.sectionName || '—'}</Td>
                    <Td className="font-mono">{p.port || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {detail.rules.length > 0 && (
        <Section title="Rules">
          <div className="space-y-3">
            {detail.rules.map((rule, ri) => (
              <div key={ri} className="overflow-hidden rounded border border-border">
                <div className="bg-muted/40 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Rule {ri + 1}
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 text-muted-foreground">
                    <tr>
                      <Th>Match</Th>
                      <Th>Backend</Th>
                      <Th>Weight</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rule.matches.length === 0
                      ? [{ pathType: '', path: '', method: '', headers: [], queryParams: [] } as HTTPRouteMatchDetail]
                      : rule.matches
                    ).flatMap((m, mi) =>
                      rule.backends.length === 0
                        ? [
                            <tr key={`${mi}-empty`} className="border-t border-border">
                              <Td className="font-mono">{matchLabel(m)}</Td>
                              <Td>—</Td>
                              <Td>—</Td>
                            </tr>,
                          ]
                        : rule.backends.map((b, bi) => (
                            <tr key={`${mi}-${bi}`} className="border-t border-border">
                              <Td className="font-mono">{matchLabel(m)}</Td>
                              <Td className="font-mono">
                                <Copyable value={backendLabel(b, detail.namespace)} />
                              </Td>
                              <Td className="font-mono">{b.weight || '—'}</Td>
                            </tr>
                          )),
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Section>
      )}

      {detail.status.length > 0 && (
        <Section title="Status">
          {detail.status.map((sp, i) => (
            <div key={i} className="mb-3 overflow-hidden rounded border border-border last:mb-0">
              <div className="flex items-center justify-between bg-muted/40 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span className="font-mono normal-case">
                  <Copyable value={parentLabel(sp.parent, detail.namespace)} />
                </span>
                <span className="font-mono normal-case">
                  <Copyable value={sp.controller} />
                </span>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-muted/20 text-muted-foreground">
                  <tr>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Reason</Th>
                    <Th>Message</Th>
                  </tr>
                </thead>
                <tbody>
                  {sp.conditions.map((c) => (
                    <tr key={c.type} className="border-t border-border">
                      <Td className="font-mono">{c.type}</Td>
                      <Td>
                        <ConditionPill status={c.status} />
                      </Td>
                      <Td className="font-mono">{c.reason || '—'}</Td>
                      <Td>{c.message || '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </Section>
      )}

      <MaybeSection
        title="Labels"
        items={detail.labels}
        render={() => <Chips items={detail.labels} />}
      />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}
