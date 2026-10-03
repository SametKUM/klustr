// Monaco is bundled rather than left to @monaco-editor/react's default, which
// fetches it from a CDN at runtime: the editors must work offline and behind
// proxies, and run the version package.json pins. Only the editor features and
// the YAML grammar the views use are pulled in. Import Editor and DiffEditor from
// here, never from @monaco-editor/react, so the config runs before the first
// editor mounts.
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/editor'
import 'monaco-editor/features/register.all'
import 'monaco-editor/languages/definitions/yaml/register'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

globalThis.MonacoEnvironment = { getWorker: () => new EditorWorker() }
loader.config({ monaco })

export { DiffEditor, Editor } from '@monaco-editor/react'
