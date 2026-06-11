package kube

import (
	"context"
	"errors"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type fakeProvider struct {
	name     string
	captures atomic.Int32
	mu       sync.Mutex
	cred     CapturedCredentials
	err      error
	block    chan struct{}
}

func (f *fakeProvider) Name() string                    { return f.name }
func (f *fakeProvider) Detect() bool                    { return true }
func (f *fakeProvider) ListProfiles() ([]string, error) { return []string{"p1"}, nil }
func (f *fakeProvider) Capture(ctx context.Context, profile string) (CapturedCredentials, error) {
	f.captures.Add(1)
	if f.block != nil {
		select {
		case <-f.block:
		case <-ctx.Done():
			return CapturedCredentials{}, ctx.Err()
		}
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.cred, f.err
}

func (f *fakeProvider) set(cred CapturedCredentials, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.cred = cred
	f.err = err
}

func testCredManager(t *testing.T, p CredentialProvider) *credentialManager {
	t.Helper()
	return &credentialManager{
		providers: []CredentialProvider{p},
		mappings:  map[string]CredentialMapping{},
		captured:  map[string]CapturedCredentials{},
		inflight:  map[string]chan struct{}{},
		timers:    map[string]*time.Timer{},
		lastErr:   map[string]string{},
		storePath: filepath.Join(t.TempDir(), "mappings.json"),
		now:       time.Now,
	}
}

func validCred() CapturedCredentials {
	return CapturedCredentials{
		env:    map[string]string{"AWS_ACCESS_KEY_ID": "a", "AWS_SECRET_ACCESS_KEY": "s"},
		expiry: time.Now().Add(time.Hour),
	}
}

func TestEnsureFresh(t *testing.T) {
	t.Run("no mapping is a no-op", func(t *testing.T) {
		p := &fakeProvider{name: "fake"}
		c := testCredManager(t, p)
		if captured, err := c.ensureFresh(context.Background(), "ctx1"); err != nil || captured {
			t.Fatalf("ensureFresh: captured=%v err=%v", captured, err)
		}
		if p.captures.Load() != 0 {
			t.Errorf("captures = %d, want 0", p.captures.Load())
		}
	})

	t.Run("captures once then reuses", func(t *testing.T) {
		p := &fakeProvider{name: "fake"}
		p.set(validCred(), nil)
		c := testCredManager(t, p)
		if err := c.setMapping("ctx1", CredentialMapping{Provider: "fake", Profile: "p1"}); err != nil {
			t.Fatalf("setMapping: %v", err)
		}
		wantCaptured := true
		for range 3 {
			captured, err := c.ensureFresh(context.Background(), "ctx1")
			if err != nil {
				t.Fatalf("ensureFresh: %v", err)
			}
			if captured != wantCaptured {
				t.Fatalf("captured = %v, want %v", captured, wantCaptured)
			}
			wantCaptured = false
		}
		if p.captures.Load() != 1 {
			t.Errorf("captures = %d, want 1", p.captures.Load())
		}
		env := c.envFor("ctx1")
		if env["AWS_ACCESS_KEY_ID"] != "a" {
			t.Errorf("envFor = %v", env)
		}
	})

	t.Run("expired credentials re-capture", func(t *testing.T) {
		p := &fakeProvider{name: "fake"}
		p.set(validCred(), nil)
		c := testCredManager(t, p)
		_ = c.setMapping("ctx1", CredentialMapping{Provider: "fake", Profile: "p1"})
		if _, err := c.ensureFresh(context.Background(), "ctx1"); err != nil {
			t.Fatalf("ensureFresh: %v", err)
		}
		c.mu.Lock()
		cred := c.captured["ctx1"]
		cred.expiry = time.Now().Add(-time.Minute)
		c.captured["ctx1"] = cred
		c.mu.Unlock()
		if captured, err := c.ensureFresh(context.Background(), "ctx1"); err != nil || !captured {
			t.Fatalf("ensureFresh after expiry: captured=%v err=%v", captured, err)
		}
		if p.captures.Load() != 2 {
			t.Errorf("captures = %d, want 2", p.captures.Load())
		}
	})

	t.Run("capture error emits status and returns error", func(t *testing.T) {
		p := &fakeProvider{name: "fake"}
		p.set(CapturedCredentials{}, errors.New("keychain locked"))
		c := testCredManager(t, p)
		_ = c.setMapping("ctx1", CredentialMapping{Provider: "fake", Profile: "p1"})
		var got CredentialStatus
		c.setOnEvent(func(s CredentialStatus) { got = s })
		if _, err := c.ensureFresh(context.Background(), "ctx1"); err == nil {
			t.Fatal("expected error")
		}
		if got.State != "error" || got.Error != "keychain locked" {
			t.Errorf("status = %+v", got)
		}
		if env := c.envFor("ctx1"); env != nil {
			t.Errorf("envFor after failure = %v, want nil", env)
		}
	})

	t.Run("concurrent captures single-flight", func(t *testing.T) {
		p := &fakeProvider{name: "fake", block: make(chan struct{})}
		p.set(validCred(), nil)
		c := testCredManager(t, p)
		_ = c.setMapping("ctx1", CredentialMapping{Provider: "fake", Profile: "p1"})
		var wg sync.WaitGroup
		for range 5 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				_, _ = c.ensureFresh(context.Background(), "ctx1")
			}()
		}
		// Let the goroutines pile up on the in-flight capture, then release.
		time.Sleep(50 * time.Millisecond)
		close(p.block)
		wg.Wait()
		if got := p.captures.Load(); got != 1 {
			t.Errorf("captures = %d, want 1", got)
		}
	})
}

func TestSetMappingValidation(t *testing.T) {
	p := &fakeProvider{name: "fake"}
	c := testCredManager(t, p)
	if err := c.setMapping("ctx1", CredentialMapping{Provider: "nope", Profile: "p"}); err == nil {
		t.Error("expected error for unknown provider")
	}
	if err := c.setMapping("ctx1", CredentialMapping{Provider: "fake", Profile: ""}); err == nil {
		t.Error("expected error for empty profile")
	}
}

func TestClearMappingDropsCredentials(t *testing.T) {
	p := &fakeProvider{name: "fake"}
	p.set(validCred(), nil)
	c := testCredManager(t, p)
	_ = c.setMapping("ctx1", CredentialMapping{Provider: "fake", Profile: "p1"})
	_, _ = c.ensureFresh(context.Background(), "ctx1")
	if err := c.clearMapping("ctx1"); err != nil {
		t.Fatalf("clearMapping: %v", err)
	}
	if env := c.envFor("ctx1"); env != nil {
		t.Errorf("envFor after clear = %v, want nil", env)
	}
	if got := c.statuses(); len(got) != 0 {
		t.Errorf("statuses after clear = %v, want empty", got)
	}
}

func TestStatuses(t *testing.T) {
	p := &fakeProvider{name: "fake"}
	p.set(validCred(), nil)
	c := testCredManager(t, p)
	_ = c.setMapping("ctx1", CredentialMapping{Provider: "fake", Profile: "p1"})

	got := c.statuses()
	if len(got) != 1 || got[0].State != "mapped" {
		t.Fatalf("statuses = %+v, want one mapped", got)
	}

	_, _ = c.ensureFresh(context.Background(), "ctx1")
	got = c.statuses()
	if got[0].State != "captured" || got[0].ExpiresAt == "" {
		t.Errorf("statuses after capture = %+v", got[0])
	}

	c.mu.Lock()
	cred := c.captured["ctx1"]
	cred.expiry = time.Now().Add(-time.Minute)
	c.captured["ctx1"] = cred
	c.mu.Unlock()
	got = c.statuses()
	if got[0].State != "expired" {
		t.Errorf("statuses after expiry = %+v", got[0])
	}
}

func TestRefreshDelay(t *testing.T) {
	now := time.Date(2026, 6, 11, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name      string
		remaining time.Duration
		want      time.Duration
		ok        bool
	}{
		{"long session renews 5min early", time.Hour, 55 * time.Minute, true},
		{"short session renews at 80%", 9 * time.Minute, 9 * time.Minute * 4 / 5, true},
		{"very short renews at 80%", 50 * time.Second, 40 * time.Second, true},
		{"clamps to 30s minimum", 35 * time.Second, 30 * time.Second, true},
		{"sub-30s skips", 20 * time.Second, 0, false},
		{"already expired skips", -time.Minute, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := refreshDelay(now, now.Add(tt.remaining))
			if ok != tt.ok {
				t.Fatalf("ok = %v, want %v", ok, tt.ok)
			}
			if ok && got != tt.want {
				t.Errorf("delay = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCredentialMappingsStoreRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sub", "mappings.json")

	missing, err := loadCredentialMappings(path)
	if err != nil {
		t.Fatalf("loadCredentialMappings missing file: %v", err)
	}
	if len(missing) != 0 {
		t.Errorf("missing-file mappings = %v, want empty", missing)
	}

	in := map[string]CredentialMapping{
		"prod": {Provider: "aws-vault", Profile: "prod-admin"},
	}
	if err := saveCredentialMappings(path, in); err != nil {
		t.Fatalf("saveCredentialMappings: %v", err)
	}
	out, err := loadCredentialMappings(path)
	if err != nil {
		t.Fatalf("loadCredentialMappings: %v", err)
	}
	if out["prod"] != in["prod"] {
		t.Errorf("round-trip = %+v, want %+v", out, in)
	}
}
