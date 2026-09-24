// Package kube is the Wails-agnostic core of Klustr: everything that talks to a
// Kubernetes cluster lives here and nothing here imports Wails, so it stays
// testable with plain `go test` and app/ is the only layer a CLI or web mode
// would replace.
//
// Resource lists are never polled. ClientManager runs one contextWatcher per
// connected context; its client-go informers start lazily per kind, are routed
// by SelfSubjectAccessReview, and emit debounced ContextChange values. Pod
// metrics are the one polled exception, because metrics.k8s.io has no watch.
//
// Captured credentials (creds*.go) live in memory only and are never logged or
// returned over a binding.
package kube
