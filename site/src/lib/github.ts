import { SITE } from './site'

export type Release = {
  tag: string
  name: string
  publishedAt: string
  url: string
  body: string
  prerelease: boolean
}

export type RepoStats = {
  stars: number
}

const API = `https://api.github.com/repos/${SITE.repo}`

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'klustr-site-build',
  }
  const token = process.env.GITHUB_TOKEN
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

async function getJson<T>(path: string): Promise<T | undefined> {
  try {
    const res = await fetch(`${API}${path}`, { headers: headers() })
    if (!res.ok) {
      console.warn(`[github] ${path} → ${res.status} ${res.statusText}; using fallback`)
      return undefined
    }
    return (await res.json()) as T
  } catch (err) {
    console.warn(`[github] ${path} failed: ${String(err)}; using fallback`)
    return undefined
  }
}

type ApiRelease = {
  tag_name: string
  name: string | null
  published_at: string
  html_url: string
  body: string | null
  prerelease: boolean
  draft: boolean
}

let releasesPromise: Promise<Release[]> | undefined

// Build-time snapshot of every published release, newest first. The API
// pages at 100, so keep going until a short page. A failed fetch (offline,
// rate limited) degrades to whatever was collected so the site still builds;
// the pages that consume it fall back to linking GitHub directly.
async function collectReleases(): Promise<Release[]> {
  const all: ApiRelease[] = []
  for (let page = 1; page <= 10; page++) {
    const list = await getJson<ApiRelease[]>(`/releases?per_page=100&page=${page}`)
    if (!list) break
    all.push(...list)
    if (list.length < 100) break
  }
  return all
    .filter((r) => !r.draft)
    .map((r) => ({
      tag: r.tag_name,
      name: r.name?.trim() || r.tag_name,
      publishedAt: r.published_at,
      url: r.html_url,
      body: r.body ?? '',
      prerelease: r.prerelease,
    }))
}

export function fetchReleases(): Promise<Release[]> {
  releasesPromise ??= collectReleases()
  return releasesPromise
}

export async function latestRelease(): Promise<Release | undefined> {
  const releases = await fetchReleases()
  return releases.find((r) => !r.prerelease) ?? releases[0]
}

export async function firstRelease(): Promise<Release | undefined> {
  const releases = await fetchReleases()
  return releases[releases.length - 1]
}

let statsPromise: Promise<RepoStats | undefined> | undefined

export function fetchRepoStats(): Promise<RepoStats | undefined> {
  statsPromise ??= getJson<{ stargazers_count: number }>('').then((repo) =>
    repo ? { stars: repo.stargazers_count } : undefined,
  )
  return statsPromise
}

export function formatStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}
