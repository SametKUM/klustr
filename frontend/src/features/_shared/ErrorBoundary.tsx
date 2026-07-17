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

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(_error: Error, info: ErrorInfo) {
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
