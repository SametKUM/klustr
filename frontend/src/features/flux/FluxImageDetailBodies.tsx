import { useCallback } from 'react'
import { api } from '@/lib/api'
import type { FluxImageStatus } from './fluxImageTypes'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { CustomResourceReference } from '@/features/_shared/CustomResourceReference'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { FluxReadyPill } from './FluxReadyPill'
import { FluxConditionsTable } from './FluxConditionsTable'
import { FLUX_IMAGE_GROUP, FLUX_IMAGE_REPOSITORY_RESOURCE } from './fluxKinds'

type Props = { contextName: string | null; namespace: string; name: string }

function ImageStatus({ title, detail }: { title: string; detail: FluxImageStatus }) {
  return (
    <Section title={title}>
      <Field label="Ready">
        <FluxReadyPill value={detail.ready} suspended={detail.suspended} />
      </Field>
      <Field label="Status message">{detail.status || '—'}</Field>
      <Field label="Interval">{detail.interval || '—'}</Field>
      <Field label="Age">{formatAge(detail.createdAt)}</Field>
    </Section>
  )
}

export function FluxImageRepositoryDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (context: string) => api.getFluxImageRepository(context, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail(
    contextName,
    'FluxImageRepository',
    namespace,
    name,
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <ImageStatus title="Image repository" detail={detail} />
      <Section title="Registry">
        <Field label="Image" mono>
          {detail.image || '—'}
        </Field>
        <Field label="Canonical image" mono>
          {detail.canonicalImage || '—'}
        </Field>
        <Field label="Provider">{detail.provider}</Field>
        <Field label="Secret ref" mono>
          {detail.secretRef || '—'}
        </Field>
        <Field label="Certificate ref" mono>
          {detail.certSecretRef || '—'}
        </Field>
        <Field label="Insecure">{String(detail.insecure)}</Field>
        <Field label="Timeout">{detail.timeout || '—'}</Field>
      </Section>
      <Section title="Last scan">
        <Field label="Scanned">{detail.lastScanTime ? formatAge(detail.lastScanTime) : '—'}</Field>
        <Field label="Tag count">
          <span className="tabular-nums">{detail.tagCount}</span>
        </Field>
        <Field label="Latest tags" mono>
          {detail.latestTags.length ? detail.latestTags.join(', ') : '—'}
        </Field>
        <Field label="Exclusion patterns" mono>
          {detail.exclusionList.length ? detail.exclusionList.join(', ') : '—'}
        </Field>
      </Section>
      <FluxConditionsTable conditions={detail.conditions} />
    </div>
  )
}

export function FluxImagePolicyDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (context: string) => api.getFluxImagePolicy(context, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail(contextName, 'FluxImagePolicy', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <ImageStatus title="Image policy" detail={detail} />
      <Section title="Tag selection">
        <Field label="Repository">
          <CustomResourceReference
            contextName={contextName}
            group={FLUX_IMAGE_GROUP}
            resource={FLUX_IMAGE_REPOSITORY_RESOURCE}
            kind="FluxImageRepository"
            namespace={detail.repositoryNamespace}
            name={detail.repositoryName}
            loadSuspended={api.getFluxImageRepository}
          />
        </Field>
        <Field label="Repository namespace">{detail.repositoryNamespace}</Field>
        <Field label="Policy">{detail.policyType || '—'}</Field>
        <Field label="Range / order" mono>
          {detail.policyValue || '—'}
        </Field>
        <Field label="Tag pattern" mono>
          {detail.filterPattern || '—'}
        </Field>
        <Field label="Tag extraction" mono>
          {detail.filterExtract || '—'}
        </Field>
        <Field label="Digest reflection">{detail.digestReflectionPolicy}</Field>
      </Section>
      <Section title="Selected image">
        <Field label="Latest image">
          {detail.latestImage ? (
            <Copyable className="font-mono text-xs" value={detail.latestImage} />
          ) : (
            '—'
          )}
        </Field>
        <Field label="Tag" mono>
          {detail.latestTag || '—'}
        </Field>
        <Field label="Digest" mono>
          {detail.latestDigest || '—'}
        </Field>
        <Field label="Previous image" mono>
          {detail.previousImage || '—'}
        </Field>
        <div className="pt-2 text-xs text-muted-foreground">
          Reconcile the linked image repository to rescan tags and refresh this policy.
        </div>
      </Section>
      <FluxConditionsTable conditions={detail.conditions} />
    </div>
  )
}

export function FluxImageUpdateAutomationDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (context: string) => api.getFluxImageUpdateAutomation(context, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail(
    contextName,
    'FluxImageUpdateAutomation',
    namespace,
    name,
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <ImageStatus title="Image update automation" detail={detail} />
      <Section title="Git updates">
        <Field label="Source">
          {detail.sourceKind === 'GitRepository' ? (
            <CustomResourceReference
              contextName={contextName}
              group="source.toolkit.fluxcd.io"
              resource="gitrepositories"
              kind="FluxGitRepository"
              namespace={detail.sourceNamespace}
              name={detail.sourceName}
              loadSuspended={api.getFluxGitRepository}
            />
          ) : (
            detail.sourceName || '—'
          )}
        </Field>
        <Field label="Source kind">{detail.sourceKind || '—'}</Field>
        <Field label="Source namespace">{detail.sourceNamespace}</Field>
        <Field label="Checkout branch" mono>
          {detail.checkoutBranch || 'GitRepository ref'}
        </Field>
        <Field label="Push branch" mono>
          {detail.pushBranch || detail.checkoutBranch || 'GitRepository ref'}
        </Field>
        <Field label="Update path" mono>
          {detail.updatePath || './'}
        </Field>
        <Field label="Update strategy">{detail.updateStrategy || 'Setters'}</Field>
        <Field label="Source revision" mono>
          {detail.observedSourceRevision || '—'}
        </Field>
      </Section>
      <Section title="Last update">
        <Field label="Last run">{detail.lastRunTime ? formatAge(detail.lastRunTime) : '—'}</Field>
        <Field label="Last push">
          {detail.lastPushTime ? formatAge(detail.lastPushTime) : '—'}
        </Field>
        <Field label="Commit">
          {detail.lastPushCommit ? (
            <Copyable className="font-mono text-xs" value={detail.lastPushCommit} />
          ) : (
            '—'
          )}
        </Field>
      </Section>
      <FluxConditionsTable conditions={detail.conditions} />
    </div>
  )
}
