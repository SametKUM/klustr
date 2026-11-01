// The fixed scenario the probe drives against hack/perf's cluster. Phase
// lengths are constants so every run, v2 or v3, does the same work;
// hack/perf/run.sh starts the cluster-side churn when the "churn" phase begins.

import { api } from '@/lib/api'
import { useUIStore } from '@/store/ui'
import type { Probe } from './probe'

const CONTEXT = 'kind-klustr-perf'
const STREAM_NAMESPACE = 'perf-stream'

const SECOND = 1000
export const PHASE_MS = {
  idle: 20 * SECOND,
  // run.sh churns for 120 s; the extra 10 s catches the tail of the last rollout.
  churn: 130 * SECOND,
  settle: 15 * SECOND,
  logs: 60 * SECOND,
}
const SYNC_TIMEOUT_MS = 180 * SECOND
const EXEC_TIMEOUT_MS = 300 * SECOND

// The command is echoed back by the TTY, so the marker it waits for is built by
// the shell ($((40+2)) → 42) and never appears in the echo.
const EXEC_COMMAND = 'seq 1 2000000; echo __PERF_$((40+2))__\r'
const EXEC_MARKER = '__PERF_42__'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function waitFor(what: string, done: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs
  while (!done()) {
    if (performance.now() > deadline) throw new Error(`timed out waiting for ${what}`)
    await sleep(100)
  }
}

// Waits until ListPods returns a count that holds steady for 3 s, which is
// when the informer has synced the whole fake fleet.
async function waitForPods(probe: Probe): Promise<void> {
  let count = 0
  let changedAt = performance.now()
  const stop = probe.onCall((method, result) => {
    if (method !== 'ListPods' || !Array.isArray(result)) return
    if (count === 0 && result.length > 0) probe.mark('firstPodsMs', performance.now())
    if (result.length !== count) {
      count = result.length
      changedAt = performance.now()
    }
  })
  try {
    await waitFor('the pod list to settle', () => count > 0 && performance.now() - changedAt > 3 * SECOND, SYNC_TIMEOUT_MS)
  } finally {
    stop()
  }
  probe.mark('podsSyncedMs', changedAt)
  probe.mark('podsCount', count)
}

async function runExec(probe: Probe): Promise<void> {
  let sessionId = ''
  const stopCalls = probe.onCall((method, result) => {
    if (method === 'StartExec' && typeof result === 'string') sessionId = result
  })
  let bytes = 0
  let tail = ''
  let finished = 0
  const stopExec = probe.onExec((id, data) => {
    if (id !== sessionId || finished) return
    bytes += data.length
    tail = (tail + data).slice(-64)
    if (tail.includes(EXEC_MARKER)) finished = performance.now()
  })
  try {
    useUIStore.getState().openResource({ kind: 'Pod', namespace: STREAM_NAMESPACE, name: 'shell', context: CONTEXT }, 'exec')
    await waitFor('the exec session', () => sessionId !== '', 30 * SECOND)
    // Let the shell print its prompt before typing.
    await sleep(2 * SECOND)
    bytes = 0
    const started = performance.now()
    await api.sendExecInput(sessionId, EXEC_COMMAND)
    await waitFor('the exec output marker', () => finished > 0, EXEC_TIMEOUT_MS)
    probe.mark('execMs', finished - started)
    probe.mark('execBytes', bytes)
  } finally {
    stopCalls()
    stopExec()
  }
}

export async function runScenario(probe: Probe): Promise<void> {
  const ui = useUIStore.getState()
  probe.setPhase('boot')
  // The app restores its own session first; give it a moment, then point it
  // at the perf cluster's pod list, all namespaces.
  await sleep(SECOND)
  ui.setSelectedContext(CONTEXT)
  ui.setSelectedNamespaces([])
  ui.setSelectedView('pods')
  await waitForPods(probe)

  probe.setPhase('idle')
  await sleep(PHASE_MS.idle)
  probe.setPhase('churn')
  await sleep(PHASE_MS.churn)
  probe.setPhase('settle')
  await sleep(PHASE_MS.settle)

  probe.setPhase('logs')
  ui.openResource({ kind: 'Pod', namespace: STREAM_NAMESPACE, name: 'log-steady', context: CONTEXT }, 'logs')
  await sleep(PHASE_MS.logs)

  probe.setPhase('exec')
  await runExec(probe)

  probe.setPhase('done')
  probe.report()
}
