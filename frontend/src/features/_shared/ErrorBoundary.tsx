import { Component, type ErrorInfo, type ReactNode } from 'react'

export type ErrorFallbackProps = {
  error: Error
  componentStack: string
  reset: () => void
}

type Props = {
  children: ReactNode
  fallback: (props: ErrorFallbackProps) => ReactNode
}

type State = {
  error: Error | null
  componentStack: string
}

function normalizeError(value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === 'string' && value.trim()) return new Error(value)
  return new Error('Unknown render error')
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: '' }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: normalizeError(error) }
  }

  componentDidCatch(_error: unknown, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? '' })
  }

  private reset = () => {
    this.setState({ error: null, componentStack: '' })
  }

  render() {
    if (this.state.error) {
      return this.props.fallback({
        error: this.state.error,
        componentStack: this.state.componentStack,
        reset: this.reset,
      })
    }
    return this.props.children
  }
}
