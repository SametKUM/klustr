import type { JSONSchema } from 'monaco-yaml'
import { asObject, type ManifestObject } from './manifestModel'

const baseSchema: JSONSchema = {
  type: 'object',
  required: ['apiVersion', 'kind', 'metadata'],
  properties: {
    apiVersion: { type: 'string' },
    kind: { type: 'string' },
    metadata: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        generateName: { type: 'string' },
        namespace: { type: 'string' },
      },
    },
  },
}

// OpenAPI 3.0 uses nullable and Kubernetes extensions that JSON Schema does
// not understand. Preserve their semantics before passing schemas to Monaco.
export function normalizeOpenAPISchema(
  value: unknown,
  reference: (name: string) => string,
): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeOpenAPISchema(item, reference))
  if (!value || typeof value !== 'object') return value
  const input = asObject(value)
  const result: ManifestObject = {}
  for (const [key, entry] of Object.entries(input)) {
    if (key === '$ref') {
      if (
        typeof entry === 'string' &&
        (entry.startsWith('#/components/schemas/') || entry.startsWith('#/definitions/'))
      ) {
        result.$ref = reference(
          entry
            .slice(entry.lastIndexOf('/') + 1)
            .replace(/~1/g, '/')
            .replace(/~0/g, '~'),
        )
      }
      continue
    }
    if (
      key.startsWith('x-kubernetes-') ||
      key === 'nullable' ||
      key === '$schema' ||
      key === '$id' ||
      key === 'id'
    )
      continue
    if (['properties', 'patternProperties', 'definitions', '$defs'].includes(key)) {
      result[key] = Object.fromEntries(
        Object.entries(asObject(entry)).map(([name, property]) => [
          name,
          normalizeOpenAPISchema(property, reference),
        ]),
      )
    } else if (['items', 'additionalProperties', 'allOf', 'anyOf', 'oneOf', 'not'].includes(key)) {
      result[key] = normalizeOpenAPISchema(entry, reference)
    } else {
      result[key] = entry
    }
  }
  if (input['x-kubernetes-int-or-string']) {
    delete result.type
    result.anyOf = [{ type: 'integer' }, { type: 'string' }]
  }
  if (input['x-kubernetes-preserve-unknown-fields']) result.additionalProperties = true
  else if (input.properties && input.additionalProperties === undefined)
    result.additionalProperties = false
  if (input.nullable) {
    if (typeof result.type === 'string') result.type = [result.type, 'null']
    else return { anyOf: [result, { type: 'null' }] }
  }
  return result
}

function matchingCRDSchema(objects: ManifestObject[], apiVersion: string, kind: string): unknown {
  for (const object of objects) {
    if (
      object.kind !== 'CustomResourceDefinition' ||
      object.apiVersion !== 'apiextensions.k8s.io/v1'
    )
      continue
    const spec = asObject(object.spec)
    if (asObject(spec.names).kind !== kind || !Array.isArray(spec.versions)) continue
    for (const item of spec.versions) {
      const version = asObject(item)
      if (`${spec.group}/${version.name}` === apiVersion && version.served === true)
        return asObject(version.schema).openAPIV3Schema
    }
  }
  return undefined
}

export function buildManifestSchema(
  objects: ManifestObject[],
  sources: Record<string, unknown>,
): JSONSchema {
  const definitions: Record<string, JSONSchema> = {}
  const resourceSchema = (object: ManifestObject, prefix: string): JSONSchema => {
    const apiVersion = String(object.apiVersion ?? '')
    const kind = String(object.kind ?? '')
    if (apiVersion === 'v1' && kind === 'List')
      return {
        type: 'object',
        properties: {
          apiVersion: { const: 'v1' },
          kind: { const: 'List' },
          items: {
            type: 'array',
            items: Array.isArray(object.items)
              ? {
                  anyOf: object.items.map((item, index) =>
                    resourceSchema(asObject(item), `${prefix}i${index}_`),
                  ),
                }
              : {},
          },
        },
        required: ['items'],
      }
    const source = asObject(sources[apiVersion])
    const schemas = asObject(asObject(source.components).schemas ?? source.definitions)
    const collect = (name: string): string => {
      const key = prefix + name
      if (!(key in definitions)) {
        definitions[key] = {}
        definitions[key] = normalizeOpenAPISchema(schemas[name] ?? {}, collect) as JSONSchema
      }
      return `#/definitions/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`
    }
    const [group, version] = apiVersion.includes('/') ? apiVersion.split('/') : ['', apiVersion]
    const match = Object.entries(schemas).find(([, schema]) => {
      const gvks = asObject(schema)['x-kubernetes-group-version-kind']
      return (
        Array.isArray(gvks) &&
        gvks.some((entry) => {
          const gvk = asObject(entry)
          return gvk.group === group && gvk.version === version && gvk.kind === kind
        })
      )
    })
    let schema: JSONSchema
    if (match) {
      const ref = collect(match[0])
      schema = {
        allOf: [
          { $ref: ref },
          { properties: { apiVersion: { const: apiVersion }, kind: { const: kind } } },
        ],
      }
    } else {
      const crd = matchingCRDSchema(objects, apiVersion, kind)
      schema = crd
        ? (normalizeOpenAPISchema(crd, collect) as JSONSchema)
        : structuredClone(baseSchema)
      schema.properties = {
        ...baseSchema.properties,
        ...schema.properties,
        apiVersion: { const: apiVersion },
        kind: { const: kind },
      }
      schema.required = [...new Set([...(schema.required ?? []), 'apiVersion', 'kind', 'metadata'])]
    }
    return schema
  }
  return {
    definitions,
    schemaSequence: objects.map((object, index) => resourceSchema(object, `d${index}_`)),
  }
}
