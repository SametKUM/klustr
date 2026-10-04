package kube

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8stesting "k8s.io/client-go/testing"
)

var (
	testPipelineRunGVR = schema.GroupVersionResource{Group: tektonGroup, Version: "v1", Resource: tektonPipelineRunsResource}
	testTaskRunGVR     = schema.GroupVersionResource{Group: tektonGroup, Version: "v1", Resource: tektonTaskRunsResource}
)

func tektonObj(kind, name string, fields map[string]any) *unstructured.Unstructured {
	obj := map[string]any{
		"apiVersion": "tekton.dev/v1",
		"kind":       kind,
		"metadata": map[string]any{
			"name":              name,
			"namespace":         "ci",
			"creationTimestamp": "2026-10-02T16:30:08Z",
		},
	}
	for k, v := range fields {
		obj[k] = v
	}
	return &unstructured.Unstructured{Object: obj}
}

func succeeded(status, reason, message string) map[string]any {
	return map[string]any{
		"conditions": []any{map[string]any{
			"type":    "Succeeded",
			"status":  status,
			"reason":  reason,
			"message": message,
		}},
	}
}

func TestTektonRunState(t *testing.T) {
	cases := []struct {
		name   string
		fields map[string]any
		want   string
	}{
		{"succeeded", map[string]any{"status": succeeded("True", "Succeeded", "")}, tektonStateSucceeded},
		{"completed with skips", map[string]any{"status": succeeded("True", "Completed", "")}, tektonStateSucceeded},
		{"failed", map[string]any{"status": succeeded("False", "Failed", "")}, tektonStateFailed},
		{"timed out", map[string]any{"status": succeeded("False", "PipelineRunTimeout", "")}, tektonStateFailed},
		{"cancelled", map[string]any{"status": succeeded("False", "Cancelled", "")}, tektonStateCancelled},
		{"taskrun cancelled", map[string]any{"status": succeeded("False", "TaskRunCancelled", "")}, tektonStateCancelled},
		{"stopped with finally", map[string]any{"status": succeeded("False", "StoppedRunFinally", "")}, tektonStateCancelled},
		{"running", map[string]any{"status": succeeded("Unknown", "Running", "")}, tektonStateRunning},
		{"cancelling", map[string]any{"status": succeeded("Unknown", "CancelledRunningFinally", "")}, tektonStateRunning},
		{"pod pending", map[string]any{"status": succeeded("Unknown", "Pending", "")}, tektonStatePending},
		{"held pending", map[string]any{"spec": map[string]any{"status": "PipelineRunPending"}}, tektonStatePending},
		{"not picked up", map[string]any{}, tektonStatePending},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, _, _ := tektonRunState(tektonObj("PipelineRun", "r", tc.fields))
			if got != tc.want {
				t.Fatalf("state = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestParseTektonTaskCounts(t *testing.T) {
	finished := parseTektonTaskCounts("Tasks Completed: 11 (Failed: 1, Cancelled 0), Skipped: 4")
	if want := (TektonTaskCounts{Known: true, Completed: 11, Failed: 1, Skipped: 4}); finished != want {
		t.Fatalf("finished counts = %+v, want %+v", finished, want)
	}
	running := parseTektonTaskCounts("Tasks Completed: 2 (Failed: 0, Cancelled 1), Incomplete: 3, Skipped: 0")
	if want := (TektonTaskCounts{Known: true, Completed: 2, Cancelled: 1, Incomplete: 3}); running != want {
		t.Fatalf("running counts = %+v, want %+v", running, want)
	}
	if got := parseTektonTaskCounts("PipelineRun couldn't find Pipeline"); got.Known {
		t.Fatalf("a message without a tally must not be Known, got %+v", got)
	}
}

func TestTektonDuration(t *testing.T) {
	if got := tektonDuration("2026-10-02T16:30:08Z", "2026-10-02T16:33:02Z"); got != "2m54s" {
		t.Fatalf("duration = %q, want 2m54s", got)
	}
	if got := tektonDuration("2026-10-02T16:30:08Z", ""); got != "" {
		t.Fatalf("a running run has no duration, got %q", got)
	}
}

func TestTektonValueString(t *testing.T) {
	if got := tektonValueString([]any{"a", "b"}); got != "a, b" {
		t.Fatalf("array = %q", got)
	}
	if got := tektonValueString(map[string]any{"z": "1", "a": "2"}); got != `{"a":"2","z":"1"}` {
		t.Fatalf("object = %q", got)
	}
	if got := tektonValueString(nil); got != "" {
		t.Fatalf("nil = %q", got)
	}
}

func TestTektonWorkspaceSource(t *testing.T) {
	cases := []struct {
		binding map[string]any
		want    string
	}{
		{map[string]any{"persistentVolumeClaim": map[string]any{"claimName": "cache"}}, "PVC cache"},
		{map[string]any{"volumeClaimTemplate": map[string]any{"spec": map[string]any{"resources": map[string]any{"requests": map[string]any{"storage": "1Gi"}}}}}, "PVC template (1Gi)"},
		{map[string]any{"secret": map[string]any{"secretName": "creds"}, "subPath": "ssh"}, "Secret creds (subPath ssh)"},
		{map[string]any{"configMap": map[string]any{"name": "cfg"}}, "ConfigMap cfg"},
		{map[string]any{"emptyDir": map[string]any{}}, "emptyDir"},
	}
	for _, tc := range cases {
		if got := tektonWorkspaceSource(tc.binding); got != tc.want {
			t.Errorf("source = %q, want %q", got, tc.want)
		}
	}
}

func childTaskRun(name, task, reason, status string) *unstructured.Unstructured {
	tr := tektonObj("TaskRun", name, map[string]any{"status": succeeded(status, reason, "")})
	tr.SetLabels(map[string]string{tektonPipelineRunLabel: "build", tektonPipelineTaskLabel: task})
	_ = unstructured.SetNestedField(tr.Object, "2026-10-02T16:30:10Z", "status", "startTime")
	_ = unstructured.SetNestedField(tr.Object, "2026-10-02T16:30:40Z", "status", "completionTime")
	return tr
}

func pipelineRunWithSpec(status map[string]any) *unstructured.Unstructured {
	status["pipelineSpec"] = map[string]any{
		"tasks": []any{
			map[string]any{"name": "clone", "taskRef": map[string]any{"name": "git-clone"}},
			map[string]any{"name": "build", "taskRef": map[string]any{"name": "kaniko"}, "runAfter": []any{"clone"}},
			map[string]any{"name": "lint", "taskSpec": map[string]any{}},
			map[string]any{"name": "deploy", "taskRef": map[string]any{"resolver": "git"}, "runAfter": []any{"build"}},
		},
		"finally": []any{
			map[string]any{"name": "notify", "taskRef": map[string]any{"name": "slack"}},
		},
	}
	status["skippedTasks"] = []any{map[string]any{"name": "lint", "reason": "When Expressions evaluated to false"}}
	return tektonObj("PipelineRun", "build", map[string]any{"status": status})
}

func TestBuildTektonPipelineRunTasksJoinsSpecRunsAndSkips(t *testing.T) {
	pr := pipelineRunWithSpec(succeeded("False", "Failed", "Tasks Completed: 3 (Failed: 1, Cancelled 0), Skipped: 1"))
	children := []*unstructured.Unstructured{
		childTaskRun("build-notify", "notify", "Succeeded", "True"),
		childTaskRun("build-build", "build", "Failed", "False"),
		childTaskRun("build-clone", "clone", "Succeeded", "True"),
	}
	rows := buildTektonPipelineRunTasks(pr, children)

	type row struct{ name, taskRef, taskRun, state string }
	got := make([]row, 0, len(rows))
	for _, r := range rows {
		got = append(got, row{r.Name, r.TaskRef, r.TaskRunName, r.State})
	}
	want := []row{
		{"clone", "git-clone", "build-clone", tektonStateSucceeded},
		{"build", "kaniko", "build-build", tektonStateFailed},
		{"lint", "(inline)", "", tektonStateSkipped},
		{"deploy", "git resolver", "", tektonStateNotRun},
		{"notify", "slack", "build-notify", tektonStateSucceeded},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("rows =\n%+v\nwant\n%+v", got, want)
	}
	if !rows[4].Finally || rows[0].Finally {
		t.Fatal("only the finally task is marked Finally")
	}
	if !reflect.DeepEqual(rows[1].RunAfter, []string{"clone"}) || rows[0].RunAfter == nil {
		t.Fatalf("runAfter must be carried and never nil, got %v / %v", rows[1].RunAfter, rows[0].RunAfter)
	}
	if rows[0].Duration != "30s" {
		t.Fatalf("task duration = %q, want 30s", rows[0].Duration)
	}
}

func TestBuildTektonPipelineRunTasksPendingWhileRunning(t *testing.T) {
	pr := pipelineRunWithSpec(succeeded("Unknown", "Running", ""))
	rows := buildTektonPipelineRunTasks(pr, nil)
	for _, r := range rows {
		if r.Name == "deploy" && r.State != tektonStatePending {
			t.Fatalf("an unstarted task of a running run is pending, got %q", r.State)
		}
	}
}

func TestBuildTektonPipelineRunTasksMatrixAndUnlisted(t *testing.T) {
	// No resolved spec: rows come from the TaskRuns alone, one per TaskRun,
	// with childReferences filling in for a missing pipelineTask label.
	pr := tektonObj("PipelineRun", "build", map[string]any{"status": map[string]any{
		"childReferences": []any{map[string]any{"name": "legacy-run", "pipelineTaskName": "scan"}},
	}})
	legacy := tektonObj("TaskRun", "legacy-run", map[string]any{"status": succeeded("True", "Succeeded", "")})
	children := []*unstructured.Unstructured{
		childTaskRun("build-test-1", "test", "Succeeded", "True"),
		childTaskRun("build-test-0", "test", "Failed", "False"),
		legacy,
	}
	rows := buildTektonPipelineRunTasks(pr, children)
	got := make([]string, 0, len(rows))
	for _, r := range rows {
		got = append(got, r.Name+"/"+r.TaskRunName)
	}
	want := []string{"scan/legacy-run", "test/build-test-0", "test/build-test-1"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("rows = %v, want %v", got, want)
	}
}

func TestExtractTektonSteps(t *testing.T) {
	tr := tektonObj("TaskRun", "r", map[string]any{"status": map[string]any{
		"taskSpec": map[string]any{"steps": []any{
			map[string]any{"name": "clone", "image": "alpine/git"},
			map[string]any{"name": "build", "image": "kaniko"},
			map[string]any{"name": "push", "image": "crane"},
		}},
		"steps": []any{
			map[string]any{"name": "clone", "container": "step-clone", "terminationReason": "Completed", "terminated": map[string]any{
				"exitCode": int64(0), "reason": "Completed",
				"startedAt": "2026-10-02T16:30:10Z", "finishedAt": "2026-10-02T16:30:15Z",
			}},
			map[string]any{"name": "build", "container": "step-build", "running": map[string]any{"startedAt": "2026-10-02T16:30:15Z"}},
			map[string]any{"name": "push", "container": "step-push", "waiting": map[string]any{"reason": "PodInitializing"}},
		},
	}})
	steps := extractTektonSteps(tr)
	if len(steps) != 3 {
		t.Fatalf("got %d steps, want 3", len(steps))
	}
	if s := steps[0]; s.State != "terminated" || s.Reason != "Completed" || s.Image != "alpine/git" || s.Duration != "5s" {
		t.Fatalf("terminated step = %+v", s)
	}
	if s := steps[1]; s.State != "running" || s.StartedAt == "" || s.Container != "step-build" {
		t.Fatalf("running step = %+v", s)
	}
	if s := steps[2]; s.State != "waiting" || s.Reason != "PodInitializing" {
		t.Fatalf("waiting step = %+v", s)
	}
}

func TestExtractTektonStepsBeforePodStarts(t *testing.T) {
	tr := tektonObj("TaskRun", "r", map[string]any{"status": map[string]any{
		"taskSpec": map[string]any{"steps": []any{map[string]any{"name": "build", "image": "kaniko"}}},
	}})
	steps := extractTektonSteps(tr)
	if len(steps) != 1 || steps[0].State != tektonStatePending || steps[0].Image != "kaniko" {
		t.Fatalf("steps = %+v", steps)
	}
}

func TestBuildTektonRerun(t *testing.T) {
	src := tektonObj("PipelineRun", "release-wcd7k-r-ab12c", map[string]any{
		"spec": map[string]any{
			"status":      "Cancelled",
			"pipelineRef": map[string]any{"name": "release"},
			"params":      []any{map[string]any{"name": "branch", "value": "main"}},
		},
		"status": succeeded("False", "Cancelled", ""),
	})
	src.SetLabels(map[string]string{"app": "api"})
	src.SetAnnotations(map[string]string{
		"kubectl.kubernetes.io/last-applied-configuration": "{}",
		"note": "keep",
	})
	src.SetUID("source-uid")
	src.SetResourceVersion("42")

	out := buildTektonRerun(src)
	if got := out.GetGenerateName(); got != "release-wcd7k-r-" {
		t.Fatalf("generateName = %q, want the source name without the previous rerun suffix", got)
	}
	if out.GetName() != "" || out.GetUID() != "" || out.GetResourceVersion() != "" {
		t.Fatal("the rerun must not carry the source's identity")
	}
	if _, found := out.Object["status"]; found {
		t.Fatal("status must not be copied")
	}
	if _, found, _ := unstructured.NestedString(out.Object, "spec", "status"); found {
		t.Fatal("spec.status must be dropped so a cancelled run starts again")
	}
	if !reflect.DeepEqual(out.GetAnnotations(), map[string]string{"note": "keep"}) {
		t.Fatalf("annotations = %v", out.GetAnnotations())
	}
	if out.GetLabels()["app"] != "api" {
		t.Fatal("labels must be copied")
	}

	// The copy must not alias the source's spec.
	_ = unstructured.SetNestedField(out.Object, "dev", "spec", "pipelineRef", "name")
	if name, _, _ := unstructured.NestedString(src.Object, "spec", "pipelineRef", "name"); name != "release" {
		t.Fatal("mutating the rerun changed the source")
	}

	plain := buildTektonRerun(tektonObj("PipelineRun", "nightly-x7k2p", nil))
	if got := plain.GetGenerateName(); got != "nightly-x7k2p-r-" {
		t.Fatalf("generateName = %q", got)
	}
}

func TestTransformForCRPrunesTektonStatusCopies(t *testing.T) {
	tr := tektonObj("TaskRun", "r", map[string]any{"status": map[string]any{
		"taskSpec":   map[string]any{"steps": []any{}},
		"provenance": map[string]any{"featureFlags": map[string]any{}},
		"podName":    "r-pod",
	}})
	tr.SetManagedFields([]metav1.ManagedFieldsEntry{{Manager: "controller"}})

	out, err := transformForCR(testTaskRunGVR)(tr)
	if err != nil {
		t.Fatal(err)
	}
	got := out.(*unstructured.Unstructured)
	if _, found, _ := unstructured.NestedMap(got.Object, "status", "taskSpec"); found {
		t.Fatal("status.taskSpec must be pruned")
	}
	if _, found, _ := unstructured.NestedMap(got.Object, "status", "provenance"); found {
		t.Fatal("status.provenance must be pruned")
	}
	if pod, _, _ := unstructured.NestedString(got.Object, "status", "podName"); pod != "r-pod" {
		t.Fatal("fields the list reads must survive")
	}
	if got.GetManagedFields() != nil {
		t.Fatal("managedFields must still be stripped")
	}

	other := tektonObj("Pipeline", "p", map[string]any{"status": map[string]any{"taskSpec": map[string]any{}}})
	out, _ = transformForCR(schema.GroupVersionResource{Group: tektonGroup, Version: "v1", Resource: tektonPipelinesResource})(other)
	if _, found, _ := unstructured.NestedMap(out.(*unstructured.Unstructured).Object, "status", "taskSpec"); !found {
		t.Fatal("resources without pruned fields must pass through")
	}
}

func TestErrCRSyncPendingIsWrapped(t *testing.T) {
	// The frontend retries on this message; keep it stable.
	if errCRSyncPending.Error() != "cache sync still in progress" {
		t.Fatalf("message changed: %q", errCRSyncPending.Error())
	}
}

// tektonTestManager wires a ClientManager whose context "ctx" knows the
// Tekton run CRDs and talks to a fake dynamic client holding objs.
func tektonTestManager(t *testing.T, objs ...runtime.Object) (*ClientManager, *dynamicfake.FakeDynamicClient) {
	t.Helper()
	return fakeCRDManager(t, []fakeCRD{
		{gvr: testPipelineRunGVR, kind: "PipelineRun", namespaced: true},
		{gvr: testTaskRunGVR, kind: "TaskRun", namespaced: true},
	}, objs...)
}

func TestCancelTektonRunsPatchSpecStatus(t *testing.T) {
	m, dyn := tektonTestManager(t,
		tektonObj("PipelineRun", "build", nil),
		tektonObj("TaskRun", "build-clone", nil),
	)
	if err := m.CancelTektonPipelineRun(context.Background(), "ctx", "ci", "build"); err != nil {
		t.Fatal(err)
	}
	if err := m.CancelTektonTaskRun(context.Background(), "ctx", "ci", "build-clone"); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		gvr  schema.GroupVersionResource
		name string
		want string
	}{
		{testPipelineRunGVR, "build", "Cancelled"},
		{testTaskRunGVR, "build-clone", "TaskRunCancelled"},
	} {
		obj, err := dyn.Resource(tc.gvr).Namespace("ci").Get(context.Background(), tc.name, metav1.GetOptions{})
		if err != nil {
			t.Fatal(err)
		}
		if got, _, _ := unstructured.NestedString(obj.Object, "spec", "status"); got != tc.want {
			t.Fatalf("%s spec.status = %q, want %q", tc.name, got, tc.want)
		}
	}
}

func TestTektonRunStateLookup(t *testing.T) {
	m, _ := tektonTestManager(t, tektonObj("TaskRun", "build-clone", map[string]any{"status": succeeded("Unknown", "Running", "")}))
	state, err := m.TektonRunState(context.Background(), "ctx", tektonTaskRunsResource, "ci", "build-clone")
	if err != nil || state != tektonStateRunning {
		t.Fatalf("state = %q, err = %v", state, err)
	}
	if _, err := m.TektonRunState(context.Background(), "ctx", tektonPipelinesResource, "ci", "p"); err == nil {
		t.Fatal("only run resources have a state")
	}
}

func TestCancelTektonRunRespectsReadOnly(t *testing.T) {
	m, dyn := tektonTestManager(t, tektonObj("PipelineRun", "build", nil))
	m.readOnly = map[string]bool{"ctx": true}
	if err := m.CancelTektonPipelineRun(context.Background(), "ctx", "ci", "build"); !errors.Is(err, errReadOnly) {
		t.Fatalf("err = %v, want errReadOnly", err)
	}
	for _, action := range dyn.Actions() {
		if action.GetVerb() == "patch" {
			t.Fatal("a read-only context must not be patched")
		}
	}
}

func TestRerunTektonPipelineRunCreatesCopy(t *testing.T) {
	src := tektonObj("PipelineRun", "build", map[string]any{"spec": map[string]any{
		"status":      "Cancelled",
		"pipelineRef": map[string]any{"name": "release"},
	}})
	m, dyn := tektonTestManager(t, src)
	// The fake tracker doesn't implement generateName; do what the API server does.
	dyn.PrependReactor("create", tektonPipelineRunsResource, func(action k8stesting.Action) (bool, runtime.Object, error) {
		obj := action.(k8stesting.CreateAction).GetObject().(*unstructured.Unstructured)
		obj.SetName(obj.GetGenerateName() + "x1y2z")
		return false, nil, nil
	})

	name, err := m.RerunTektonPipelineRun(context.Background(), "ctx", "ci", "build")
	if err != nil {
		t.Fatal(err)
	}
	if name != "build-r-x1y2z" {
		t.Fatalf("new run = %q", name)
	}
	created, err := dyn.Resource(testPipelineRunGVR).Namespace("ci").Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if ref, _, _ := unstructured.NestedString(created.Object, "spec", "pipelineRef", "name"); ref != "release" {
		t.Fatalf("pipelineRef = %q", ref)
	}
	if _, found, _ := unstructured.NestedString(created.Object, "spec", "status"); found {
		t.Fatal("the rerun must start, not inherit Cancelled")
	}
}

func TestGetTektonPipelineRunReadsLiveWithChildren(t *testing.T) {
	pr := pipelineRunWithSpec(succeeded("Unknown", "Running", "Tasks Completed: 1 (Failed: 0, Cancelled 0), Incomplete: 3, Skipped: 1"))
	_ = unstructured.SetNestedField(pr.Object, map[string]any{"serviceAccountName": "builder"}, "spec", "taskRunTemplate")
	_ = unstructured.SetNestedSlice(pr.Object, []any{map[string]any{"name": "branch", "value": "main"}}, "spec", "params")
	clone := childTaskRun("build-clone", "clone", "Succeeded", "True")
	unrelated := childTaskRun("other-clone", "clone", "Succeeded", "True")
	unrelated.SetLabels(map[string]string{tektonPipelineRunLabel: "other", tektonPipelineTaskLabel: "clone"})
	m, _ := tektonTestManager(t, pr, clone, unrelated)

	detail, err := m.GetTektonPipelineRun(context.Background(), "ctx", "ci", "build")
	if err != nil {
		t.Fatal(err)
	}
	if detail.State != tektonStateRunning || detail.ServiceAccount != "builder" {
		t.Fatalf("detail = %+v", detail.TektonPipelineRunInfo)
	}
	if !detail.Tasks.Known || detail.Tasks.Incomplete != 3 {
		t.Fatalf("task counts = %+v", detail.Tasks)
	}
	if len(detail.Params) != 1 || detail.Params[0].Value != "main" {
		t.Fatalf("params = %+v", detail.Params)
	}
	var cloneRuns []string
	for _, row := range detail.PipelineTasks {
		if row.Name == "clone" {
			cloneRuns = append(cloneRuns, row.TaskRunName)
		}
	}
	if !reflect.DeepEqual(cloneRuns, []string{"build-clone"}) {
		t.Fatalf("clone rows = %v; the other run's TaskRun must not match", cloneRuns)
	}
	// Nil slices would reach the frontend as JSON null.
	b, _ := json.Marshal(detail)
	var decoded map[string]any
	_ = json.Unmarshal(b, &decoded)
	for _, field := range []string{"params", "workspaces", "results", "pipelineTasks"} {
		if decoded[field] == nil {
			t.Fatalf("%s encodes as null", field)
		}
	}
}
