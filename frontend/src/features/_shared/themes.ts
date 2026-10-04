import type { ITheme } from '@xterm/xterm'

export type ThemeMode = 'light' | 'dark'

export type ThemeId =
  | 'default-light'
  | 'default-dark'
  | 'dracula'
  | 'dracula-light'
  | 'monokai'
  | 'monokai-light'
  | 'nord'
  | 'nord-light'
  | 'tokyo-night'
  | 'one-dark'
  | 'one-light'
  | 'joker'
  | 'joker-light'

export const DEFAULT_LIGHT: ThemeId = 'default-light'
export const DEFAULT_DARK: ThemeId = 'default-dark'

const lightXterm: ITheme = {
  background: '#ffffff',
  foreground: '#0f172a',
  cursor: '#0f172a',
  cursorAccent: '#ffffff',
  selectionBackground: '#cbd5e1',
  black: '#1f2937',
  red: '#dc2626',
  green: '#059669',
  yellow: '#b45309',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0891b2',
  white: '#e5e7eb',
  brightBlack: '#475569',
  brightRed: '#ef4444',
  brightGreen: '#10b981',
  brightYellow: '#d97706',
  brightBlue: '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan: '#06b6d4',
  brightWhite: '#f8fafc',
}

const darkXterm: ITheme = {
  background: '#0a0a0a',
  foreground: '#e5e7eb',
  cursor: '#e5e7eb',
  cursorAccent: '#0a0a0a',
  selectionBackground: '#3f3f46',
  black: '#1f2937',
  red: '#f87171',
  green: '#34d399',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e5e7eb',
  brightBlack: '#52525b',
  brightRed: '#fca5a5',
  brightGreen: '#6ee7b7',
  brightYellow: '#fcd34d',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#fafafa',
}

const draculaXterm: ITheme = {
  background: '#282a36',
  foreground: '#f8f8f2',
  cursor: '#f8f8f2',
  cursorAccent: '#282a36',
  selectionBackground: '#44475a',
  black: '#21222c',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#bd93f9',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#f8f8f2',
  brightBlack: '#6272a4',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff',
}

const monokaiXterm: ITheme = {
  background: '#272822',
  foreground: '#cccccc',
  cursor: '#cccccc',
  cursorAccent: '#272822',
  selectionBackground: '#878b9180',
  black: '#333333',
  red: '#c4265e',
  green: '#86b42b',
  yellow: '#b3b42b',
  blue: '#6a7ec8',
  magenta: '#8c6bc8',
  cyan: '#56adbc',
  white: '#e3e3dd',
  brightBlack: '#666666',
  brightRed: '#f92672',
  brightGreen: '#a6e22e',
  brightYellow: '#e2e22e',
  brightBlue: '#819aff',
  brightMagenta: '#ae81ff',
  brightCyan: '#66d9ef',
  brightWhite: '#f8f8f2',
}

const nordXterm: ITheme = {
  background: '#2e3440',
  foreground: '#d8dee9',
  cursor: '#d8dee9',
  cursorAccent: '#2e3440',
  selectionBackground: '#434c5ecc',
  black: '#3b4252',
  red: '#bf616a',
  green: '#a3be8c',
  yellow: '#ebcb8b',
  blue: '#81a1c1',
  magenta: '#b48ead',
  cyan: '#88c0d0',
  white: '#e5e9f0',
  brightBlack: '#4c566a',
  brightRed: '#bf616a',
  brightGreen: '#a3be8c',
  brightYellow: '#ebcb8b',
  brightBlue: '#81a1c1',
  brightMagenta: '#b48ead',
  brightCyan: '#8fbcbb',
  brightWhite: '#eceff4',
}

const tokyoNightXterm: ITheme = {
  background: '#1a1b26',
  foreground: '#c0caf5',
  cursor: '#c0caf5',
  cursorAccent: '#1a1b26',
  selectionBackground: '#283457',
  black: '#15161e',
  red: '#f7768e',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#bb9af7',
  cyan: '#7dcfff',
  white: '#a9b1d6',
  brightBlack: '#414868',
  brightRed: '#ff899d',
  brightGreen: '#9fe044',
  brightYellow: '#faba4a',
  brightBlue: '#8db0ff',
  brightMagenta: '#c7a9ff',
  brightCyan: '#a4daff',
  brightWhite: '#c0caf5',
}

const oneDarkXterm: ITheme = {
  background: '#282c34',
  foreground: '#abb2bf',
  cursor: '#528bff',
  cursorAccent: '#282c34',
  selectionBackground: '#3e4451',
  black: '#282c34',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#abb2bf',
  brightBlack: '#636d83',
  brightRed: '#ea858b',
  brightGreen: '#aad581',
  brightYellow: '#ffd885',
  brightBlue: '#85c1ff',
  brightMagenta: '#d398eb',
  brightCyan: '#6ed5de',
  brightWhite: '#fafafa',
}

const draculaLightXterm: ITheme = {
  background: '#fffbeb',
  foreground: '#1f1f1f',
  cursor: '#1f1f1f',
  cursorAccent: '#fffbeb',
  selectionBackground: '#cfcfde',
  black: '#fffbeb',
  red: '#cb3a2a',
  green: '#14710a',
  yellow: '#846e15',
  blue: '#644ac9',
  magenta: '#a3144d',
  cyan: '#036a96',
  white: '#1f1f1f',
  brightBlack: '#6c664b',
  brightRed: '#d74c3d',
  brightGreen: '#198d0c',
  brightYellow: '#9e841a',
  brightBlue: '#7862d0',
  brightMagenta: '#bf185a',
  brightCyan: '#047fb4',
  brightWhite: '#2c2b31',
}

const monokaiLightXterm: ITheme = {
  background: '#fafafa',
  foreground: '#272822',
  cursor: '#272822',
  cursorAccent: '#fafafa',
  selectionBackground: '#ece8d4',
  black: '#272822',
  red: '#c13a5e',
  green: '#56932e',
  yellow: '#a37c1a',
  blue: '#1d80a6',
  magenta: '#7d4cd2',
  cyan: '#4caea0',
  white: '#3e3d32',
  brightBlack: '#75715e',
  brightRed: '#dc4773',
  brightGreen: '#6dab3d',
  brightYellow: '#b89324',
  brightBlue: '#2998be',
  brightMagenta: '#9263e2',
  brightCyan: '#5ec1b3',
  brightWhite: '#1d1e19',
}

const nordLightXterm: ITheme = {
  background: '#eceff4',
  foreground: '#2e3440',
  cursor: '#2e3440',
  cursorAccent: '#eceff4',
  selectionBackground: '#d8dee9',
  black: '#3b4252',
  red: '#bf616a',
  green: '#a3be8c',
  yellow: '#ebcb8b',
  blue: '#5e81ac',
  magenta: '#b48ead',
  cyan: '#88c0d0',
  white: '#2e3440',
  brightBlack: '#4c566a',
  brightRed: '#bf616a',
  brightGreen: '#a3be8c',
  brightYellow: '#ebcb8b',
  brightBlue: '#81a1c1',
  brightMagenta: '#b48ead',
  brightCyan: '#8fbcbb',
  brightWhite: '#2e3440',
}

const oneLightXterm: ITheme = {
  background: '#fafafa',
  foreground: '#383a42',
  cursor: '#526fff',
  cursorAccent: '#fafafa',
  selectionBackground: '#e5e5e6',
  black: '#000000',
  red: '#de3e35',
  green: '#3f953a',
  yellow: '#d2b67c',
  blue: '#2f5af3',
  magenta: '#950095',
  cyan: '#0997b3',
  white: '#bbbbbb',
  brightBlack: '#000000',
  brightRed: '#de3e35',
  brightGreen: '#3f953a',
  brightYellow: '#d2b67c',
  brightBlue: '#2f5af3',
  brightMagenta: '#a00095',
  brightCyan: '#0bbcd6',
  brightWhite: '#ffffff',
}

const jokerXterm: ITheme = {
  background: '#1c1626',
  foreground: '#f4efe6',
  cursor: '#8af26a',
  cursorAccent: '#1c1626',
  selectionBackground: '#3d3051',
  black: '#16111e',
  red: '#ff5266',
  green: '#8af26a',
  yellow: '#ffdc63',
  blue: '#a685ff',
  magenta: '#ff7ccf',
  cyan: '#97b46e',
  white: '#f4efe6',
  brightBlack: '#9088a0',
  brightRed: '#ff6b7a',
  brightGreen: '#a5f78a',
  brightYellow: '#ffe88f',
  brightBlue: '#c0a6ff',
  brightMagenta: '#ff9fdc',
  brightCyan: '#b1cc8d',
  brightWhite: '#ffffff',
}

const jokerLightXterm: ITheme = {
  background: '#f4efe6',
  foreground: '#1c1626',
  cursor: '#057502',
  cursorAccent: '#f4efe6',
  selectionBackground: '#d8ceee',
  black: '#ebe3db',
  red: '#c7054c',
  green: '#057502',
  yellow: '#6d5901',
  blue: '#601dd0',
  magenta: '#9a0381',
  cyan: '#234e14',
  white: '#1c1626',
  brightBlack: '#685e74',
  brightRed: '#e43562',
  brightGreen: '#2d8d28',
  brightYellow: '#847025',
  brightBlue: '#7540ec',
  brightMagenta: '#b52e9a',
  brightCyan: '#3b682e',
  brightWhite: '#40394d',
}

export type SwatchColors = {
  background: string
  primary: string
  accent: string
}

// A family is what the picker lists; the light/dark toggle picks its variant.
export type ThemeFamily =
  | 'default'
  | 'dracula'
  | 'monokai'
  | 'nord'
  | 'tokyo-night'
  | 'one'
  | 'joker'

export const THEME_FAMILIES: readonly { id: ThemeFamily; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'monokai', label: 'Monokai' },
  { id: 'nord', label: 'Nord' },
  { id: 'tokyo-night', label: 'Tokyo Night' },
  { id: 'one', label: 'One' },
  { id: 'joker', label: 'Joker' },
]

export type ThemeDefinition = {
  id: ThemeId
  family: ThemeFamily
  mode: ThemeMode
  cssClass: string | null
  xterm: ITheme
  swatch: SwatchColors
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'default-light',
    family: 'default',
    mode: 'light',
    cssClass: null,
    xterm: lightXterm,
    swatch: { background: '#ffffff', primary: '#1f2937', accent: '#f1f1f3' },
  },
  {
    id: 'dracula-light',
    family: 'dracula',
    mode: 'light',
    cssClass: 'theme-dracula-light',
    xterm: draculaLightXterm,
    swatch: { background: '#fffbeb', primary: '#644ac9', accent: '#ece9df' },
  },
  {
    id: 'monokai-light',
    family: 'monokai',
    mode: 'light',
    cssClass: 'theme-monokai-light',
    xterm: monokaiLightXterm,
    swatch: { background: '#fafafa', primary: '#56932e', accent: '#efeee0' },
  },
  {
    id: 'nord-light',
    family: 'nord',
    mode: 'light',
    cssClass: 'theme-nord-light',
    xterm: nordLightXterm,
    swatch: { background: '#e5e9f0', primary: '#5e81ac', accent: '#d8dee9' },
  },
  {
    id: 'one-light',
    family: 'one',
    mode: 'light',
    cssClass: 'theme-one-light',
    xterm: oneLightXterm,
    swatch: { background: '#fafafa', primary: '#5871ef', accent: '#dbdbdc' },
  },
  {
    id: 'joker-light',
    family: 'joker',
    mode: 'light',
    cssClass: 'theme-joker-light',
    xterm: jokerLightXterm,
    swatch: { background: '#f4efe6', primary: '#234e14', accent: '#d8ceee' },
  },
  {
    id: 'default-dark',
    family: 'default',
    mode: 'dark',
    cssClass: null,
    xterm: darkXterm,
    swatch: { background: '#0a0a0a', primary: '#e7e7eb', accent: '#3f3f46' },
  },
  {
    id: 'dracula',
    family: 'dracula',
    mode: 'dark',
    cssClass: 'theme-dracula',
    xterm: draculaXterm,
    swatch: { background: '#282a36', primary: '#bd93f9', accent: '#323543' },
  },
  {
    id: 'monokai',
    family: 'monokai',
    mode: 'dark',
    cssClass: 'theme-monokai',
    xterm: monokaiXterm,
    swatch: { background: '#272822', primary: '#a6e22e', accent: '#3e3d32' },
  },
  {
    id: 'nord',
    family: 'nord',
    mode: 'dark',
    cssClass: 'theme-nord',
    xterm: nordXterm,
    swatch: { background: '#2e3440', primary: '#88c0d0', accent: '#3b4252' },
  },
  {
    id: 'tokyo-night',
    family: 'tokyo-night',
    mode: 'dark',
    cssClass: 'theme-tokyo-night',
    xterm: tokyoNightXterm,
    swatch: { background: '#1a1b26', primary: '#7aa2f7', accent: '#343a55' },
  },
  {
    id: 'one-dark',
    family: 'one',
    mode: 'dark',
    cssClass: 'theme-one-dark',
    xterm: oneDarkXterm,
    swatch: { background: '#282c34', primary: '#4d78cc', accent: '#2c313a' },
  },
  {
    id: 'joker',
    family: 'joker',
    mode: 'dark',
    cssClass: 'theme-joker',
    xterm: jokerXterm,
    swatch: { background: '#1c1626', primary: '#97b46e', accent: '#3d3051' },
  },
]

export const THEME_CSS_CLASSES: string[] = THEMES.map((t) => t.cssClass).filter(
  (c): c is string => c !== null,
)

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((t) => t.id === value)
}

export function familyTheme(family: ThemeFamily, mode: ThemeMode): ThemeDefinition | undefined {
  return THEMES.find((t) => t.family === family && t.mode === mode)
}

// themeInMode is the toggle: the same family in the other mode, or that
// mode's default theme for a family without one (Tokyo Night is dark only).
export function themeInMode(id: ThemeId, mode: ThemeMode): ThemeId {
  return familyTheme(getTheme(id).family, mode)?.id ?? (mode === 'light' ? DEFAULT_LIGHT : DEFAULT_DARK)
}
