import { useEffect, useRef } from 'react'
import type { JSONSchema } from 'monaco-yaml'
import { Editor, DiffEditor, registerYAMLSchema, type OnMount } from '@/lib/monaco'
import { useThemeMode } from '@/features/_shared/useThemeMode'

type Props = {
  path: string
  source: string
  onChange: (source: string) => void
  schema: JSONSchema
  readOnly: boolean
  location: { line: number }
}

export default function ManifestYAMLPane({
  path,
  source,
  onChange,
  schema,
  readOnly,
  location,
}: Props) {
  const theme = useThemeMode()
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  useEffect(() => registerYAMLSchema(path, schema), [path, schema])
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(location.line)
      editorRef.current.setPosition({ lineNumber: location.line, column: 1 })
    }
  }, [location])
  const onMount: OnMount = (editor) => {
    editorRef.current = editor
    if (location.line) {
      editor.revealLineInCenter(location.line)
      editor.setPosition({ lineNumber: location.line, column: 1 })
    }
    editor.focus()
  }
  return (
    <Editor
      path={path}
      height="100%"
      language="yaml"
      value={source}
      onChange={(value) => onChange(value ?? '')}
      theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
      onMount={onMount}
      options={{
        readOnly,
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        folding: true,
        fontSize: 12,
        tabSize: 2,
        automaticLayout: true,
        fixedOverflowWidgets: true,
      }}
    />
  )
}

export function ManifestDiffPane({ before, after }: { before: string; after: string }) {
  const theme = useThemeMode()
  return (
    <DiffEditor
      height="100%"
      language="yaml"
      original={before}
      modified={after}
      theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
      options={{
        readOnly: true,
        renderSideBySide: true,
        useInlineViewWhenSpaceIsLimited: true,
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        fontSize: 12,
        automaticLayout: true,
      }}
    />
  )
}
