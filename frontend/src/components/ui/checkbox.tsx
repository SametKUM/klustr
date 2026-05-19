import { forwardRef, type InputHTMLAttributes } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox(
  { className, checked, disabled, ...props },
  ref,
) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className="peer sr-only"
        {...props}
      />
      <span
        aria-hidden
        className="flex size-4 items-center justify-center rounded-sm border border-input bg-background transition-colors peer-checked:border-primary peer-checked:bg-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1"
      >
        <Check
          className={cn(
            'size-3 text-primary-foreground transition-opacity',
            checked ? 'opacity-100' : 'opacity-0',
          )}
          strokeWidth={3}
        />
      </span>
    </span>
  )
})
