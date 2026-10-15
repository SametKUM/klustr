import { editor } from 'monaco-editor/editor'
import YamlWorker from './yaml.worker?worker'

// monaco-yaml's worker manager still supplies the pre-0.57 createData options.
// Monaco now takes an initialized Worker instead; both bootstrap messages must
// precede its RPC handshake so the YAML service receives its configuration.
export function createYAMLWebWorker<T extends object>(
  options: Partial<editor.IInternalWebWorkerOptions> & { createData?: unknown },
): editor.MonacoWebWorker<T> {
  const worker = new YamlWorker()
  worker.postMessage('ignore')
  worker.postMessage(options.createData)
  return editor.createWebWorker<T>({ ...options, worker })
}
