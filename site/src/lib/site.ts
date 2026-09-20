export const SITE = {
  name: 'Klustr',
  url: 'https://klustr.dev',
  tagline: 'A native Kubernetes desktop client that installs nothing in your cluster',
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
