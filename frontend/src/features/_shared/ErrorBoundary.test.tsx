import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import { ErrorRecovery } from './ErrorRecovery'

describe('ErrorBoundary', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('renders a fallback and can recover its children', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldThrow = true

    function Child() {
      if (shouldThrow) throw new Error('broken detail')
      return <span>Recovered</span>
    }

    act(() => {
      root.render(
        <ErrorBoundary
          fallback={({ error, reset }) => (
            <button
              type="button"
              onClick={() => {
                shouldThrow = false
                reset()
              }}
            >
              {error.message}
            </button>
          )}
        >
          <Child />
        </ErrorBoundary>,
      )
    })

    expect(container.textContent).toBe('broken detail')

    act(() => {
      container.querySelector('button')?.click()
    })

    expect(container.textContent).toBe('Recovered')
  })

  it('normalizes non-Error thrown values', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    function Child(): never {
      throw null
    }

    act(() => {
      root.render(
        <ErrorBoundary fallback={({ error }) => <span>{error.message}</span>}>
          <Child />
        </ErrorBoundary>,
      )
    })

    expect(container.textContent).toBe('Unknown render error')
  })

  it('shows a fallback message when an Error has no name or message', () => {
    const error = new Error('')
    error.name = ''

    act(() => {
      root.render(
        <ErrorRecovery
          title="Render failed"
          description="Recovery is available."
          error={error}
          onRetry={vi.fn()}
        />,
      )
    })

    expect(container.textContent).toContain('Unknown render error')
  })
})
