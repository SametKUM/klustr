// Package app is the thin Wails binding adapter that sits between the native
// webview frontend and the Wails-agnostic core in internal/kube. Its job is
// narrow on purpose: hold the bound App struct, forward each frontend call to
// the underlying ClientManager, and translate backend ContextChange / credential
// callbacks into Wails runtime events (kube:change, creds:update). The Wails CLI
// generates the TypeScript bindings for every exported App method.
//
// Keeping this layer thin is what makes the internal/kube <-> app split pay off:
// if Klustr ever ships a CLI or web mode, only this package is rewritten. Avoid
// putting business logic here — it belongs in internal/kube where it stays
// testable without the Wails runtime.
package app
