package kube

import (
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestExtractCertManagerCertificate(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "web-tls", "namespace": "default"},
		"spec": map[string]any{
			"secretName": "web-tls",
			"commonName": "example.com",
			"issuerRef": map[string]any{
				"kind": "ClusterIssuer",
				"name": "letsencrypt-prod",
			},
		},
		"status": map[string]any{
			"notAfter":    "2026-09-01T00:00:00Z",
			"renewalTime": "2026-08-01T00:00:00Z",
			"conditions": []any{
				map[string]any{
					"type":    "Ready",
					"status":  "True",
					"reason":  "Ready",
					"message": "Certificate is up to date and has not expired",
				},
			},
		},
	}}

	got := extractCertManagerCertificate(obj)
	if got.Name != "web-tls" || got.Namespace != "default" {
		t.Errorf("identity wrong: %+v", got)
	}
	if got.Ready != "True" || got.Status != "Certificate is up to date and has not expired" {
		t.Errorf("ready summary wrong: %+v", got)
	}
	if got.SecretName != "web-tls" || got.CommonName != "example.com" {
		t.Errorf("spec fields wrong: %+v", got)
	}
	if got.Issuer != "ClusterIssuer/letsencrypt-prod" {
		t.Errorf("issuerRef wrong: %q", got.Issuer)
	}
	if got.NotAfter != "2026-09-01T00:00:00Z" || got.RenewalTime != "2026-08-01T00:00:00Z" {
		t.Errorf("validity fields wrong: %+v", got)
	}
}

func TestFormatIssuerRefDefaultsToName(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{
			"issuerRef": map[string]any{"kind": "Issuer", "name": "ca-issuer"},
		},
	}}
	if got := formatIssuerRef(obj); got != "ca-issuer" {
		t.Errorf("default Issuer kind should be elided: %q", got)
	}

	empty := &unstructured.Unstructured{Object: map[string]any{"spec": map[string]any{}}}
	if got := formatIssuerRef(empty); got != "" {
		t.Errorf("absent issuerRef should be empty: %q", got)
	}
}

func TestExtractCertManagerIssuerType(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "letsencrypt-prod"},
		"spec": map[string]any{
			"acme": map[string]any{
				"server": "https://acme-v02.api.letsencrypt.org/directory",
				"email":  "ops@example.com",
			},
		},
		"status": map[string]any{
			"conditions": []any{
				map[string]any{"type": "Ready", "status": "True", "reason": "ACMEAccountRegistered"},
			},
		},
	}}

	got := extractCertManagerIssuer(obj)
	if got.Name != "letsencrypt-prod" {
		t.Errorf("identity wrong: %+v", got)
	}
	if got.Type != "acme" {
		t.Errorf("issuer type wrong: %q", got.Type)
	}
	if got.Ready != "True" || got.Status != "ACMEAccountRegistered" {
		t.Errorf("ready summary should fall back to reason: %+v", got)
	}
}

func TestExtractCertManagerCertificateRequest(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "web-tls-1", "namespace": "default"},
		"spec": map[string]any{
			"issuerRef": map[string]any{"kind": "ClusterIssuer", "name": "letsencrypt-prod"},
		},
		"status": map[string]any{
			"conditions": []any{
				map[string]any{"type": "Approved", "status": "True", "reason": "cert-manager.io"},
				map[string]any{"type": "Ready", "status": "False", "reason": "Pending", "message": "Waiting on certificate issuance"},
			},
		},
	}}
	got := extractCertManagerCertificateRequest(obj)
	if got.Approved != "True" {
		t.Errorf("approved condition not surfaced: %+v", got)
	}
	if got.Denied != "" {
		t.Errorf("absent Denied condition should be empty: %q", got.Denied)
	}
	if got.Ready != "False" || got.Status != "Waiting on certificate issuance" {
		t.Errorf("ready summary wrong: %+v", got)
	}
	if got.Issuer != "ClusterIssuer/letsencrypt-prod" {
		t.Errorf("issuer wrong: %q", got.Issuer)
	}
}

func TestExtractCertManagerOrderAndChallenge(t *testing.T) {
	order := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "web-tls-1-12345", "namespace": "default"},
		"spec":     map[string]any{"dnsNames": []any{"a.example.com", "b.example.com", "c.example.com", "d.example.com"}},
		"status":   map[string]any{"state": "pending", "reason": "waiting for challenge"},
	}}
	got := extractCertManagerOrder(order)
	if got.State != "pending" || got.Reason != "waiting for challenge" {
		t.Errorf("order state/reason wrong: %+v", got)
	}
	if got.DNSNames != "a.example.com, b.example.com, c.example.com +1" {
		t.Errorf("dnsNames trim wrong: %q", got.DNSNames)
	}

	challenge := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "web-tls-1-12345-99", "namespace": "default"},
		"spec":     map[string]any{"type": "HTTP-01", "dnsName": "a.example.com"},
		"status":   map[string]any{"state": "invalid", "reason": "self-check failed"},
	}}
	gotCh := extractCertManagerChallenge(challenge)
	if gotCh.Type != "HTTP-01" || gotCh.DNSName != "a.example.com" {
		t.Errorf("challenge spec wrong: %+v", gotCh)
	}
	if gotCh.State != "invalid" || gotCh.Reason != "self-check failed" {
		t.Errorf("challenge status wrong: %+v", gotCh)
	}
}

func TestOwnedBy(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name": "order-1",
			"ownerReferences": []any{
				map[string]any{"kind": "CertificateRequest", "name": "web-tls-1", "uid": "abc"},
			},
		},
	}}
	if !ownedBy(obj, "CertificateRequest", "web-tls-1") {
		t.Error("expected ownedBy to match the CertificateRequest owner")
	}
	if ownedBy(obj, "CertificateRequest", "other") {
		t.Error("ownedBy should not match a different owner name")
	}
	if ownedBy(obj, "Certificate", "web-tls-1") {
		t.Error("ownedBy should not match a different owner kind")
	}
}
