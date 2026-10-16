package kube

import (
	"context"
	"errors"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// integrationActions is every action an integration offers on its CRs. Each
// must write through writableResource; the table checks that from outside.
var integrationActions = []struct {
	name string
	gr   schema.GroupResource
	kind string
	run  func(ctx context.Context, m *ClientManager) error
}{
	{"argo sync", argoApplicationGR, "Application", func(ctx context.Context, m *ClientManager) error {
		return m.SyncArgoApplication(ctx, "ctx", "apps", "one", ArgoSyncOptions{})
	}},
	{"argo rollback", argoApplicationGR, "Application", func(ctx context.Context, m *ClientManager) error {
		return m.RollbackArgoApplication(ctx, "ctx", "apps", "one", 3, false)
	}},
	{"argo refresh", argoApplicationGR, "Application", func(ctx context.Context, m *ClientManager) error {
		return m.RefreshArgoApplication(ctx, "ctx", "apps", "one", "hard")
	}},
	{"argo automation", argoApplicationGR, "Application", func(ctx context.Context, m *ClientManager) error {
		return m.SetArgoApplicationAutomation(ctx, "ctx", "apps", "one", true)
	}},
	{"argo delete", argoApplicationGR, "Application", func(ctx context.Context, m *ClientManager) error {
		return m.DeleteArgoApplication(ctx, "ctx", "apps", "one", "")
	}},
	{"flux reconcile", fluxKustomizationGR, "Kustomization", func(ctx context.Context, m *ClientManager) error {
		return m.ReconcileFluxResource(ctx, "ctx", "FluxKustomization", "apps", "one")
	}},
	{"flux suspend", fluxHelmReleaseGR, "HelmRelease", func(ctx context.Context, m *ClientManager) error {
		return m.SetFluxResourceSuspended(ctx, "ctx", "FluxHelmRelease", "apps", "one", true)
	}},
	{"cert-manager renew", certManagerCertificateGR, "Certificate", func(ctx context.Context, m *ClientManager) error {
		return m.RenewCertificate(ctx, "ctx", "apps", "one")
	}},
	{"tekton cancel pipelinerun", tektonGR(tektonPipelineRunsResource), "PipelineRun", func(ctx context.Context, m *ClientManager) error {
		return m.CancelTektonPipelineRun(ctx, "ctx", "apps", "one")
	}},
	{"tekton cancel taskrun", tektonGR(tektonTaskRunsResource), "TaskRun", func(ctx context.Context, m *ClientManager) error {
		return m.CancelTektonTaskRun(ctx, "ctx", "apps", "one")
	}},
	{"tekton rerun", tektonGR(tektonPipelineRunsResource), "PipelineRun", func(ctx context.Context, m *ClientManager) error {
		_, err := m.RerunTektonPipelineRun(ctx, "ctx", "apps", "one")
		return err
	}},
	{"keda pause scaledobject", kedaScaledObjectGR, "ScaledObject", func(ctx context.Context, m *ClientManager) error {
		return m.PauseKEDAScaledObject(ctx, "ctx", "apps", "one", 2)
	}},
	{"keda resume scaledobject", kedaScaledObjectGR, "ScaledObject", func(ctx context.Context, m *ClientManager) error {
		return m.ResumeKEDAScaledObject(ctx, "ctx", "apps", "one")
	}},
	{"keda pause scaledjob", kedaScaledJobGR, "ScaledJob", func(ctx context.Context, m *ClientManager) error {
		return m.SetKEDAScaledJobPaused(ctx, "ctx", "apps", "one", true)
	}},
}

func TestIntegrationActions(t *testing.T) {
	ctx := context.Background()
	for _, a := range integrationActions {
		t.Run(a.name, func(t *testing.T) {
			// A version no integration pins, so a hardcoded GVR shows up as an
			// action on the wrong resource.
			gvr := a.gr.WithVersion("v9alpha1")
			obj := &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": gvr.GroupVersion().String(),
				"kind":       a.kind,
				"metadata":   map[string]any{"name": "one", "namespace": "apps"},
				"spec":       map[string]any{},
			}}

			t.Run("read-only", func(t *testing.T) {
				m, dyn := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: a.kind, namespaced: true}}, obj.DeepCopy())
				m.readOnly = map[string]bool{"ctx": true}
				if err := a.run(ctx, m); !errors.Is(err, errReadOnly) {
					t.Fatalf("read-only context returned %v, want errReadOnly", err)
				}
				if len(dyn.Actions()) != 0 {
					t.Fatalf("read-only context reached the API: %v", dyn.Actions())
				}
			})

			t.Run("served version", func(t *testing.T) {
				m, dyn := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: a.kind, namespaced: true}}, obj.DeepCopy())
				m.readOnly = map[string]bool{}
				if err := a.run(ctx, m); err != nil {
					t.Fatal(err)
				}
				if len(dyn.Actions()) == 0 {
					t.Fatal("action made no request")
				}
				for _, action := range dyn.Actions() {
					if action.GetResource() != gvr {
						t.Fatalf("%s used %v, want %v", action.GetVerb(), action.GetResource(), gvr)
					}
				}
			})
		})
	}
}
