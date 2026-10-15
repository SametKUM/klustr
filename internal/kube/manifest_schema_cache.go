package kube

import (
	"context"
	"sync"
	"time"
)

type manifestSchemaCacheEntry struct {
	ready   chan struct{}
	body    string
	err     error
	expires time.Time
}

// OpenAPI v2 covers the whole cluster, so all requested group-versions share
// one bounded, short-lived download. No registry lock covers network work.
type manifestSchemaCache struct {
	mu      sync.Mutex
	entries map[string]*manifestSchemaCacheEntry
}

func (c *manifestSchemaCache) invalidate(contextName string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if contextName == "" {
		clear(c.entries)
	} else {
		delete(c.entries, contextName)
	}
}

func (c *manifestSchemaCache) load(ctx context.Context, contextName string, fetch func() (string, error)) (string, error) {
	c.mu.Lock()
	for key, entry := range c.entries {
		if !entry.expires.IsZero() && time.Now().After(entry.expires) {
			delete(c.entries, key)
		}
	}
	if entry := c.entries[contextName]; entry != nil {
		c.mu.Unlock()
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-entry.ready:
			return entry.body, entry.err
		}
	}
	if c.entries == nil {
		c.entries = make(map[string]*manifestSchemaCacheEntry)
	}
	// Evict a completed entry first. If all slots are in flight, serve this
	// request uncached rather than retaining an unbounded number of documents.
	if len(c.entries) >= 8 {
		for key, entry := range c.entries {
			if !entry.expires.IsZero() {
				delete(c.entries, key)
				break
			}
		}
	}
	if len(c.entries) >= 8 {
		c.mu.Unlock()
		return fetch()
	}
	entry := &manifestSchemaCacheEntry{ready: make(chan struct{})}
	c.entries[contextName] = entry
	c.mu.Unlock()
	body, err := fetch()
	c.mu.Lock()
	entry.body, entry.err, entry.expires = body, err, time.Now().Add(30*time.Second)
	if err != nil && c.entries[contextName] == entry {
		delete(c.entries, contextName)
	}
	close(entry.ready)
	c.mu.Unlock()
	return body, err
}
