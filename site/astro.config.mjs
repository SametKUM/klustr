import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

const SITE_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_DIR = path.resolve(SITE_DIR, '..')

// Last commit that touched any of the repository-relative paths, as an ISO
// timestamp, or undefined when git cannot answer.
function lastCommit(...paths) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...paths], {
      cwd: REPO_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return out || undefined
  } catch {
    return undefined
  }
}

// Sitemap <lastmod> follows the sources a page is rendered from, so a
// changed guide or comparison row moves its page, and the landing page moves
// with its data files. The changelog is rebuilt from the Releases API, so it
// carries the build time.
const SHARED = ['site/src/layouts', 'site/src/components', 'site/src/styles']
const PAGE_SOURCES = {
  '/': ['site/src/pages/index.astro', 'site/src/data', ...SHARED],
  '/install/': ['site/src/pages/install.astro', 'site/src/data/install.ts'],
  '/faq/': ['site/src/pages/faq.astro', 'site/src/data/faq.ts'],
  '/compare/': ['site/src/pages/compare/index.astro', 'site/src/data/compare.ts'],
  '/docs/': ['site/src/pages/docs/index.astro', 'site/src/lib/guides.ts', 'docs/guide'],
}

function lastmodFor(pathname) {
  if (pathname === '/changelog/') return new Date().toISOString()
  const docs = pathname.match(/^\/docs\/([^/]+)\/$/)
  if (docs) return lastCommit(`docs/guide/${docs[1]}.md`)
  if (/^\/compare\/[^/]+\/$/.test(pathname)) {
    return lastCommit('site/src/data/compare.ts', 'site/src/pages/compare/[slug].astro')
  }
  const sources = PAGE_SOURCES[pathname]
  return sources ? lastCommit(...sources) : undefined
}

export default defineConfig({
  site: 'https://klustr.dev',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      serialize(item) {
        const lastmod = lastmodFor(new URL(item.url).pathname)
        if (lastmod) item.lastmod = lastmod
        return item
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
