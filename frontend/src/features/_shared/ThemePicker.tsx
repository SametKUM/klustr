import { Check, Moon, Palette, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { THEME_FAMILIES, familyTheme, getTheme, themeInMode, type ThemeDefinition } from './themes'
import { useUIStore } from '@/store/ui'

const MODES = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
] as const

function Swatch({ theme }: { theme: ThemeDefinition }) {
  return (
    <div
      className="flex h-4 w-7 overflow-hidden rounded-sm border border-border/60"
      aria-hidden
    >
      <div className="flex-1" style={{ backgroundColor: theme.swatch.background }} />
      <div className="flex-1" style={{ backgroundColor: theme.swatch.primary }} />
      <div className="flex-1" style={{ backgroundColor: theme.swatch.accent }} />
    </div>
  )
}

function ThemeRow({
  label,
  theme,
  active,
  onSelect,
}: {
  label: string
  theme: ThemeDefinition
  active: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="gap-2">
      <Swatch theme={theme} />
      <span className="flex-1 truncate text-sm">{label}</span>
      {active && <Check className="size-3.5 text-muted-foreground" />}
    </DropdownMenuItem>
  )
}

export function ThemePicker() {
  const themeId = useUIStore((s) => s.themeId)
  const setTheme = useUIStore((s) => s.setTheme)
  const mode = getTheme(themeId).mode

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Pick color theme">
              <Palette />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Color theme</TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(next) => {
            if (next === 'light' || next === 'dark') setTheme(themeInMode(themeId, next))
          }}
          className="flex gap-0.5 rounded-md bg-muted p-0.5"
        >
          {MODES.map(({ mode: value, label, icon: Icon }) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              // Stay open so the list below can be seen switching modes.
              onSelect={(e) => e.preventDefault()}
              className="flex-1 justify-center pr-1.5 data-[state=checked]:bg-background data-[state=checked]:shadow-sm [&>[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
            >
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {THEME_FAMILIES.map(({ id, label }) => {
          const theme = familyTheme(id, mode)
          if (!theme) return null
          return (
            <ThemeRow
              key={id}
              label={label}
              theme={theme}
              active={themeId === theme.id}
              onSelect={() => setTheme(theme.id)}
            />
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
