export const SITE = {
  name: 'Klustr',
  url: 'https://klustr.dev',
  // The home page <title>; kept under 60 characters so search results show it whole.
  title: 'Klustr: open-source Kubernetes desktop GUI for macOS & Linux',
  // The home page meta description; kept under 160 characters for the same reason.
  metaDescription:
    'Free, open-source Kubernetes desktop GUI for macOS and Linux. Live resources, Helm, Argo CD, Flux, Gateway API from your kubeconfig. Nothing in the cluster.',
  tagline: 'A native Kubernetes desktop client that installs nothing in your cluster',
  // The long form, for structured data where length is not a constraint.
  description:
    'Klustr is a free, open-source Kubernetes desktop client for macOS and Linux. Built in Go, it reads your kubeconfig and drives the API directly: live resources, RBAC review, Helm, Argo CD, Flux, Gateway API and cert-manager, with nothing installed in the cluster.',
  author: 'Samet Kum',
  repo: 'SametKUM/klustr',
  license: 'MIT',
} as const

export const REPO_URL = `https://github.com/${SITE.repo}`
export const RELEASES_URL = `${REPO_URL}/releases`
export const LATEST_RELEASE_URL = `${REPO_URL}/releases/latest`
export const ISSUES_URL = `${REPO_URL}/issues`
export const NEW_BUG_URL = `${REPO_URL}/issues/new?template=bug_report.yml`
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`
export const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md`
export const SECURITY_URL = `${REPO_URL}/blob/main/SECURITY.md`

export const NAV = [
  { href: '/#features', label: 'Features' },
  { href: '/compare/', label: 'Compare' },
  { href: '/docs/', label: 'Docs' },
  { href: '/faq/', label: 'FAQ' },
  { href: '/changelog/', label: 'Changelog' },
] as const

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.url).toString()
}

// Search results cut descriptions at roughly 160 characters. Prefer ending on
// a sentence inside the limit; otherwise end on a word and mark the cut.
export function clampDescription(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const head = clean.slice(0, max)
  const sentenceEnd = head.lastIndexOf('. ')
  if (sentenceEnd > max * 0.55) return head.slice(0, sentenceEnd + 1)
  return `${head.slice(0, head.lastIndexOf(' '))}…`
}
