import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist', 'src/lib/wails/**'],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // react-hooks v7 ships several opinionated rules that fire on patterns
      // existing in this codebase. Keep them surfaced as warnings rather than
      // hard errors so lint stays runnable while we migrate incrementally.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/incompatible-library': 'warn',
    },
  },
  {
    // A direct import of the Monaco wrapper falls back to its CDN loader; the
    // editors come from src/lib/monaco.ts, which bundles Monaco.
    files: ['**/*.{ts,tsx}'],
    ignores: ['src/lib/monaco.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@monaco-editor/*', 'monaco-editor', 'monaco-editor/*'],
              message: 'Import Editor and DiffEditor from @/lib/monaco.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/^(@monaco-editor\\/|monaco-editor)/]',
          message: 'Import Editor and DiffEditor from @/lib/monaco.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
)
