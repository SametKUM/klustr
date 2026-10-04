package kube

import (
	"context"
	"fmt"
	"sort"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// ---------------------------------------------------------------------------
// PipelineRun
// ---------------------------------------------------------------------------

// TektonPipelineRunInfo is the row shape for the PipelineRuns list. Pipeline is
// the display name of what the run executes; PipelineRefName is set only when
// that is a Pipeline object in the run's namespace, which the UI can open.
type TektonPipelineRunInfo struct {
	Name            string           `json:"name"`
	Namespace       string           `json:"namespace"`
	Pipeline        string           `json:"pipeline"`
	PipelineRefName string           `json:"pipelineRefName"`
	State           string           `json:"state"`
	Reason          string           `json:"reason"`
	Message         string           `json:"message"`
	Tasks           TektonTaskCounts `json:"tasks"`
	StartTime       string           `json:"startTime"`
	CompletionTime  string           `json:"completionTime"`
	Duration        string           `json:"duration"`
	CreatedAt       string           `json:"createdAt"`
}

// TektonPipelineRunTask is one row of a PipelineRun's task table: a pipeline
// task joined with the TaskRun that executed it. A matrixed task yields one row
// per TaskRun; a task without one is skipped, pending or never ran.
type TektonPipelineRunTask struct {
	Name           string   `json:"name"`
	DisplayName    string   `json:"displayName"`
	TaskRef        string   `json:"taskRef"`
	RunAfter       []string `json:"runAfter"`
	Finally        bool     `json:"finally"`
	TaskRunName    string   `json:"taskRunName"`
	State          string   `json:"state"`
	Reason         string   `json:"reason"`
	Message        string   `json:"message"`
	StartTime      string   `json:"startTime"`
	CompletionTime string   `json:"completionTime"`
	Duration       string   `json:"duration"`
}

type TektonPipelineRunDetail struct {
	TektonPipelineRunInfo
	Params         []TektonParam            `json:"params"`
	Workspaces     []TektonWorkspaceBinding `json:"workspaces"`
	Results        []TektonParam            `json:"results"`
	PipelineTasks  []TektonPipelineRunTask  `json:"pipelineTasks"`
	ServiceAccount string                   `json:"serviceAccount"`
	Timeout        string                   `json:"timeout"`
	SpecStatus     string                   `json:"specStatus"`
}

func (m *ClientManager) ListTektonPipelineRuns(contextName, namespace string) []TektonPipelineRunInfo {
	gvr, ok := m.tektonGVR(contextName, tektonPipelineRunsResource)
	if !ok {
		return []TektonPipelineRunInfo{}
	}
	objs := listCachedCRs(m, contextName, gvr, namespace)
	out := make([]TektonPipelineRunInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractTektonPipelineRun(obj))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

// TektonPipelineRunsForPipeline returns the cached runs of the named Pipeline,
// newest first, matched on the tekton.dev/pipeline label the controller sets
// (it also covers runs whose Pipeline came from a remote resolver).
func (m *ClientManager) TektonPipelineRunsForPipeline(contextName, namespace, pipeline string) []TektonPipelineRunInfo {
	gvr, ok := m.tektonGVR(contextName, tektonPipelineRunsResource)
	if !ok {
		return []TektonPipelineRunInfo{}
	}
	out := []TektonPipelineRunInfo{}
	for _, obj := range listCachedCRs(m, contextName, gvr, namespace) {
		if obj.GetLabels()[tektonPipelineLabel] == pipeline {
			out = append(out, extractTektonPipelineRun(obj))
		}
	}
	sortTektonRunsNewestFirst(out, func(r TektonPipelineRunInfo) (string, string) { return r.CreatedAt, r.Name })
	return out
}

// GetTektonPipelineRun reads the run live (the cache prunes status.pipelineSpec,
// which the task table needs) and its child TaskRuns by label.
func (m *ClientManager) GetTektonPipelineRun(ctx context.Context, contextName, namespace, name string) (*TektonPipelineRunDetail, error) {
	gvr, ok := m.tektonGVR(contextName, tektonPipelineRunsResource)
	if !ok {
		return nil, fmt.Errorf("%s.%s is not served by this cluster", tektonPipelineRunsResource, tektonGroup)
	}
	obj, err := m.getTektonLive(ctx, contextName, gvr, namespace, name)
	if err != nil {
		return nil, err
	}
	children, err := m.tektonChildTaskRuns(ctx, contextName, namespace, name)
	if err != nil {
		return nil, err
	}
	serviceAccount, _, _ := unstructured.NestedString(obj.Object, "spec", "taskRunTemplate", "serviceAccountName")
	timeout, _, _ := unstructured.NestedString(obj.Object, "spec", "timeouts", "pipeline")
	specStatus, _, _ := unstructured.NestedString(obj.Object, "spec", "status")
	return &TektonPipelineRunDetail{
		TektonPipelineRunInfo: extractTektonPipelineRun(obj),
		Params:                extractTektonParams(obj, "spec", "params"),
		Workspaces:            extractTektonWorkspaceBindings(obj),
		Results:               extractTektonParams(obj, "status", "results"),
		PipelineTasks:         buildTektonPipelineRunTasks(obj, children),
		ServiceAccount:        serviceAccount,
		Timeout:               timeout,
		SpecStatus:            specStatus,
	}, nil
}

func extractTektonPipelineRun(obj *unstructured.Unstructured) TektonPipelineRunInfo {
	state, reason, message := tektonRunState(obj)
	start, _, _ := unstructured.NestedString(obj.Object, "status", "startTime")
	completion, _, _ := unstructured.NestedString(obj.Object, "status", "completionTime")
	pipeline, refName := tektonPipelineRefName(obj)
	return TektonPipelineRunInfo{
		Name:            obj.GetName(),
		Namespace:       obj.GetNamespace(),
		Pipeline:        pipeline,
		PipelineRefName: refName,
		State:           state,
		Reason:          reason,
		Message:         message,
		Tasks:           parseTektonTaskCounts(message),
		StartTime:       start,
		CompletionTime:  completion,
		Duration:        tektonDuration(start, completion),
		CreatedAt:       crCreatedAt(obj),
	}
}

// tektonPipelineRefName returns what a run executes: a Pipeline by name, a
// remotely resolved one (named by the label the controller sets once it
// resolves) or an inline spec.
func tektonPipelineRefName(obj *unstructured.Unstructured) (display, refName string) {
	if name, _, _ := unstructured.NestedString(obj.Object, "spec", "pipelineRef", "name"); name != "" {
		return name, name
	}
	label := obj.GetLabels()[tektonPipelineLabel]
	if resolver, _, _ := unstructured.NestedString(obj.Object, "spec", "pipelineRef", "resolver"); resolver != "" {
		if label != "" {
			return label, ""
		}
		return resolver + " resolver", ""
	}
	if _, found, _ := nestedMapNoCopy(obj.Object, "spec", "pipelineSpec"); found {
		return "(inline)", ""
	}
	return label, ""
}

// tektonChildTaskRuns lists a PipelineRun's TaskRuns live by the label the
// controller stamps on them, so opening one run never starts the (large)
// cluster-wide TaskRun informer.
func (m *ClientManager) tektonChildTaskRuns(ctx context.Context, contextName, namespace, pipelineRun string) ([]*unstructured.Unstructured, error) {
	gvr, ok := m.tektonGVR(contextName, tektonTaskRunsResource)
	if !ok {
		return nil, nil
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	list, err := dyn.Resource(gvr).Namespace(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labels.Set{tektonPipelineRunLabel: pipelineRun}.String(),
	})
	if err != nil {
		return nil, fmt.Errorf("list taskruns of %s/%s: %w", namespace, pipelineRun, err)
	}
	out := make([]*unstructured.Unstructured, 0, len(list.Items))
	for i := range list.Items {
		out = append(out, &list.Items[i])
	}
	return out, nil
}

// getTektonLive GETs a Tekton object from the API server, bypassing the
// informer cache whose copy has crCachePrunedFields removed.
func (m *ClientManager) getTektonLive(ctx context.Context, contextName string, gvr schema.GroupVersionResource, namespace, name string) (*unstructured.Unstructured, error) {
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	return resourceFor(dyn, gvr, namespace).Get(ctx, name, metav1.GetOptions{})
}

// buildTektonPipelineRunTasks joins the run's resolved pipeline tasks
// (status.pipelineSpec, or an inline spec.pipelineSpec) with its TaskRuns and
// skipped tasks, in pipeline order with finally tasks last. TaskRuns of tasks
// the spec doesn't list (no resolved spec yet) are appended at the end.
func buildTektonPipelineRunTasks(pr *unstructured.Unstructured, children []*unstructured.Unstructured) []TektonPipelineRunTask {
	spec, found, _ := nestedMapNoCopy(pr.Object, "status", "pipelineSpec")
	if !found {
		spec, _, _ = nestedMapNoCopy(pr.Object, "spec", "pipelineSpec")
	}

	// The controller labels each TaskRun with its pipeline task; childReferences
	// cover TaskRuns created before that label existed.
	taskOf := map[string]string{}
	refs, _, _ := nestedSliceNoCopy(pr.Object, "status", "childReferences")
	for _, item := range refs {
		ref, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := ref["name"].(string)
		task, _ := ref["pipelineTaskName"].(string)
		if name != "" && task != "" {
			taskOf[name] = task
		}
	}
	runsByTask := map[string][]*unstructured.Unstructured{}
	for _, tr := range children {
		task := tr.GetLabels()[tektonPipelineTaskLabel]
		if task == "" {
			task = taskOf[tr.GetName()]
		}
		runsByTask[task] = append(runsByTask[task], tr)
	}
	for task := range runsByTask {
		sort.Slice(runsByTask[task], func(i, j int) bool {
			return runsByTask[task][i].GetName() < runsByTask[task][j].GetName()
		})
	}

	skipped := map[string]string{}
	skippedRaw, _, _ := nestedSliceNoCopy(pr.Object, "status", "skippedTasks")
	for _, item := range skippedRaw {
		s, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := s["name"].(string)
		reason, _ := s["reason"].(string)
		if name != "" {
			skipped[name] = reason
		}
	}

	prState, _, _ := tektonRunState(pr)
	out := []TektonPipelineRunTask{}
	seen := map[string]bool{}
	appendTask := func(task map[string]any, finally bool) {
		name, _ := task["name"].(string)
		if name == "" {
			return
		}
		seen[name] = true
		displayName, _ := task["displayName"].(string)
		runAfter, _, _ := unstructured.NestedStringSlice(task, "runAfter")
		base := TektonPipelineRunTask{
			Name:        name,
			DisplayName: displayName,
			TaskRef:     tektonPipelineTaskRef(task),
			RunAfter:    append([]string{}, runAfter...),
			Finally:     finally,
		}
		runs := runsByTask[name]
		if len(runs) == 0 {
			switch reason, isSkipped := skipped[name]; {
			case isSkipped:
				base.State, base.Reason = tektonStateSkipped, reason
			case tektonRunFinished(prState):
				base.State = tektonStateNotRun
			default:
				base.State = tektonStatePending
			}
			out = append(out, base)
			return
		}
		for _, tr := range runs {
			out = append(out, tektonTaskRow(base, tr))
		}
	}
	for _, field := range []string{"tasks", "finally"} {
		tasks, _, _ := nestedSliceNoCopy(spec, field)
		for _, item := range tasks {
			if task, ok := item.(map[string]any); ok {
				appendTask(task, field == "finally")
			}
		}
	}

	var unlisted []string
	for task := range runsByTask {
		if !seen[task] {
			unlisted = append(unlisted, task)
		}
	}
	sort.Strings(unlisted)
	for _, task := range unlisted {
		for _, tr := range runsByTask[task] {
			out = append(out, tektonTaskRow(TektonPipelineRunTask{
				Name:     task,
				TaskRef:  tektonTaskRunRef(tr),
				RunAfter: []string{},
				Finally:  tr.GetLabels()["tekton.dev/memberOf"] == "finally",
			}, tr))
		}
	}
	return out
}

func tektonTaskRow(base TektonPipelineRunTask, tr *unstructured.Unstructured) TektonPipelineRunTask {
	state, reason, message := tektonRunState(tr)
	start, _, _ := unstructured.NestedString(tr.Object, "status", "startTime")
	completion, _, _ := unstructured.NestedString(tr.Object, "status", "completionTime")
	base.TaskRunName = tr.GetName()
	base.State = state
	base.Reason = reason
	base.Message = message
	base.StartTime = start
	base.CompletionTime = completion
	base.Duration = tektonDuration(start, completion)
	return base
}

// tektonPipelineTaskRef describes what a pipeline task runs.
func tektonPipelineTaskRef(task map[string]any) string {
	if ref, ok := task["taskRef"].(map[string]any); ok {
		return tektonRefString(ref)
	}
	if _, ok := task["taskSpec"].(map[string]any); ok {
		return "(inline)"
	}
	if ref, ok := task["pipelineRef"].(map[string]any); ok {
		return "Pipeline " + tektonRefString(ref)
	}
	if _, ok := task["pipelineSpec"].(map[string]any); ok {
		return "(inline pipeline)"
	}
	return ""
}

// tektonRefString renders a taskRef/pipelineRef: its name, prefixed with the
// kind unless it's the default, or the remote resolver that fetches it.
func tektonRefString(ref map[string]any) string {
	name, _ := ref["name"].(string)
	kind, _ := ref["kind"].(string)
	if name != "" {
		if kind != "" && kind != "Task" && kind != "Pipeline" {
			return kind + " " + name
		}
		return name
	}
	if resolver, _ := ref["resolver"].(string); resolver != "" {
		return resolver + " resolver"
	}
	return ""
}

// ---------------------------------------------------------------------------
// TaskRun
// ---------------------------------------------------------------------------

// TektonTaskRunInfo is the row shape for the TaskRuns list. TaskRefName is set
// only when the run references a Task object in its namespace.
type TektonTaskRunInfo struct {
	Name           string `json:"name"`
	Namespace      string `json:"namespace"`
	Task           string `json:"task"`
	TaskRefName    string `json:"taskRefName"`
	PipelineRun    string `json:"pipelineRun"`
	PipelineTask   string `json:"pipelineTask"`
	State          string `json:"state"`
	Reason         string `json:"reason"`
	Message        string `json:"message"`
	PodName        string `json:"podName"`
	StepsTotal     int    `json:"stepsTotal"`
	StepsDone      int    `json:"stepsDone"`
	Retries        int    `json:"retries"`
	StartTime      string `json:"startTime"`
	CompletionTime string `json:"completionTime"`
	Duration       string `json:"duration"`
	CreatedAt      string `json:"createdAt"`
}

// TektonStep is one step of a TaskRun, from its container state. ExitCode is
// meaningful only for a terminated step.
type TektonStep struct {
	Name       string `json:"name"`
	Container  string `json:"container"`
	Image      string `json:"image"`
	State      string `json:"state"`
	Reason     string `json:"reason"`
	Message    string `json:"message"`
	ExitCode   int64  `json:"exitCode"`
	StartedAt  string `json:"startedAt"`
	FinishedAt string `json:"finishedAt"`
	Duration   string `json:"duration"`
}

type TektonTaskRunDetail struct {
	TektonTaskRunInfo
	Params         []TektonParam            `json:"params"`
	Workspaces     []TektonWorkspaceBinding `json:"workspaces"`
	Results        []TektonParam            `json:"results"`
	Steps          []TektonStep             `json:"steps"`
	ServiceAccount string                   `json:"serviceAccount"`
	Timeout        string                   `json:"timeout"`
}

func (m *ClientManager) ListTektonTaskRuns(contextName, namespace string) []TektonTaskRunInfo {
	gvr, ok := m.tektonGVR(contextName, tektonTaskRunsResource)
	if !ok {
		return []TektonTaskRunInfo{}
	}
	objs := listCachedCRs(m, contextName, gvr, namespace)
	out := make([]TektonTaskRunInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractTektonTaskRun(obj))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

// GetTektonTaskRun reads the run live: step images come from status.taskSpec,
// which the cache prunes.
func (m *ClientManager) GetTektonTaskRun(ctx context.Context, contextName, namespace, name string) (*TektonTaskRunDetail, error) {
	gvr, ok := m.tektonGVR(contextName, tektonTaskRunsResource)
	if !ok {
		return nil, fmt.Errorf("%s.%s is not served by this cluster", tektonTaskRunsResource, tektonGroup)
	}
	obj, err := m.getTektonLive(ctx, contextName, gvr, namespace, name)
	if err != nil {
		return nil, err
	}
	serviceAccount, _, _ := unstructured.NestedString(obj.Object, "spec", "serviceAccountName")
	timeout, _, _ := unstructured.NestedString(obj.Object, "spec", "timeout")
	return &TektonTaskRunDetail{
		TektonTaskRunInfo: extractTektonTaskRun(obj),
		Params:            extractTektonParams(obj, "spec", "params"),
		Workspaces:        extractTektonWorkspaceBindings(obj),
		Results:           extractTektonParams(obj, "status", "results"),
		Steps:             extractTektonSteps(obj),
		ServiceAccount:    serviceAccount,
		Timeout:           timeout,
	}, nil
}

func extractTektonTaskRun(obj *unstructured.Unstructured) TektonTaskRunInfo {
	state, reason, message := tektonRunState(obj)
	start, _, _ := unstructured.NestedString(obj.Object, "status", "startTime")
	completion, _, _ := unstructured.NestedString(obj.Object, "status", "completionTime")
	podName, _, _ := unstructured.NestedString(obj.Object, "status", "podName")
	steps, _, _ := nestedSliceNoCopy(obj.Object, "status", "steps")
	done := 0
	for _, item := range steps {
		if step, ok := item.(map[string]any); ok && step["terminated"] != nil {
			done++
		}
	}
	retries, _, _ := nestedSliceNoCopy(obj.Object, "status", "retriesStatus")
	labels := obj.GetLabels()
	task := tektonTaskRunRef(obj)
	refName := ""
	if name, _, _ := unstructured.NestedString(obj.Object, "spec", "taskRef", "name"); name != "" {
		if kind, _, _ := unstructured.NestedString(obj.Object, "spec", "taskRef", "kind"); kind == "" || kind == "Task" {
			refName = name
		}
	}
	return TektonTaskRunInfo{
		Name:           obj.GetName(),
		Namespace:      obj.GetNamespace(),
		Task:           task,
		TaskRefName:    refName,
		PipelineRun:    labels[tektonPipelineRunLabel],
		PipelineTask:   labels[tektonPipelineTaskLabel],
		State:          state,
		Reason:         reason,
		Message:        message,
		PodName:        podName,
		StepsTotal:     len(steps),
		StepsDone:      done,
		Retries:        len(retries),
		StartTime:      start,
		CompletionTime: completion,
		Duration:       tektonDuration(start, completion),
		CreatedAt:      crCreatedAt(obj),
	}
}

// tektonTaskRunRef describes what a TaskRun runs: its taskRef, the task label
// the controller sets once a remote ref resolves, or an inline spec.
func tektonTaskRunRef(obj *unstructured.Unstructured) string {
	if ref, found, _ := nestedMapNoCopy(obj.Object, "spec", "taskRef"); found {
		if name, _ := ref["name"].(string); name == "" {
			if label := obj.GetLabels()[tektonTaskLabel]; label != "" {
				return label
			}
		}
		return tektonRefString(ref)
	}
	if _, found, _ := nestedMapNoCopy(obj.Object, "spec", "taskSpec"); found {
		return "(inline)"
	}
	return obj.GetLabels()[tektonTaskLabel]
}

// extractTektonSteps projects status.steps, taking each step's image from the
// resolved status.taskSpec. Before the pod starts there are no step states, so
// the steps come from the spec alone, marked pending.
func extractTektonSteps(obj *unstructured.Unstructured) []TektonStep {
	images := map[string]string{}
	specSteps, _, _ := nestedSliceNoCopy(obj.Object, "status", "taskSpec", "steps")
	for _, item := range specSteps {
		if step, ok := item.(map[string]any); ok {
			name, _ := step["name"].(string)
			image, _ := step["image"].(string)
			images[name] = image
		}
	}

	raw, found, _ := nestedSliceNoCopy(obj.Object, "status", "steps")
	if !found || len(raw) == 0 {
		out := make([]TektonStep, 0, len(specSteps))
		for _, item := range specSteps {
			if step, ok := item.(map[string]any); ok {
				name, _ := step["name"].(string)
				out = append(out, TektonStep{Name: name, Image: images[name], State: tektonStatePending})
			}
		}
		return out
	}

	out := make([]TektonStep, 0, len(raw))
	for _, item := range raw {
		s, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := s["name"].(string)
		container, _ := s["container"].(string)
		step := TektonStep{Name: name, Container: container, Image: images[name]}
		switch {
		case s["terminated"] != nil:
			term, _ := s["terminated"].(map[string]any)
			step.State = "terminated"
			step.Reason, _ = s["terminationReason"].(string)
			if step.Reason == "" {
				step.Reason, _ = term["reason"].(string)
			}
			step.ExitCode = toInt64(term["exitCode"])
			step.StartedAt, _ = term["startedAt"].(string)
			step.FinishedAt, _ = term["finishedAt"].(string)
			step.Duration = tektonDuration(step.StartedAt, step.FinishedAt)
		case s["running"] != nil:
			running, _ := s["running"].(map[string]any)
			step.State = "running"
			step.StartedAt, _ = running["startedAt"].(string)
		case s["waiting"] != nil:
			waiting, _ := s["waiting"].(map[string]any)
			step.State = "waiting"
			step.Reason, _ = waiting["reason"].(string)
			step.Message, _ = waiting["message"].(string)
		default:
			step.State = tektonStatePending
		}
		out = append(out, step)
	}
	return out
}
