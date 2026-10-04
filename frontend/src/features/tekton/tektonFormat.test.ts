import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TektonStep, TektonTaskCounts } from '@/lib/api'
import {
  isTektonRunActive,
  stepContainer,
  tektonElapsed,
  tektonStateLabel,
  tektonTaskSummary,
} from './tektonFormat'

function step(name: string, state: string, exitCode = 0): TektonStep {
  return { name, container: `step-${name}`, state, exitCode } as TektonStep
}

describe('stepContainer', () => {
  it('prefers the running step', () => {
    expect(stepContainer([step('clone', 'terminated'), step('build', 'running'), step('push', 'waiting')])).toBe(
      'step-build',
    )
  })

  it('then the first failed step, then the last one that ran', () => {
    expect(
      stepContainer([step('clone', 'terminated'), step('build', 'terminated', 1), step('push', 'terminated', 2)]),
    ).toBe('step-build')
    expect(stepContainer([step('clone', 'terminated'), step('build', 'terminated')])).toBe('step-build')
  })

  it('falls back to the first step, deriving its container before the pod exists', () => {
    expect(stepContainer([{ name: 'build', container: '', state: 'pending' } as TektonStep])).toBe('step-build')
    expect(stepContainer([])).toBeUndefined()
  })
})

function counts(partial: Partial<TektonTaskCounts>): TektonTaskCounts {
  return {
    known: true,
    completed: 0,
    failed: 0,
    cancelled: 0,
    incomplete: 0,
    skipped: 0,
    ...partial,
  } as TektonTaskCounts
}

describe('tektonTaskSummary', () => {
  it('lists done plus the non-zero counts', () => {
    expect(tektonTaskSummary(counts({ completed: 11, failed: 1, skipped: 4 }))).toBe(
      '11 done, 1 failed, 4 skipped',
    )
    expect(tektonTaskSummary(counts({ completed: 2, incomplete: 3 }))).toBe('2 done, 3 incomplete')
  })

  it('shows a dash when the controller wrote no tally', () => {
    expect(tektonTaskSummary(counts({ known: false }))).toBe('—')
    expect(tektonTaskSummary(undefined)).toBe('—')
  })
})

describe('tektonStateLabel', () => {
  it('prefers the controller reason', () => {
    expect(tektonStateLabel('succeeded', 'Completed')).toBe('Completed')
    expect(tektonStateLabel('failed', 'PipelineRunTimeout')).toBe('PipelineRunTimeout')
  })

  it('falls back to the state, and never shows a skip reason as the label', () => {
    expect(tektonStateLabel('pending', '')).toBe('Pending')
    expect(tektonStateLabel('skipped', 'When Expressions evaluated to false')).toBe('Skipped')
    expect(tektonStateLabel('notrun')).toBe('Not run')
  })
})

describe('tektonElapsed', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the backend duration once a run finished', () => {
    expect(tektonElapsed('2m54s', '2026-10-02T16:30:08Z', 'failed')).toBe('2m54s')
  })

  it('ticks from the start time while a run is active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-02T16:31:38Z'))
    expect(tektonElapsed('', '2026-10-02T16:30:08Z', 'running')).toBe('1m30s')
  })

  it('shows a dash for a finished run without timestamps', () => {
    expect(tektonElapsed('', '', 'cancelled')).toBe('—')
    expect(tektonElapsed('', '2026-10-02T16:30:08Z', 'cancelled')).toBe('—')
  })
})

describe('isTektonRunActive', () => {
  it('is true only for running and pending runs', () => {
    expect(isTektonRunActive('running')).toBe(true)
    expect(isTektonRunActive('pending')).toBe(true)
    expect(isTektonRunActive('succeeded')).toBe(false)
    expect(isTektonRunActive('cancelled')).toBe(false)
  })
})
