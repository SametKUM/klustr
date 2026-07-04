import { useCallback } from 'react'
import { api, type CertManagerChallengeDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { CertManagerStatePill } from './CertManagerStatePill'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function ChallengeDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getCertManagerChallenge(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<CertManagerChallengeDetail>(contextName, 'Challenge', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="Challenge">
        <Field label="State">
          <CertManagerStatePill state={detail.state} />
        </Field>
        <Field label="Reason">
          {detail.reason ? (
            <span className="break-words">{detail.reason}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Field>
        <Field label="Type">
          {detail.type ? <span className="font-mono text-xs">{detail.type}</span> : '—'}
        </Field>
        <Field label="DNS name">
          {detail.dnsName ? (
            <Copyable className="font-mono text-xs" value={detail.dnsName} />
          ) : (
            '—'
          )}
        </Field>
        <Field label="Wildcard">{detail.wildcard ? 'yes' : 'no'}</Field>
        <Field label="Presented">{detail.presented ? 'yes' : 'no'}</Field>
        <Field label="Processing">{detail.processing ? 'yes' : 'no'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <Section title="ACME">
        <Field label="Token">
          {detail.token ? (
            <Copyable className="font-mono text-xs break-all" value={detail.token} />
          ) : (
            '—'
          )}
        </Field>
        <Field label="Authorization URL">
          {detail.authorizationURL ? (
            <Copyable className="font-mono text-xs break-all" value={detail.authorizationURL} />
          ) : (
            '—'
          )}
        </Field>
      </Section>
    </div>
  )
}
