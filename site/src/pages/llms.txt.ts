import type { APIRoute } from 'astro'
import { COMPARE_PAGES, TOOLS } from '../data/compare'
import { GUIDE_GROUPS, loadGuideMarkdown } from '../lib/guides'
import { REPO_URL, SITE, absoluteUrl } from '../lib/site'

const link = (label: string, path: string, note: string) => `- [${label}](${absoluteUrl(path)}): ${note}`

const PAGES = [
  link('Home', '/', SITE.metaDescription),
  link('Install', '/install/', 'Homebrew, the AUR package, the .deb, the tarballs and building from source.'),
  link('FAQ', '/faq/', 'What Klustr installs, which platforms it runs on, how it authenticates and what it costs.'),
  link('Documentation index', '/docs/', 'All task-focused guides, grouped.'),
  link('Comparisons', '/compare/', 'Klustr next to Lens, k9s, Headlamp and Kubernetes Dashboard, row by row.'),
]

// The heading each guide carries in docs/guide, so the list reads the way the
// page does rather than the way its slug is spelled.
async function guideTitle(slug: string): Promise<string> {
  const markdown = await loadGuideMarkdown(slug)
  const heading = markdown.match(/^#\s+(.+)$/m)
  if (!heading) throw new Error(`guide "${slug}" has no H1 title`)
  return heading[1].trim()
}

const COMPARISONS = COMPARE_PAGES.map((page) =>
  link(page.heading, `/compare/${page.slug}/`, TOOLS[page.tool].summary),
)

const OPTIONAL = [
  link('Changelog', '/changelog/', 'Release notes, rendered from the GitHub Releases API.'),
  `- [Source repository](${REPO_URL}): Go backend, React frontend, MIT licensed.`,
]

const DOCS = await Promise.all(
  GUIDE_GROUPS.flatMap((group) =>
    group.guides.map(async (guide) => link(await guideTitle(guide.slug), `/docs/${guide.slug}/`, guide.summary)),
  ),
)

const body = `# ${SITE.name}

> ${SITE.description}

Klustr is a desktop application, not a service and not an in-cluster component. It reads the user's kubeconfig and drives the standard Kubernetes API directly, the way kubectl does, so there is no agent, operator, CRD or sign-in. The backend is Go with client-go; the window is Wails with a React frontend.

The full text of every guide is at ${absoluteUrl('/llms-full.txt')}.

## Pages

${PAGES.join('\n')}

## Docs

${DOCS.join('\n')}

## Comparisons

${COMPARISONS.join('\n')}

## Optional

${OPTIONAL.join('\n')}
`

export const GET: APIRoute = () =>
  new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
