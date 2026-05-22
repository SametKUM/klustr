import { beforeEach, describe, expect, it } from 'vitest'
import type { PodMetrics } from '@/lib/api'
import {
  podKey,
  selectMetricsAvailable,
  selectPodMetric,
  useMetrics,
} from './metrics'

function reset() {
  useMetrics.setState({ available: {}, byPodByContext: {} })
}

const sample: PodMetrics = {
  namespace: 'default',
  name: 'demo',
  cpuMC: 12,
  memB: 4096,
}

describe('useMetrics', () => {
  beforeEach(reset)

  it('podKey joins namespace and name', () => {
    expect(podKey('ns', 'p1')).toBe('ns/p1')
  })

  it('setPodMetrics marks the context available and indexes by namespace/name', () => {
    useMetrics.getState().setPodMetrics('prod', [sample])
    const s = useMetrics.getState()
    expect(s.available.prod).toBe(true)
    expect(s.byPodByContext.prod['default/demo']).toEqual(sample)
  })

  it('setPodMetrics with empty list flips the context to unavailable', () => {
    useMetrics.getState().setPodMetrics('prod', [sample])
    useMetrics.getState().setPodMetrics('prod', [])
    const s = useMetrics.getState()
    expect(s.available.prod).toBe(false)
    expect(s.byPodByContext.prod).toEqual({})
  })

  it('setUnavailable flips availability and clears pods', () => {
    useMetrics.getState().setPodMetrics('prod', [sample])
    useMetrics.getState().setUnavailable('prod')
    const s = useMetrics.getState()
    expect(s.available.prod).toBe(false)
    expect(s.byPodByContext.prod).toEqual({})
  })

  it('clearContext removes only the target context', () => {
    useMetrics.getState().setPodMetrics('prod', [sample])
    useMetrics.getState().setPodMetrics('staging', [{ ...sample, name: 'other' }])
    useMetrics.getState().clearContext('prod')
    const s = useMetrics.getState()
    expect(s.available.prod).toBeUndefined()
    expect(s.byPodByContext.prod).toBeUndefined()
    expect(s.available.staging).toBe(true)
  })

  it('reset wipes everything', () => {
    useMetrics.getState().setPodMetrics('prod', [sample])
    useMetrics.getState().reset()
    expect(useMetrics.getState().available).toEqual({})
    expect(useMetrics.getState().byPodByContext).toEqual({})
  })
})

describe('selectPodMetric', () => {
  beforeEach(reset)

  it('returns undefined without an active context', () => {
    expect(selectPodMetric(null, 'default', 'demo')(useMetrics.getState())).toBeUndefined()
  })

  it('returns undefined when the pod is missing', () => {
    useMetrics.getState().setPodMetrics('prod', [sample])
    expect(selectPodMetric('prod', 'default', 'other')(useMetrics.getState())).toBeUndefined()
  })

  it('returns the matching pod metric', () => {
    useMetrics.getState().setPodMetrics('prod', [sample])
    expect(selectPodMetric('prod', 'default', 'demo')(useMetrics.getState())).toEqual(sample)
  })
})

describe('selectMetricsAvailable', () => {
  beforeEach(reset)

  it('returns false when no contexts are passed', () => {
    expect(selectMetricsAvailable([])(useMetrics.getState())).toBe(false)
  })

  it('returns true when at least one passed context is available', () => {
    useMetrics.getState().setPodMetrics('prod', [sample])
    expect(selectMetricsAvailable(['staging', 'prod'])(useMetrics.getState())).toBe(true)
  })

  it('returns false when none of the contexts are available', () => {
    useMetrics.getState().setUnavailable('prod')
    expect(selectMetricsAvailable(['prod', 'staging'])(useMetrics.getState())).toBe(false)
  })
})
