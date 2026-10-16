package kube

import (
	"context"
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes/fake"
	clienttesting "k8s.io/client-go/testing"
)

func kedaFixture(t *testing.T, resource string) *unstructured.Unstructured {
	t.Helper()
	data, err := os.ReadFile("testdata/integrations/keda.sh/" + resource + ".yaml")
	if err != nil {
		t.Fatal(err)
	}
	return mustUnstructured(t, string(data))
}

func TestKEDAScaledObjectDetail(t *testing.T) {
	d := extractKEDAScaledObjectDetail(kedaFixture(t, "scaledobjects"))
	if d.TargetKind != "Deployment" || d.TargetName != "orders-worker" || d.MinReplicas != 1 || d.MaxReplicas != 20 {
		t.Fatalf("target/replicas = %s/%s %d-%d", d.TargetKind, d.TargetName, d.MinReplicas, d.MaxReplicas)
	}
	if d.Ready != "True" || d.Active != "True" || d.Fallback != "False" || d.Paused {
		t.Fatalf("state = ready %q active %q fallback %q paused %v", d.Ready, d.Active, d.Fallback, d.Paused)
	}
	if d.TriggerTypes != "aws-sqs-queue,cron" || d.HPAName != "keda-hpa-orders-worker" {
		t.Fatalf("triggers %q hpa %q", d.TriggerTypes, d.HPAName)
	}
	if d.PollingInterval != 15 || d.CooldownPeriod != 120 || d.FallbackReplicas != "4" || d.OriginalReplicas != "2" || d.IdleReplicas != "" {
		t.Fatalf("timing/fallback = %+v", d)
	}
	if len(d.Triggers) != 2 || d.Triggers[0].AuthKind != "TriggerAuthentication" || d.Triggers[0].AuthName != "aws-irsa" {
		t.Fatalf("triggers = %+v", d.Triggers)
	}
	if !strings.Contains(d.Triggers[1].Summary, "desiredReplicas=3") {
		t.Fatalf("cron summary = %q", d.Triggers[1].Summary)
	}
	if len(d.Health) != 1 || d.Health[0].Status != "Happy" {
		t.Fatalf("health = %+v", d.Health)
	}
}

func TestKEDADefaults(t *testing.T) {
	so := extractKEDAScaledObjectDetail(mustUnstructured(t, `
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: {name: api, namespace: shop}
spec:
  scaleTargetRef: {name: api}
  triggers: [{type: cpu, metricType: Utilization, metadata: {value: "60"}}]
`))
	if so.TargetKind != "Deployment" || so.TargetAPIVersion != "apps/v1" || so.MinReplicas != 0 || so.MaxReplicas != 100 ||
		so.PollingInterval != 30 || so.CooldownPeriod != 300 || so.TriggerTypes != "cpu" {
		t.Fatalf("defaults = %+v", so)
	}
	sj := extractKEDAScaledJobDetail(mustUnstructured(t, `
apiVersion: keda.sh/v1alpha1
kind: ScaledJob
metadata: {name: jobs, namespace: shop}
spec:
  rolloutStrategy: gradual
  jobTargetRef: {template: {spec: {containers: [{name: run, image: busybox}]}}}
`))
	if sj.ScalingStrategy != "default" || sj.RolloutStrategy != "gradual" || sj.SuccessfulJobsHistoryLimit != 100 || sj.MaxReplicas != 100 {
		t.Fatalf("scaledjob defaults = %+v", sj)
	}
	if !reflect.DeepEqual(sj.Containers, []KEDAContainer{{Name: "run", Image: "busybox"}}) {
		t.Fatalf("containers = %+v", sj.Containers)
	}
}

func TestKEDAPauseState(t *testing.T) {
	cases := []struct {
		name        string
		scaledJob   bool
		annotations map[string]string
		condition   string
		want        KEDAPauseState
	}{
		{name: "running"},
		{name: "paused at current", annotations: map[string]string{kedaPausedAnnotation: "true"},
			want: KEDAPauseState{Paused: true, Annotated: true}},
		{name: "paused at replicas", annotations: map[string]string{kedaPausedReplicasAnnotation: "0"},
			want: KEDAPauseState{Paused: true, PausedReplicas: "0", Annotated: true}},
		{name: "annotation set to false", annotations: map[string]string{kedaPausedAnnotation: "false"},
			want: KEDAPauseState{Annotated: true}},
		{name: "non-bool value counts as set", annotations: map[string]string{kedaPausedAnnotation: "yes"},
			want: KEDAPauseState{Paused: true, Annotated: true}},
		// The operator confirms through the condition, which also covers a
		// pause applied by a newer annotation Klustr does not know.
		{name: "paused condition", condition: "True", want: KEDAPauseState{Paused: true}},
		// A one-direction pause sets the same condition but KEDA keeps
		// scaling the other way, so it is not a full pause.
		{name: "scale-in paused", annotations: map[string]string{kedaPausedScaleInAnnotation: "true"}, condition: "True",
			want: KEDAPauseState{ScaleInPaused: true, Annotated: true}},
		{name: "scale-out paused", annotations: map[string]string{kedaPausedScaleOutAnnotation: "true"}, condition: "True",
			want: KEDAPauseState{ScaleOutPaused: true, Annotated: true}},
		{name: "scale-in set to false", annotations: map[string]string{kedaPausedScaleInAnnotation: "false"},
			want: KEDAPauseState{Annotated: true}},
		{name: "scaledjob paused", scaledJob: true, annotations: map[string]string{kedaPausedAnnotation: "true"},
			want: KEDAPauseState{Paused: true, Annotated: true}},
		{name: "scaledjob ignores scaledobject annotations", scaledJob: true,
			annotations: map[string]string{kedaPausedReplicasAnnotation: "0", kedaPausedScaleInAnnotation: "true"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			obj := &unstructured.Unstructured{Object: map[string]any{}}
			obj.SetAnnotations(tc.annotations)
			var conds []ConditionDetail
			if tc.condition != "" {
				conds = []ConditionDetail{{Type: "Paused", Status: tc.condition}}
			}
			if got := kedaPauseState(obj, conds, !tc.scaledJob); got != tc.want {
				t.Fatalf("state = %+v, want %+v", got, tc.want)
			}
		})
	}
}

// kedaPatchAnnotations runs action against a fake ScaledObject or ScaledJob
// and returns the annotations of the merge patch it sent.
func kedaPatchAnnotations(t *testing.T, kind string, action func(m *ClientManager) error) map[string]any {
	t.Helper()
	gvr := kedaScaledObjectGR.WithVersion("v1alpha1")
	if kind == "ScaledJob" {
		gvr = kedaScaledJobGR.WithVersion("v1alpha1")
	}
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "keda.sh/v1alpha1", "kind": kind,
		"metadata": map[string]any{"name": "one", "namespace": "apps"},
	}}
	m, dyn := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: kind, namespaced: true}}, obj)
	m.readOnly = map[string]bool{}
	if err := action(m); err != nil {
		t.Fatal(err)
	}
	for _, a := range dyn.Actions() {
		if p, ok := a.(clienttesting.PatchAction); ok {
			var body struct {
				Metadata struct {
					Annotations map[string]any `json:"annotations"`
				} `json:"metadata"`
			}
			if err := json.Unmarshal(p.GetPatch(), &body); err != nil {
				t.Fatal(err)
			}
			return body.Metadata.Annotations
		}
	}
	t.Fatal("no patch sent")
	return nil
}

func TestKEDAPausePatches(t *testing.T) {
	ctx := context.Background()
	cases := []struct {
		name   string
		kind   string
		action func(m *ClientManager) error
		want   map[string]any
	}{
		{"pause at current replicas", "ScaledObject", func(m *ClientManager) error {
			return m.PauseKEDAScaledObject(ctx, "ctx", "apps", "one", -1)
		}, map[string]any{kedaPausedAnnotation: "true", kedaPausedReplicasAnnotation: nil}},
		{"pause at 0 replicas", "ScaledObject", func(m *ClientManager) error {
			return m.PauseKEDAScaledObject(ctx, "ctx", "apps", "one", 0)
		}, map[string]any{kedaPausedAnnotation: nil, kedaPausedReplicasAnnotation: "0"}},
		{"resume", "ScaledObject", func(m *ClientManager) error {
			return m.ResumeKEDAScaledObject(ctx, "ctx", "apps", "one")
		}, map[string]any{
			kedaPausedAnnotation: nil, kedaPausedReplicasAnnotation: nil,
			kedaPausedScaleInAnnotation: nil, kedaPausedScaleOutAnnotation: nil,
		}},
		{"pause scaledjob", "ScaledJob", func(m *ClientManager) error {
			return m.SetKEDAScaledJobPaused(ctx, "ctx", "apps", "one", true)
		}, map[string]any{kedaPausedAnnotation: "true"}},
		{"resume scaledjob", "ScaledJob", func(m *ClientManager) error {
			return m.SetKEDAScaledJobPaused(ctx, "ctx", "apps", "one", false)
		}, map[string]any{kedaPausedAnnotation: nil}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := kedaPatchAnnotations(t, tc.kind, tc.action); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("annotations = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestKEDATriggerAuthenticationNeverCopiesVaultToken(t *testing.T) {
	auth := mustUnstructured(t, `
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata: {name: vault, namespace: shop}
spec:
  hashiCorpVault:
    address: https://vault.example.com
    authentication: token
    credential: {token: hvs.not-for-the-ui}
    secrets: [{parameter: password, path: secret/data/db, key: password}]
  azureKeyVault:
    vaultUri: https://kv.vault.azure.net
    credentials:
      clientId: app-id
      tenantId: tenant
      clientSecret: {valueFrom: {secretKeyRef: {name: kv-creds, key: client-secret}}}
    secrets: [{parameter: connection, name: sb-conn}]
`)
	m, _ := fakeCRDManager(t, nil)
	d := m.extractKEDATriggerAuthenticationDetail("ctx", auth, "TriggerAuthentication")
	data, err := json.Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), "hvs.not-for-the-ui") {
		t.Fatalf("detail carries the Vault token: %s", data)
	}
	if !reflect.DeepEqual(d.Sources, []string{"HashiCorp Vault", "Azure Key Vault"}) {
		t.Fatalf("sources = %v", d.Sources)
	}
	wantFields := []KEDAField{{"Address", "https://vault.example.com"}, {"Authentication", "token"}, {"Credential", "token in spec"}}
	if len(d.Providers) != 2 || !reflect.DeepEqual(d.Providers[0].Fields, wantFields) {
		t.Fatalf("providers = %+v", d.Providers)
	}
	if !reflect.DeepEqual(d.Providers[1].Fields[len(d.Providers[1].Fields)-1], KEDAField{"Client secret", "Secret kv-creds/client-secret"}) {
		t.Fatalf("azure fields = %+v", d.Providers[1].Fields)
	}
	want := []KEDAAuthParameter{
		{Parameter: "password", Source: "HashiCorp Vault", Name: "secret/data/db", Key: "password"},
		{Parameter: "connection", Source: "Azure Key Vault", Name: "sb-conn"},
	}
	if !reflect.DeepEqual(d.Parameters, want) {
		t.Fatalf("parameters = %+v", d.Parameters)
	}
}

// Status names the users the operator saw last; a ScaledObject that started
// referencing the authentication since is found in the cache.
func TestKEDATriggerAuthenticationUsers(t *testing.T) {
	soGVR := kedaScaledObjectGR.WithVersion("v1alpha1")
	newUser := mustUnstructured(t, `
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: {name: payments, namespace: shop}
spec:
  scaleTargetRef: {name: payments}
  triggers:
    - {type: aws-sqs-queue, metadata: {queueURL: q}, authenticationRef: {name: aws-irsa}}
    - {type: aws-sqs-queue, metadata: {queueURL: q}, authenticationRef: {name: aws-irsa, kind: ClusterTriggerAuthentication}}
`)
	m, _ := fakeCRDManager(t, []fakeCRD{{gvr: soGVR, kind: "ScaledObject", namespaced: true}})
	startFakeCRWatch(t, m, soGVR, newUser)
	info := m.extractKEDATriggerAuthentication("ctx", kedaFixture(t, "triggerauthentications"), "TriggerAuthentication")
	if !reflect.DeepEqual(info.ScaledObjects, []string{"orders-worker", "payments"}) {
		t.Fatalf("scaledObjects = %v", info.ScaledObjects)
	}
	if !reflect.DeepEqual(info.Sources, []string{"Secret", "Pod identity (aws)"}) {
		t.Fatalf("sources = %v", info.Sources)
	}
}

// The operator records a ClusterTriggerAuthentication's users by bare name.
// The cache places them in their namespace; a name it cannot place stays bare
// rather than becoming a reference with an empty namespace.
func TestKEDAClusterTriggerAuthenticationUsers(t *testing.T) {
	sjGVR := kedaScaledJobGR.WithVersion("v1alpha1")
	user := mustUnstructured(t, `
apiVersion: keda.sh/v1alpha1
kind: ScaledJob
metadata: {name: invoice-renderer, namespace: jobs}
spec:
  jobTargetRef: {template: {spec: {containers: [{name: run, image: busybox}]}}}
  triggers:
    - {type: rabbitmq, metadata: {queueName: invoices}, authenticationRef: {name: rabbitmq-conn, kind: ClusterTriggerAuthentication}}
`)
	auth := kedaFixture(t, "clustertriggerauthentications")
	crds := []fakeCRD{{gvr: sjGVR, kind: "ScaledJob", namespaced: true}}

	cold, _ := fakeCRDManager(t, crds)
	if got := cold.extractKEDATriggerAuthentication("ctx", auth, "ClusterTriggerAuthentication").ScaledJobs; !reflect.DeepEqual(got, []string{"invoice-renderer"}) {
		t.Fatalf("cold cache scaledJobs = %v, want the bare status name", got)
	}

	warm, _ := fakeCRDManager(t, crds)
	startFakeCRWatch(t, warm, sjGVR, user)
	if got := warm.extractKEDATriggerAuthentication("ctx", auth, "ClusterTriggerAuthentication").ScaledJobs; !reflect.DeepEqual(got, []string{"jobs/invoice-renderer"}) {
		t.Fatalf("warm cache scaledJobs = %v, want only the qualified name", got)
	}
}

func TestKEDAScaledJobJobs(t *testing.T) {
	cs := fake.NewClientset()
	f := informers.NewSharedInformerFactory(cs, 0)
	store := f.Batch().V1().Jobs().Informer().GetStore()
	base := time.Date(2026, 10, 16, 9, 0, 0, 0, time.UTC)
	for i, j := range []struct{ name, owner string }{{"renderer-a", "invoice-renderer"}, {"renderer-b", "invoice-renderer"}, {"other", "mailer"}} {
		job := &batchv1.Job{ObjectMeta: metav1.ObjectMeta{
			Name: j.name, Namespace: "shop", Labels: map[string]string{kedaScaledJobLabel: j.owner},
			CreationTimestamp: metav1.NewTime(base.Add(time.Duration(i) * time.Minute)),
		}}
		if err := store.Add(job); err != nil {
			t.Fatal(err)
		}
	}
	w := &contextWatcher{cs: cs, factory: f, started: map[string]bool{"Job": true}, bindings: kindBindings()}
	m := &ClientManager{watchers: map[string]*contextWatcher{"ctx": w}}
	got := m.ListKEDAScaledJobJobs("ctx", "shop", "invoice-renderer")
	if len(got) != 2 || got[0].Name != "renderer-b" || got[1].Name != "renderer-a" {
		t.Fatalf("jobs = %+v, want renderer-b then renderer-a", got)
	}
	if rows := m.ListKEDAScaledJobJobs("missing", "shop", "invoice-renderer"); rows == nil || len(rows) != 0 {
		t.Fatalf("unknown context = %v, want []", rows)
	}
}
