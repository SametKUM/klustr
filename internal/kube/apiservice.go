package kube

import (
	"context"
	"fmt"
	"sort"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"
)

// APIService (apiregistration.k8s.io/v1) is the aggregation-layer registration
// for a Kubernetes API group/version. We watch it through the dynamic client
// rather than pulling in k8s.io/kube-aggregator's typed informer factory —
// that module would drag the apiserver tree along, and the data we need is
// flat enough that unstructured access is fine.

var apiSvcGVR = schema.GroupVersionResource{
	Group:    "apiregistration.k8s.io",
	Version:  "v1",
	Resource: "apiservices",
}

type APIServiceInfo struct {
	Name      string `json:"name"`
	Group     string `json:"group"`
	Version   string `json:"version"`
	Service   string `json:"service"`
	Available string `json:"available"`
	Message   string `json:"message"`
	CreatedAt string `json:"createdAt"`
}

type APIServiceDetail struct {
	Name                  string            `json:"name"`
	UID                   string            `json:"uid"`
	Group                 string            `json:"group"`
	Version               string            `json:"version"`
	Service               string            `json:"service"`
	GroupPriorityMinimum  int32             `json:"groupPriorityMinimum"`
	VersionPriority       int32             `json:"versionPriority"`
	InsecureSkipTLSVerify bool              `json:"insecureSkipTLSVerify"`
	HasCABundle           bool              `json:"hasCABundle"`
	Conditions            []ConditionDetail `json:"conditions"`
	Labels                map[string]string `json:"labels"`
	Annotations           map[string]string `json:"annotations"`
	CreatedAt             string            `json:"createdAt"`
}

func (w *contextWatcher) startAPIServiceInformer(ctx context.Context) error {
	if w.access.For("APIService").Mode != AccessCluster {
		return nil
	}
	w.apiSvcFactory = dynamicinformer.NewDynamicSharedInformerFactory(w.dyn, 0)
	informer := w.apiSvcFactory.ForResource(apiSvcGVR).Informer()
	if _, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("APIService") },
		UpdateFunc: func(any, any) { w.touch("APIService") },
		DeleteFunc: func(any) { w.touch("APIService") },
	}); err != nil {
		return err
	}
	w.apiSvcInformer = informer
	w.apiSvcFactory.Start(ctx.Done())
	go func() {
		w.apiSvcFactory.WaitForCacheSync(ctx.Done())
		w.touch("APIService")
	}()
	return nil
}

func (w *contextWatcher) APIServices() []APIServiceInfo {
	if w.apiSvcInformer == nil {
		return []APIServiceInfo{}
	}
	objs := w.apiSvcInformer.GetStore().List()
	out := make([]APIServiceInfo, 0, len(objs))
	for _, raw := range objs {
		obj, ok := raw.(*unstructured.Unstructured)
		if !ok {
			continue
		}
		out = append(out, apiServiceInfoFromUnstructured(obj))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) APIService(name string) (*APIServiceDetail, error) {
	if w.apiSvcInformer == nil {
		return nil, errKindNoAccess("APIService")
	}
	obj, exists, err := w.apiSvcInformer.GetStore().GetByKey(name)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, fmt.Errorf("apiservice %q not found", name)
	}
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return nil, fmt.Errorf("apiservice store returned unexpected type %T", obj)
	}
	return apiServiceDetailFromUnstructured(u), nil
}

func apiServiceInfoFromUnstructured(obj *unstructured.Unstructured) APIServiceInfo {
	group, _, _ := unstructured.NestedString(obj.Object, "spec", "group")
	version, _, _ := unstructured.NestedString(obj.Object, "spec", "version")
	available, message := apiServiceAvailability(obj)
	return APIServiceInfo{
		Name:      obj.GetName(),
		Group:     group,
		Version:   version,
		Service:   apiServiceServiceRef(obj),
		Available: available,
		Message:   message,
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

func apiServiceDetailFromUnstructured(obj *unstructured.Unstructured) *APIServiceDetail {
	group, _, _ := unstructured.NestedString(obj.Object, "spec", "group")
	version, _, _ := unstructured.NestedString(obj.Object, "spec", "version")
	insecure, _, _ := unstructured.NestedBool(obj.Object, "spec", "insecureSkipTLSVerify")
	caBundle, _, _ := unstructured.NestedString(obj.Object, "spec", "caBundle")
	groupPrio, _, _ := unstructured.NestedInt64(obj.Object, "spec", "groupPriorityMinimum")
	verPrio, _, _ := unstructured.NestedInt64(obj.Object, "spec", "versionPriority")

	rawConds, _, _ := unstructured.NestedSlice(obj.Object, "status", "conditions")
	conds := make([]ConditionDetail, 0, len(rawConds))
	for _, c := range rawConds {
		m, ok := c.(map[string]any)
		if !ok {
			continue
		}
		t, _ := m["type"].(string)
		s, _ := m["status"].(string)
		r, _ := m["reason"].(string)
		msg, _ := m["message"].(string)
		conds = append(conds, ConditionDetail{Type: t, Status: s, Reason: r, Message: msg})
	}

	return &APIServiceDetail{
		Name:                  obj.GetName(),
		UID:                   string(obj.GetUID()),
		Group:                 group,
		Version:               version,
		Service:               apiServiceServiceRef(obj),
		GroupPriorityMinimum:  int32(groupPrio),
		VersionPriority:       int32(verPrio),
		InsecureSkipTLSVerify: insecure,
		HasCABundle:           caBundle != "",
		Conditions:            conds,
		Labels:                obj.GetLabels(),
		Annotations:           obj.GetAnnotations(),
		CreatedAt:             obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// apiServiceServiceRef formats spec.service as "<ns>/<name>:<port>". When the
// API is served by kube-apiserver itself (no aggregator backend) the field is
// absent — return "Local" so the UI can show that explicitly.
func apiServiceServiceRef(obj *unstructured.Unstructured) string {
	ns, _, _ := unstructured.NestedString(obj.Object, "spec", "service", "namespace")
	name, _, _ := unstructured.NestedString(obj.Object, "spec", "service", "name")
	if name == "" {
		return "Local"
	}
	port, _, _ := unstructured.NestedInt64(obj.Object, "spec", "service", "port")
	if port > 0 {
		return fmt.Sprintf("%s/%s:%d", ns, name, port)
	}
	return fmt.Sprintf("%s/%s", ns, name)
}

// apiServiceAvailability reads status.conditions for the canonical "Available"
// condition. When False/Unknown, message is rendered as "Reason: message" for
// the list row so users see why an aggregated API is broken without opening
// the detail dialog.
func apiServiceAvailability(obj *unstructured.Unstructured) (status string, message string) {
	rawConds, _, _ := unstructured.NestedSlice(obj.Object, "status", "conditions")
	for _, c := range rawConds {
		m, ok := c.(map[string]any)
		if !ok {
			continue
		}
		t, _ := m["type"].(string)
		if t != "Available" {
			continue
		}
		s, _ := m["status"].(string)
		status = s
		if s == "True" {
			return status, ""
		}
		reason, _ := m["reason"].(string)
		msg, _ := m["message"].(string)
		switch {
		case reason != "" && msg != "":
			message = reason + ": " + msg
		case reason != "":
			message = reason
		default:
			message = msg
		}
		return status, message
	}
	return "Unknown", ""
}
