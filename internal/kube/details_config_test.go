package kube

import (
	"encoding/base64"
	"testing"
)

// A binary secret value must cross the bridge as base64 (flagged), not as a
// string whose invalid UTF-8 bytes JSON-marshal to U+FFFD and corrupt a copy.
func TestEncodeSecretValue(t *testing.T) {
	got := encodeSecretValue([]byte("plain text"))
	if got.Binary || got.Value != "plain text" {
		t.Errorf("utf-8 value: got %+v, want plain text/false", got)
	}

	binary := []byte{0xff, 0xfe, 0x00, 0x01, 0x80}
	got = encodeSecretValue(binary)
	if !got.Binary {
		t.Error("non-utf-8 value must be flagged binary")
	}
	if got.Value != base64.StdEncoding.EncodeToString(binary) {
		t.Errorf("binary value must be base64: got %q", got.Value)
	}
	decoded, err := base64.StdEncoding.DecodeString(got.Value)
	if err != nil || string(decoded) != string(binary) {
		t.Errorf("base64 must round-trip losslessly: %v / %v", decoded, err)
	}
}
