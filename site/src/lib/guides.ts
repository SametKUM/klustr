import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { renderDocument, type Rendered } from './markdown'

// The user guides are the markdown files under docs/guide in the repository
// root. The site renders them in place so there is one source of truth; this
// list only adds the ordering, grouping and card copy the docs index needs.
// Resolved from the working directory because the build bundles this module
// under dist/, where a URL relative to import.meta.url no longer points home.
const GUIDE_DIR = path.resolve(process.cwd(), '..', 'docs', 'guide')

export type GuideMeta = {
  slug: string
  group: string
  summary: string
}

export const GUIDE_GROUPS: { name: string; guides: GuideMeta[] }[] = [
  {
    name: 'getting around',
    guides: [
      {
        slug: 'getting-started',
        group: 'getting around',
        summary: 'Connect to a context, choose namespaces and browse production safely in read-only mode.',
      },
      {
        slug: 'multi-context',
        group: 'getting around',
        summary: 'View two or more clusters as one, save named groups and tag contexts with a color stripe.',
      },
    ],
  },
  {
    name: 'connecting',
    guides: [
      {
        slug: 'credential-helpers',
        group: 'connecting',
        summary: 'Make aws-vault and other exec plugins work when Klustr is launched from the Dock or Finder.',
      },
    ],
  },
  {
    name: 'working with resources',
    guides: [
      {
        slug: 'overview',
        group: 'working with resources',
        summary: 'Capacity donuts, workload health bars and the recent-events feed.',
      },
      {
        slug: 'workloads-and-debugging',
        group: 'working with resources',
        summary: 'Logs, exec, debug containers, port-forward, node shell, drain, events and pod diagnosis.',
      },
      {
        slug: 'terminal',
        group: 'working with resources',
        summary: 'The built-in shell drawer, copy and paste rules, and launching an external terminal.',
      },
      {
        slug: 'helm',
        group: 'working with resources',
        summary: 'Browse releases and run install, upgrade, rollback and uninstall with a dry-run first.',
      },
      {
        slug: 'gitops',
        group: 'working with resources',
        summary: 'Argo CD and Flux: sync, refresh, reconcile and suspend through the Kubernetes API.',
      },
      {
        slug: 'gateway-api',
        group: 'working with resources',
        summary: 'Gateways, routes, ListenerSets and how to read route status when something is rejected.',
      },
      {
        slug: 'integrations',
        group: 'working with resources',
        summary: 'cert-manager, Istio, Karpenter and KEDA views that appear when their CRDs are present.',
      },
      {
        slug: 'custom-resources',
        group: 'working with resources',
        summary: 'How CRDs are auto-discovered, the generic browser and the promoted typed integrations.',
      },
    ],
  },
]

export const GUIDES: GuideMeta[] = GUIDE_GROUPS.flatMap((g) => g.guides)

export type Guide = GuideMeta & Rendered

export function loadGuideMarkdown(slug: string): Promise<string> {
  return readFile(path.join(GUIDE_DIR, `${slug}.md`), 'utf8')
}

export async function loadGuide(slug: string): Promise<Guide> {
  const meta = GUIDES.find((g) => g.slug === slug)
  if (!meta) throw new Error(`guide "${slug}" is not listed in GUIDE_GROUPS`)
  const markdown = await loadGuideMarkdown(slug)
  const rendered = renderDocument(markdown)
  if (!rendered.title) throw new Error(`guide "${slug}" has no H1 title`)
  return { ...meta, ...rendered }
}

// Fails the build when a guide is added to docs/guide without a card here,
// so the site index never silently lags behind the repository.
export async function assertGuidesIndexed(): Promise<void> {
  const files = (await readdir(GUIDE_DIR)).filter((f) => f.endsWith('.md') && f !== 'README.md')
  const missing = files.map((f) => f.replace(/\.md$/, '')).filter((slug) => !GUIDES.some((g) => g.slug === slug))
  if (missing.length) throw new Error(`guides missing from GUIDE_GROUPS: ${missing.join(', ')}`)
}
