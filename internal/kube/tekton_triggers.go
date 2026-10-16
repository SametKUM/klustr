package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Tekton Triggers serves triggers.tekton.dev at v1beta1 (and v1alpha1 on
// older installs); the version is resolved from the discovered CRD like the
// pipeline kinds.
const tektonTriggersGroup = "triggers.tekton.dev"

var (
	tektonEventListenerGR         = schema.GroupResource{Group: tektonTriggersGroup, Resource: "eventlisteners"}
	tektonTriggerGR               = schema.GroupResource{Group: tektonTriggersGroup, Resource: "triggers"}
	tektonTriggerTemplateGR       = schema.GroupResource{Group: tektonTriggersGroup, Resource: "triggertemplates"}
	tektonTriggerBindingGR        = schema.GroupResource{Group: tektonTriggersGroup, Resource: "triggerbindings"}
	tektonClusterTriggerBindingGR = schema.GroupResource{Group: tektonTriggersGroup, Resource: "clustertriggerbindings"}
)

// TektonBindingRef is one binding of a trigger: a reference to a
// (Cluster)TriggerBinding, or an inline param when Value is set.
type TektonBindingRef struct {
	Ref   string `json:"ref"`
	Kind  string `json:"kind"`
	Name  string `json:"name"`
	Value string `json:"value"`
}

// TektonInterceptor is one interceptor in a trigger's chain. Ref names the
// (Cluster)Interceptor, such as "github" or "cel"; params are rendered as
// JSON text.
type TektonInterceptor struct {
	Name    string        `json:"name"`
	Ref     string        `json:"ref"`
	Kind    string        `json:"kind"`
	Webhook string        `json:"webhook"`
	Params  []TektonParam `json:"params"`
}

// TektonTriggerSpec is a trigger: the interceptors an event passes, the
// bindings that pull params out of it, and the template they fill.
type TektonTriggerSpec struct {
	Name string `json:"name"`
	// TriggerRef names a Trigger resource an EventListener entry points at
	// instead of declaring one inline.
	TriggerRef     string              `json:"triggerRef"`
	Template       string              `json:"template"`
	TemplateInline bool                `json:"templateInline"`
	Bindings       []TektonBindingRef  `json:"bindings"`
	Interceptors   []TektonInterceptor `json:"interceptors"`
	ServiceAccount string              `json:"serviceAccount"`
}

type TektonEventListenerInfo struct {
	Name           string `json:"name"`
	Namespace      string `json:"namespace"`
	Ready          string `json:"ready"`
	Status         string `json:"status"`
	Address        string `json:"address"`
	Triggers       int    `json:"triggers"`
	ServiceAccount string `json:"serviceAccount"`
	CreatedAt      string `json:"createdAt"`
}

type TektonEventListenerDetail struct {
	TektonEventListenerInfo
	TriggerList       []TektonTriggerSpec `json:"triggerList"`
	TriggerGroups     []string            `json:"triggerGroups"`
	NamespaceSelector []string            `json:"namespaceSelector"`
	LabelSelector     map[string]string   `json:"labelSelector"`
	// GeneratedName is the Deployment and Service the controller runs the
	// listener as.
	GeneratedName string            `json:"generatedName"`
	ServiceType   string            `json:"serviceType"`
	ServicePort   int64             `json:"servicePort"`
	Replicas      int64             `json:"replicas"`
	Conditions    []ConditionDetail `json:"conditions"`
}

type TektonTriggerInfo struct {
	Name         string   `json:"name"`
	Namespace    string   `json:"namespace"`
	Template     string   `json:"template"`
	Bindings     int      `json:"bindings"`
	Interceptors []string `json:"interceptors"`
	CreatedAt    string   `json:"createdAt"`
}

type TektonTriggerDetail struct {
	TektonTriggerInfo
	Spec TektonTriggerSpec `json:"spec"`
	// EventListeners are the cached listeners whose entries reference this
	// Trigger.
	EventListeners []string `json:"eventListeners"`
}

// TektonTemplateResource is one resource a TriggerTemplate creates.
type TektonTemplateResource struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Name       string `json:"name"`
	// Namespace is the template's own metadata.namespace, possibly a
	// $(tt.params...) placeholder. Empty means Triggers creates the resource
	// in the EventListener's namespace, where the refs below also resolve.
	Namespace string `json:"namespace"`
	// PipelineRef or TaskRef is the Pipeline or Task a templated run starts.
	PipelineRef string `json:"pipelineRef"`
	TaskRef     string `json:"taskRef"`
}

type TektonTriggerTemplateInfo struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Params    int      `json:"params"`
	Creates   []string `json:"creates"`
	CreatedAt string   `json:"createdAt"`
}

type TektonTriggerTemplateDetail struct {
	TektonTriggerTemplateInfo
	ParamSpecs []TektonParamSpec        `json:"paramSpecs"`
	Resources  []TektonTemplateResource `json:"resources"`
}

type TektonTriggerBindingInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Params    int    `json:"params"`
	CreatedAt string `json:"createdAt"`
}

type TektonTriggerBindingDetail struct {
	TektonTriggerBindingInfo
	ParamList []TektonParam `json:"paramList"`
}

func (m *ClientManager) ListTektonEventListeners(contextName, namespace string) []TektonEventListenerInfo {
	return listServedRows(m, contextName, tektonEventListenerGR, namespace, extractTektonEventListener,
		func(r TektonEventListenerInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetTektonEventListener(ctx context.Context, contextName, namespace, name string) (*TektonEventListenerDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, tektonEventListenerGR, namespace, name)
	if err != nil {
		return nil, err
	}
	spec := tektonSpec(obj)
	d := &TektonEventListenerDetail{
		TektonEventListenerInfo: extractTektonEventListener(obj),
		TriggerList:             []TektonTriggerSpec{},
		TriggerGroups:           []string{},
		NamespaceSelector:       stringsAt(nestedMap(spec, "namespaceSelector"), "matchNames"),
		LabelSelector:           map[string]string{},
		Conditions:              crConditions(obj),
	}
	triggers, _, _ := nestedSliceNoCopy(spec, "triggers")
	for _, item := range triggers {
		if t, ok := item.(map[string]any); ok {
			d.TriggerList = append(d.TriggerList, extractTektonTriggerSpec(t))
		}
	}
	groups, _, _ := nestedSliceNoCopy(spec, "triggerGroups")
	for _, item := range groups {
		g, _ := item.(map[string]any)
		if n, _ := g["name"].(string); n != "" {
			d.TriggerGroups = append(d.TriggerGroups, n)
		}
	}
	if sel, ok := nestedMap(spec, "labelSelector")["matchLabels"].(map[string]any); ok {
		for k, v := range sel {
			d.LabelSelector[k] = fmt.Sprint(v)
		}
	}
	d.GeneratedName, _, _ = unstructured.NestedString(obj.Object, "status", "configuration", "generatedName")
	kr := nestedMap(nestedMap(spec, "resources"), "kubernetesResource")
	d.ServiceType, _ = kr["serviceType"].(string)
	d.ServicePort = toInt64(kr["servicePort"])
	d.Replicas = toInt64(kr["replicas"])
	return d, nil
}

func nestedMap(m map[string]any, key string) map[string]any {
	v, _ := m[key].(map[string]any)
	return v
}

func extractTektonEventListener(obj *unstructured.Unstructured) TektonEventListenerInfo {
	ready, status := readyCondition(crConditions(obj))
	address, _, _ := unstructured.NestedString(obj.Object, "status", "address", "url")
	spec := tektonSpec(obj)
	sa, _ := spec["serviceAccountName"].(string)
	return TektonEventListenerInfo{
		Name: obj.GetName(), Namespace: obj.GetNamespace(), Ready: ready, Status: status, Address: address,
		Triggers: tektonSliceLen(spec, "triggers"), ServiceAccount: sa, CreatedAt: crCreatedAt(obj),
	}
}

func extractTektonTriggerSpec(t map[string]any) TektonTriggerSpec {
	out := TektonTriggerSpec{Bindings: []TektonBindingRef{}, Interceptors: []TektonInterceptor{}}
	out.Name, _ = t["name"].(string)
	out.TriggerRef, _ = t["triggerRef"].(string)
	out.ServiceAccount, _ = t["serviceAccountName"].(string)
	if tmpl, ok := t["template"].(map[string]any); ok {
		// "name" is the pre-v0.10 spelling of ref.
		out.Template, _ = tmpl["ref"].(string)
		if out.Template == "" {
			out.Template, _ = tmpl["name"].(string)
		}
		_, out.TemplateInline = tmpl["spec"]
	}
	bindings, _ := t["bindings"].([]any)
	for _, item := range bindings {
		b, _ := item.(map[string]any)
		ref := TektonBindingRef{}
		ref.Ref, _ = b["ref"].(string)
		ref.Kind, _ = b["kind"].(string)
		ref.Name, _ = b["name"].(string)
		ref.Value, _ = b["value"].(string)
		if ref.Ref != "" && ref.Kind == "" {
			ref.Kind = "TriggerBinding"
		}
		out.Bindings = append(out.Bindings, ref)
	}
	interceptors, _ := t["interceptors"].([]any)
	for _, item := range interceptors {
		ic, _ := item.(map[string]any)
		in := TektonInterceptor{Params: []TektonParam{}}
		in.Name, _ = ic["name"].(string)
		if ref, ok := ic["ref"].(map[string]any); ok {
			in.Ref, _ = ref["name"].(string)
			in.Kind, _ = ref["kind"].(string)
		}
		if wh, ok := ic["webhook"].(map[string]any); ok {
			if obj, ok := wh["objectRef"].(map[string]any); ok {
				in.Webhook, _ = obj["name"].(string)
			}
			if in.Webhook == "" {
				in.Webhook, _ = wh["url"].(string)
			}
		}
		// Older listeners spell interceptors as {github: {...}} or {cel: {...}}.
		for _, legacy := range []string{"github", "gitlab", "bitbucket", "cel"} {
			if body, ok := ic[legacy].(map[string]any); ok && in.Ref == "" {
				in.Ref = legacy
				for k, v := range body {
					in.Params = append(in.Params, TektonParam{Name: k, Value: tektonJSONText(v)})
				}
			}
		}
		params, _ := ic["params"].([]any)
		for _, p := range params {
			pm, _ := p.(map[string]any)
			name, _ := pm["name"].(string)
			in.Params = append(in.Params, TektonParam{Name: name, Value: tektonJSONText(pm["value"])})
		}
		sort.SliceStable(in.Params, func(i, j int) bool { return in.Params[i].Name < in.Params[j].Name })
		out.Interceptors = append(out.Interceptors, in)
	}
	return out
}

// tektonJSONText renders an interceptor param value: a string as is,
// anything else as JSON.
func tektonJSONText(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprint(v)
	}
	return string(data)
}

func (m *ClientManager) ListTektonTriggers(contextName, namespace string) []TektonTriggerInfo {
	return listServedRows(m, contextName, tektonTriggerGR, namespace, extractTektonTrigger,
		func(r TektonTriggerInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetTektonTrigger(ctx context.Context, contextName, namespace, name string) (*TektonTriggerDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, tektonTriggerGR, namespace, name)
	if err != nil {
		return nil, err
	}
	d := &TektonTriggerDetail{
		TektonTriggerInfo: extractTektonTrigger(obj),
		Spec:              extractTektonTriggerSpec(tektonSpec(obj)),
		EventListeners:    []string{},
	}
	for _, el := range m.listServedCRs(contextName, tektonEventListenerGR, namespace) {
		triggers, _, _ := nestedSliceNoCopy(el.Object, "spec", "triggers")
		for _, item := range triggers {
			t, _ := item.(map[string]any)
			if ref, _ := t["triggerRef"].(string); ref == name {
				d.EventListeners = append(d.EventListeners, el.GetName())
				break
			}
		}
	}
	sort.Strings(d.EventListeners)
	return d, nil
}

func extractTektonTrigger(obj *unstructured.Unstructured) TektonTriggerInfo {
	spec := extractTektonTriggerSpec(tektonSpec(obj))
	interceptors := make([]string, 0, len(spec.Interceptors))
	for _, in := range spec.Interceptors {
		label := in.Ref
		if label == "" {
			label = in.Name
		}
		if label == "" && in.Webhook != "" {
			label = "webhook"
		}
		interceptors = append(interceptors, label)
	}
	return TektonTriggerInfo{
		Name: obj.GetName(), Namespace: obj.GetNamespace(), Template: spec.Template,
		Bindings: len(spec.Bindings), Interceptors: interceptors, CreatedAt: crCreatedAt(obj),
	}
}

func (m *ClientManager) ListTektonTriggerTemplates(contextName, namespace string) []TektonTriggerTemplateInfo {
	return listServedRows(m, contextName, tektonTriggerTemplateGR, namespace, extractTektonTriggerTemplate,
		func(r TektonTriggerTemplateInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetTektonTriggerTemplate(ctx context.Context, contextName, namespace, name string) (*TektonTriggerTemplateDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, tektonTriggerTemplateGR, namespace, name)
	if err != nil {
		return nil, err
	}
	return &TektonTriggerTemplateDetail{
		TektonTriggerTemplateInfo: extractTektonTriggerTemplate(obj),
		ParamSpecs:                extractTektonParamSpecs(tektonSpec(obj)),
		Resources:                 tektonTemplateResources(obj),
	}, nil
}

func tektonTemplateResources(obj *unstructured.Unstructured) []TektonTemplateResource {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "resourcetemplates")
	out := make([]TektonTemplateResource, 0, len(raw))
	for _, item := range raw {
		r, _ := item.(map[string]any)
		res := TektonTemplateResource{}
		res.APIVersion, _ = r["apiVersion"].(string)
		res.Kind, _ = r["kind"].(string)
		meta := nestedMap(r, "metadata")
		res.Name, _ = meta["name"].(string)
		res.Namespace, _ = meta["namespace"].(string)
		if res.Name == "" {
			if gen, _ := meta["generateName"].(string); gen != "" {
				res.Name = gen + "…"
			}
		}
		spec := nestedMap(r, "spec")
		res.PipelineRef, _ = nestedMap(spec, "pipelineRef")["name"].(string)
		res.TaskRef, _ = nestedMap(spec, "taskRef")["name"].(string)
		out = append(out, res)
	}
	return out
}

func extractTektonTriggerTemplate(obj *unstructured.Unstructured) TektonTriggerTemplateInfo {
	creates := []string{}
	seen := map[string]bool{}
	for _, r := range tektonTemplateResources(obj) {
		if r.Kind != "" && !seen[r.Kind] {
			seen[r.Kind] = true
			creates = append(creates, r.Kind)
		}
	}
	return TektonTriggerTemplateInfo{
		Name: obj.GetName(), Namespace: obj.GetNamespace(), Params: tektonSliceLen(tektonSpec(obj), "params"),
		Creates: creates, CreatedAt: crCreatedAt(obj),
	}
}

func (m *ClientManager) ListTektonTriggerBindings(contextName, namespace string) []TektonTriggerBindingInfo {
	return listServedRows(m, contextName, tektonTriggerBindingGR, namespace, extractTektonTriggerBinding,
		func(r TektonTriggerBindingInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetTektonTriggerBinding(ctx context.Context, contextName, namespace, name string) (*TektonTriggerBindingDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, tektonTriggerBindingGR, namespace, name)
	if err != nil {
		return nil, err
	}
	return &TektonTriggerBindingDetail{TektonTriggerBindingInfo: extractTektonTriggerBinding(obj), ParamList: extractTektonParams(obj, "spec", "params")}, nil
}

func (m *ClientManager) ListTektonClusterTriggerBindings(contextName string) []TektonTriggerBindingInfo {
	return listServedRows(m, contextName, tektonClusterTriggerBindingGR, "", extractTektonTriggerBinding,
		func(r TektonTriggerBindingInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetTektonClusterTriggerBinding(ctx context.Context, contextName, name string) (*TektonTriggerBindingDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, tektonClusterTriggerBindingGR, "", name)
	if err != nil {
		return nil, err
	}
	return &TektonTriggerBindingDetail{TektonTriggerBindingInfo: extractTektonTriggerBinding(obj), ParamList: extractTektonParams(obj, "spec", "params")}, nil
}

func extractTektonTriggerBinding(obj *unstructured.Unstructured) TektonTriggerBindingInfo {
	return TektonTriggerBindingInfo{
		Name: obj.GetName(), Namespace: obj.GetNamespace(), Params: tektonSliceLen(tektonSpec(obj), "params"),
		CreatedAt: crCreatedAt(obj),
	}
}
