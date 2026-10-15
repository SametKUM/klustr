import { describe, expect, it } from 'vitest'
import { buildManifestSchema, normalizeOpenAPISchema } from './manifestSchema'

const openAPI = {
  components: {
    schemas: {
      ConfigMap: {
        type: 'object',
        'x-kubernetes-group-version-kind': [{ group: '', version: 'v1', kind: 'ConfigMap' }],
        properties: {
          metadata: { $ref: '#/components/schemas/Metadata' },
          data: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
      Metadata: {
        type: 'object',
        properties: { name: { type: 'string' }, owner: { $ref: '#/components/schemas/Metadata' } },
      },
      Unused: { type: 'object' },
    },
  },
}

describe('cluster schemas', () => {
  it('selects each document by exact GVK and includes only reachable definitions', () => {
    const schema = buildManifestSchema(
      [
        { apiVersion: 'v1', kind: 'ConfigMap' },
        { apiVersion: 'v1', kind: 'Missing' },
      ],
      { v1: openAPI },
    )
    expect(Object.keys(schema.definitions!)).toEqual(['d0_ConfigMap', 'd0_Metadata'])
    expect(schema.schemaSequence?.[0].allOf?.[0]).toEqual({ $ref: '#/definitions/d0_ConfigMap' })
    expect(schema.definitions?.d0_Metadata.properties?.owner).toEqual({
      $ref: '#/definitions/d0_Metadata',
    })
    expect(schema.schemaSequence?.[1].required).toContain('kind')
  })

  it('supports OpenAPI v2 definitions without dropping literal property names', () => {
    const schema = normalizeOpenAPISchema(
      {
        type: 'object',
        properties: {
          nullable: { type: 'boolean' },
          id: { type: 'string' },
          properties: { type: 'string' },
        },
      },
      (name) => name,
    )
    expect(schema).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        nullable: { type: 'boolean' },
        id: { type: 'string' },
        properties: { type: 'string' },
      },
    })
    const v2 = buildManifestSchema([{ apiVersion: 'v1', kind: 'ConfigMap' }], {
      v1: { definitions: openAPI.components.schemas },
    })
    expect(v2.definitions?.d0_ConfigMap).toBeDefined()
  })

  it('normalizes nullable, int-or-string and preserve-unknown semantics', () => {
    expect(normalizeOpenAPISchema({ type: 'integer', nullable: true }, String)).toEqual({
      type: ['integer', 'null'],
    })
    expect(normalizeOpenAPISchema({ 'x-kubernetes-int-or-string': true }, String)).toEqual({
      anyOf: [{ type: 'integer' }, { type: 'string' }],
    })
    expect(
      normalizeOpenAPISchema(
        { type: 'object', properties: {}, 'x-kubernetes-preserve-unknown-fields': true },
        String,
      ),
    ).toEqual({ type: 'object', properties: {}, additionalProperties: true })
  })

  it('does not forward remote references or schema IDs to the worker', () => {
    expect(
      normalizeOpenAPISchema(
        {
          $ref: 'https://example.com/schema.json',
          $id: 'https://example.com',
          $schema: 'https://example.com',
        },
        String,
      ),
    ).toEqual({})
  })

  it('uses CRD schemas from the draft before the API endpoint exists', () => {
    const schema = buildManifestSchema(
      [
        { apiVersion: 'example.com/v1', kind: 'Widget' },
        {
          apiVersion: 'apiextensions.k8s.io/v1',
          kind: 'CustomResourceDefinition',
          spec: {
            group: 'example.com',
            names: { kind: 'Widget' },
            versions: [
              {
                name: 'v1',
                served: true,
                schema: {
                  openAPIV3Schema: {
                    type: 'object',
                    properties: {
                      spec: { type: 'object', properties: { replicas: { type: 'integer' } } },
                    },
                  },
                },
              },
            ],
          },
        },
      ],
      {},
    )
    expect(schema.schemaSequence?.[0].properties?.spec).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: { replicas: { type: 'integer' } },
    })
  })

  it('assigns independent schemas to List items', () => {
    const schema = buildManifestSchema(
      [{ apiVersion: 'v1', kind: 'List', items: [{ apiVersion: 'v1', kind: 'ConfigMap' }] }],
      { v1: openAPI },
    )
    expect(schema.definitions?.d0_i0_ConfigMap).toBeDefined()
  })
})
