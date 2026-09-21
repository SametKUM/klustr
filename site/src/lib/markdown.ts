import { Marked, type Token, type Tokens } from 'marked'

export type Heading = { depth: number; id: string; text: string }

export type Rendered = {
  html: string
  title: string
  description: string
  headings: Heading[]
}

// GitHub-compatible heading anchors, so the `guide.md#section` cross-links the
// guides already use keep resolving after they are rewritten to site routes.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const GUIDE_LINK = /^([a-z0-9-]+)\.md(#[\w-]*)?$/

function rewriteHref(href: string): string {
  const m = GUIDE_LINK.exec(href)
  return m ? `/docs/${m[1]}/${m[2] ?? ''}` : href
}

function plainText(tokens: Tokens.Generic[] | undefined): string {
  if (!tokens) return ''
  return tokens
    .map((t) => {
      if ('tokens' in t && Array.isArray(t.tokens)) return plainText(t.tokens as Tokens.Generic[])
      if (t.type === 'codespan' || t.type === 'text' || t.type === 'escape') return String(t.text ?? '')
      return String(t.raw ?? '')
    })
    .join('')
}

function createMarked(headings: Heading[]) {
  const marked = new Marked({ gfm: true })
  marked.use({
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const text = plainText(tokens)
        const id = slugify(text)
        if (depth > 1) headings.push({ depth, id, text })
        const inner = this.parser.parseInline(tokens)
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`
      },
      link({ href, title, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens)
        const target = rewriteHref(href)
        const external = /^https?:\/\//.test(target)
        const attrs = [
          `href="${escapeHtml(target)}"`,
          title ? `title="${escapeHtml(title)}"` : '',
          external ? 'rel="noreferrer"' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return `<a ${attrs}>${inner}</a>`
      },
    },
  })
  return marked
}

// Renders a guide-style document: the first H1 becomes the page title and is
// dropped from the body (the layout renders it), the first paragraph becomes
// the meta description, and H2/H3 anchors are collected for the sidebar.
export function renderDocument(markdown: string): Rendered {
  const headings: Heading[] = []
  const marked = createMarked(headings)
  const tokens = marked.lexer(markdown)

  let title = ''
  let description = ''
  const body: Token[] = []
  for (const token of tokens) {
    if (!title && token.type === 'heading' && token.depth === 1) {
      title = plainText(token.tokens)
      continue
    }
    if (!description && token.type === 'paragraph') {
      description = plainText(token.tokens).replace(/\s+/g, ' ').trim()
    }
    body.push(token)
  }

  const html = marked.parser(body)
  return { html, title, description, headings }
}

// Renders a fragment (an FAQ answer, a release note) with no title handling.
export function renderFragment(markdown: string): string {
  return createMarked([]).parse(markdown, { async: false })
}

// Reads the text off the markdown tokens instead of stripping tags from
// rendered HTML: one regex pass can leave a `<script` behind, and the
// round-trip would also carry escaped entities into what callers treat as
// plain text.
export function stripMarkdown(markdown: string): string {
  return plainText(createMarked([]).lexer(markdown) as Tokens.Generic[])
    .replace(/\s+/g, ' ')
    .trim()
}
