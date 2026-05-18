import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, RefreshCw, Search as SearchIcon, Trash2 } from 'lucide-react'
import { api, type HelmChartSearchResult } from '@/lib/api'
import { useHelmStore } from '@/store/helm'
import { Button } from '@/components/ui/button'
import { HelmInstallDialog } from './HelmInstallDialog'

export function HelmReposView() {
  const repos = useHelmStore((s) => s.repos)
  const setRepos = useHelmStore((s) => s.setRepos)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<HelmChartSearchResult[]>([])
  const [adding, setAdding] = useState(false)
  const [newRepoName, setNewRepoName] = useState('')
  const [newRepoURL, setNewRepoURL] = useState('')
  const [installFor, setInstallFor] = useState<HelmChartSearchResult | null>(null)

  const reloadRepos = useCallback(() => {
    api
      .listHelmRepos()
      .then((list) => setRepos(list ?? []))
      .catch((e) => toast.error(`Failed to load repos: ${String(e)}`))
  }, [setRepos])

  const reloadSearch = useCallback(
    (q: string) => {
      api
        .searchHelmCharts(q)
        .then((list) => setResults(list ?? []))
        .catch(() => setResults([]))
    },
    [],
  )

  useEffect(() => {
    reloadRepos()
    reloadSearch('')
  }, [reloadRepos, reloadSearch])

  const addRepo = useMutation({
    mutationFn: async () => {
      await api.addHelmRepo(newRepoName.trim(), newRepoURL.trim())
    },
    onSuccess: () => {
      toast.success(`Added repo ${newRepoName}`)
      setNewRepoName('')
      setNewRepoURL('')
      setAdding(false)
      reloadRepos()
      reloadSearch(query)
    },
    onError: (e) => toast.error(`Add failed: ${String(e)}`),
  })

  const removeRepo = useMutation({
    mutationFn: async (name: string) => {
      await api.removeHelmRepo(name)
    },
    onSuccess: (_, name) => {
      toast.success(`Removed ${name}`)
      reloadRepos()
      reloadSearch(query)
    },
    onError: (e) => toast.error(`Remove failed: ${String(e)}`),
  })

  const updateRepos = useMutation({
    mutationFn: async () => {
      await api.updateHelmRepos()
    },
    onSuccess: () => {
      toast.success('Repository indexes refreshed')
      reloadSearch(query)
    },
    onError: (e) => toast.error(`Refresh failed: ${String(e)}`),
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border bg-background px-4 py-2">
        <h2 className="text-sm font-medium">Helm repositories</h2>
        <Button
          size="xs"
          variant="outline"
          onClick={() => setAdding((v) => !v)}
          className="ml-2"
        >
          <Plus className="size-3" /> Add repo
        </Button>
        <Button
          size="xs"
          variant="outline"
          onClick={() => updateRepos.mutate()}
          disabled={updateRepos.isPending || repos.length === 0}
        >
          <RefreshCw className={`size-3 ${updateRepos.isPending ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </header>

      {adding && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs">
          <input
            type="text"
            value={newRepoName}
            onChange={(e) => setNewRepoName(e.target.value)}
            placeholder="name (e.g. bitnami)"
            className="w-40 rounded border border-border bg-background px-2 py-1 font-mono"
          />
          <input
            type="text"
            value={newRepoURL}
            onChange={(e) => setNewRepoURL(e.target.value)}
            placeholder="https://charts.bitnami.com/bitnami"
            className="flex-1 rounded border border-border bg-background px-2 py-1 font-mono"
          />
          <Button
            size="xs"
            onClick={() => addRepo.mutate()}
            disabled={addRepo.isPending || !newRepoName.trim() || !newRepoURL.trim()}
          >
            {addRepo.isPending ? 'Adding…' : 'Add'}
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-border">
          {repos.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">
              No repositories yet. Add one with the button above.
            </div>
          ) : (
            <ul className="divide-y divide-border text-xs">
              {repos.map((r) => (
                <li key={r.name} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-medium">{r.name}</div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                      {r.url}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRepo.mutate(r.name)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                    aria-label={`Remove ${r.name}`}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <SearchIcon className="size-3 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                reloadSearch(e.target.value)
              }}
              placeholder="Search charts (name, description, keywords)"
              className="flex-1 bg-transparent text-xs outline-none"
            />
            <span className="text-[10px] text-muted-foreground">{results.length} charts</span>
          </div>
          <ChartTable results={results} onInstall={(r) => setInstallFor(r)} />
        </main>
      </div>

      <HelmInstallDialog
        open={installFor !== null}
        onOpenChange={(o) => {
          if (!o) setInstallFor(null)
        }}
        mode="install"
        initialChartRef={
          installFor ? `${installFor.repo}/${installFor.name}` : ''
        }
        initialVersion={installFor?.version ?? ''}
        initialName={installFor?.name ?? ''}
      />
    </div>
  )
}

function ChartTable({
  results,
  onInstall,
}: {
  results: HelmChartSearchResult[]
  onInstall: (r: HelmChartSearchResult) => void
}) {
  const sorted = useMemo(
    () =>
      [...results].sort((a, b) =>
        a.repo === b.repo ? a.name.localeCompare(b.name) : a.repo.localeCompare(b.repo),
      ),
    [results],
  )
  if (sorted.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        No charts found. Try adding a repository or refreshing the index.
      </div>
    )
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background">
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-2">Repo</th>
            <th className="px-4 py-2">Chart</th>
            <th className="px-4 py-2">Version</th>
            <th className="px-4 py-2">App</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={`${r.repo}/${r.name}`} className="border-b border-border/40 hover:bg-muted/30">
              <td className="px-4 py-1.5 font-mono">{r.repo}</td>
              <td className="px-4 py-1.5 font-mono">{r.name}</td>
              <td className="px-4 py-1.5 font-mono">{r.version}</td>
              <td className="px-4 py-1.5 font-mono">{r.appVersion || '—'}</td>
              <td className="px-4 py-1.5 text-muted-foreground">{r.description}</td>
              <td className="px-4 py-1.5 text-right">
                <Button size="xs" onClick={() => onInstall(r)}>
                  Install
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
