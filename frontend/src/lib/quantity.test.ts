import { describe, expect, it } from 'vitest'
import { formatMemoryQuantity, parseQuantity } from './quantity'

describe('parseQuantity', () => {
  it('handles binary suffixes', () => {
    expect(parseQuantity('1Ki')).toBe(1024)
    expect(parseQuantity('2Mi')).toBe(2 * 1024 ** 2)
    expect(parseQuantity('3Gi')).toBe(3 * 1024 ** 3)
    expect(parseQuantity('7962736Ki')).toBe(7962736 * 1024)
  })
  it('handles decimal suffixes', () => {
    expect(parseQuantity('500m')).toBe(0.5)
    expect(parseQuantity('1k')).toBe(1000)
    expect(parseQuantity('2M')).toBe(2_000_000)
    expect(parseQuantity('1G')).toBe(1_000_000_000)
  })
  it('handles plain numbers', () => {
    expect(parseQuantity('2')).toBe(2)
    expect(parseQuantity('0')).toBe(0)
  })
  it('handles whitespace and empty', () => {
    expect(parseQuantity('  3Gi  ')).toBe(3 * 1024 ** 3)
    expect(parseQuantity('')).toBeNull()
    expect(parseQuantity('   ')).toBeNull()
  })
  it('returns null for garbage', () => {
    expect(parseQuantity('not-a-quantity')).toBeNull()
    expect(parseQuantity('1Zi')).toBeNull()
  })
})

describe('formatMemoryQuantity', () => {
  it('compacts binary quantities', () => {
    expect(formatMemoryQuantity('7962736Ki')).toBe('7.6Gi')
    expect(formatMemoryQuantity('7950404Ki')).toBe('7.6Gi')
    expect(formatMemoryQuantity('2Gi')).toBe('2.0Gi')
    expect(formatMemoryQuantity('512Mi')).toBe('512Mi')
  })
  it('compacts plain-byte quantities', () => {
    expect(formatMemoryQuantity('1048576')).toBe('1.0Mi')
    expect(formatMemoryQuantity('1073741824')).toBe('1.0Gi')
  })
  it('passes garbage through unchanged so it stays visible', () => {
    expect(formatMemoryQuantity('not-a-quantity')).toBe('not-a-quantity')
    expect(formatMemoryQuantity('')).toBe('')
  })
  it('renders zero plainly', () => {
    expect(formatMemoryQuantity('0')).toBe('0')
    expect(formatMemoryQuantity('0Ki')).toBe('0')
  })
  it('reaches the Ei unit its parser supports instead of overflowing Pi', () => {
    expect(formatMemoryQuantity('1Ei')).toBe('1.0Ei')
    expect(formatMemoryQuantity('2Ei')).toBe('2.0Ei')
  })
})
