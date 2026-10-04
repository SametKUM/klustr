package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

// Tekton Pipelines serves its core kinds at tekton.dev/v1 (stored as v1 since
// v0.50) with v1beta1 alongside. The GVR is resolved from the discovered CRD so
// the backend reads at the version the frontend started the watch with.
const (
	tektonGroup                = "tekton.dev"
	tektonPipelineRunsResource = "pipelineruns"
	tektonTaskRunsResource     = "taskruns"
	tektonPipelinesResource    = "pipelines"
	tektonTasksResource        = "tasks"
)

// Labels the Tekton controller stamps on the runs it creates; they tie a
// TaskRun back to its PipelineRun and pipeline task, and a PipelineRun to its
// Pipeline (also for runs whose Pipeline came from a remote resolver).
const (
	tektonPipelineLabel     = "tekton.dev/pipeline"
	tektonPipelineRunLabel  = "tekton.dev/pipelineRun"
	tektonPipelineTaskLabel = "tekton.dev/pipelineTask"
	tektonTaskLabel         = "tekton.dev/task"
)

// spec.status values that cancel a run: the ones `tkn pipelinerun cancel` and
// `tkn taskrun cancel` write. PipelineRunPending holds a run before it starts.
const (
	tektonPipelineRunCancelled = "Cancelled"
	tektonTaskRunCancelled     = "TaskRunCancelled"
	tektonPipelineRunPending   = "PipelineRunPending"
)

// Run states the UI colors by, bucketed from the Succeeded condition.
const (
	tektonStateSucceeded = "succeeded"
	tektonStateFailed    = "failed"
	tektonStateCancelled = "cancelled"
	tektonStateRunning   = "running"
	tektonStatePending   = "pending"
	// Rows of a PipelineRun's task table that have no TaskRun.
	tektonStateSkipped = "skipped"
	tektonStateNotRun  = "notrun"
)

func (m *ClientManager) tektonGVR(contextName, resource string) (schema.GroupVersionResource, bool) {
	return m.servedGVR(contextName, tektonGroup, resource)
}

// TektonParam is a name/value pair: a run's resolved param or a result.
// Array and object values are flattened to text.
type TektonParam struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// TektonWorkspaceBinding is one workspace a run binds, with its volume source
// summarized ("Secret docker-credentials", "PVC template (1Gi)").
type TektonWorkspaceBinding struct {
	Name   string `json:"name"`
	Source string `json:"source"`
}

type tektonCondition struct{ typ, status, reason, message string }

// tektonRunState buckets a run's Succeeded condition into a UI state and
// returns the condition's reason and message. Tekton runs carry that single
// knative-style condition; a run without it has not been picked up by the
// controller yet, or is held by PipelineRunPending.
func tektonRunState(obj *unstructured.Unstructured) (state, reason, message string) {
	conds := extractConditions(obj, func(t, s, reason, message, _ string) tektonCondition {
		return tektonCondition{typ: t, status: s, reason: reason, message: message}
	})
	for _, c := range conds {
		if c.typ != "Succeeded" {
			continue
		}
		switch c.status {
		case "True":
			return tektonStateSucceeded, c.reason, c.message
		case "False":
			switch c.reason {
			case "Cancelled", "PipelineRunCancelled", tektonTaskRunCancelled, "StoppedRunFinally", "CancelledRunFinally":
				return tektonStateCancelled, c.reason, c.message
			}
			return tektonStateFailed, c.reason, c.message
		default:
			if c.reason == tektonPipelineRunPending || c.reason == "Pending" {
				return tektonStatePending, c.reason, c.message
			}
			return tektonStateRunning, c.reason, c.message
		}
	}
	if specStatus, _, _ := unstructured.NestedString(obj.Object, "spec", "status"); specStatus == tektonPipelineRunPending {
		return tektonStatePending, tektonPipelineRunPending, ""
	}
	return tektonStatePending, "", ""
}

// tektonDuration is the wall time of a finished run. A running run has none:
// the frontend computes its elapsed time from StartTime so it keeps ticking.
func tektonDuration(start, completion string) string {
	if start == "" || completion == "" {
		return ""
	}
	s, err := time.Parse(time.RFC3339, start)
	if err != nil {
		return ""
	}
	c, err := time.Parse(time.RFC3339, completion)
	if err != nil || c.Before(s) {
		return ""
	}
	return c.Sub(s).Round(time.Second).String()
}

// tektonValueString renders a param or result value. Tekton values are a
// string, an array of strings, or an object of strings.
func tektonValueString(v any) string {
	switch val := v.(type) {
	case nil:
		return ""
	case string:
		return val
	case []any:
		parts := make([]string, 0, len(val))
		for _, item := range val {
			parts = append(parts, tektonValueString(item))
		}
		return strings.Join(parts, ", ")
	default:
		// encoding/json sorts map keys, so the rendering is stable.
		b, err := json.Marshal(val)
		if err != nil {
			return fmt.Sprint(val)
		}
		return string(b)
	}
}

// extractTektonParams reads a list of {name, value} entries (spec.params,
// status.results) at the given path.
func extractTektonParams(obj *unstructured.Unstructured, fields ...string) []TektonParam {
	raw, _, _ := nestedSliceNoCopy(obj.Object, fields...)
	out := make([]TektonParam, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := m["name"].(string)
		if name == "" {
			continue
		}
		out = append(out, TektonParam{Name: name, Value: tektonValueString(m["value"])})
	}
	return out
}

func extractTektonWorkspaceBindings(obj *unstructured.Unstructured) []TektonWorkspaceBinding {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "workspaces")
	out := make([]TektonWorkspaceBinding, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := m["name"].(string)
		if name == "" {
			continue
		}
		out = append(out, TektonWorkspaceBinding{Name: name, Source: tektonWorkspaceSource(m)})
	}
	return out
}

// tektonWorkspaceSource summarizes the volume a workspace binding mounts.
func tektonWorkspaceSource(binding map[string]any) string {
	var source string
	switch {
	case binding["persistentVolumeClaim"] != nil:
		claim, _, _ := unstructured.NestedString(binding, "persistentVolumeClaim", "claimName")
		source = "PVC " + claim
	case binding["volumeClaimTemplate"] != nil:
		size, _, _ := unstructured.NestedString(binding, "volumeClaimTemplate", "spec", "resources", "requests", "storage")
		source = "PVC template"
		if size != "" {
			source += " (" + size + ")"
		}
	case binding["secret"] != nil:
		secret, _, _ := unstructured.NestedString(binding, "secret", "secretName")
		source = "Secret " + secret
	case binding["configMap"] != nil:
		cm, _, _ := unstructured.NestedString(binding, "configMap", "name")
		source = "ConfigMap " + cm
	case binding["emptyDir"] != nil:
		source = "emptyDir"
	case binding["csi"] != nil:
		driver, _, _ := unstructured.NestedString(binding, "csi", "driver")
		source = "CSI " + driver
	case binding["projected"] != nil:
		source = "projected"
	default:
		source = "—"
	}
	if subPath, _ := binding["subPath"].(string); subPath != "" {
		source += " (subPath " + subPath + ")"
	}
	return strings.TrimSpace(source)
}

// TektonTaskCounts is the PipelineRun task tally the controller writes into the
// Succeeded condition's message. Known is false when the message carries no
// tally (the run has not started, or it failed before scheduling tasks).
type TektonTaskCounts struct {
	Known      bool `json:"known"`
	Completed  int  `json:"completed"`
	Failed     int  `json:"failed"`
	Cancelled  int  `json:"cancelled"`
	Incomplete int  `json:"incomplete"`
	Skipped    int  `json:"skipped"`
}

// tektonTaskCountsPattern matches the controller's two message forms:
// "Tasks Completed: 11 (Failed: 1, Cancelled 0), Skipped: 4" and, while
// running, "Tasks Completed: 2 (Failed: 0, Cancelled 0), Incomplete: 3,
// Skipped: 0". Reading the tally from the message keeps the list free of a
// TaskRun lookup per row.
var tektonTaskCountsPattern = regexp.MustCompile(`Tasks Completed: (\d+) \(Failed: (\d+), Cancelled:? (\d+)\)(?:, Incomplete: (\d+))?, Skipped: (\d+)`)

func parseTektonTaskCounts(message string) TektonTaskCounts {
	match := tektonTaskCountsPattern.FindStringSubmatch(message)
	if match == nil {
		return TektonTaskCounts{}
	}
	atoi := func(s string) int {
		n, _ := strconv.Atoi(s)
		return n
	}
	return TektonTaskCounts{
		Known:      true,
		Completed:  atoi(match[1]),
		Failed:     atoi(match[2]),
		Cancelled:  atoi(match[3]),
		Incomplete: atoi(match[4]),
		Skipped:    atoi(match[5]),
	}
}

// tektonRunFinished reports whether a run reached a terminal state.
func tektonRunFinished(state string) bool {
	return state == tektonStateSucceeded || state == tektonStateFailed || state == tektonStateCancelled
}

// sortTektonRunsNewestFirst orders run rows by creation time, newest first,
// breaking ties by name so the order is stable.
func sortTektonRunsNewestFirst[T any](rows []T, key func(T) (createdAt, name string)) {
	sort.SliceStable(rows, func(i, j int) bool {
		ci, ni := key(rows[i])
		cj, nj := key(rows[j])
		if ci != cj {
			return ci > cj
		}
		return ni < nj
	})
}

// TektonRunState returns a PipelineRun's or TaskRun's UI state, cache-first.
// The detail header uses it to offer Cancel only while the run is active,
// without fetching the full detail a second time.
func (m *ClientManager) TektonRunState(ctx context.Context, contextName, resource, namespace, name string) (string, error) {
	if resource != tektonPipelineRunsResource && resource != tektonTaskRunsResource {
		return "", fmt.Errorf("unsupported tekton run resource: %q", resource)
	}
	gvr, ok := m.tektonGVR(contextName, resource)
	if !ok {
		return "", fmt.Errorf("%s.%s is not served by this cluster", resource, tektonGroup)
	}
	obj, err := m.crForDetail(ctx, contextName, gvr, namespace, name)
	if err != nil {
		return "", err
	}
	state, _, _ := tektonRunState(obj)
	return state, nil
}

// ---------------------------------------------------------------------------
// Mutations: Cancel, Rerun
// ---------------------------------------------------------------------------

// CancelTektonPipelineRun sets spec.status to Cancelled, the same patch
// `tkn pipelinerun cancel` sends: the controller cancels the running TaskRuns
// and skips finally tasks.
func (m *ClientManager) CancelTektonPipelineRun(ctx context.Context, contextName, namespace, name string) error {
	return m.patchTektonSpecStatus(ctx, contextName, tektonPipelineRunsResource, namespace, name, tektonPipelineRunCancelled)
}

// CancelTektonTaskRun sets spec.status to TaskRunCancelled, the same patch
// `tkn taskrun cancel` sends. A TaskRun owned by a PipelineRun fails that
// PipelineRun when cancelled.
func (m *ClientManager) CancelTektonTaskRun(ctx context.Context, contextName, namespace, name string) error {
	return m.patchTektonSpecStatus(ctx, contextName, tektonTaskRunsResource, namespace, name, tektonTaskRunCancelled)
}

func (m *ClientManager) patchTektonSpecStatus(ctx context.Context, contextName, resource, namespace, name, status string) error {
	if err := m.assertWritable(contextName); err != nil {
		return err
	}
	gvr, ok := m.tektonGVR(contextName, resource)
	if !ok {
		return fmt.Errorf("%s.%s is not served by this cluster", resource, tektonGroup)
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return err
	}
	body, err := json.Marshal(map[string]any{"spec": map[string]any{"status": status}})
	if err != nil {
		return err
	}
	if _, err := dyn.Resource(gvr).Namespace(namespace).Patch(ctx, name, types.MergePatchType, body, metav1.PatchOptions{}); err != nil {
		return fmt.Errorf("cancel %s %s/%s: %w", resource, namespace, name, err)
	}
	return nil
}

// RerunTektonPipelineRun creates a new PipelineRun from an existing one's spec
// and returns the new run's name. It reads the source live, so the copy never
// comes from the pruned informer cache.
func (m *ClientManager) RerunTektonPipelineRun(ctx context.Context, contextName, namespace, name string) (string, error) {
	if err := m.assertWritable(contextName); err != nil {
		return "", err
	}
	gvr, ok := m.tektonGVR(contextName, tektonPipelineRunsResource)
	if !ok {
		return "", fmt.Errorf("%s.%s is not served by this cluster", tektonPipelineRunsResource, tektonGroup)
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return "", err
	}
	ri := dyn.Resource(gvr).Namespace(namespace)
	src, err := ri.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("rerun pipelinerun %s/%s: %w", namespace, name, err)
	}
	created, err := ri.Create(ctx, buildTektonRerun(src), metav1.CreateOptions{})
	if err != nil {
		return "", fmt.Errorf("rerun pipelinerun %s/%s: %w", namespace, name, err)
	}
	return created.GetName(), nil
}

// tektonRerunSuffix matches the "-r-xxxxx" a previous rerun appended, so a
// rerun of a rerun gets "<original>-r-yyyyy" rather than a growing chain.
var tektonRerunSuffix = regexp.MustCompile(`-r-[a-z0-9]{5}$`)

// buildTektonRerun copies a run's spec, labels and annotations into a new
// object named "<source>-r-<random>", the scheme the Tekton Dashboard uses.
// spec.status is dropped: rerunning a cancelled or pending run must start it.
func buildTektonRerun(src *unstructured.Unstructured) *unstructured.Unstructured {
	out := &unstructured.Unstructured{Object: map[string]any{}}
	out.SetAPIVersion(src.GetAPIVersion())
	out.SetKind(src.GetKind())
	out.SetNamespace(src.GetNamespace())
	out.SetGenerateName(tektonRerunSuffix.ReplaceAllString(src.GetName(), "") + "-r-")
	if labels := src.GetLabels(); len(labels) > 0 {
		out.SetLabels(labels)
	}
	if annotations := src.GetAnnotations(); len(annotations) > 0 {
		copied := make(map[string]string, len(annotations))
		for k, v := range annotations {
			if k == "kubectl.kubernetes.io/last-applied-configuration" {
				continue
			}
			copied[k] = v
		}
		if len(copied) > 0 {
			out.SetAnnotations(copied)
		}
	}
	if spec, ok := src.Object["spec"].(map[string]any); ok {
		copied := runtime.DeepCopyJSON(spec)
		delete(copied, "status")
		out.Object["spec"] = copied
	}
	return out
}
