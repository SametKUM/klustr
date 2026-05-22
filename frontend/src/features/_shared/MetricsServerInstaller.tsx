import { lazy, Suspense, useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import { useThemeMode } from '@/features/_shared/useThemeMode'

const INSECURE_FLAG = '--kubelet-insecure-tls'
const MANAGED_BY_LABEL = 'klustr/managed-by'
const MANAGED_BY_VALUE = 'metrics-server-installer'

function injectInsecureFlag(yaml: string): string {
  if (yaml.includes(INSECURE_FLAG)) return yaml
  return yaml.replace(/^(\s+- args:)$/m, `$1\n        - ${INSECURE_FLAG}`)
}

function injectManagedByLabel(doc: string): string {
  if (doc.includes(`${MANAGED_BY_LABEL}:`)) return doc
  // Insert under existing top-level `  labels:` block inside metadata.
  if (/^ {2}labels:\s*$/m.test(doc)) {
    return doc.replace(
      /^( {2}labels:)\s*$/m,
      `$1\n    ${MANAGED_BY_LABEL}: ${MANAGED_BY_VALUE}`,
    )
  }
  // No labels block — inject one right after metadata:.
  return doc.replace(
    /^(metadata:)\s*$/m,
    `$1\n  labels:\n    ${MANAGED_BY_LABEL}: ${MANAGED_BY_VALUE}`,
  )
}

const Editor = lazy(() => import('@monaco-editor/react').then((m) => ({ default: m.Editor })))

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contextName: string | null
}

function splitYAMLDocuments(yaml: string): string[] {
  return yaml
    .split(/\n---\s*\n/)
    .map((doc) => doc.replace(/^---\s*\n/, '').trim())
    .filter((doc) => doc.length > 0 && !/^---\s*$/.test(doc))
}

export function MetricsServerInstaller({ open, onOpenChange, contextName }: Props) {
  const theme = useThemeMode()
  const [manifest, setManifest] = useState<string>('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [insecureApplied, setInsecureApplied] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(
    null,
  )

  useEffect(() => {
    if (!open) {
      setManifest('')
      setLoadError(null)
      setProgress(null)
      setInsecureApplied(false)
      return
    }
    let cancelled = false
    setLoadError(null)
    setManifest('')
    let fetched: string | null = null
    let recommendation: boolean | null = null
    const tryFinish = () => {
      if (cancelled || fetched === null || recommendation === null) return
      if (recommendation) {
        setInsecureApplied(true)
        setManifest(injectInsecureFlag(fetched))
      } else {
        setInsecureApplied(false)
        setManifest(fetched)
      }
    }
    api
      .fetchMetricsServerManifest()
      .then((text) => {
        if (!cancelled) {
          fetched = text
          tryFinish()
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(`Could not fetch manifest: ${String(e)}`)
      })
    if (contextName) {
      api
        .recommendInsecureKubeletTLS(contextName)
        .then((needed) => {
          if (!cancelled) {
            recommendation = needed
            tryFinish()
          }
        })
        .catch(() => {
          if (!cancelled) {
            recommendation = false
            tryFinish()
          }
        })
    } else {
      recommendation = false
    }
    return () => {
      cancelled = true
    }
  }, [open, contextName])

  const install = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('No active context')
      const docs = splitYAMLDocuments(manifest)
      if (docs.length === 0) throw new Error('Manifest is empty')
      for (let i = 0; i < docs.length; i++) {
        const doc = injectManagedByLabel(docs[i])
        const kindMatch = doc.match(/^kind:\s*(\S+)/m)
        const nameMatch = doc.match(/^\s{2}name:\s*(\S+)/m)
        const label = `${kindMatch?.[1] ?? 'resource'}${nameMatch ? `/${nameMatch[1]}` : ''}`
        setProgress({ current: i + 1, total: docs.length, label })
        await api.applyResourceYAML(contextName, doc)
      }
      setProgress(null)
    },
    onSuccess: () => {
      toast.success('metrics-server installed')
      onOpenChange(false)
    },
    onError: (e) => {
      setProgress(null)
      toast.error(`Install failed: ${String(e)}`)
    },
  })

  const ready = manifest.length > 0 && !loadError
  const busy = install.isPending

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="flex h-[85vh] flex-col gap-3 sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Install metrics-server</DialogTitle>
          <DialogDescription>
            Fetches the upstream{' '}
            <code className="font-mono text-xs">components.yaml</code> from
            kubernetes-sigs/metrics-server and applies it to the active cluster. Klustr probes
            the apiserver → kubelet path before installing; if the kubelet serving certificate
            cannot be verified, it patches the Deployment automatically so the install actually
            works. Each resource is tagged with a{' '}
            <code className="font-mono text-xs">klustr/managed-by</code> label so you can
            roll this install back any time from the cluster overview menu. Review or edit
            below before applying.
          </DialogDescription>
        </DialogHeader>

        {ready && insecureApplied && (
          <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              This cluster's apiserver cannot verify the kubelet serving certificate, so{' '}
              <code className="font-mono">--kubelet-insecure-tls</code> has been added to the
              Deployment args. Without it the metrics-server pod would CrashLoop.
            </span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden rounded border border-border">
          {loadError ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
              {loadError}
            </div>
          ) : !ready ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Fetching latest manifest…
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading editor…
                </div>
              }
            >
              <Editor
                height="100%"
                defaultLanguage="yaml"
                value={manifest}
                onChange={(v) => setManifest(v ?? '')}
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  scrollBeyondLastLine: false,
                  readOnly: busy,
                }}
              />
            </Suspense>
          )}
        </div>

        <DialogFooter className="items-center">
          {progress && (
            <span className="mr-auto text-xs text-muted-foreground">
              Applying {progress.current}/{progress.total}: {progress.label}
            </span>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => install.mutate()} disabled={!ready || busy || !contextName}>
            {busy ? <Spinner size="lg" muted={false} /> : null}
            {busy ? 'Installing…' : 'Install'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
