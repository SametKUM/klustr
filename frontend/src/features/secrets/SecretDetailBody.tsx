import { useCallback, useState } from 'react'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { api, type SecretDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

function shortenSecretType(t: string): string {
  const slash = t.indexOf('/')
  return slash >= 0 ? t.slice(slash + 1) : t
}

type RevealState =
  | { status: 'hidden' }
  | { status: 'loading' }
  | { status: 'shown'; value: string }
  | { status: 'error'; message: string }

function SecretValueRow({
  contextName,
  namespace,
  name,
  secretKey,
  size,
}: {
  contextName: string
  namespace: string
  name: string
  secretKey: string
  size: number
}) {
  const [state, setState] = useState<RevealState>({ status: 'hidden' })
  const [justCopied, setJustCopied] = useState(false)

  const reveal = async () => {
    setState({ status: 'loading' })
    try {
      const value = await api.revealSecretValue(contextName, namespace, name, secretKey)
      setState({ status: 'shown', value })
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
    <tr className="border-t border-border">
      <Td className="font-mono align-top">{secretKey}</Td>
      <Td className="align-top whitespace-nowrap text-muted-foreground">{`${size} bytes`}</Td>
      <Td className="align-top">
        {state.status === 'hidden' && (
          <span className="select-none font-mono tracking-widest text-muted-foreground">••••••••</span>
        )}
        {state.status === 'loading' && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Spinner size="sm" />
            Reading…
          </span>
        )}
        {state.status === 'shown' && (
          <pre className="allow-select max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/30 px-2 py-1 font-mono text-[11px]">
            {state.value}
          </pre>
        )}
        {state.status === 'error' && (
          <span className="text-destructive">{state.message}</span>
        )}
      </Td>
      <Td className="align-top whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1">
          {state.status === 'shown' && (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Copy value"
              onClick={copy}
            >
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
              disabled={state.status === 'loading'}
            >
              <Eye />
              Reveal
            </Button>
          )}
        </div>
      </Td>
    </tr>
  )
}

export function SecretDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getSecret(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<SecretDetail>(contextName, 'Secret', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Metadata">
        <Field label="Type" mono>{shortenSecretType(detail.type)}</Field>
        <Field label="Keys">{detail.keys.length}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      {detail.keys.length > 0 && (
        <Section title="Data">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Key</Th>
                  <Th>Size</Th>
                  <Th>Value</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {detail.keys.map((k) => (
                  <SecretValueRow
                    key={k.key}
                    contextName={contextName ?? ''}
                    namespace={namespace}
                    name={name}
                    secretKey={k.key}
                    size={k.size}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Values are fetched from the cluster only when you click Reveal.
          </div>
        </Section>
      )}
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
