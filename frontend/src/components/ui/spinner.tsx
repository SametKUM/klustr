import type { SVGProps } from 'react'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

type SpinnerSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: 'size-3',
  md: 'size-3.5',
  lg: 'size-4',
}

type Props = Omit<SVGProps<SVGSVGElement>, 'ref'> & {
  size?: SpinnerSize
  muted?: boolean
}

export function Spinner({ size = 'md', muted = true, className, ...rest }: Props) {
  return (
    <Loader2
      aria-hidden
      className={cn(
        'animate-spin',
        SIZE_CLASS[size],
        muted && 'text-muted-foreground',
        className,
      )}
      {...rest}
    />
  )
}
