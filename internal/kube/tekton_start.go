package kube

import (
	"context"
	"fmt"
	"strings"
	"time"

	apiresource "k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// TektonStartParam is one param value for a new PipelineRun. Type picks the
// field that carries it: Value for a string, Values for an array, Object for
// an object.
type TektonStartParam struct {
	Name   string            `json:"name"`
	Type   string            `json:"type"`
	Value  string            `json:"value"`
	Values []string          `json:"values"`
	Object map[string]string `json:"object"`
}

// TektonStartWorkspace binds one Pipeline workspace. Kind is emptyDir,
// persistentVolumeClaim, volumeClaimTemplate, configMap or secret; Source is
// the claim, ConfigMap or Secret name, and Size and StorageClass shape a
// volumeClaimTemplate.
type TektonStartWorkspace struct {
	Name         string `json:"name"`
	Kind         string `json:"kind"`
	Source       string `json:"source"`
	SubPath      string `json:"subPath"`
	Size         string `json:"size"`
	StorageClass string `json:"storageClass"`
}

// TektonStartOptions is what the Start dialog collects for a PipelineRun.
type TektonStartOptions struct {
	Params         []TektonStartParam     `json:"params"`
	Workspaces     []TektonStartWorkspace `json:"workspaces"`
	ServiceAccount string                 `json:"serviceAccount"`
	// Timeout is a Go duration ("1h30m"); "" keeps the cluster default.
	Timeout string `json:"timeout"`
}

// StartTektonPipeline creates a PipelineRun of the named Pipeline, the way
// `tkn pipeline start` does, and returns the new run's name.
func (m *ClientManager) StartTektonPipeline(ctx context.Context, contextName, namespace, pipeline string, opts TektonStartOptions) (string, error) {
	ri, err := m.writableResource(contextName, tektonGR(tektonPipelineRunsResource), namespace)
	if err != nil {
		return "", err
	}
	gvr, err := m.requireServedGVR(contextName, tektonGR(tektonPipelineRunsResource))
	if err != nil {
		return "", err
	}
	run, err := buildTektonPipelineRun(gvr.GroupVersion().String(), namespace, pipeline, opts)
	if err != nil {
		return "", err
	}
	created, err := ri.Create(ctx, run, metav1.CreateOptions{})
	if err != nil {
		return "", fmt.Errorf("start pipeline %s/%s: %w", namespace, pipeline, err)
	}
	return created.GetName(), nil
}

// buildTektonPipelineRun renders a PipelineRun for apiVersion. v1 moved the
// service account under taskRunTemplate; v1beta1 keeps it on the spec.
func buildTektonPipelineRun(apiVersion, namespace, pipeline string, opts TektonStartOptions) (*unstructured.Unstructured, error) {
	if pipeline == "" {
		return nil, fmt.Errorf("pipeline name is required")
	}
	spec := map[string]any{"pipelineRef": map[string]any{"name": pipeline}}

	params := make([]any, 0, len(opts.Params))
	for _, p := range opts.Params {
		if p.Name == "" {
			return nil, fmt.Errorf("a param has no name")
		}
		var value any
		switch p.Type {
		case "array":
			values := make([]any, 0, len(p.Values))
			for _, v := range p.Values {
				values = append(values, v)
			}
			value = values
		case "object":
			obj := make(map[string]any, len(p.Object))
			for k, v := range p.Object {
				obj[k] = v
			}
			value = obj
		default:
			value = p.Value
		}
		params = append(params, map[string]any{"name": p.Name, "value": value})
	}
	if len(params) > 0 {
		spec["params"] = params
	}

	workspaces := make([]any, 0, len(opts.Workspaces))
	for _, w := range opts.Workspaces {
		binding, err := tektonWorkspaceBinding(w)
		if err != nil {
			return nil, err
		}
		workspaces = append(workspaces, binding)
	}
	if len(workspaces) > 0 {
		spec["workspaces"] = workspaces
	}

	if sa := strings.TrimSpace(opts.ServiceAccount); sa != "" {
		if strings.HasSuffix(apiVersion, "/v1beta1") {
			spec["serviceAccountName"] = sa
		} else {
			spec["taskRunTemplate"] = map[string]any{"serviceAccountName": sa}
		}
	}
	if t := strings.TrimSpace(opts.Timeout); t != "" {
		d, err := time.ParseDuration(t)
		if err != nil || d <= 0 {
			return nil, fmt.Errorf("invalid timeout %q", t)
		}
		spec["timeouts"] = map[string]any{"pipeline": d.String()}
	}

	run := &unstructured.Unstructured{Object: map[string]any{"spec": spec}}
	run.SetAPIVersion(apiVersion)
	run.SetKind("PipelineRun")
	run.SetNamespace(namespace)
	// tkn names runs "<pipeline>-run-<random>".
	run.SetGenerateName(pipeline + "-run-")
	run.SetLabels(map[string]string{tektonPipelineLabel: pipeline})
	return run, nil
}

func tektonWorkspaceBinding(w TektonStartWorkspace) (map[string]any, error) {
	if w.Name == "" {
		return nil, fmt.Errorf("a workspace has no name")
	}
	binding := map[string]any{"name": w.Name}
	if w.SubPath != "" {
		binding["subPath"] = w.SubPath
	}
	needSource := func(what string) error {
		if strings.TrimSpace(w.Source) == "" {
			return fmt.Errorf("workspace %s needs a %s name", w.Name, what)
		}
		return nil
	}
	switch w.Kind {
	case "emptyDir", "":
		binding["emptyDir"] = map[string]any{}
	case "persistentVolumeClaim":
		if err := needSource("PersistentVolumeClaim"); err != nil {
			return nil, err
		}
		binding["persistentVolumeClaim"] = map[string]any{"claimName": w.Source}
	case "configMap":
		if err := needSource("ConfigMap"); err != nil {
			return nil, err
		}
		binding["configMap"] = map[string]any{"name": w.Source}
	case "secret":
		if err := needSource("Secret"); err != nil {
			return nil, err
		}
		binding["secret"] = map[string]any{"secretName": w.Source}
	case "volumeClaimTemplate":
		size := strings.TrimSpace(w.Size)
		if size == "" {
			size = "1Gi"
		}
		if _, err := apiresource.ParseQuantity(size); err != nil {
			return nil, fmt.Errorf("workspace %s: invalid size %q", w.Name, size)
		}
		claimSpec := map[string]any{
			"accessModes": []any{"ReadWriteOnce"},
			"resources":   map[string]any{"requests": map[string]any{"storage": size}},
		}
		if sc := strings.TrimSpace(w.StorageClass); sc != "" {
			claimSpec["storageClassName"] = sc
		}
		binding["volumeClaimTemplate"] = map[string]any{"spec": claimSpec}
	default:
		return nil, fmt.Errorf("workspace %s: unsupported kind %q", w.Name, w.Kind)
	}
	return binding, nil
}
