// Package kube is the Wails-agnostic core of Klustr: everything that talks to a
// Kubernetes cluster lives here, and nothing in this package imports Wails. That
// split is deliberate — internal/kube stays testable with plain `go test`, and a
// future CLI or web frontend would reuse it unchanged while only the thin app/
// binding adapter is rewritten.
//
// # Live data
//
// Resource lists are never polled. ClientManager owns one contextWatcher per
// connected kubeconfig context, each running client-go informers whose cache
// events are debounced and emitted as ContextChange values. The application
// adapter turns those into Wails events that drive the frontend stores:
//
//	K8s API --watch--> Informer --cache+events--> ContextChange --> (app) Wails event
//
// Informers start lazily. On attach a contextWatcher probes SelfSubjectAccessReview
// for every built-in kind and routes each into one of three buckets — cluster-wide,
// namespace-scoped (the kubeconfig context's namespace), or denied. Only Namespace
// and Pod informers start up front; every other kind's informer is registered and
// started on first use via factoryFor/ensureKind, so attaching to a large cluster
// costs two initial LISTs rather than one per covered kind. The kindBindings table
// in informers.go enumerates every covered kind in one place. The metrics.k8s.io
// API is the sole exception to the no-polling rule — it has no watch verb, so pod
// usage is polled and cached.
//
// Custom Resources, Helm releases, Argo CD Applications and Gateway API objects are
// handled alongside the typed informers (see crd.go, helm.go, argocd.go, gateway.go).
//
// # Layout
//
// manager.go holds ClientManager lifecycle plus the shared subsystems
// (logs/exec/port-forward); manager_<group>.go files are the per-sidebar-group
// forwarders. informers_<group>.go define list shapes and listers,
// details_<group>.go the detail builders. Credentials (creds*.go) are held in
// memory only and are never logged or returned over a binding.
package kube
