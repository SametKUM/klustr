// Package app is the thin Wails binding adapter over internal/kube: it forwards
// each frontend call to ClientManager and turns backend callbacks into Wails
// events (kube:change, creds:update). Business logic belongs in internal/kube,
// where it stays testable without the Wails runtime.
package app
