import { describe, expect, it } from 'vitest'
import { parseSearch, rowMatchesSearch, searchText } from './rowSearch'

const route = {
  namespace: 'staging',
  name: 'drivergateway',
  hostnames: ['drivergateway.staging.example.com'],
  parents: [{ namespace: 'envoy-gateway-system', name: 'internal-gw' }],
  rules: 1,
  accepted: true,
}

const columnIds = ['namespace', 'name', 'hostnames', 'parents', 'rules', 'accepted']
const getColumnValue = (row: object, id: string) => (row as Record<string, unknown>)[id]

function matches(row: object, query: string): boolean {
  return rowMatchesSearch(row, parseSearch(query), columnIds, getColumnValue)
}

describe('parseSearch', () => {
  it('splits on whitespace and lowercases', () => {
    expect(parseSearch('  Foo  BAR ')).toEqual([
      { raw: 'foo', text: 'foo' },
      { raw: 'bar', text: 'bar' },
    ])
  })

  it('parses column:value terms', () => {
    expect(parseSearch('host:Gateway')).toEqual([
      { raw: 'host:gateway', column: 'host', text: 'gateway' },
    ])
  })

  it('keeps a leading or trailing colon literal', () => {
    expect(parseSearch(':foo bar:')).toEqual([
      { raw: ':foo', text: ':foo' },
      { raw: 'bar:', text: 'bar:' },
    ])
  })
})

describe('searchText', () => {
  it('flattens arrays and nested objects, values only', () => {
    const text = searchText(route)
    expect(text).toContain('drivergateway.staging.example.com')
    expect(text).toContain('internal-gw')
    expect(text).not.toContain('hostnames')
  })

  it('stringifies numbers and booleans', () => {
    expect(searchText({ rules: 3, accepted: true })).toBe('3 true')
  })
})

describe('rowMatchesSearch', () => {
  it('matches inside array values', () => {
    expect(matches(route, 'drivergateway.staging')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(matches(route, 'DRIVERGATEWAY')).toBe(true)
  })

  it('requires every term (AND)', () => {
    expect(matches(route, 'drivergateway staging')).toBe(true)
    expect(matches(route, 'drivergateway missing')).toBe(false)
  })

  it('scopes column:value terms to matching columns', () => {
    expect(matches(route, 'host:drivergateway')).toBe(true)
    expect(matches(route, 'host:internal-gw')).toBe(false)
    expect(matches(route, 'parents:internal-gw')).toBe(true)
  })

  it('treats an ambiguous column prefix as any matching column', () => {
    expect(matches(route, 'na:staging')).toBe(true)
    expect(matches(route, 'na:drivergateway')).toBe(true)
  })

  it('falls back to a literal match when the prefix is not a column', () => {
    expect(matches({ name: 'cron', schedule: '10:30' }, '10:30')).toBe(true)
    expect(matches(route, 'nosuchcolumn:drivergateway')).toBe(false)
  })
})
