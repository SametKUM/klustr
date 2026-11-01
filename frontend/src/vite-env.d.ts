/// <reference types="vite/client" />

interface ImportMetaEnv {
  // '1' in a perf probe build (hack/perf); see src/perf/probe.ts.
  readonly VITE_KLUSTR_PERF?: string
}
