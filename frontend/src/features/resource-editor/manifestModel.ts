import { isScalar, LineCounter, parseAllDocuments, type Tags } from 'yaml'
import type { ManifestKind, ManifestOperation } from '@/lib/api'

export const MAX_MANIFEST_BYTES = 2 * 1024 * 1024
export const MAX_MANIFEST_RESOURCES = 200

export type ManifestObject = Record<string, unknown>
export type OutlineResource = {
  index: number
  document: number
  line: number
  apiVersion: string
  kind: string
  name: string
  namespace: string
}

const uniqueManifestKeys = (a: unknown, b: unknown) =>
  isScalar(a) && isScalar(b) ? String(a.value) === String(b.value) : a === b

// Match Kubernetes' YAML v2 conversion: dates are literal strings, including keys.
const kubernetesYAMLTags = (tags: Tags): Tags => tags.map((tag) =>
  typeof tag !== 'string' && !tag.collection && tag.tag === 'tag:yaml.org,2002:timestamp'
    ? { ...tag, resolve: (value: string) => value, stringify: undefined }
    : tag,
)

function manifestJSONValue(value: unknown, path = new Set<unknown>(), depth = 0): unknown {
  if (depth > 100 || path.has(value)) throw new Error('limit')
  if (!value || typeof value !== 'object') return value
  path.add(value)
  try {
    if (Array.isArray(value)) return value.map((item) => manifestJSONValue(item, path, depth + 1))
    if (value instanceof Map) {
      const keys = new Set<string>()
      return Object.fromEntries(
        [...value].map(([key, item]) => {
          if (
            !['string', 'number', 'boolean'].includes(typeof key) ||
            (typeof key === 'number' && !Number.isFinite(key))
          ) throw new Error('keys')
          const name = String(key)
          if (keys.has(name)) throw new Error('keys')
          keys.add(name)
          return [name, manifestJSONValue(item, path, depth + 1)]
        }),
      )
    }
    return value
  } finally {
    path.delete(value)
  }
}

export function asObject(value: unknown): ManifestObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as ManifestObject)
    : {}
}

export function parseManifestDraft(source: string): {
  objects: ManifestObject[]
  outline: OutlineResource[]
  error: string | null
  schemaIdentities: ManifestObject[]
} {
  if (new TextEncoder().encode(source).length > MAX_MANIFEST_BYTES)
    return { objects: [], outline: [], schemaIdentities: [], error: 'Manifest exceeds the 2 MiB limit.' }
  const lineCounter = new LineCounter()
  const docs = parseAllDocuments(source, {
    version: '1.1',
    lineCounter,
    prettyErrors: false,
    uniqueKeys: uniqueManifestKeys,
    customTags: kubernetesYAMLTags,
  })
  const objects: ManifestObject[] = []
  const outline: OutlineResource[] = []
  // Reading scalar identity fields does not expand aliases or convert malformed
  // document bodies. They are hints for completion, never input to creation.
  const schemaIdentities = docs.slice(0, MAX_MANIFEST_RESOURCES).map((doc) => {
    const apiVersion = doc.get('apiVersion')
    const kind = doc.get('kind')
    return {
      apiVersion: typeof apiVersion === 'string' ? apiVersion : '',
      kind: typeof kind === 'string' ? kind : '',
    }
  })
  const visit = (value: unknown, document: number, line: number, depth = 0) => {
    if (depth > 100) throw new Error('nesting')
    const obj = asObject(value)
    if (obj.apiVersion === 'v1' && obj.kind === 'List' && Array.isArray(obj.items)) {
      for (const item of obj.items) visit(item, document, line, depth + 1)
      return
    }
    if (outline.length >= MAX_MANIFEST_RESOURCES) throw new Error('count')
    const metadata = asObject(obj.metadata)
    outline.push({
      index: outline.length,
      document,
      line,
      apiVersion: typeof obj.apiVersion === 'string' ? obj.apiVersion : '',
      kind: typeof obj.kind === 'string' ? obj.kind : '',
      name: String(metadata.name ?? metadata.generateName ?? ''),
      namespace: typeof metadata.namespace === 'string' ? metadata.namespace : '',
    })
  }
  try {
    for (const [index, doc] of docs.entries()) {
      if (doc.errors.length) {
        const position = lineCounter.linePos(doc.errors[0].pos[0])
        return {
          objects,
          outline,
          schemaIdentities,
          error: `Invalid YAML in document ${index + 1}, line ${position.line}, column ${position.col}.`,
        }
      }
      const value = manifestJSONValue(doc.toJS({ maxAliasCount: 100, mapAsMap: true }))
      objects.push(asObject(value))
      if (value !== null)
        visit(
          value,
          index + 1,
          lineCounter.linePos(doc.contents?.range?.[0] ?? doc.range?.[0] ?? 0).line,
        )
    }
    return {
      objects,
      outline,
      schemaIdentities,
      error: outline.length ? null : 'Add a Kubernetes manifest to begin.',
    }
  } catch (reason) {
    return {
      objects: [],
      outline: [],
      schemaIdentities,
      error: reason instanceof Error && reason.message === 'keys'
        ? 'Invalid YAML: mapping keys must be unique scalar strings, numbers or booleans.'
        : 'Manifest exceeds the resource, nesting or YAML alias limit.',
    }
  }
}

export function formatManifest(source: string): string {
  const docs = parseAllDocuments(source, { version: '1.1', prettyErrors: false, uniqueKeys: uniqueManifestKeys, customTags: kubernetesYAMLTags })
  if (docs.some((doc) => doc.errors.length)) throw new Error('Cannot format invalid YAML.')
  return docs
    .map((doc, index) => {
      if (index > 0) doc.directives.docStart = true
      return doc.toString({ indent: 2 })
    })
    .join('')
}

export function isValidNamespaceName(name: string): boolean {
  return name.length <= 63 && /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)
}

export function addNamespaceToManifest(source: string, name: string): string {
  if (!isValidNamespaceName(name)) throw new Error('Enter a valid namespace name.')
  const current = parseManifestDraft(source)
  if (!current.error && current.outline.some((item) =>
    item.apiVersion === 'v1' && item.kind === 'Namespace' && item.name === name,
  )) return source
  // Quote names such as "yes" and "123" to preserve YAML 1.1 string semantics.
  const namespace = `apiVersion: v1\nkind: Namespace\nmetadata:\n  name: ${JSON.stringify(name)}\n`
  const next = source.trim() ? `${namespace}---\n${source}` : namespace
  if (parseManifestDraft(next).error)
    throw new Error('Fix manifest errors or resource limits before adding a namespace.')
  return next
}

export function mergeManifestOperation(
  current: ManifestOperation | null,
  incoming: ManifestOperation,
): ManifestOperation {
  if (current && (current.id !== incoming.id || current.revision > incoming.revision))
    return current
  return incoming
}

export function canCreateManifest(operation: ManifestOperation | null, readOnly: boolean): boolean {
  return (
    !!operation &&
    !readOnly &&
    operation.phase === 'review' &&
    operation.resources.some((item) => item.status === 'ready') &&
    !operation.resources.some((item) => item.status === 'failed' || item.status === 'unknown')
  )
}

export function resourceTemplate(mapping: ManifestKind): string {
  const header = `apiVersion: ${mapping.apiVersion}\nkind: ${mapping.kind}\nmetadata:\n  name: example\n`
  switch (mapping.kind) {
    case 'Deployment':
      return (
        header +
        'spec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: example\n  template:\n    metadata:\n      labels:\n        app: example\n    spec:\n      containers:\n        - name: app\n          image: nginx:stable\n          ports:\n            - containerPort: 80\n'
      )
    case 'Pod':
      return header + 'spec:\n  containers:\n    - name: app\n      image: nginx:stable\n'
    case 'Service':
      return (
        header +
        'spec:\n  selector:\n    app: example\n  ports:\n    - port: 80\n      targetPort: 80\n'
      )
    case 'ConfigMap':
      return header + 'data:\n  key: value\n'
    case 'Secret':
      return header + 'type: Opaque\nstringData:\n  key: value\n'
    case 'Job':
      return (
        header +
        'spec:\n  template:\n    spec:\n      restartPolicy: Never\n      containers:\n        - name: task\n          image: busybox:stable\n          command: ["echo", "hello"]\n'
      )
    case 'CronJob':
      return (
        header +
        'spec:\n  schedule: "0 * * * *"\n  jobTemplate:\n    spec:\n      template:\n        spec:\n          restartPolicy: Never\n          containers:\n            - name: task\n              image: busybox:stable\n              command: ["echo", "hello"]\n'
      )
    case 'PersistentVolumeClaim':
      return (
        header +
        'spec:\n  accessModes: [ReadWriteOnce]\n  resources:\n    requests:\n      storage: 1Gi\n'
      )
    case 'Role':
      return (
        header +
        'rules:\n  - apiGroups: [""]\n    resources: ["pods"]\n    verbs: ["get", "list", "watch"]\n'
      )
    case 'RoleBinding':
      return (
        header +
        'subjects:\n  - kind: ServiceAccount\n    name: example\nroleRef:\n  apiGroup: rbac.authorization.k8s.io\n  kind: Role\n  name: example\n'
      )
    case 'NetworkPolicy':
      return (
        header +
        'spec:\n  podSelector:\n    matchLabels:\n      app: example\n  policyTypes: [Ingress]\n  ingress:\n    - from:\n        - podSelector: {}\n'
      )
    case 'Ingress':
      return (
        header +
        'spec:\n  rules:\n    - host: example.com\n      http:\n        paths:\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: example\n                port:\n                  number: 80\n'
      )
    default:
      return header
  }
}
