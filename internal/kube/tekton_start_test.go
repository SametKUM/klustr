package kube

import (
	"context"
	"reflect"
	"strings"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	clienttesting "k8s.io/client-go/testing"
)

func TestBuildTektonPipelineRun(t *testing.T) {
	opts := TektonStartOptions{
		Params: []TektonStartParam{
			{Name: "revision", Type: "string", Value: "main"},
			{Name: "targets", Type: "array", Values: []string{"linux", "darwin"}},
			{Name: "image", Type: "object", Object: map[string]string{"repo": "registry.example.com/shop"}},
		},
		Workspaces: []TektonStartWorkspace{
			{Name: "source", Kind: "volumeClaimTemplate", Size: "2Gi", StorageClass: "gp3"},
			{Name: "cache", Kind: "persistentVolumeClaim", Source: "build-cache", SubPath: "go"},
			{Name: "docker-config", Kind: "secret", Source: "registry-auth"},
			{Name: "settings", Kind: "configMap", Source: "build-settings"},
			{Name: "scratch", Kind: "emptyDir"},
		},
		ServiceAccount: "builder",
		Timeout:        "90m",
	}
	run, err := buildTektonPipelineRun("tekton.dev/v1", "ci", "build", opts)
	if err != nil {
		t.Fatal(err)
	}
	if run.GetGenerateName() != "build-run-" || run.GetNamespace() != "ci" || run.GetLabels()[tektonPipelineLabel] != "build" {
		t.Fatalf("metadata = %v", run.Object["metadata"])
	}
	want := mustUnstructured(t, `
spec:
  pipelineRef: {name: build}
  params:
    - {name: revision, value: main}
    - {name: targets, value: [linux, darwin]}
    - {name: image, value: {repo: registry.example.com/shop}}
  workspaces:
    - name: source
      volumeClaimTemplate:
        spec:
          accessModes: [ReadWriteOnce]
          resources: {requests: {storage: 2Gi}}
          storageClassName: gp3
    - {name: cache, subPath: go, persistentVolumeClaim: {claimName: build-cache}}
    - {name: docker-config, secret: {secretName: registry-auth}}
    - {name: settings, configMap: {name: build-settings}}
    - {name: scratch, emptyDir: {}}
  taskRunTemplate: {serviceAccountName: builder}
  timeouts: {pipeline: 1h30m0s}
`)
	if !reflect.DeepEqual(run.Object["spec"], want.Object["spec"]) {
		t.Fatalf("spec = %v\nwant %v", run.Object["spec"], want.Object["spec"])
	}
}

// v1beta1 PipelineRuns carry the service account on the spec itself.
func TestBuildTektonPipelineRunV1beta1(t *testing.T) {
	run, err := buildTektonPipelineRun("tekton.dev/v1beta1", "ci", "build", TektonStartOptions{ServiceAccount: "builder"})
	if err != nil {
		t.Fatal(err)
	}
	if sa, _, _ := unstructured.NestedString(run.Object, "spec", "serviceAccountName"); sa != "builder" {
		t.Fatalf("spec = %v", run.Object["spec"])
	}
	if _, found, _ := unstructured.NestedMap(run.Object, "spec", "taskRunTemplate"); found {
		t.Fatal("v1beta1 run carries taskRunTemplate")
	}
}

func TestBuildTektonPipelineRunRejects(t *testing.T) {
	cases := map[string]TektonStartOptions{
		"bad timeout":       {Timeout: "soon"},
		"unnamed param":     {Params: []TektonStartParam{{Value: "x"}}},
		"claim without pvc": {Workspaces: []TektonStartWorkspace{{Name: "src", Kind: "persistentVolumeClaim"}}},
		"bad size":          {Workspaces: []TektonStartWorkspace{{Name: "src", Kind: "volumeClaimTemplate", Size: "lots"}}},
		"unknown kind":      {Workspaces: []TektonStartWorkspace{{Name: "src", Kind: "hostPath"}}},
	}
	for name, opts := range cases {
		if _, err := buildTektonPipelineRun("tekton.dev/v1", "ci", "build", opts); err == nil {
			t.Errorf("%s: no error", name)
		}
	}
}

// The run is created at the version the cluster serves.
func TestStartTektonPipelineCreatesAtServedVersion(t *testing.T) {
	gvr := tektonGR(tektonPipelineRunsResource).WithVersion("v1")
	m, dyn := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: "PipelineRun", namespaced: true}})
	m.readOnly = map[string]bool{}
	dyn.PrependReactor("create", "pipelineruns", func(action clienttesting.Action) (bool, runtime.Object, error) {
		obj := action.(clienttesting.CreateAction).GetObject().(*unstructured.Unstructured).DeepCopy()
		obj.SetName(obj.GetGenerateName() + "x7k2p")
		return true, obj, nil
	})
	name, err := m.StartTektonPipeline(context.Background(), "ctx", "ci", "build", TektonStartOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if name != "build-run-x7k2p" {
		t.Fatalf("name = %q", name)
	}
	created := dyn.Actions()[0].(clienttesting.CreateAction).GetObject().(*unstructured.Unstructured)
	if created.GetAPIVersion() != "tekton.dev/v1" || !strings.HasPrefix(created.GetGenerateName(), "build-run-") {
		t.Fatalf("created %s %s", created.GetAPIVersion(), created.GetGenerateName())
	}
}

func TestTektonTaskDependencies(t *testing.T) {
	task := mustUnstructured(t, `
name: deploy
runAfter: [test]
params:
  - {name: image, value: "$(tasks.build.results.image-url)"}
  - {name: digest, value: "$(tasks.build.results.image-digest)"}
when:
  - {input: "$(tasks.scan.results.passed)", operator: in, values: ["true"]}
  - {input: "$(tasks.lint.status)", operator: notin, values: [Failed]}
matrix:
  params:
    - {name: region, value: ["$(tasks.plan.results.regions[*])"]}
`)
	got := tektonTaskDependencies(task.Object, []string{"test"})
	if want := []string{"test", "build", "scan", "lint", "plan"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("dependencies = %v, want %v", got, want)
	}
	if got := tektonTaskDependencies(map[string]any{"name": "first"}, nil); got == nil || len(got) != 0 {
		t.Fatalf("no dependencies = %#v, want []", got)
	}
}
