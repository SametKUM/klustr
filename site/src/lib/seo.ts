import { LATEST_RELEASE_URL, LICENSE_URL, REPO_URL, SITE, absoluteUrl } from './site'

export type JsonLd = Record<string, unknown>

export const PERSON_ID = `${SITE.url}/#author`
export const WEBSITE_ID = `${SITE.url}/#website`
export const APP_ID = `${SITE.url}/#app`

export function personLd(): JsonLd {
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: SITE.author,
    url: 'https://github.com/SametKUM',
  }
}

export function websiteLd(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE.name,
    url: `${SITE.url}/`,
    description: SITE.description,
    inLanguage: 'en',
    publisher: { '@id': PERSON_ID },
  }
}

export function softwareLd(opts: { version?: string; screenshots: string[]; features: string[] }): JsonLd {
  return {
    '@type': 'SoftwareApplication',
    '@id': APP_ID,
    name: SITE.name,
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Kubernetes desktop client',
    operatingSystem: 'macOS, Linux',
    description: SITE.description,
    url: `${SITE.url}/`,
    downloadUrl: LATEST_RELEASE_URL,
    installUrl: `${SITE.url}/install/`,
    softwareHelp: `${SITE.url}/docs/`,
    releaseNotes: `${SITE.url}/changelog/`,
    license: LICENSE_URL,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@id': PERSON_ID },
    ...(opts.version ? { softwareVersion: opts.version.replace(/^v/, '') } : {}),
    screenshot: opts.screenshots,
    featureList: opts.features,
    sameAs: [REPO_URL],
  }
}

export function sourceCodeLd(): JsonLd {
  return {
    '@type': 'SoftwareSourceCode',
    '@id': `${SITE.url}/#source`,
    name: SITE.name,
    codeRepository: REPO_URL,
    programmingLanguage: ['Go', 'TypeScript'],
    runtimePlatform: 'Wails',
    license: LICENSE_URL,
    author: { '@id': PERSON_ID },
    targetProduct: { '@id': APP_ID },
  }
}

export function breadcrumbLd(items: { name: string; path: string }[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function articleLd(opts: {
  type?: 'TechArticle' | 'Article'
  headline: string
  description: string
  path: string
  dateModified?: string
}): JsonLd {
  return {
    '@type': opts.type ?? 'TechArticle',
    headline: opts.headline,
    description: opts.description,
    url: absoluteUrl(opts.path),
    mainEntityOfPage: absoluteUrl(opts.path),
    inLanguage: 'en',
    author: { '@id': PERSON_ID },
    publisher: { '@id': PERSON_ID },
    about: { '@id': APP_ID },
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
  }
}

export function faqLd(items: { question: string; answerText: string }[]): JsonLd {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answerText },
    })),
  }
}

export function graph(nodes: JsonLd[]): JsonLd {
  return { '@context': 'https://schema.org', '@graph': nodes }
}
