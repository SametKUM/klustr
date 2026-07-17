import { RefreshCcw, RotateCcw, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CopyButton } from './Copyable'

type Props = {
  title: string
  description: string
  error: Error
  componentStack?: string
  onRetry: () => void
  onReload?: () => void
  onDismiss?: () => void
  fullscreen?: boolean
}

export function ErrorRecovery({
  title,
  description,
  error,
  componentStack = '',
  onRetry,
  onReload,
  onDismiss,
  fullscreen = false,
}: Props) {
  const visibleMessage = error.message.trim() || error.name.trim() || 'Unknown render error'
  const details = [error.stack ?? `${error.name}: ${error.message}`, componentStack.trim()]
    .filter(Boolean)
    .join('\n\nComponent stack:\n')

  return (
    <div
      role="alert"
      className={cn(
        'flex min-h-0 flex-1 items-center justify-center bg-background p-6 text-foreground',
        fullscreen && 'min-h-screen',
      )}
    >
      <div className="w-full max-w-2xl space-y-4 rounded-xl border border-destructive/30 bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive/10 p-2 text-destructive">
            <TriangleAlert className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Error details
            </span>
            <CopyButton value={details} toastLabel="error details" ariaLabel="Copy error details" />
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-destructive">
            {visibleMessage}
          </pre>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {onDismiss && (
            <Button type="button" variant="outline" onClick={onDismiss}>
              <X />
              Close details
            </Button>
          )}
          {onReload && (
            <Button type="button" variant="outline" onClick={onReload}>
              <RefreshCcw />
              Reload application
            </Button>
          )}
          <Button type="button" onClick={onRetry}>
            <RotateCcw />
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}
