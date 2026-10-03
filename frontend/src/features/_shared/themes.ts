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
  | 'tokyo-night-day'
  | 'one-dark'
  | 'one-light'

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
  foreground: '#f8f8f2',
  cursor: '#f8f8f2',
  cursorAccent: '#272822',
  selectionBackground: '#49483e',
  black: '#272822',
  red: '#f92672',
  green: '#a6e22e',
  yellow: '#e6db74',
  blue: '#66d9ef',
  magenta: '#ae81ff',
  cyan: '#a1efe4',
  white: '#f8f8f2',
  brightBlack: '#75715e',
  brightRed: '#f92672',
  brightGreen: '#a6e22e',
  brightYellow: '#e6db74',
  brightBlue: '#66d9ef',
  brightMagenta: '#ae81ff',
  brightCyan: '#a1efe4',
  brightWhite: '#f9f8f5',
}

const nordXterm: ITheme = {
  background: '#2e3440',
  foreground: '#d8dee9',
  cursor: '#d8dee9',
  cursorAccent: '#2e3440',
  selectionBackground: '#434c5e',
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
  brightRed: '#f7768e',
  brightGreen: '#9ece6a',
  brightYellow: '#e0af68',
  brightBlue: '#7aa2f7',
  brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff',
  brightWhite: '#c0caf5',
}

const oneDarkXterm: ITheme = {
  background: '#282c34',
  foreground: '#abb2bf',
  cursor: '#abb2bf',
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
  brightBlack: '#5c6370',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff',
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

const tokyoNightDayXterm: ITheme = {
  background: '#e1e2e7',
  foreground: '#3760bf',
  cursor: '#3760bf',
  cursorAccent: '#e1e2e7',
  selectionBackground: '#b7c1e3',
  black: '#b7c1e3',
  red: '#f52a65',
  green: '#587539',
  yellow: '#8c6c3e',
  blue: '#2e7de9',
  magenta: '#9854f1',
  cyan: '#007197',
  white: '#6172b0',
  brightBlack: '#848cb5',
  brightRed: '#f52a65',
  brightGreen: '#587539',
  brightYellow: '#b15c00',
  brightBlue: '#2e7de9',
  brightMagenta: '#65359d',
  brightCyan: '#007197',
  brightWhite: '#3760bf',
}

const oneLightXterm: ITheme = {
  background: '#fafafa',
  foreground: '#383a42',
  cursor: '#526fff',
  cursorAccent: '#fafafa',
  selectionBackground: '#e5e5e6',
  black: '#383a42',
  red: '#e45649',
  green: '#50a14f',
  yellow: '#c18401',
  blue: '#4078f2',
  magenta: '#a626a4',
  cyan: '#0184bc',
  white: '#fafafa',
  brightBlack: '#a0a1a7',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#d19a66',
  brightBlue: '#4078f2',
  brightMagenta: '#a626a4',
  brightCyan: '#0184bc',
  brightWhite: '#ffffff',
}

export type SwatchColors = {
  background: string
  primary: string
  accent: string
}

export type ThemeDefinition = {
  id: ThemeId
  label: string
  mode: ThemeMode
  cssClass: string | null
  xterm: ITheme
  swatch: SwatchColors
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'default-light',
    label: 'Light',
    mode: 'light',
    cssClass: null,
    xterm: lightXterm,
    swatch: { background: '#ffffff', primary: '#1f2937', accent: '#f1f1f3' },
  },
  {
    id: 'dracula-light',
    label: 'Dracula',
    mode: 'light',
    cssClass: 'theme-dracula-light',
    xterm: draculaLightXterm,
    swatch: { background: '#fffbeb', primary: '#644ac9', accent: '#ece9df' },
  },
  {
    id: 'monokai-light',
    label: 'Monokai',
    mode: 'light',
    cssClass: 'theme-monokai-light',
    xterm: monokaiLightXterm,
    swatch: { background: '#fafafa', primary: '#56932e', accent: '#efeee0' },
  },
  {
    id: 'nord-light',
    label: 'Nord',
    mode: 'light',
    cssClass: 'theme-nord-light',
    xterm: nordLightXterm,
    swatch: { background: '#e5e9f0', primary: '#5e81ac', accent: '#c8d0db' },
  },
  {
    id: 'tokyo-night-day',
    label: 'Tokyo Night Day',
    mode: 'light',
    cssClass: 'theme-tokyo-night-day',
    xterm: tokyoNightDayXterm,
    swatch: { background: '#e1e2e7', primary: '#2e7de9', accent: '#b7c1e3' },
  },
  {
    id: 'one-light',
    label: 'One',
    mode: 'light',
    cssClass: 'theme-one-light',
    xterm: oneLightXterm,
    swatch: { background: '#fafafa', primary: '#4078f2', accent: '#e5e5e6' },
  },
  {
    id: 'default-dark',
    label: 'Dark',
    mode: 'dark',
    cssClass: null,
    xterm: darkXterm,
    swatch: { background: '#0a0a0a', primary: '#e7e7eb', accent: '#3f3f46' },
  },
  {
    id: 'dracula',
    label: 'Dracula',
    mode: 'dark',
    cssClass: 'theme-dracula',
    xterm: draculaXterm,
    swatch: { background: '#282a36', primary: '#bd93f9', accent: '#323543' },
  },
  {
    id: 'monokai',
    label: 'Monokai',
    mode: 'dark',
    cssClass: 'theme-monokai',
    xterm: monokaiXterm,
    swatch: { background: '#272822', primary: '#a6e22e', accent: '#49483e' },
  },
  {
    id: 'nord',
    label: 'Nord',
    mode: 'dark',
    cssClass: 'theme-nord',
    xterm: nordXterm,
    swatch: { background: '#2e3440', primary: '#88c0d0', accent: '#434c5e' },
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    mode: 'dark',
    cssClass: 'theme-tokyo-night',
    xterm: tokyoNightXterm,
    swatch: { background: '#1a1b26', primary: '#7aa2f7', accent: '#323862' },
  },
  {
    id: 'one-dark',
    label: 'One Dark',
    mode: 'dark',
    cssClass: 'theme-one-dark',
    xterm: oneDarkXterm,
    swatch: { background: '#282c34', primary: '#61afef', accent: '#3e4451' },
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
