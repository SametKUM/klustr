import type { CustomTagDef } from '@/store/ui'

export type ContextTagMeta = {
  id: string
  label: string
  shortLabel: string
  dotClass: string
  badgeClass: string
  barClass: string
}

export type TagColor =
  | 'rose'
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'fuchsia'
  | 'pink'
  | 'slate'

type ColorClasses = {
  dotClass: string
  badgeClass: string
  barClass: string
}

export const COLOR_PALETTE: Record<TagColor, ColorClasses> = {
  rose: {
    dotClass: 'bg-rose-500',
    badgeClass: 'border-rose-500/40 bg-rose-500/10 text-rose-500',
    barClass: 'bg-rose-500',
  },
  red: {
    dotClass: 'bg-red-500',
    badgeClass: 'border-red-500/40 bg-red-500/10 text-red-500',
    barClass: 'bg-red-500',
  },
  orange: {
    dotClass: 'bg-orange-500',
    badgeClass: 'border-orange-500/40 bg-orange-500/10 text-orange-500',
    barClass: 'bg-orange-500',
  },
  amber: {
    dotClass: 'bg-amber-500',
    badgeClass: 'border-amber-500/40 bg-amber-500/10 text-amber-500',
    barClass: 'bg-amber-500',
  },
  yellow: {
    dotClass: 'bg-yellow-500',
    badgeClass: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-500',
    barClass: 'bg-yellow-500',
  },
  lime: {
    dotClass: 'bg-lime-500',
    badgeClass: 'border-lime-500/40 bg-lime-500/10 text-lime-500',
    barClass: 'bg-lime-500',
  },
  emerald: {
    dotClass: 'bg-emerald-500',
    badgeClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500',
    barClass: 'bg-emerald-500',
  },
  teal: {
    dotClass: 'bg-teal-500',
    badgeClass: 'border-teal-500/40 bg-teal-500/10 text-teal-500',
    barClass: 'bg-teal-500',
  },
  cyan: {
    dotClass: 'bg-cyan-500',
    badgeClass: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-500',
    barClass: 'bg-cyan-500',
  },
  sky: {
    dotClass: 'bg-sky-500',
    badgeClass: 'border-sky-500/40 bg-sky-500/10 text-sky-500',
    barClass: 'bg-sky-500',
  },
  blue: {
    dotClass: 'bg-blue-500',
    badgeClass: 'border-blue-500/40 bg-blue-500/10 text-blue-500',
    barClass: 'bg-blue-500',
  },
  indigo: {
    dotClass: 'bg-indigo-500',
    badgeClass: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-500',
    barClass: 'bg-indigo-500',
  },
  violet: {
    dotClass: 'bg-violet-500',
    badgeClass: 'border-violet-500/40 bg-violet-500/10 text-violet-500',
    barClass: 'bg-violet-500',
  },
  fuchsia: {
    dotClass: 'bg-fuchsia-500',
    badgeClass: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-500',
    barClass: 'bg-fuchsia-500',
  },
  pink: {
    dotClass: 'bg-pink-500',
    badgeClass: 'border-pink-500/40 bg-pink-500/10 text-pink-500',
    barClass: 'bg-pink-500',
  },
  slate: {
    dotClass: 'bg-slate-500',
    badgeClass: 'border-slate-500/40 bg-slate-500/10 text-slate-500',
    barClass: 'bg-slate-500',
  },
}

export const TAG_COLOR_ORDER: TagColor[] = [
  'rose',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'fuchsia',
  'pink',
  'slate',
]

export const BUILT_IN_TAGS: Record<string, ContextTagMeta> = {
  prod: {
    id: 'prod',
    label: 'Production',
    shortLabel: 'PROD',
    ...COLOR_PALETTE.red,
  },
  staging: {
    id: 'staging',
    label: 'Staging',
    shortLabel: 'STAGING',
    ...COLOR_PALETTE.amber,
  },
  dev: {
    id: 'dev',
    label: 'Development',
    shortLabel: 'DEV',
    ...COLOR_PALETTE.emerald,
  },
}

export const BUILT_IN_TAG_ORDER: string[] = ['prod', 'staging', 'dev']

export function resolveTagMeta(
  tagId: string | null,
  customTags: Record<string, CustomTagDef>,
): ContextTagMeta | null {
  if (!tagId) return null
  if (BUILT_IN_TAGS[tagId]) return BUILT_IN_TAGS[tagId]
  const custom = customTags[tagId]
  if (!custom) return null
  return {
    id: custom.id,
    label: custom.label,
    shortLabel: custom.shortLabel,
    ...COLOR_PALETTE[custom.color],
  }
}

export function makeTagSlug(label: string, existing: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'tag'
  if (!existing.has(base)) return base
  let i = 2
  while (existing.has(`${base}-${i}`)) i += 1
  return `${base}-${i}`
}

export function deriveShortLabel(label: string): string {
  return label.trim().slice(0, 12).toUpperCase()
}
