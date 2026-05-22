import { useEffect, useState } from 'react'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { api, type ContainerDetail, type EnvVarRef, type PodDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { NodeLink } from '@/features/_shared/NodeLink'
import { OwnerLink } from '@/features/_shared/OwnerLink'

export function PodOverviewBody({
  contextName,
  detail,
}: {
  contextName: string | null
  detail: PodDetail
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Status">
          <Field label="Status">{detail.status}</Field>
          <Field label="Phase">{detail.phase}</Field>
          <Field label="QoS Class">{detail.qosClass || '—'}</Field>
          <Field label="Restart Policy">{detail.restartPolicy}</Field>
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>

        <Section title="Networking">
          <Field label="Pod IP" mono>{detail.podIP ? <Copyable value={detail.podIP} /> : '—'}</Field>
          <Field label="Host IP" mono>{detail.hostIP ? <Copyable value={detail.hostIP} /> : '—'}</Field>
          <Field label="Node">
            {detail.node ? (
              <Copyable value={detail.node}>
                <NodeLink name={detail.node} />
              </Copyable>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Service Account">{detail.serviceAccount || 'default'}</Field>
          {detail.priorityClassName && <Field label="Priority Class">{detail.priorityClassName}</Field>}
        </Section>

        {detail.owners.length > 0 && (
          <Section title="Controlled By">
            {detail.owners.map((o, i) => (
              <Field key={i} label={o.kind}>
                <OwnerLink owner={o} namespace={detail.namespace} />
              </Field>
            ))}
          </Section>
        )}
      </div>

      {detail.initContainers.length > 0 && <PodContainersTable title="Init Containers" containers={detail.initContainers} />}
      <PodContainersTable title="Containers" containers={detail.containers} />

      <ContainerEnvSection
        title="Environment"
        contextName={contextName}
        namespace={detail.namespace}
        containers={[...detail.initContainers, ...detail.containers]}
      />

      {detail.conditions.length > 0 && (
        <Section title="Conditions">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {detail.conditions.map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td>{c.type}</Td>
                    <Td className={c.status === 'True' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                      {c.status}
                    </Td>
                    <Td>{c.reason || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}

function ContainerEnvSection({
  title,
  contextName,
  namespace,
  containers,
}: {
  title: string
  contextName: string | null
  namespace: string
  containers: ContainerDetail[]
}) {
  const withEnv = containers.filter(
    (c) => (c.env && c.env.length > 0) || (c.envFrom && c.envFrom.length > 0),
  )
  if (withEnv.length === 0) return null
  return (
    <Section title={title}>
      <div className="space-y-4">
        {withEnv.map((c) => (
          <div key={c.name} className="overflow-hidden rounded border border-border">
            <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {c.name}
            </div>
            {c.env && c.env.length > 0 && (
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <Th>Name</Th>
                    <Th>Value</Th>
                    <Th>Source</Th>
                  </tr>
                </thead>
                <tbody>
                  {c.env.map((e) => (
                    <tr key={e.name} className="border-t border-border align-top">
                      <Td className="font-mono"><Copyable value={e.name} /></Td>
                      <Td className="break-all font-mono">
                        <EnvValueCell
                          contextName={contextName}
                          namespace={namespace}
                          envName={e.name}
                          value={e.value}
                          valueFrom={e.valueFrom}
                          ref={e.ref ?? null}
                        />
                      </Td>
                      <Td className="font-mono text-[11px] text-muted-foreground">
                        {e.ref ? `${e.ref.kind}: ${e.ref.name}/${e.ref.key}` : e.valueFrom || '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {c.envFrom && c.envFrom.length > 0 && (
              <div className="border-t border-border bg-muted/20 px-3 py-2">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  envFrom
                </div>
                <ul className="space-y-1 text-xs">
                  {c.envFrom.map((f, i) => (
                    <li key={i} className="font-mono">
                      <span>{f.source}</span>
                      {f.prefix && (
                        <span className="ml-2 text-muted-foreground">prefix: {f.prefix}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}

function EnvValueCell({
  contextName,
  namespace,
  value,
  ref,
}: {
  contextName: string | null
  namespace: string
  envName: string
  value: string
  valueFrom: string
  ref: EnvVarRef | null
}) {
  if (ref && ref.kind === 'Secret') {
    return (
      <SecretEnvValue
        contextName={contextName}
        namespace={namespace}
        secretName={ref.name}
        secretKey={ref.key}
      />
    )
  }
  if (ref && ref.kind === 'ConfigMap') {
    return (
      <ConfigMapEnvValue
        contextName={contextName}
        namespace={namespace}
        cmName={ref.name}
        cmKey={ref.key}
      />
    )
  }
  if (value === '') return <span className="text-muted-foreground">—</span>
  return <Copyable value={value} />
}

function ConfigMapEnvValue({
  contextName,
  namespace,
  cmName,
  cmKey,
}: {
  contextName: string | null
  namespace: string
  cmName: string
  cmKey: string
}) {
  const [value, setValue] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!contextName) return
    let cancelled = false
    api
      .getConfigMap(contextName, namespace, cmName)
      .then((cm) => {
        if (cancelled) return
        const v = cm.data?.[cmKey]
        if (v === undefined) {
          setError(`key '${cmKey}' not in ConfigMap`)
        } else {
          setValue(v)
        }
      })
      .catch((e) => {
        if (cancelled) return
        setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [contextName, namespace, cmName, cmKey])

  if (error) return <span className="text-destructive">{error}</span>
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Spinner size="sm" />
        Reading…
      </span>
    )
  }
  if (value === '') return <span className="text-muted-foreground">(empty)</span>
  return <Copyable value={value} />
}

type SecretRevealState =
  | { status: 'hidden' }
  | { status: 'loading' }
  | { status: 'shown'; value: string }
  | { status: 'error'; message: string }

function SecretEnvValue({
  contextName,
  namespace,
  secretName,
  secretKey,
}: {
  contextName: string | null
  namespace: string
  secretName: string
  secretKey: string
}) {
  const [state, setState] = useState<SecretRevealState>({ status: 'hidden' })
  const [justCopied, setJustCopied] = useState(false)

  const reveal = async () => {
    if (!contextName) return
    setState({ status: 'loading' })
    try {
      const v = await api.revealSecretValue(contextName, namespace, secretName, secretKey)
      setState({ status: 'shown', value: v })
    } catch (e) {
      setState({ status: 'error', message: String(e) })
    }
  }

  const hide = () => setState({ status: 'hidden' })

  const copy = async () => {
    if (state.status !== 'shown') return
    try {
      await navigator.clipboard.writeText(state.value)
      setJustCopied(true)
      setTimeout(() => setJustCopied(false), 1200)
    } catch (e) {
      toast.error(`Copy failed: ${String(e)}`)
    }
  }

  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        {state.status === 'hidden' && (
          <span className="select-none font-mono tracking-widest text-muted-foreground">
            ••••••••
          </span>
        )}
        {state.status === 'loading' && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Spinner size="sm" />
            Reading…
          </span>
        )}
        {state.status === 'shown' && (
          <span className="allow-select break-all font-mono">{state.value}</span>
        )}
        {state.status === 'error' && (
          <span className="text-destructive">{state.message}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {state.status === 'shown' && (
          <Button type="button" size="icon-xs" variant="ghost" aria-label="Copy" onClick={copy}>
            {justCopied ? <Check className="text-emerald-500" /> : <Copy />}
          </Button>
        )}
        {state.status === 'shown' ? (
          <Button type="button" size="xs" variant="ghost" onClick={hide}>
            <EyeOff />
            Hide
          </Button>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={reveal}
            disabled={state.status === 'loading' || !contextName}
          >
            <Eye />
            Reveal
          </Button>
        )}
      </div>
    </div>
  )
}

function PodContainersTable({
  title,
  containers,
}: {
  title: string
  containers: PodDetail['containers']
}) {
  return (
    <Section title={title}>
      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>Name</Th>
              <Th>Image</Th>
              <Th>State</Th>
              <Th>Ready</Th>
              <Th>Restarts</Th>
            </tr>
          </thead>
          <tbody>
            {containers.map((c) => (
              <tr key={c.name} className="border-t border-border">
                <Td>{c.name}</Td>
                <Td className="font-mono break-all"><Copyable value={c.image} /></Td>
                <Td>
                  <div>{c.state}</div>
                  {c.stateReason && <div className="text-[10px] text-muted-foreground">{c.stateReason}</div>}
                </Td>
                <Td>{c.ready ? '✓' : '·'}</Td>
                <Td>{c.restartCount}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
