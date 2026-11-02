// The Wails v3 bindings, shaped the way the rest of the frontend expects them.
//
// Types: the v3 generator types every Go slice and map as nullable
// (T[] | null, { [_ in string]?: V } | null), because a nil slice encodes as
// null. The Go side never sends nil for them (see AGENTS.md: empty slices,
// never nil), so Strict gives the frontend T[] and Record<string, V>. Optional
// fields stay optional, without the extra null.
//
// Errors: v3 rejects a call with a RuntimeError object whose message is the Go
// error string. The frontend reads rejections as that string, so call
// rejects with the message alone.

export type Strict<T> = T extends readonly (infer U)[]
  ? Strict<Exclude<U, null>>[]
  : T extends object
    ? string extends keyof T
      ? Record<string, Strict<NonNullable<T[string]>>>
      : { [K in keyof T]: Strict<Exclude<T[K], null>> }
    : T

export function rejectionMessage(error: unknown): unknown {
  return error instanceof Error ? error.message : error
}

type Binding<A extends unknown[], R> = (...args: A) => PromiseLike<R>

export function call<A extends unknown[], R>(fn: Binding<A, R>): (...args: A) => Promise<Strict<Exclude<R, null>>> {
  return (...args: A) =>
    Promise.resolve(fn(...args)).then(
      (result) => result as Strict<Exclude<R, null>>,
      // Rejecting with the bare message keeps every existing catch working.
      (error: unknown) => Promise.reject(rejectionMessage(error)),
    )
}

// For the few bindings where a null result carries meaning, such as the
// metrics lists (null: the metrics API is unavailable).
export function callNullable<A extends unknown[], R>(
  fn: Binding<A, R>,
): (...args: A) => Promise<Strict<Exclude<R, null>> | null> {
  return (...args: A) =>
    Promise.resolve(fn(...args)).then(
      (result) => result as Strict<Exclude<R, null>> | null,
      (error: unknown) => Promise.reject(rejectionMessage(error)),
    )
}
