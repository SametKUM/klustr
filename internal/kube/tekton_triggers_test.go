package kube

import (
	"context"
	"os"
	"reflect"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func triggersFixture(t *testing.T, resource string) *unstructured.Unstructured {
	t.Helper()
	data, err := os.ReadFile("testdata/integrations/triggers.tekton.dev/" + resource + ".yaml")
	if err != nil {
		t.Fatal(err)
	}
	return mustUnstructured(t, string(data))
}

func TestTektonEventListenerDetail(t *testing.T) {
	gvr := tektonEventListenerGR.WithVersion("v1beta1")
	el := triggersFixture(t, "eventlisteners")
	m, _ := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: "EventListener", namespaced: true}})
	startFakeCRWatch(t, m, gvr, el)
	d, err := m.GetTektonEventListener(context.Background(), "ctx", "ci", "github")
	if err != nil {
		t.Fatal(err)
	}
	if d.Ready != "True" || d.Address != "http://el-github.ci.svc.cluster.local:8080" || d.GeneratedName != "el-github" {
		t.Fatalf("status = %+v", d.TektonEventListenerInfo)
	}
	if d.ServicePort != 8080 || d.Replicas != 2 || !reflect.DeepEqual(d.NamespaceSelector, []string{"ci"}) {
		t.Fatalf("resources = %+v", d)
	}
	push := d.TriggerList[0]
	if push.Template != "build-and-deploy" || push.TemplateInline {
		t.Fatalf("template = %+v", push)
	}
	wantBindings := []TektonBindingRef{
		{Ref: "github-push", Kind: "TriggerBinding"},
		{Ref: "git-defaults", Kind: "ClusterTriggerBinding"},
		{Name: "environment", Value: "dev"},
	}
	if !reflect.DeepEqual(push.Bindings, wantBindings) {
		t.Fatalf("bindings = %+v", push.Bindings)
	}
	wantInterceptors := []TektonInterceptor{
		{Name: "verify", Ref: "github", Kind: "ClusterInterceptor", Params: []TektonParam{
			{Name: "eventTypes", Value: `["push"]`},
			{Name: "secretRef", Value: `{"secretKey":"token","secretName":"github-webhook"}`},
		}},
		{Ref: "cel", Params: []TektonParam{{Name: "filter", Value: "body.ref == 'refs/heads/main'"}}},
	}
	if !reflect.DeepEqual(push.Interceptors, wantInterceptors) {
		t.Fatalf("interceptors = %+v", push.Interceptors)
	}
	if d.TriggerList[1].TriggerRef != "pull-request" {
		t.Fatalf("triggerRef = %+v", d.TriggerList[1])
	}
}

// Listeners from before Triggers v0.10 wrote interceptors as
// {github: {...}} and the template as {name: ...}.
func TestTektonLegacyTriggerSpec(t *testing.T) {
	spec := extractTektonTriggerSpec(mustUnstructured(t, `
template: {name: old-template}
interceptors:
  - github: {eventTypes: [push]}
`).Object)
	if spec.Template != "old-template" || len(spec.Interceptors) != 1 || spec.Interceptors[0].Ref != "github" {
		t.Fatalf("legacy spec = %+v", spec)
	}
}

func TestTektonTriggerListeners(t *testing.T) {
	elGVR := tektonEventListenerGR.WithVersion("v1beta1")
	trGVR := tektonTriggerGR.WithVersion("v1beta1")
	m, _ := fakeCRDManager(t, []fakeCRD{
		{gvr: elGVR, kind: "EventListener", namespaced: true},
		{gvr: trGVR, kind: "Trigger", namespaced: true},
	})
	startFakeCRWatch(t, m, elGVR, triggersFixture(t, "eventlisteners"))
	startFakeCRWatch(t, m, trGVR, triggersFixture(t, "triggers"))
	d, err := m.GetTektonTrigger(context.Background(), "ctx", "ci", "pull-request")
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(d.EventListeners, []string{"github"}) || d.Template != "pr-checks" ||
		!reflect.DeepEqual(d.Interceptors, []string{"github"}) {
		t.Fatalf("trigger = %+v", d)
	}
}

func TestTektonTriggerTemplateResources(t *testing.T) {
	tt := triggersFixture(t, "triggertemplates")
	info := extractTektonTriggerTemplate(tt)
	if info.Params != 3 || !reflect.DeepEqual(info.Creates, []string{"PipelineRun"}) {
		t.Fatalf("info = %+v", info)
	}
	want := []TektonTemplateResource{{APIVersion: "tekton.dev/v1", Kind: "PipelineRun", Name: "build-and-deploy-…", PipelineRef: "build-and-deploy"}}
	if got := tektonTemplateResources(tt); !reflect.DeepEqual(got, want) {
		t.Fatalf("resources = %+v", got)
	}
}

func TestTektonTemplateResourceNamespace(t *testing.T) {
	for _, tc := range []struct {
		name, metadata, want string
	}{
		{"default", "generateName: build-", ""},
		{"explicit", "generateName: build-\n        namespace: builds", "builds"},
		{"templated", "generateName: build-\n        namespace: $(tt.params.namespace)", "$(tt.params.namespace)"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			tt := mustUnstructured(t, `apiVersion: triggers.tekton.dev/v1beta1
kind: TriggerTemplate
metadata:
  name: build
  namespace: ci
spec:
  resourcetemplates:
    - apiVersion: tekton.dev/v1
      kind: PipelineRun
      metadata:
        `+tc.metadata+`
      spec:
        pipelineRef:
          name: build
`)
			got := tektonTemplateResources(tt)
			if len(got) != 1 || got[0].Namespace != tc.want || got[0].PipelineRef != "build" {
				t.Fatalf("resources = %+v, want namespace %q", got, tc.want)
			}
		})
	}
}
