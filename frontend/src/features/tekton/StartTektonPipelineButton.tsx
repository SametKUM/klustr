import { useCallback, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Play } from 'lucide-react'
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
import { api, type TektonPipelineDetail } from '@/lib/api'
import { ContextBadge } from '@/features/_shared/ContextBadge'
import { ErrorBox } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { findCRD, useCRDStore } from '@/store/crds'
import { useUIStore } from '@/store/ui'
import { TEKTON_GROUP, TEKTON_PIPELINERUN_RESOURCE } from './tektonKinds'
import {
  WORKSPACE_KINDS,
  buildStartOptions,
  initialStartForm,
  startProblems,
  type StartForm,
  type WorkspaceForm,
  type WorkspaceKind,
} from './tektonStart'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

const INPUT = 'w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs'

// StartTektonPipelineButton creates a PipelineRun of the Pipeline from a form
// of its declared params and workspaces, like `tkn pipeline start`.
export function StartTektonPipelineButton({ contextName, namespace, name }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
        <Play />
        Start
      </Button>
      {open && <StartDialog contextName={contextName} namespace={namespace} name={name} onClose={() => setOpen(false)} />}
    </>
  )
}

function StartDialog({ contextName, namespace, name, onClose }: Props & { onClose: () => void }) {
  const load = useCallback((ctx: string) => api.getTektonPipeline(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<TektonPipelineDetail>(contextName, 'Pipeline', namespace, name, load)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start Pipeline</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p>
                Creates a PipelineRun of <span className="font-mono text-xs">{namespace}/{name}</span>. It starts right
                away.
              </p>
              <ContextBadge contextName={contextName} label="Target context" />
            </div>
          </DialogDescription>
        </DialogHeader>
        {error && <ErrorBox>{error}</ErrorBox>}
        {!detail && !error && <div className="py-6 text-center text-xs text-muted-foreground">Loading pipeline…</div>}
        {detail && <StartFormBody contextName={contextName} namespace={namespace} detail={detail} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function StartFormBody({
  contextName,
  namespace,
  detail,
  onDone,
}: {
  contextName: string | null
  namespace: string
  detail: TektonPipelineDetail
  onDone: () => void
}) {
  const openResource = useUIStore((s) => s.openResource)
  const crd = useCRDStore((s) =>
    contextName ? findCRD(s.byContext, contextName, TEKTON_GROUP, TEKTON_PIPELINERUN_RESOURCE) : null,
  )
  const [form, setForm] = useState<StartForm>(() => initialStartForm(detail.params, detail.workspaces))
  const problems = startProblems(detail.params, detail.workspaces, form)

  const start = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      return api.startTektonPipeline(contextName, namespace, detail.name, buildStartOptions(detail.params, detail.workspaces, form))
    },
    onSuccess: (created) => {
      toast.success(`Started PipelineRun ${created}`)
      onDone()
      if (contextName && crd) {
        openResource({
          kind: 'PipelineRun',
          namespace,
          name: created,
          context: contextName,
          gvr: { group: crd.group, version: crd.version, resource: crd.resource },
        })
      }
    },
  })

  const setParam = (key: string, value: string) => setForm((f) => ({ ...f, params: { ...f.params, [key]: value } }))
  const setWorkspace = (key: string, patch: Partial<WorkspaceForm>) =>
    setForm((f) => ({ ...f, workspaces: { ...f.workspaces, [key]: { ...f.workspaces[key], ...patch } } }))

  return (
    <>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 text-xs">
        {detail.params.length > 0 && (
          <fieldset className="space-y-3">
            <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Params</legend>
            {detail.params.map((p) => {
              const multiline = p.type === 'array' || p.type === 'object'
              const id = `tekton-param-${p.name}`
              return (
                <div key={p.name} className="space-y-1">
                  <label htmlFor={id} className="flex items-baseline gap-2">
                    <span className="font-mono">{p.name}</span>
                    <span className="text-muted-foreground">
                      {p.type}
                      {p.type === 'array' && ', one item per line'}
                      {p.type === 'object' && ', one key=value per line'}
                      {!p.hasDefault && p.type !== 'array' && ', required'}
                    </span>
                  </label>
                  {multiline ? (
                    <textarea
                      id={id}
                      rows={3}
                      spellCheck={false}
                      value={form.params[p.name] ?? ''}
                      onChange={(e) => setParam(p.name, e.target.value)}
                      className={INPUT}
                    />
                  ) : (
                    <input
                      id={id}
                      type="text"
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                      value={form.params[p.name] ?? ''}
                      onChange={(e) => setParam(p.name, e.target.value)}
                      className={INPUT}
                    />
                  )}
                  {p.description && <p className="text-muted-foreground">{p.description}</p>}
                </div>
              )
            })}
          </fieldset>
        )}
        {detail.workspaces.length > 0 && (
          <fieldset className="space-y-3">
            <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workspaces
            </legend>
            {detail.workspaces.map((w) => {
              const b = form.workspaces[w.name]
              const kind = WORKSPACE_KINDS.find((k) => k.value === b.kind)
              return (
                <div key={w.name} className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono">{w.name}</span>
                    {w.optional && <span className="text-muted-foreground">optional</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      aria-label={`Workspace ${w.name} source`}
                      value={b.kind}
                      onChange={(e) => setWorkspace(w.name, { kind: e.target.value as WorkspaceKind })}
                      className="rounded border border-border bg-background px-2 py-1.5 text-xs"
                    >
                      {w.optional && <option value="none">Not bound</option>}
                      {WORKSPACE_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                    {kind?.source && (
                      <input
                        aria-label={`Workspace ${w.name} ${kind.source}`}
                        placeholder={kind.source}
                        value={b.source}
                        onChange={(e) => setWorkspace(w.name, { source: e.target.value })}
                        className={INPUT}
                      />
                    )}
                    {b.kind === 'volumeClaimTemplate' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          aria-label={`Workspace ${w.name} size`}
                          placeholder="Size"
                          value={b.size}
                          onChange={(e) => setWorkspace(w.name, { size: e.target.value })}
                          className={INPUT}
                        />
                        <input
                          aria-label={`Workspace ${w.name} storage class`}
                          placeholder="Storage class"
                          value={b.storageClass}
                          onChange={(e) => setWorkspace(w.name, { storageClass: e.target.value })}
                          className={INPUT}
                        />
                      </div>
                    )}
                  </div>
                  {w.description && <p className="text-muted-foreground">{w.description}</p>}
                </div>
              )
            })}
          </fieldset>
        )}
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Run</legend>
          <label className="space-y-1">
            <span>Service account</span>
            <input
              placeholder="default"
              value={form.serviceAccount}
              onChange={(e) => setForm((f) => ({ ...f, serviceAccount: e.target.value }))}
              className={INPUT}
            />
          </label>
          <label className="space-y-1">
            <span>Timeout</span>
            <input
              placeholder="cluster default, e.g. 1h30m"
              value={form.timeout}
              onChange={(e) => setForm((f) => ({ ...f, timeout: e.target.value }))}
              className={INPUT}
            />
          </label>
        </fieldset>
      </div>
      {problems.length > 0 && (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}
      {start.error && <ErrorBox>{String(start.error)}</ErrorBox>}
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={start.isPending}>
          Cancel
        </Button>
        <Button onClick={() => start.mutate()} disabled={start.isPending || problems.length > 0}>
          {start.isPending ? 'Starting…' : 'Start'}
        </Button>
      </DialogFooter>
    </>
  )
}
