package kube

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// TektonParamSpec is a declared param of a Pipeline or Task.
type TektonParamSpec struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Default     string `json:"default"`
	HasDefault  bool   `json:"hasDefault"`
	Description string `json:"description"`
}

// TektonWorkspaceSpec is a declared workspace of a Pipeline or Task.
type TektonWorkspaceSpec struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Optional    bool   `json:"optional"`
}

// TektonResultSpec is a declared result. A Pipeline result's Value is the
// expression it takes from a task result; a Task result has a Type instead.
type TektonResultSpec struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Value       string `json:"value"`
}

func extractTektonParamSpecs(spec map[string]any) []TektonParamSpec {
	raw, _, _ := nestedSliceNoCopy(spec, "params")
	out := make([]TektonParamSpec, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := m["name"].(string)
		if name == "" {
			continue
		}
		typ, _ := m["type"].(string)
		if typ == "" {
			typ = "string"
		}
		description, _ := m["description"].(string)
		def, hasDefault := m["default"]
		out = append(out, TektonParamSpec{
			Name:        name,
			Type:        typ,
			Default:     tektonValueString(def),
			HasDefault:  hasDefault,
			Description: description,
		})
	}
	return out
}

func extractTektonWorkspaceSpecs(spec map[string]any) []TektonWorkspaceSpec {
	raw, _, _ := nestedSliceNoCopy(spec, "workspaces")
	out := make([]TektonWorkspaceSpec, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := m["name"].(string)
		if name == "" {
			continue
		}
		description, _ := m["description"].(string)
		optional, _ := m["optional"].(bool)
		out = append(out, TektonWorkspaceSpec{Name: name, Description: description, Optional: optional})
	}
	return out
}

func extractTektonResultSpecs(spec map[string]any) []TektonResultSpec {
	raw, _, _ := nestedSliceNoCopy(spec, "results")
	out := make([]TektonResultSpec, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := m["name"].(string)
		if name == "" {
			continue
		}
		typ, _ := m["type"].(string)
		description, _ := m["description"].(string)
		out = append(out, TektonResultSpec{
			Name:        name,
			Type:        typ,
			Description: description,
			Value:       tektonValueString(m["value"]),
		})
	}
	return out
}

func tektonSpec(obj *unstructured.Unstructured) map[string]any {
	spec, _, _ := nestedMapNoCopy(obj.Object, "spec")
	if spec == nil {
		return map[string]any{}
	}
	return spec
}

func tektonSliceLen(spec map[string]any, field string) int {
	raw, _, _ := nestedSliceNoCopy(spec, field)
	return len(raw)
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

type TektonPipelineInfo struct {
	Name           string `json:"name"`
	Namespace      string `json:"namespace"`
	TaskCount      int    `json:"taskCount"`
	FinallyCount   int    `json:"finallyCount"`
	ParamCount     int    `json:"paramCount"`
	WorkspaceCount int    `json:"workspaceCount"`
	CreatedAt      string `json:"createdAt"`
}

// TektonPipelineTaskSpec is one declared task of a Pipeline. When counts its
// when expressions, which make the task conditional.
type TektonPipelineTaskSpec struct {
	Name        string   `json:"name"`
	DisplayName string   `json:"displayName"`
	TaskRef     string   `json:"taskRef"`
	TaskRefName string   `json:"taskRefName"`
	RunAfter    []string `json:"runAfter"`
	When        int      `json:"when"`
	Finally     bool     `json:"finally"`
}

type TektonPipelineDetail struct {
	TektonPipelineInfo
	DisplayName   string                   `json:"displayName"`
	Description   string                   `json:"description"`
	Params        []TektonParamSpec        `json:"params"`
	Workspaces    []TektonWorkspaceSpec    `json:"workspaces"`
	Results       []TektonResultSpec       `json:"results"`
	PipelineTasks []TektonPipelineTaskSpec `json:"pipelineTasks"`
}

func (m *ClientManager) ListTektonPipelines(contextName, namespace string) []TektonPipelineInfo {
	gvr, ok := m.tektonGVR(contextName, tektonPipelinesResource)
	if !ok {
		return []TektonPipelineInfo{}
	}
	objs := listCachedCRs(m, contextName, gvr, namespace)
	out := make([]TektonPipelineInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractTektonPipeline(obj))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetTektonPipeline(ctx context.Context, contextName, namespace, name string) (*TektonPipelineDetail, error) {
	gvr, ok := m.tektonGVR(contextName, tektonPipelinesResource)
	if !ok {
		return nil, fmt.Errorf("%s.%s is not served by this cluster", tektonPipelinesResource, tektonGroup)
	}
	obj, err := m.crForDetail(ctx, contextName, gvr, namespace, name)
	if err != nil {
		return nil, err
	}
	spec := tektonSpec(obj)
	displayName, _ := spec["displayName"].(string)
	description, _ := spec["description"].(string)
	return &TektonPipelineDetail{
		TektonPipelineInfo: extractTektonPipeline(obj),
		DisplayName:        displayName,
		Description:        description,
		Params:             extractTektonParamSpecs(spec),
		Workspaces:         extractTektonWorkspaceSpecs(spec),
		Results:            extractTektonResultSpecs(spec),
		PipelineTasks:      extractTektonPipelineTaskSpecs(spec),
	}, nil
}

func extractTektonPipeline(obj *unstructured.Unstructured) TektonPipelineInfo {
	spec := tektonSpec(obj)
	return TektonPipelineInfo{
		Name:           obj.GetName(),
		Namespace:      obj.GetNamespace(),
		TaskCount:      tektonSliceLen(spec, "tasks"),
		FinallyCount:   tektonSliceLen(spec, "finally"),
		ParamCount:     tektonSliceLen(spec, "params"),
		WorkspaceCount: tektonSliceLen(spec, "workspaces"),
		CreatedAt:      crCreatedAt(obj),
	}
}

func extractTektonPipelineTaskSpecs(spec map[string]any) []TektonPipelineTaskSpec {
	out := []TektonPipelineTaskSpec{}
	for _, field := range []string{"tasks", "finally"} {
		raw, _, _ := nestedSliceNoCopy(spec, field)
		for _, item := range raw {
			task, ok := item.(map[string]any)
			if !ok {
				continue
			}
			name, _ := task["name"].(string)
			if name == "" {
				continue
			}
			displayName, _ := task["displayName"].(string)
			runAfter, _, _ := unstructured.NestedStringSlice(task, "runAfter")
			when, _, _ := nestedSliceNoCopy(task, "when")
			refName := ""
			if ref, ok := task["taskRef"].(map[string]any); ok {
				name, _ := ref["name"].(string)
				kind, _ := ref["kind"].(string)
				if name != "" && (kind == "" || kind == "Task") {
					refName = name
				}
			}
			out = append(out, TektonPipelineTaskSpec{
				Name:        name,
				DisplayName: displayName,
				TaskRef:     tektonPipelineTaskRef(task),
				TaskRefName: refName,
				RunAfter:    append([]string{}, runAfter...),
				When:        len(when),
				Finally:     field == "finally",
			})
		}
	}
	return out
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

type TektonTaskInfo struct {
	Name           string `json:"name"`
	Namespace      string `json:"namespace"`
	StepCount      int    `json:"stepCount"`
	ParamCount     int    `json:"paramCount"`
	ResultCount    int    `json:"resultCount"`
	WorkspaceCount int    `json:"workspaceCount"`
	CreatedAt      string `json:"createdAt"`
}

// TektonTaskStep is one declared step. Ref names the StepAction a step reuses
// instead of declaring its own image and script.
type TektonTaskStep struct {
	Name    string   `json:"name"`
	Image   string   `json:"image"`
	Ref     string   `json:"ref"`
	Script  string   `json:"script"`
	Command []string `json:"command"`
	Args    []string `json:"args"`
}

type TektonTaskDetail struct {
	TektonTaskInfo
	DisplayName string                `json:"displayName"`
	Description string                `json:"description"`
	Params      []TektonParamSpec     `json:"params"`
	Workspaces  []TektonWorkspaceSpec `json:"workspaces"`
	Results     []TektonResultSpec    `json:"results"`
	Steps       []TektonTaskStep      `json:"steps"`
	Sidecars    []string              `json:"sidecars"`
}

func (m *ClientManager) ListTektonTasks(contextName, namespace string) []TektonTaskInfo {
	gvr, ok := m.tektonGVR(contextName, tektonTasksResource)
	if !ok {
		return []TektonTaskInfo{}
	}
	objs := listCachedCRs(m, contextName, gvr, namespace)
	out := make([]TektonTaskInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractTektonTask(obj))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetTektonTask(ctx context.Context, contextName, namespace, name string) (*TektonTaskDetail, error) {
	gvr, ok := m.tektonGVR(contextName, tektonTasksResource)
	if !ok {
		return nil, fmt.Errorf("%s.%s is not served by this cluster", tektonTasksResource, tektonGroup)
	}
	obj, err := m.crForDetail(ctx, contextName, gvr, namespace, name)
	if err != nil {
		return nil, err
	}
	spec := tektonSpec(obj)
	displayName, _ := spec["displayName"].(string)
	description, _ := spec["description"].(string)
	sidecars := []string{}
	rawSidecars, _, _ := nestedSliceNoCopy(spec, "sidecars")
	for _, item := range rawSidecars {
		if sidecar, ok := item.(map[string]any); ok {
			if name, _ := sidecar["name"].(string); name != "" {
				sidecars = append(sidecars, name)
			}
		}
	}
	return &TektonTaskDetail{
		TektonTaskInfo: extractTektonTask(obj),
		DisplayName:    displayName,
		Description:    description,
		Params:         extractTektonParamSpecs(spec),
		Workspaces:     extractTektonWorkspaceSpecs(spec),
		Results:        extractTektonResultSpecs(spec),
		Steps:          extractTektonTaskSteps(spec),
		Sidecars:       sidecars,
	}, nil
}

func extractTektonTask(obj *unstructured.Unstructured) TektonTaskInfo {
	spec := tektonSpec(obj)
	return TektonTaskInfo{
		Name:           obj.GetName(),
		Namespace:      obj.GetNamespace(),
		StepCount:      tektonSliceLen(spec, "steps"),
		ParamCount:     tektonSliceLen(spec, "params"),
		ResultCount:    tektonSliceLen(spec, "results"),
		WorkspaceCount: tektonSliceLen(spec, "workspaces"),
		CreatedAt:      crCreatedAt(obj),
	}
}

func extractTektonTaskSteps(spec map[string]any) []TektonTaskStep {
	raw, _, _ := nestedSliceNoCopy(spec, "steps")
	out := make([]TektonTaskStep, 0, len(raw))
	for _, item := range raw {
		step, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := step["name"].(string)
		image, _ := step["image"].(string)
		script, _ := step["script"].(string)
		command, _, _ := unstructured.NestedStringSlice(step, "command")
		args, _, _ := unstructured.NestedStringSlice(step, "args")
		ref := ""
		if r, ok := step["ref"].(map[string]any); ok {
			ref = tektonRefString(r)
		}
		out = append(out, TektonTaskStep{
			Name:    name,
			Image:   image,
			Ref:     ref,
			Script:  script,
			Command: append([]string{}, command...),
			Args:    append([]string{}, args...),
		})
	}
	return out
}
