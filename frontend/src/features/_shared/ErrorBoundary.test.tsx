import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

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
  })

  it('renders a fallback and can recover its children', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
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
    consoleError.mockRestore()
  })
})
