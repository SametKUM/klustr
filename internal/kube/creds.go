package kube

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"sync"
	"time"
)

// captureTimeout bounds one helper invocation. It is generous because a
// capture may block on user interaction (the macOS Keychain dialog).
const captureTimeout = 2 * time.Minute

// credentialManager owns the credential-helper state: persisted context →
// profile mappings, captured secrets (memory only), per-context single-flight
// capture and ahead-of-expiry refresh timers.
type credentialManager struct {
	mu          sync.Mutex
	providers   []CredentialProvider
	mappings    map[string]CredentialMapping
	captured    map[string]CapturedCredentials
	inflight    map[string]chan struct{}
	timers      map[string]*time.Timer
	lastErr     map[string]string
	storePath   string
	onEvent     func(CredentialStatus)
	onRefreshed func(contextName string)
	now         func() time.Time
}

func newCredentialManager() *credentialManager {
	c := &credentialManager{
		providers: []CredentialProvider{awsVaultProvider{}},
		mappings:  map[string]CredentialMapping{},
		captured:  map[string]CapturedCredentials{},
		inflight:  map[string]chan struct{}{},
		timers:    map[string]*time.Timer{},
		lastErr:   map[string]string{},
		now:       time.Now,
	}
	if path, err := credsStorePath(); err == nil {
		c.storePath = path
		if m, err := loadCredentialMappings(path); err == nil {
			c.mappings = m
		}
	}
	return c
}

func (c *credentialManager) setOnEvent(cb func(CredentialStatus)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.onEvent = cb
}

func (c *credentialManager) setOnRefreshed(cb func(contextName string)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.onRefreshed = cb
}

func (c *credentialManager) providerInfos() []CredentialProviderInfo {
	infos := make([]CredentialProviderInfo, 0, len(c.providers))
	for _, p := range c.providers {
		infos = append(infos, CredentialProviderInfo{Name: p.Name(), Detected: p.Detect()})
	}
	return infos
}

func (c *credentialManager) provider(name string) CredentialProvider {
	for _, p := range c.providers {
		if p.Name() == name {
			return p
		}
	}
	return nil
}

func (c *credentialManager) profiles(providerName string) ([]string, error) {
	p := c.provider(providerName)
	if p == nil {
		return []string{}, fmt.Errorf("unknown credential provider %q", providerName)
	}
	return p.ListProfiles()
}

func (c *credentialManager) mapping(contextName string) (CredentialMapping, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	m, ok := c.mappings[contextName]
	return m, ok
}

func (c *credentialManager) hasMapping(contextName string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	_, ok := c.mappings[contextName]
	return ok
}

func (c *credentialManager) setMapping(contextName string, mapping CredentialMapping) error {
	if c.provider(mapping.Provider) == nil {
		return fmt.Errorf("unknown credential provider %q", mapping.Provider)
	}
	if mapping.Profile == "" {
		return errors.New("profile is required")
	}
	c.mu.Lock()
	c.mappings[contextName] = mapping
	// A remap invalidates whatever was captured for the old profile.
	delete(c.captured, contextName)
	delete(c.lastErr, contextName)
	c.stopTimerLocked(contextName)
	mappings := c.mappings
	path := c.storePath
	c.mu.Unlock()
	if path == "" {
		return nil
	}
	return saveCredentialMappings(path, mappings)
}

func (c *credentialManager) clearMapping(contextName string) error {
	c.mu.Lock()
	delete(c.mappings, contextName)
	delete(c.captured, contextName)
	delete(c.lastErr, contextName)
	c.stopTimerLocked(contextName)
	mappings := c.mappings
	path := c.storePath
	c.mu.Unlock()
	if path == "" {
		return nil
	}
	return saveCredentialMappings(path, mappings)
}

// envFor returns a copy of the captured credential env for restConfig to
// merge into the context's exec provider, or nil when nothing is captured.
func (c *credentialManager) envFor(contextName string) map[string]string {
	c.mu.Lock()
	defer c.mu.Unlock()
	cred, ok := c.captured[contextName]
	if !ok {
		return nil
	}
	out := make(map[string]string, len(cred.env))
	maps.Copy(out, cred.env)
	return out
}

// ensureFresh is the auto-capture entry point Watch calls before building
// clients: a no-op for unmapped contexts, otherwise it captures unless valid
// credentials are already in memory. The bool reports whether a capture ran —
// the caller must then discard any clients built while it was pending.
func (c *credentialManager) ensureFresh(ctx context.Context, contextName string) (bool, error) {
	c.mu.Lock()
	mapping, ok := c.mappings[contextName]
	if !ok {
		c.mu.Unlock()
		return false, nil
	}
	if cred, ok := c.captured[contextName]; ok && cred.valid(c.now()) {
		c.mu.Unlock()
		return false, nil
	}
	c.mu.Unlock()
	if err := c.capture(ctx, contextName, mapping); err != nil {
		return false, err
	}
	return true, nil
}

func (c *credentialManager) capture(ctx context.Context, contextName string, mapping CredentialMapping) error {
	c.mu.Lock()
	if ch, ok := c.inflight[contextName]; ok {
		c.mu.Unlock()
		select {
		case <-ch:
		case <-ctx.Done():
			return ctx.Err()
		}
		c.mu.Lock()
		cred, ok := c.captured[contextName]
		errMsg := c.lastErr[contextName]
		now := c.now()
		c.mu.Unlock()
		if ok && cred.valid(now) {
			return nil
		}
		if errMsg == "" {
			errMsg = "credential capture failed"
		}
		return errors.New(errMsg)
	}
	ch := make(chan struct{})
	c.inflight[contextName] = ch
	c.mu.Unlock()
	defer func() {
		c.mu.Lock()
		delete(c.inflight, contextName)
		c.mu.Unlock()
		close(ch)
	}()

	provider := c.provider(mapping.Provider)
	if provider == nil {
		return c.fail(contextName, fmt.Sprintf("unknown credential provider %q", mapping.Provider))
	}
	cctx, cancel := context.WithTimeout(ctx, captureTimeout)
	defer cancel()
	cred, err := provider.Capture(cctx, mapping.Profile)
	if err != nil {
		return c.fail(contextName, err.Error())
	}

	c.mu.Lock()
	c.captured[contextName] = cred
	delete(c.lastErr, contextName)
	c.mu.Unlock()
	c.scheduleRefresh(contextName, cred.expiry)
	c.emit(contextName)
	return nil
}

func (c *credentialManager) fail(contextName, msg string) error {
	c.mu.Lock()
	c.lastErr[contextName] = msg
	c.mu.Unlock()
	c.emit(contextName)
	return errors.New(msg)
}

func (c *credentialManager) scheduleRefresh(contextName string, expiry time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.stopTimerLocked(contextName)
	if expiry.IsZero() {
		return
	}
	delay, ok := refreshDelay(c.now(), expiry)
	if !ok {
		return
	}
	c.timers[contextName] = time.AfterFunc(delay, func() { c.refresh(contextName) })
}

// refresh re-captures ahead of expiry and tells the manager to rebuild the
// context's clients: the client-go exec authenticator snapshots its env at
// construction, so injecting new credentials requires fresh rest.Configs.
func (c *credentialManager) refresh(contextName string) {
	c.mu.Lock()
	mapping, ok := c.mappings[contextName]
	cb := c.onRefreshed
	c.mu.Unlock()
	if !ok {
		return
	}
	if err := c.capture(context.Background(), contextName, mapping); err != nil {
		return
	}
	if cb != nil {
		cb(contextName)
	}
}

// refreshDelay decides when to renew ahead of expiry: 5 minutes early
// normally, at 80% of the remaining lifetime for short-lived sessions, and
// not at all when fewer than 30 seconds remain (the next ensureFresh
// re-captures instead).
func refreshDelay(now, expiry time.Time) (time.Duration, bool) {
	remaining := expiry.Sub(now)
	if remaining <= 30*time.Second {
		return 0, false
	}
	delay := remaining - 5*time.Minute
	if remaining < 10*time.Minute {
		delay = remaining * 4 / 5
	}
	if delay < 30*time.Second {
		delay = 30 * time.Second
	}
	return delay, true
}

func (c *credentialManager) stopTimerLocked(contextName string) {
	if t, ok := c.timers[contextName]; ok {
		t.Stop()
		delete(c.timers, contextName)
	}
}

// pauseRefresh stops the background renewal when a context disconnects; the
// captured credentials stay in memory and the next Watch revalidates them.
func (c *credentialManager) pauseRefresh(contextName string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.stopTimerLocked(contextName)
}

func (c *credentialManager) stopAll() {
	c.mu.Lock()
	defer c.mu.Unlock()
	for name, t := range c.timers {
		t.Stop()
		delete(c.timers, name)
	}
	c.captured = map[string]CapturedCredentials{}
	c.lastErr = map[string]string{}
}

func (c *credentialManager) statuses() []CredentialStatus {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]CredentialStatus, 0, len(c.mappings))
	for name := range c.mappings {
		out = append(out, c.statusLocked(name))
	}
	return out
}

func (c *credentialManager) statusLocked(contextName string) CredentialStatus {
	mapping := c.mappings[contextName]
	s := CredentialStatus{
		Context:  contextName,
		Provider: mapping.Provider,
		Profile:  mapping.Profile,
		State:    "mapped",
	}
	if msg, ok := c.lastErr[contextName]; ok {
		s.State = "error"
		s.Error = msg
		return s
	}
	cred, ok := c.captured[contextName]
	if !ok {
		return s
	}
	if !cred.expiry.IsZero() {
		s.ExpiresAt = cred.expiry.Format(time.RFC3339)
	}
	if cred.valid(c.now()) {
		s.State = "captured"
	} else {
		s.State = "expired"
	}
	return s
}

func (c *credentialManager) emit(contextName string) {
	c.mu.Lock()
	cb := c.onEvent
	var status CredentialStatus
	if cb != nil {
		status = c.statusLocked(contextName)
	}
	c.mu.Unlock()
	if cb != nil {
		cb(status)
	}
}
