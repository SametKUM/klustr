import type { APIRoute } from 'astro'
import { GUIDES, loadGuideMarkdown } from '../lib/guides'
import { SITE, absoluteUrl } from '../lib/site'

export const GET: APIRoute = async () => {
  const guides = await Promise.all(
    GUIDES.map(async (guide) => {
      const markdown = await loadGuideMarkdown(guide.slug)
      return `<!-- source: ${absoluteUrl(`/docs/${guide.slug}/`)} -->\n\n${markdown.trim()}`
    }),
  )

  const body = `# ${SITE.name} documentation

> ${SITE.description}

This file is every user guide in full, in the order they appear on the
documentation index. The short index is at ${absoluteUrl('/llms.txt')}.

---

${guides.join('\n\n---\n\n')}
`

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
