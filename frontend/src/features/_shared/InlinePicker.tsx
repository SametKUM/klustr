import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Option = { value: string; label?: string }

type Props = {
  value: string
  options: ReadonlyArray<string | Option>
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
  minWidth?: number
  className?: string
  align?: 'start' | 'center' | 'end'
}

function normalize(option: string | Option): Option {
  return typeof option === 'string' ? { value: option } : option
}

export function InlinePicker({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Select…',
  minWidth = 120,
  className,
  align = 'start',
}: Props) {
  const normalized = options.map(normalize)
  const current = normalized.find((o) => o.value === value)
  const label = current?.label ?? current?.value ?? placeholder

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="xs"
          aria-label={ariaLabel}
          title={label}
          className={`justify-between font-normal ${className ?? ''}`}
          style={{ minWidth }}
          data-icon="inline-end"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} style={{ minWidth }}>
        {normalized.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => onChange(opt.value)}
            title={opt.label ?? opt.value}
            className="gap-2"
          >
            <span className="flex-1 truncate text-sm">{opt.label ?? opt.value}</span>
            {opt.value === value && <Check className="size-3.5 text-muted-foreground" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
