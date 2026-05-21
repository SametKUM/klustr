import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api, type HelmDryRunResult, type HelmInstallOptions } from '@/lib/api'
import { useUIStore } from '@/store/ui'
import { useThemeMode } from '@/features/_shared/useThemeMode'

const Editor = lazy(() => import('@monaco-editor/react').then((m) => ({ default: m.Editor })))

type Mode = 'install' | 'upgrade'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  // Required for upgrade, prefill for install.
  initialName?: string
  initialNamespace?: string
  initialChartRef?: string
  initialVersion?: string
  initialValues?: string
  onSuccess?: () => void
}

export function HelmInstallDialog({
  open,
  onOpenChange,
  mode,
  initialName = '',
  initialNamespace = 'default',
  initialChartRef = '',
  initialVersion = '',
  initialValues = '',
  onSuccess,
}: Props) {
  const contextName = useUIStore((s) => s.selectedContext)
  const theme = useThemeMode()
  const [name, setName] = useState(initialName)
  const [namespace, setNamespace] = useState(initialNamespace)
  const [chartRef, setChartRef] = useState(initialChartRef)
  const [chartVersion, setChartVersion] = useState(initialVersion)
  const [values, setValues] = useState(initialValues)
  const [createNS, setCreateNS] = useState(mode === 'install')
  const [wait, setWait] = useState(false)
  const [atomic, setAtomic] = useState(false)
  const [resetValues, setResetValues] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<HelmDryRunResult | null>(null)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setNamespace(initialNamespace || 'default')
    setChartRef(initialChartRef)
    setChartVersion(initialVersion)
    setValues(initialValues)
    setDryRunResult(null)
  }, [open, initialName, initialNamespace, initialChartRef, initialVersion, initialValues])

  const opts: HelmInstallOptions = useMemo(
    () => ({
      contextName: contextName ?? '',
      namespace,
      releaseName: name,
      chartRef,
      chartVersion,
      values,
      createNamespace: createNS,
      wait,
      atomic,
      timeoutSeconds: 0,
      dryRun: false,
      resetValues,
    }),
    [contextName, namespace, name, chartRef, chartVersion, values, createNS, wait, atomic, resetValues],
  )

  const dryRun = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      const fn = mode === 'install' ? api.installHelmRelease : api.upgradeHelmRelease
      return fn({ ...opts, dryRun: true })
    },
    onSuccess: (r) => {
      setDryRunResult(r)
      toast.success('Dry-run rendered')
    },
    onError: (e) => toast.error(`Dry-run failed: ${String(e)}`),
  })

  const apply = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      const fn = mode === 'install' ? api.installHelmRelease : api.upgradeHelmRelease
      await fn({ ...opts, dryRun: false })
    },
    onSuccess: () => {
      toast.success(mode === 'install' ? `Installed ${name}` : `Upgraded ${name}`)
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (e) => toast.error(`${mode === 'install' ? 'Install' : 'Upgrade'} failed: ${String(e)}`),
  })

  const formInvalid = !name.trim() || !chartRef.trim() || !namespace.trim()
  const pending = dryRun.isPending || apply.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="flex h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>
            {mode === 'install' ? 'Install Helm chart' : `Upgrade ${initialName}`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'install'
              ? 'Render a chart with custom values and install it as a new release.'
              : 'Apply a new chart version or values to an existing release.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <aside className="w-72 shrink-0 overflow-y-auto border-r border-border bg-sidebar/30 px-4 py-3 text-xs">
            <Field label="Release name">
              <input
                type="text"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={mode === 'upgrade'}
                className="w-full rounded border border-border bg-background px-2 py-1 font-mono"
              />
            </Field>
            <Field label="Namespace">
              <input
                type="text"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                disabled={mode === 'upgrade'}
                className="w-full rounded border border-border bg-background px-2 py-1 font-mono"
              />
            </Field>
            <Field label="Chart (repo/name or path)">
              <input
                type="text"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                value={chartRef}
                onChange={(e) => setChartRef(e.target.value)}
                placeholder="e.g. bitnami/redis or ./mychart"
                className="w-full rounded border border-border bg-background px-2 py-1 font-mono"
              />
            </Field>
            <Field label="Chart version (optional)">
              <input
                type="text"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                value={chartVersion}
                onChange={(e) => setChartVersion(e.target.value)}
                placeholder="latest"
                className="w-full rounded border border-border bg-background px-2 py-1 font-mono"
              />
            </Field>
            {mode === 'install' && (
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={createNS}
                  onChange={(e) => setCreateNS(e.target.checked)}
                />
                Create namespace if missing
              </label>
            )}
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={wait}
                onChange={(e) => setWait(e.target.checked)}
              />
              Wait until ready
            </label>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={atomic}
                onChange={(e) => setAtomic(e.target.checked)}
              />
              Atomic (auto-rollback on failure)
            </label>
            {mode === 'upgrade' && (
              <div className="mt-2 flex flex-col gap-1">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={resetValues}
                    onChange={(e) => setResetValues(e.target.checked)}
                  />
                  Ignore previous release values
                </label>
                <p className="pl-5 text-[10px] leading-snug text-muted-foreground/80">
                  Helm normally re-uses the values you applied last time. With this on,
                  it starts from chart defaults and only applies what's in the editor
                  below — clear the editor too if you want full chart defaults.
                </p>
              </div>
            )}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs">
              <span className="text-muted-foreground">Values (YAML)</span>
              <span className="ml-auto">
                {dryRunResult ? '● dry-run rendered' : 'No preview yet'}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Loading editor…
                  </div>
                }
              >
                <Editor
                  height="100%"
                  language="yaml"
                  value={values}
                  onChange={(v) => setValues(v ?? '')}
                  theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
                  options={{
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                    fontFamily:
                      '"JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    tabSize: 2,
                    automaticLayout: true,
                  }}
                />
              </Suspense>
            </div>
            {dryRunResult && (
              <div className="max-h-[40%] min-h-0 shrink-0 overflow-y-auto border-t border-border bg-muted/40 p-3 text-xs">
                <div className="mb-1 font-medium text-muted-foreground">Rendered manifest</div>
                <pre className="overflow-x-auto whitespace-pre font-mono text-[11px]">
                  {dryRunResult.manifest || '(empty)'}
                </pre>
                {dryRunResult.notes && (
                  <>
                    <div className="mb-1 mt-2 font-medium text-muted-foreground">Notes</div>
                    <pre className="whitespace-pre-wrap font-mono text-[11px]">
                      {dryRunResult.notes}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/40 px-6 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => dryRun.mutate()}
            disabled={pending || formInvalid}
          >
            {dryRun.isPending ? 'Rendering…' : 'Dry-run'}
          </Button>
          <Button
            type="button"
            onClick={() => apply.mutate()}
            disabled={pending || formInvalid}
          >
            {apply.isPending
              ? mode === 'install'
                ? 'Installing…'
                : 'Upgrading…'
              : mode === 'install'
                ? 'Install'
                : 'Upgrade'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
