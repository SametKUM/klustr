import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contextName: string | null
}

type ResourceRef = {
  kind: string
  name: string
  namespace: string
}

function splitYAMLDocuments(yaml: string): string[] {
  return yaml
    .split(/\n---\s*\n/)
    .map((doc) => doc.replace(/^---\s*\n/, '').trim())
    .filter((doc) => doc.length > 0 && !/^---\s*$/.test(doc))
}

function extractRef(doc: string): ResourceRef | null {
  const kindMatch = doc.match(/^kind:\s*(\S+)/m)
  if (!kindMatch) return null
  const metaIdx = doc.search(/^metadata:\s*$/m)
  if (metaIdx === -1) return null
  const strip = (s: string) => s.replace(/^["']|["']$/g, '')
  let name = ''
  let namespace = ''
  const lines = doc.slice(metaIdx).split('\n').slice(1)
  for (const line of lines) {
    if (line.length > 0 && !/^\s/.test(line)) break
    const nameM = line.match(/^ {2}name:\s+(\S+)/)
    if (nameM && !name) name = strip(nameM[1])
    const nsM = line.match(/^ {2}namespace:\s+(\S+)/)
    if (nsM && !namespace) namespace = strip(nsM[1])
  }
  if (!name) return null
  return { kind: kindMatch[1], name, namespace }
}

function isMissingResourceError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('not found') ||
    lower.includes('could not find the requested resource')
  )
}

export function MetricsServerUninstaller({ open, onOpenChange, contextName }: Props) {
  const [manifest, setManifest] = useState<string>('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(
    null,
  )

  useEffect(() => {
    if (!open) {
      setManifest('')
      setLoadError(null)
      setProgress(null)
      return
    }
    let cancelled = false
    api
      .fetchMetricsServerManifest()
      .then((text) => {
        if (!cancelled) setManifest(text)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(`Could not fetch manifest: ${String(e)}`)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const refs = useMemo<ResourceRef[]>(() => {
    if (!manifest) return []
    return splitYAMLDocuments(manifest)
      .map(extractRef)
      .filter((r): r is ResourceRef => r !== null)
  }, [manifest])

  const uninstall = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('No active context')
      if (refs.length === 0) throw new Error('Manifest is empty')
      const failures: string[] = []
      for (let i = 0; i < refs.length; i++) {
        const ref = refs[i]
        const label = `${ref.kind}/${ref.name}`
        setProgress({ current: i + 1, total: refs.length, label })
        try {
          await api.deleteResource(contextName, ref.kind, ref.namespace, ref.name)
        } catch (e) {
          if (!isMissingResourceError(String(e))) {
            failures.push(`${label}: ${String(e)}`)
          }
        }
      }
      setProgress(null)
      if (failures.length > 0) {
        throw new Error(failures.join('; '))
      }
    },
    onSuccess: () => {
      toast.success('metrics-server uninstalled')
      onOpenChange(false)
    },
    onError: (e) => {
      setProgress(null)
      toast.error(`Uninstall failed: ${String(e)}`)
    },
  })

  const ready = refs.length > 0 && !loadError
  const busy = uninstall.isPending

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Uninstall metrics-server</DialogTitle>
          <DialogDescription>
            Removes the resources that Klustr installs as part of metrics-server. The list comes
            from the upstream manifest, so any custom modifications you added through
            <code className="ml-1 font-mono text-xs">kubectl</code> or Helm are not touched.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto rounded border border-border bg-muted/40 p-3 text-xs">
          {loadError ? (
            <span className="text-destructive">{loadError}</span>
          ) : !ready ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Spinner /> Fetching manifest…
            </span>
          ) : (
            <ul className="space-y-1 font-mono">
              {refs.map((r, i) => (
                <li key={`${r.kind}-${r.name}-${i}`} className="truncate text-muted-foreground">
                  <span className="text-foreground">{r.kind}</span> {r.namespace ? `${r.namespace}/` : ''}
                  {r.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="items-center">
          {progress && (
            <span className="mr-auto text-xs text-muted-foreground">
              Deleting {progress.current}/{progress.total}: {progress.label}
            </span>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => uninstall.mutate()}
            disabled={!ready || busy || !contextName}
          >
            {busy ? <Spinner size="lg" muted={false} /> : null}
            {busy ? 'Uninstalling…' : 'Uninstall'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
