package kube

import (
	"context"
	"time"
)

// CredentialProvider captures short-lived cloud credentials from an external
// helper (aws-vault, granted, …) so kubeconfig exec plugins that expect them
// as ambient environment work under GUI launch. Implementations must never
// log or persist credential values.
type CredentialProvider interface {
	Name() string
	Detect() bool
	ListProfiles() ([]string, error)
	Capture(ctx context.Context, profile string) (CapturedCredentials, error)
}

// CapturedCredentials holds helper-issued secrets in memory only. The fields
// are unexported so the struct can never serialize through a Wails binding
// or event payload.
type CapturedCredentials struct {
	env    map[string]string
	expiry time.Time
}

func (c CapturedCredentials) valid(now time.Time) bool {
	if len(c.env) == 0 {
		return false
	}
	if c.expiry.IsZero() {
		return true
	}
	return c.expiry.After(now.Add(time.Minute))
}

// CredentialMapping ties a kubeconfig context to a provider profile. It is
// the only credential-helper state persisted to disk — names, never secrets.
type CredentialMapping struct {
	Provider string `json:"provider"`
	Profile  string `json:"profile"`
}

type CredentialProviderInfo struct {
	Name     string `json:"name"`
	Detected bool   `json:"detected"`
}

// CredentialStatus is the frontend-facing view of one mapped context.
type CredentialStatus struct {
	Context   string `json:"context"`
	Provider  string `json:"provider"`
	Profile   string `json:"profile"`
	State     string `json:"state"` // mapped | captured | expired | error
	ExpiresAt string `json:"expiresAt"`
	Error     string `json:"error"`
}
