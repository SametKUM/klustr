// Stands in for @wailsio/runtime in unit tests (see vitest.config.ts). The
// real module starts a timer on import that reads `window`; when a short test
// file ends first, the timer fires after jsdom is gone and fails the run with
// "window is not defined". Unit tests never reach the native side anyway.

const unavailable = () => Promise.reject(new Error('the Wails runtime is not available in unit tests'))

export const Call = { ByID: unavailable, ByName: unavailable }
export const CancellablePromise = Promise
export const Create = { Events: {} }

export const Events = {
  On: () => () => {},
  Off: () => {},
  Emit: () => Promise.resolve(false),
}

export const Browser = { OpenURL: () => Promise.resolve() }
