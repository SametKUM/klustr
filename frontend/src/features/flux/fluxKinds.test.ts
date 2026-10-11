import { describe, expect, it } from 'vitest'
import {
  canReconcileFluxKind,
  canSuspendFluxKind,
  isFluxResource,
  stripFluxKindPrefix,
} from './fluxKinds'

describe('Flux image action capabilities', () => {
  it.each(['FluxImageRepository', 'FluxImagePolicy', 'FluxImageUpdateAutomation'] as const)(
    'recognizes %s for detail events',
    (kind) => {
      expect(isFluxResource({ kind, namespace: 'apps', name: 'app' })).toBe(true)
      expect(stripFluxKindPrefix(kind)).toBe(kind.slice(4))
    },
  )

  it('reconciles repositories and automations, while policies follow their repository', () => {
    expect(canReconcileFluxKind('FluxImageRepository')).toBe(true)
    expect(canReconcileFluxKind('FluxImageUpdateAutomation')).toBe(true)
    expect(canReconcileFluxKind('FluxImagePolicy')).toBe(false)
  })

  it('does not offer an unsupported suspend field on legacy policies', () => {
    expect(canSuspendFluxKind('FluxImagePolicy', 'v1beta2')).toBe(false)
    expect(canSuspendFluxKind('FluxImagePolicy')).toBe(false)
    expect(canSuspendFluxKind('FluxImagePolicy', 'v1')).toBe(true)
    expect(canSuspendFluxKind('FluxImageRepository', 'v1beta2')).toBe(true)
  })
})
