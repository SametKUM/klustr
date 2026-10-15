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
import YamlWorker from './yaml.worker?worker'
import { configureMonacoYaml, type JSONSchema } from 'monaco-yaml'
import { createYAMLWebWorker } from './monacoYamlWorker'

globalThis.MonacoEnvironment = {
  getWorker: (_moduleId, label) => (label === 'yaml' ? new YamlWorker() : new EditorWorker()),
}
loader.config({ monaco })

const schemas = new Map<string, JSONSchema>()
const yamlService = configureMonacoYaml({
  ...monaco,
  editor: { ...monaco.editor, createWebWorker: createYAMLWebWorker },
}, {
  enableSchemaRequest: false,
  isKubernetes: true,
  yamlVersion: '1.1',
  format: { enable: false },
  schemas: [],
})

export function registerYAMLSchema(path: string, schema: JSONSchema): () => void {
  schemas.set(path, schema)
  const update = () =>
    yamlService.update({
      enableSchemaRequest: false,
      isKubernetes: true,
      yamlVersion: '1.1',
      format: { enable: false },
      schemas: [...schemas].map(([path, schema]) => ({
        uri: `${path}.schema.json`,
        fileMatch: [path],
        schema,
      })),
    })
  update()
  return () => {
    if (schemas.get(path) === schema) {
      schemas.delete(path)
      update()
    }
  }
}

export type { OnMount } from '@monaco-editor/react'

export { DiffEditor, Editor } from '@monaco-editor/react'
