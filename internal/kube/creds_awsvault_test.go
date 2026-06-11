package kube

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestParseAWSConfigProfiles(t *testing.T) {
	config := `
# comment
[default]
region = eu-central-1

[profile prod]
source_profile = root
role_arn = arn:aws:iam::123:role/Engineer

[profile  spaced  ]
region = eu-central-1

[sso-session corp]
sso_start_url = https://example.awsapps.com/start

[services local]
endpoint_url = http://localhost:4566

[profile prod]
duplicated = true
`
	got := parseAWSConfigProfiles(strings.NewReader(config))
	want := []string{"default", "prod", "spaced"}
	if len(got) != len(want) {
		t.Fatalf("profiles = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("profiles[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestParseAWSConfigProfilesEmpty(t *testing.T) {
	got := parseAWSConfigProfiles(strings.NewReader(""))
	if len(got) != 0 {
		t.Errorf("profiles = %v, want empty", got)
	}
}

func TestParseAWSVaultExport(t *testing.T) {
	t.Run("full payload", func(t *testing.T) {
		out := []byte(`{
			"Version": 1,
			"AccessKeyId": "AKIAEXAMPLE",
			"SecretAccessKey": "secret",
			"SessionToken": "token",
			"Expiration": "2026-06-11T15:04:05Z"
		}`)
		cred, err := parseAWSVaultExport(out)
		if err != nil {
			t.Fatalf("parseAWSVaultExport: %v", err)
		}
		if cred.env["AWS_ACCESS_KEY_ID"] != "AKIAEXAMPLE" {
			t.Errorf("AWS_ACCESS_KEY_ID = %q", cred.env["AWS_ACCESS_KEY_ID"])
		}
		if cred.env["AWS_SECRET_ACCESS_KEY"] != "secret" {
			t.Errorf("AWS_SECRET_ACCESS_KEY = %q", cred.env["AWS_SECRET_ACCESS_KEY"])
		}
		if cred.env["AWS_SESSION_TOKEN"] != "token" {
			t.Errorf("AWS_SESSION_TOKEN = %q", cred.env["AWS_SESSION_TOKEN"])
		}
		want := time.Date(2026, 6, 11, 15, 4, 5, 0, time.UTC)
		if !cred.expiry.Equal(want) {
			t.Errorf("expiry = %v, want %v", cred.expiry, want)
		}
	})

	t.Run("no session token and no expiration", func(t *testing.T) {
		out := []byte(`{"AccessKeyId":"AKIA","SecretAccessKey":"s"}`)
		cred, err := parseAWSVaultExport(out)
		if err != nil {
			t.Fatalf("parseAWSVaultExport: %v", err)
		}
		if _, ok := cred.env["AWS_SESSION_TOKEN"]; ok {
			t.Error("AWS_SESSION_TOKEN should be absent")
		}
		if !cred.expiry.IsZero() {
			t.Errorf("expiry = %v, want zero", cred.expiry)
		}
		if !cred.valid(time.Now()) {
			t.Error("static credentials should be valid")
		}
	})

	t.Run("malformed json", func(t *testing.T) {
		if _, err := parseAWSVaultExport([]byte("not json")); err == nil {
			t.Error("expected error for malformed output")
		}
	})

	t.Run("missing keys", func(t *testing.T) {
		if _, err := parseAWSVaultExport([]byte(`{"Version":1}`)); err == nil {
			t.Error("expected error for missing credentials")
		}
	})

	t.Run("bad expiration", func(t *testing.T) {
		out := []byte(`{"AccessKeyId":"a","SecretAccessKey":"s","Expiration":"yesterday"}`)
		if _, err := parseAWSVaultExport(out); err == nil {
			t.Error("expected error for unparseable expiration")
		}
	})
}

func TestStderrTail(t *testing.T) {
	fallback := errors.New("exit status 1")
	if got := stderrTail("line one\naws-vault: error: profile not found\n\n", fallback); got != "aws-vault: error: profile not found" {
		t.Errorf("stderrTail = %q", got)
	}
	if got := stderrTail("\n  \n", fallback); got != "exit status 1" {
		t.Errorf("stderrTail fallback = %q", got)
	}
}
