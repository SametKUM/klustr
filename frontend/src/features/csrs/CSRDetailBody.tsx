import { useCallback, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api, type CertificateSigningRequestDetail } from '@/lib/api'
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
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { CSRConditionPill } from './CSRConditionPill'

export function CSRDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback(
    (ctx: string) => api.getCertificateSigningRequest(ctx, name),
    [name],
  )
  const { detail, error } = useResourceDetail<CertificateSigningRequestDetail>(
    contextName,
    'CertificateSigningRequest',
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  const decided = detail.condition !== 'Pending'
  const expirationLabel = detail.expirationSeconds
    ? formatExpiration(detail.expirationSeconds)
    : 'signer default'

  return (
    <div className="space-y-6">
      <Section title="CertificateSigningRequest">
        <Field label="Condition">
          <CSRConditionPill condition={detail.condition} />
        </Field>
        <Field label="Signer" mono>
          {detail.signerName}
        </Field>
        <Field label="Requester" mono>
          {detail.requester}
        </Field>
        {detail.groups.length > 0 && (
          <Field label="Groups">{detail.groups.join(', ')}</Field>
        )}
        <Field label="Usages">{detail.usages.join(', ') || '—'}</Field>
        <Field label="Expiration">{expirationLabel}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {!decided && contextName && (
        <Section title="Decision">
          <div className="flex gap-2 pt-1">
            <ApproveButton contextName={contextName} name={name} />
            <DenyButton contextName={contextName} name={name} />
          </div>
          <p className="pt-2 text-xs text-muted-foreground">
            Approve mints the cert (signer permitting); deny is terminal.
          </p>
        </Section>
      )}

      {detail.conditions.length > 0 && (
        <Section title="Conditions">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Reason</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {detail.conditions.map((c, i) => (
                  <tr key={`${c.type}-${i}`} className="border-t border-border">
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
        </Section>
      )}

      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}

function formatExpiration(seconds: number): string {
  const days = Math.round(seconds / 86400)
  if (days >= 1) return `${days}d`
  const hours = Math.round(seconds / 3600)
  if (hours >= 1) return `${hours}h`
  return `${seconds}s`
}

function ApproveButton({ contextName, name }: { contextName: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const mut = useMutation({
    mutationFn: () => api.approveCertificateSigningRequest(contextName, name, message),
    onSuccess: () => {
      toast.success(`Approved CSR ${name}`)
      setOpen(false)
      setMessage('')
    },
    onError: (e) => toast.error(String(e)),
  })
  return (
    <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) mut.reset() }}>
      <Button size="xs" variant="outline" onClick={() => setOpen(true)} disabled={mut.isPending}>
        <Check />
        Approve
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Once approved the signer issues the certificate. This is irreversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          placeholder="Optional message attached to the Approved condition"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={mut.isPending}
        />
        {mut.error && (
          <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
            {String(mut.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mut.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mut.isPending}
            onClick={(e) => {
              e.preventDefault()
              mut.mutate()
            }}
          >
            {mut.isPending ? 'Approving…' : 'Approve'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DenyButton({ contextName, name }: { contextName: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const mut = useMutation({
    mutationFn: () => api.denyCertificateSigningRequest(contextName, name, message),
    onSuccess: () => {
      toast.success(`Denied CSR ${name}`)
      setOpen(false)
      setMessage('')
    },
    onError: (e) => toast.error(String(e)),
  })
  return (
    <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) mut.reset() }}>
      <Button
        size="xs"
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={mut.isPending}
      >
        <X />
        Deny
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deny {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Denial is terminal — the requester must resubmit a new CSR to retry.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          placeholder="Optional message attached to the Denied condition"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={mut.isPending}
        />
        {mut.error && (
          <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
            {String(mut.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mut.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mut.isPending}
            onClick={(e) => {
              e.preventDefault()
              mut.mutate()
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mut.isPending ? 'Denying…' : 'Deny'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
