package kube

import (
	"os"
	"path/filepath"
	"testing"

	"k8s.io/client-go/tools/clientcmd"
)

const sampleKubeconfig = `apiVersion: v1
kind: Config
current-context: prod
contexts:
- name: prod
  context:
    cluster: prod-cluster
    user: prod-user
    namespace: app
- name: dev
  context:
    cluster: dev-cluster
    user: dev-user
clusters:
- name: prod-cluster
  cluster:
    server: https://prod.example
- name: dev-cluster
  cluster:
    server: https://dev.example
users:
- name: prod-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: aws
      args: ["--region", "eu-central-1", "eks", "get-token", "--cluster-name", "prod", "--profile", "prod-admin"]
- name: dev-user
  user: {}
`

const execVariantsKubeconfig = `apiVersion: v1
kind: Config
current-context: eq
contexts:
- name: eq
  context: {cluster: c, user: eq-user}
- name: envvar
  context: {cluster: c, user: env-user}
- name: wrapped
  context: {cluster: c, user: vault-user}
- name: gke
  context: {cluster: c, user: gke-user}
clusters:
- name: c
  cluster: {server: "https://c.example"}
users:
- name: eq-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: /usr/local/bin/aws
      args: ["eks", "get-token", "--cluster-name", "x", "--profile=team-prod"]
- name: env-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: aws
      args: ["eks", "get-token", "--cluster-name", "x"]
      env:
      - name: AWS_PROFILE
        value: from-env
- name: vault-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: aws-vault
      args: ["exec", "prod", "--", "aws", "eks", "get-token", "--cluster-name", "x"]
- name: gke-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: gke-gcloud-auth-plugin
`

func TestLoadRawConfig(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "kubeconfig")
	if err := os.WriteFile(path, []byte(sampleKubeconfig), 0o600); err != nil {
		t.Fatalf("write kubeconfig: %v", err)
	}

	rules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: path}
	kc, err := loadRawConfig(rules)
	if err != nil {
		t.Fatalf("loadRawConfig: %v", err)
	}

	if kc.CurrentContext != "prod" {
		t.Errorf("current context: got %q, want prod", kc.CurrentContext)
	}
	if len(kc.Contexts) != 2 {
		t.Fatalf("expected 2 contexts, got %d", len(kc.Contexts))
	}
	if kc.Contexts[0].Name != "dev" || kc.Contexts[1].Name != "prod" {
		t.Errorf("contexts not sorted: %+v", kc.Contexts)
	}
	prod := kc.Contexts[1]
	if prod.Cluster != "prod-cluster" || prod.Server != "https://prod.example" {
		t.Errorf("prod cluster/server wrong: %+v", prod)
	}
	if prod.User != "prod-user" || prod.Namespace != "app" {
		t.Errorf("prod user/namespace wrong: %+v", prod)
	}
	if !prod.AWSExec || prod.ExecCommand != "aws" || prod.AWSProfileHint != "prod-admin" {
		t.Errorf("prod exec hints wrong: %+v", prod)
	}
	dev := kc.Contexts[0]
	if dev.AWSExec || dev.ExecCommand != "" || dev.AWSProfileHint != "" {
		t.Errorf("dev should have no exec hints: %+v", dev)
	}
}

func TestLoadRawConfigExecHints(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "kubeconfig")
	if err := os.WriteFile(path, []byte(execVariantsKubeconfig), 0o600); err != nil {
		t.Fatalf("write kubeconfig: %v", err)
	}

	rules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: path}
	kc, err := loadRawConfig(rules)
	if err != nil {
		t.Fatalf("loadRawConfig: %v", err)
	}

	byName := make(map[string]ContextInfo)
	for _, c := range kc.Contexts {
		byName[c.Name] = c
	}

	eq := byName["eq"]
	if !eq.AWSExec || eq.AWSProfileHint != "team-prod" {
		t.Errorf("--profile= form: %+v", eq)
	}
	envvar := byName["envvar"]
	if !envvar.AWSExec || envvar.AWSProfileHint != "from-env" {
		t.Errorf("AWS_PROFILE env form: %+v", envvar)
	}
	wrapped := byName["wrapped"]
	if !wrapped.AWSVaultExec || wrapped.AWSExec {
		t.Errorf("aws-vault wrapped exec: %+v", wrapped)
	}
	gke := byName["gke"]
	if gke.AWSExec || gke.AWSVaultExec || gke.ExecCommand != "gke-gcloud-auth-plugin" {
		t.Errorf("gke exec: %+v", gke)
	}
}

func TestLoadRawConfigMissingFile(t *testing.T) {
	rules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: filepath.Join(t.TempDir(), "nope")}
	if _, err := loadRawConfig(rules); err == nil {
		t.Fatal("expected error for missing file")
	}
}
