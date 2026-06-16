# Performance testing protocol

How to measure Klustr's behavior on large, busy clusters before and after a
change, so performance work stays data-driven.

## 1. Microbenchmarks (no cluster)

The hot path on every `kube:change` is: walk the informer cache → project each
object into its lean `Info` struct → sort → (the Wails layer then JSON-serializes
the slice). The benchmarks in `internal/kube/informers_pods_bench_test.go` cover
each stage at N = 500 / 1500 / 5000.

```bash
go test ./internal/kube -run='^$' -bench='BenchmarkPods|BenchmarkPodInfo|BenchmarkMarshal' -benchmem -count=10 > before.txt
# make the change, then:
go test ./internal/kube -run='^$' -bench='BenchmarkPods|BenchmarkPodInfo|BenchmarkMarshal' -benchmem -count=10 > after.txt
go install golang.org/x/perf/cmd/benchstat@latest
benchstat before.txt after.txt   # paste the delta table into the PR / commit body
```

What each one isolates:

| Benchmark | Measures |
|---|---|
| `BenchmarkPods` | end-to-end Go cost: lister walk + projection + sort |
| `BenchmarkPodInfosFrom` | projection + sort only (no lister) |
| `BenchmarkPodInfoFrom` | per-object projection cost |
| `BenchmarkMarshalPodInfos` | `encoding/json` of `[]PodInfo` — proxy for the Wails bridge serialization, the number a delta protocol must beat |

These are deterministic and CI-reproducible; no cluster required.

## 2. Opt-in runtime profiling

Both knobs are off by default and cost nothing in production builds.

- `KLUSTR_PPROF=127.0.0.1:6060` (or `:6060`) starts a **loopback-only** pprof
  server (`net/http/pprof`).
- `KLUSTR_PERF_TRACE=1` logs `[perf]` lines: Go-side `build=` per list call, and
  (in DEV builds) a frontend `roundtrip=`/`apply=` line per refetch.

```bash
KLUSTR_PPROF=127.0.0.1:6060 KLUSTR_PERF_TRACE=1 wails dev
# while a list view is open and synced:
go tool pprof -http=: http://127.0.0.1:6060/debug/pprof/heap        # cache RAM (inuse_space)
go tool pprof -http=: http://127.0.0.1:6060/debug/pprof/allocs      # allocation churn
go tool pprof -seconds=30 http://127.0.0.1:6060/debug/pprof/profile # CPU during churn
```

The heap profile's `inuse_space` (focus on `ManagedFieldsEntry` / `FieldsV1`) is
how the managedFields-stripping memory win is proven before/after.

## 3. End-to-end against a large simulated cluster

A kwok-based simulation that spins up ~1500 pods/cluster across two clusters plus
a sustained watch-event storm lives in the developer's local fixtures under
`hack/sim/` (`sim-up.sh`, `sim-churn.sh`, `sim-down.sh`) — that directory is
local-only and not part of the repo. Any equivalent large cluster works.

Protocol (run before and after the change under identical sim state):

1. Bring up the simulation (`hack/sim/sim-up.sh`, ~1500 pods/cluster).
2. Launch with profiling: `KLUSTR_PPROF=127.0.0.1:6060 KLUSTR_PERF_TRACE=1 wails dev`.
3. Attach to a sim context, open the Pods view, wait for sync.
4. Baseline capture:
   - heap `inuse_space` of the pod informer cache (pprof),
   - a few `[perf] … roundtrip=/apply=` console lines + `[perf] list … build=` Go logs.
5. Start churn (`hack/sim/sim-churn.sh`, ~25 events/sec); capture a 30s CPU profile.
6. Apply the change, rebuild, repeat steps 4–5 identically.
7. Tear down (`hack/sim/sim-down.sh`).

Report: heap `inuse_space` before/after, CPU `top10` before/after, and the median
`roundtrip`/`apply` numbers.

## Reading the numbers

- `roundtrip` ≈ bridge + Go build + JSON parse. Cross-reference against the Go
  `build=` log to isolate the pure bridge + parse slice.
- `apply` ≈ `stableList` diff + React state set — the JS cost a delta protocol
  also reduces (deltas bypass `stableList`).
