import { useMemo, useState } from 'react'
import { lazy, Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorBox } from '@/features/_shared/DetailPrimitives'
import { type HelmReleaseDetail, type HelmRevisionInfo } from '@/lib/api'
import { useThemeMode } from '@/features/_shared/useThemeMode'
import { formatAge } from '@/lib/time'

const Editor = lazy(() => import('@monaco-editor/react').then((m) => ({ default: m.Editor })))

type Tab = 'overview' | 'values' | 'manifest' | 'notes' | 'history'

type Props = {
  detail: HelmReleaseDetail | null
  error: string | null
  onRequestRollback: (rev: number) => void
  onRequestRollbackPicker: () => void
  onRequestUpgrade: () => void
  onRequestUninstall: () => void
}

export function HelmReleaseDetailBody({
  detail,
  error,
  onRequestRollback,
  onRequestRollbackPicker,
  onRequestUpgrade,
  onRequestUninstall,
}: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail)
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading release…
      </div>
    )

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-row items-center justify-between gap-2 px-6 pt-3">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="values">Values</TabsTrigger>
          <TabsTrigger value="manifest">Manifest</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRequestUpgrade}
            className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-accent"
          >
            Upgrade
          </button>
          <button
            type="button"
            onClick={onRequestRollbackPicker}
            disabled={detail.revisions.length < 2}
            className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            title={detail.revisions.length < 2 ? 'No previous revisions to roll back to' : undefined}
          >
            Rollback
          </button>
          <button
            type="button"
            onClick={onRequestUninstall}
            className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20"
          >
            Uninstall
          </button>
        </div>
      </div>
      <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <Overview detail={detail} />
      </TabsContent>
      <TabsContent value="values" className="min-h-0 flex-1 p-0">
        <ValuesView userValues={detail.userValues} mergedValues={detail.mergedValues} />
      </TabsContent>
      <TabsContent value="manifest" className="min-h-0 flex-1 p-0">
        <YAMLView body={detail.manifest} language="yaml" />
      </TabsContent>
      <TabsContent value="notes" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <pre className="whitespace-pre-wrap break-words text-xs font-mono">
          {detail.notes || '(no notes)'}
        </pre>
      </TabsContent>
      <TabsContent value="history" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <HistoryList
          revisions={detail.revisions}
          currentRevision={detail.info.revision}
          onRollback={onRequestRollback}
        />
      </TabsContent>
    </Tabs>
  )
}

function Overview({ detail }: { detail: HelmReleaseDetail }) {
  const rows: Array<[string, string]> = [
    ['Name', detail.info.name],
    ['Namespace', detail.info.namespace],
    ['Revision', `#${detail.info.revision}`],
    ['Status', detail.info.status],
    ['Chart', `${detail.chartName}-${detail.chartVersion}`],
    ['App version', detail.appVersion || '—'],
    ['Updated', detail.info.updated ? formatAge(detail.info.updated) : '—'],
    ['Description', detail.info.description || '—'],
  ]
  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-border/40">
            <th className="w-32 py-1 text-left font-medium text-muted-foreground">{k}</th>
            <td className="py-1 font-mono">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ValuesView({ userValues, mergedValues }: { userValues: string; mergedValues: string }) {
  const [mode, setMode] = useState<'user' | 'merged'>('user')
  const value = mode === 'user' ? userValues : mergedValues
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs">
        <button
          type="button"
          onClick={() => setMode('user')}
          className={`rounded px-2 py-0.5 ${mode === 'user' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
        >
          User-supplied
        </button>
        <button
          type="button"
          onClick={() => setMode('merged')}
          className={`rounded px-2 py-0.5 ${mode === 'merged' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
        >
          Chart defaults
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <YAMLView body={value || '{}\n'} language="yaml" />
      </div>
    </div>
  )
}

function YAMLView({ body, language }: { body: string; language: string }) {
  const theme = useThemeMode()
  const options = useMemo(
    () => ({
      readOnly: true,
      minimap: { enabled: false },
      lineNumbers: 'on' as const,
      scrollBeyondLastLine: false,
      fontSize: 12,
      fontFamily:
        '"JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      automaticLayout: true,
    }),
    [],
  )
  return (
    <Suspense
      fallback={<div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading editor…</div>}
    >
      <Editor
        height="100%"
        language={language}
        value={body}
        theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
        options={options}
      />
    </Suspense>
  )
}

function HistoryList({
  revisions,
  currentRevision,
  onRollback,
}: {
  revisions: HelmRevisionInfo[]
  currentRevision: number
  onRollback: (rev: number) => void
}) {
  if (revisions.length === 0) {
    return <div className="text-xs text-muted-foreground">No history yet.</div>
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th className="py-1">Rev</th>
          <th className="py-1">Status</th>
          <th className="py-1">Chart</th>
          <th className="py-1">App</th>
          <th className="py-1">Updated</th>
          <th className="py-1">Description</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {revisions.map((r) => (
          <tr key={r.revision} className="border-b border-border/40">
            <td className="py-1 font-mono">#{r.revision}</td>
            <td className="py-1">{r.status}</td>
            <td className="py-1 font-mono">{r.chart}</td>
            <td className="py-1 font-mono">{r.appVersion || '—'}</td>
            <td className="py-1">{r.updated ? formatAge(r.updated) : '—'}</td>
            <td className="py-1">{r.description}</td>
            <td className="py-1 text-right">
              {r.revision !== currentRevision && (
                <button
                  type="button"
                  onClick={() => onRollback(r.revision)}
                  className="rounded border border-border bg-background px-2 py-0.5 hover:bg-accent"
                >
                  Rollback
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
