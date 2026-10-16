import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import type { ResourceManager } from '@/lib/api'
import { GitOpsRevertWarning } from './GitOpsRevertWarning'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const selfHealing = {
  tool: 'argocd',
  kind: 'Application',
  group: 'argoproj.io',
  resource: 'applications',
  context: 'devops',
  namespace: 'argocd',
  name: 'shop-api',
  resolved: true,
  suspended: false,
  revertsDrift: true,
  revertReason: 'self-heal is on',
  ignoredFields: ['/spec/replicas'],
} as ResourceManager

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(() => act(() => root.unmount()))

it('warns before a YAML edit that self-heal reverts it', async () => {
  await act(async () => root.render(<GitOpsRevertWarning managers={[selfHealing]} />))
  expect(container.textContent).toContain(
    'Argo CD Application argocd/shop-api will revert this change because self-heal is on.',
  )
})

it('stays quiet for a scale when the owner ignores replicas', async () => {
  await act(async () => root.render(<GitOpsRevertWarning managers={[selfHealing]} field="/spec/replicas" />))
  expect(container.innerHTML).toBe('')
})

it('stays quiet when no owner reverts live changes', async () => {
  await act(async () => root.render(<GitOpsRevertWarning managers={[{ ...selfHealing, revertsDrift: false }]} />))
  expect(container.innerHTML).toBe('')
})
