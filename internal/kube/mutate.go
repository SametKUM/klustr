package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	apiresource "k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"
	"sigs.k8s.io/yaml"
)

var kindToGVR = map[string]schema.GroupVersionResource{
	"Pod":         {Group: "", Version: "v1", Resource: "pods"},
	"Service":     {Group: "", Version: "v1", Resource: "services"},
	"ConfigMap":   {Group: "", Version: "v1", Resource: "configmaps"},
	"Secret":      {Group: "", Version: "v1", Resource: "secrets"},
	"Namespace":   {Group: "", Version: "v1", Resource: "namespaces"},
	"Node":        {Group: "", Version: "v1", Resource: "nodes"},
	"Deployment":  {Group: "apps", Version: "v1", Resource: "deployments"},
	"StatefulSet": {Group: "apps", Version: "v1", Resource: "statefulsets"},
	"DaemonSet":   {Group: "apps", Version: "v1", Resource: "daemonsets"},
	"ReplicaSet":  {Group: "apps", Version: "v1", Resource: "replicasets"},

	"Job":                              {Group: "batch", Version: "v1", Resource: "jobs"},
	"CronJob":                          {Group: "batch", Version: "v1", Resource: "cronjobs"},
	"Ingress":                          {Group: "networking.k8s.io", Version: "v1", Resource: "ingresses"},
	"PersistentVolumeClaim":            {Group: "", Version: "v1", Resource: "persistentvolumeclaims"},
	"PersistentVolume":                 {Group: "", Version: "v1", Resource: "persistentvolumes"},
	"StorageClass":                     {Group: "storage.k8s.io", Version: "v1", Resource: "storageclasses"},
	"NetworkPolicy":                    {Group: "networking.k8s.io", Version: "v1", Resource: "networkpolicies"},
	"HorizontalPodAutoscaler":          {Group: "autoscaling", Version: "v2", Resource: "horizontalpodautoscalers"},
	"PodDisruptionBudget":              {Group: "policy", Version: "v1", Resource: "poddisruptionbudgets"},
	"EndpointSlice":                    {Group: "discovery.k8s.io", Version: "v1", Resource: "endpointslices"},
	"ResourceQuota":                    {Group: "", Version: "v1", Resource: "resourcequotas"},
	"LimitRange":                       {Group: "", Version: "v1", Resource: "limitranges"},
	"IngressClass":                     {Group: "networking.k8s.io", Version: "v1", Resource: "ingressclasses"},
	"PriorityClass":                    {Group: "scheduling.k8s.io", Version: "v1", Resource: "priorityclasses"},
	"RuntimeClass":                     {Group: "node.k8s.io", Version: "v1", Resource: "runtimeclasses"},
	"Lease":                            {Group: "coordination.k8s.io", Version: "v1", Resource: "leases"},
	"MutatingWebhookConfiguration":     {Group: "admissionregistration.k8s.io", Version: "v1", Resource: "mutatingwebhookconfigurations"},
	"ValidatingWebhookConfiguration":   {Group: "admissionregistration.k8s.io", Version: "v1", Resource: "validatingwebhookconfigurations"},
	"ValidatingAdmissionPolicy":        {Group: "admissionregistration.k8s.io", Version: "v1", Resource: "validatingadmissionpolicies"},
	"ValidatingAdmissionPolicyBinding": {Group: "admissionregistration.k8s.io", Version: "v1", Resource: "validatingadmissionpolicybindings"},
	"MutatingAdmissionPolicy":          {Group: "admissionregistration.k8s.io", Version: "v1", Resource: "mutatingadmissionpolicies"},
	"MutatingAdmissionPolicyBinding":   {Group: "admissionregistration.k8s.io", Version: "v1", Resource: "mutatingadmissionpolicybindings"},

	"DeviceClass":           {Group: "resource.k8s.io", Version: "v1", Resource: "deviceclasses"},
	"ResourceClaim":         {Group: "resource.k8s.io", Version: "v1", Resource: "resourceclaims"},
	"ResourceClaimTemplate": {Group: "resource.k8s.io", Version: "v1", Resource: "resourceclaimtemplates"},
	"ResourceSlice":         {Group: "resource.k8s.io", Version: "v1", Resource: "resourceslices"},

	"ServiceCIDR":           {Group: "networking.k8s.io", Version: "v1", Resource: "servicecidrs"},
	"IPAddress":             {Group: "networking.k8s.io", Version: "v1", Resource: "ipaddresses"},
	"Endpoints":             {Group: "", Version: "v1", Resource: "endpoints"},
	"ReplicationController": {Group: "", Version: "v1", Resource: "replicationcontrollers"},

	"ServiceAccount":     {Group: "", Version: "v1", Resource: "serviceaccounts"},
	"Role":               {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "roles"},
	"RoleBinding":        {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "rolebindings"},
	"ClusterRole":        {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterroles"},
	"ClusterRoleBinding": {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterrolebindings"},

	"APIService": {Group: "apiregistration.k8s.io", Version: "v1", Resource: "apiservices"},

	"CertificateSigningRequest": {Group: "certificates.k8s.io", Version: "v1", Resource: "certificatesigningrequests"},

	"CSIDriver":        {Group: "storage.k8s.io", Version: "v1", Resource: "csidrivers"},
	"CSINode":          {Group: "storage.k8s.io", Version: "v1", Resource: "csinodes"},
	"VolumeAttachment": {Group: "storage.k8s.io", Version: "v1", Resource: "volumeattachments"},

	"FlowSchema":                 {Group: "flowcontrol.apiserver.k8s.io", Version: "v1", Resource: "flowschemas"},
	"PriorityLevelConfiguration": {Group: "flowcontrol.apiserver.k8s.io", Version: "v1", Resource: "prioritylevelconfigurations"},

	"Gateway":        {Group: "gateway.networking.k8s.io", Version: "v1", Resource: "gateways"},
	"HTTPRoute":      {Group: "gateway.networking.k8s.io", Version: "v1", Resource: "httproutes"},
	"GRPCRoute":      {Group: "gateway.networking.k8s.io", Version: "v1", Resource: "grpcroutes"},
	"GatewayClass":   {Group: "gateway.networking.k8s.io", Version: "v1", Resource: "gatewayclasses"},
	"ReferenceGrant": {Group: "gateway.networking.k8s.io", Version: "v1", Resource: "referencegrants"},
}

func resourceForKind(kind string) (schema.GroupVersionResource, error) {
	gvr, ok := kindToGVR[kind]
	if !ok {
		return schema.GroupVersionResource{}, fmt.Errorf("unsupported kind: %q", kind)
	}
	return gvr, nil
}

// resolveKind looks up a Kind first in the built-in table and then in the
// per-context CRD cache. Apply/Delete/YAML paths use this so they work
// uniformly for both core and custom resources.
//
// Klustr-internal kind aliases (e.g. "FluxKustomization") are checked in
// fluxKindGVR before the CRD cache so a Delete on a Flux resource resolves
// without the caller having to know about the real CR kind ("Kustomization").
// The ResourceTable's table-prefs key for CR views also leaks through here
// as "cr:<group>/<resource>" when the bulk-delete dialog reuses that key
// as the kind label — splitting it into a GVR keeps the bulk path working.
func (m *ClientManager) resolveKind(contextName, kind string) (schema.GroupVersionResource, error) {
	if gvr, ok := kindToGVR[kind]; ok {
		return gvr, nil
	}
	if gvr, ok := fluxKindGVR[kind]; ok {
		return gvr, nil
	}
	if gvr, ok := SplitCRChangeKind(kind); ok {
		if w, ok := m.watcher(contextName); ok && w.crd != nil {
			if info, found := w.crd.LookupCRDByGVR(gvr); found {
				return info.GVR(), nil
			}
		}
	}
	if w, ok := m.watcher(contextName); ok && w.crd != nil {
		if info, found := w.crd.LookupCRDByKind(kind); found {
			return info.GVR(), nil
		}
	}
	return schema.GroupVersionResource{}, fmt.Errorf("unsupported kind: %q", kind)
}

// resolveGVK is used by Apply: the YAML carries an apiVersion that uniquely
// disambiguates which CRD (or built-in) we're targeting.
func (m *ClientManager) resolveGVK(contextName string, gvk schema.GroupVersionKind) (schema.GroupVersionResource, error) {
	if gvr, ok := kindToGVR[gvk.Kind]; ok && gvr.Group == gvk.Group {
		return schema.GroupVersionResource{Group: gvk.Group, Version: gvk.Version, Resource: gvr.Resource}, nil
	}
	if w, ok := m.watcher(contextName); ok && w.crd != nil {
		if info, found := w.crd.LookupCRDByGVK(gvk); found {
			return schema.GroupVersionResource{Group: info.Group, Version: gvk.Version, Resource: info.Resource}, nil
		}
	}
	return schema.GroupVersionResource{}, fmt.Errorf("unsupported kind: %q (apiVersion %q)", gvk.Kind, gvk.GroupVersion().String())
}

func (m *ClientManager) dynamicClient(contextName string) (dynamic.Interface, error) {
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return nil, err
	}
	return dynamic.NewForConfig(cfg)
}

func resourceFor(d dynamic.Interface, gvr schema.GroupVersionResource, namespace string) dynamic.ResourceInterface {
	if namespace == "" {
		return d.Resource(gvr)
	}
	return d.Resource(gvr).Namespace(namespace)
}

func (m *ClientManager) GetResourceYAML(ctx context.Context, contextName, kind, namespace, name string) (string, error) {
	gvr, err := m.resolveKind(contextName, kind)
	if err != nil {
		return "", err
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return "", err
	}
	obj, err := resourceFor(dyn, gvr, namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	sanitizeForYAML(obj)
	data, err := yaml.Marshal(obj.Object)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func sanitizeForYAML(obj *unstructured.Unstructured) {
	unstructured.RemoveNestedField(obj.Object, "metadata", "managedFields")
	unstructured.RemoveNestedField(obj.Object, "metadata", "creationTimestamp")
	unstructured.RemoveNestedField(obj.Object, "metadata", "generation")
	unstructured.RemoveNestedField(obj.Object, "metadata", "resourceVersion")
	unstructured.RemoveNestedField(obj.Object, "metadata", "uid")
	unstructured.RemoveNestedField(obj.Object, "metadata", "selfLink")
	unstructured.RemoveNestedField(obj.Object, "metadata", "ownerReferences")
	unstructured.RemoveNestedField(obj.Object, "status")
}

func (m *ClientManager) ApplyResourceYAML(ctx context.Context, contextName, yamlBody string) error {
	if err := m.assertWritable(contextName); err != nil {
		return err
	}
	obj := &unstructured.Unstructured{}
	if err := yaml.Unmarshal([]byte(yamlBody), &obj.Object); err != nil {
		return fmt.Errorf("invalid YAML: %w", err)
	}
	gvk := obj.GroupVersionKind()
	if gvk.Kind == "" {
		return fmt.Errorf("YAML missing kind")
	}
	gvr, err := m.resolveGVK(contextName, gvk)
	if err != nil {
		return err
	}

	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return err
	}

	data, err := yaml.YAMLToJSON([]byte(yamlBody))
	if err != nil {
		return fmt.Errorf("yaml→json: %w", err)
	}
	force := true
	_, err = resourceFor(dyn, gvr, obj.GetNamespace()).Patch(
		ctx,
		obj.GetName(),
		types.ApplyPatchType,
		data,
		metav1.PatchOptions{FieldManager: "klustr", Force: &force},
	)
	return err
}

// MutationDiff is the before/after preview shown before a YAML apply is
// committed. Before is the current live object ("" when the apply would
// create it); After is what the server predicts the object becomes. Both come
// from a server-side dry-run, so defaulting, admission and mutating webhooks
// are already reflected — the same truthfulness Helm's --dry-run gives, unlike
// a plain text diff of the user's edits.
type MutationDiff struct {
	Kind   string `json:"kind"`
	Name   string `json:"name"`
	Action string `json:"action"`
	Before string `json:"before"`
	After  string `json:"after"`
}

// DryRunApplyResourceYAML runs the same server-side apply as
// ApplyResourceYAML but with DryRun=All, returning the live object and the
// server-predicted result so the UI can diff them before the user commits.
func (m *ClientManager) DryRunApplyResourceYAML(ctx context.Context, contextName, yamlBody string) (*MutationDiff, error) {
	obj := &unstructured.Unstructured{}
	if err := yaml.Unmarshal([]byte(yamlBody), &obj.Object); err != nil {
		return nil, fmt.Errorf("invalid YAML: %w", err)
	}
	gvk := obj.GroupVersionKind()
	if gvk.Kind == "" {
		return nil, fmt.Errorf("YAML missing kind")
	}
	gvr, err := m.resolveGVK(contextName, gvk)
	if err != nil {
		return nil, err
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	data, err := yaml.YAMLToJSON([]byte(yamlBody))
	if err != nil {
		return nil, fmt.Errorf("yaml→json: %w", err)
	}

	ri := resourceFor(dyn, gvr, obj.GetNamespace())

	before := ""
	action := "create"
	if cur, err := ri.Get(ctx, obj.GetName(), metav1.GetOptions{}); err == nil {
		action = "update"
		if before, err = sanitizedYAML(cur); err != nil {
			return nil, err
		}
	} else if !apierrors.IsNotFound(err) {
		return nil, err
	}

	force := true
	predicted, err := ri.Patch(
		ctx,
		obj.GetName(),
		types.ApplyPatchType,
		data,
		metav1.PatchOptions{
			FieldManager: "klustr",
			Force:        &force,
			DryRun:       []string{metav1.DryRunAll},
		},
	)
	if err != nil {
		return nil, err
	}
	after, err := sanitizedYAML(predicted)
	if err != nil {
		return nil, err
	}
	return &MutationDiff{
		Kind:   gvk.Kind,
		Name:   obj.GetName(),
		Action: action,
		Before: before,
		After:  after,
	}, nil
}

func sanitizedYAML(obj *unstructured.Unstructured) (string, error) {
	clone := obj.DeepCopy()
	sanitizeForYAML(clone)
	data, err := yaml.Marshal(clone.Object)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (m *ClientManager) DeleteResource(ctx context.Context, contextName, kind, namespace, name string) error {
	if err := m.assertWritable(contextName); err != nil {
		return err
	}
	gvr, err := m.resolveKind(contextName, kind)
	if err != nil {
		return err
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return err
	}
	return resourceFor(dyn, gvr, namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

func (m *ClientManager) RestartWorkload(ctx context.Context, contextName, kind, namespace, name string) error {
	if err := m.assertWritable(contextName); err != nil {
		return err
	}
	gvr, err := resourceForKind(kind)
	if err != nil {
		return err
	}
	switch kind {
	case "Deployment", "StatefulSet", "DaemonSet":
	default:
		return fmt.Errorf("restart not supported for kind %q", kind)
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return err
	}
	patch := map[string]any{
		"spec": map[string]any{
			"template": map[string]any{
				"metadata": map[string]any{
					"annotations": map[string]any{
						"kubectl.kubernetes.io/restartedAt": time.Now().UTC().Format(time.RFC3339),
					},
				},
			},
		},
	}
	data, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	_, err = resourceFor(dyn, gvr, namespace).Patch(
		ctx,
		name,
		types.StrategicMergePatchType,
		data,
		metav1.PatchOptions{FieldManager: "klustr"},
	)
	return err
}

func (m *ClientManager) PatchDeploymentPaused(ctx context.Context, contextName, namespace, name string, paused bool) error {
	if err := m.assertWritable(contextName); err != nil {
		return err
	}
	cs, err := m.Clientset(contextName)
	if err != nil {
		return err
	}
	patch := map[string]any{
		"spec": map[string]any{
			"paused": paused,
		},
	}
	data, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	_, err = cs.AppsV1().Deployments(namespace).Patch(
		ctx, name, types.MergePatchType, data,
		metav1.PatchOptions{FieldManager: "klustr"},
	)
	return err
}

func (m *ClientManager) PatchHPAReplicas(ctx context.Context, contextName, namespace, name string, minReplicas, maxReplicas int32) error {
	if err := m.assertWritable(contextName); err != nil {
		return err
	}
	if maxReplicas < 1 {
		return fmt.Errorf("maxReplicas must be >= 1")
	}
	if minReplicas < 1 {
		return fmt.Errorf("minReplicas must be >= 1")
	}
	if minReplicas > maxReplicas {
		return fmt.Errorf("minReplicas (%d) cannot exceed maxReplicas (%d)", minReplicas, maxReplicas)
	}
	cs, err := m.Clientset(contextName)
	if err != nil {
		return err
	}
	patch := map[string]any{
		"spec": map[string]any{
			"minReplicas": minReplicas,
			"maxReplicas": maxReplicas,
		},
	}
	data, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	_, err = cs.AutoscalingV2().HorizontalPodAutoscalers(namespace).Patch(
		ctx, name, types.MergePatchType, data,
		metav1.PatchOptions{FieldManager: "klustr"},
	)
	return err
}

// ResizePodResources changes a running container's CPU/memory requests and
// limits in place via the pods/resize subresource (KEP-1287, beta and on by
// default since Kubernetes 1.33), so the pod keeps running instead of being
// recreated. Each field is optional; an empty string leaves that quantity
// untouched. Non-empty values are validated as resource.Quantity before any
// request is issued. Whether a container actually restarts is governed by its
// resizePolicy, not by Klustr.
func (m *ClientManager) ResizePodResources(ctx context.Context, contextName, namespace, podName, container, cpuRequest, cpuLimit, memRequest, memLimit string) error {
	if err := m.assertWritable(contextName); err != nil {
		return err
	}
	data, err := buildResizePatch(container, cpuRequest, cpuLimit, memRequest, memLimit)
	if err != nil {
		return err
	}

	cs, err := m.Clientset(contextName)
	if err != nil {
		return err
	}
	_, err = cs.CoreV1().Pods(namespace).Patch(
		ctx, podName, types.StrategicMergePatchType, data,
		metav1.PatchOptions{FieldManager: "klustr"}, "resize",
	)
	return err
}

// buildResizePatch validates the quantities and builds the strategic-merge
// patch body sent to the pods/resize subresource. An empty field is omitted so
// it stays untouched; at least one request or limit must be set.
func buildResizePatch(container, cpuRequest, cpuLimit, memRequest, memLimit string) ([]byte, error) {
	if container == "" {
		return nil, fmt.Errorf("container name is required")
	}
	requests := map[string]string{}
	limits := map[string]string{}
	add := func(dst map[string]string, key, raw string) error {
		if raw == "" {
			return nil
		}
		if _, err := apiresource.ParseQuantity(raw); err != nil {
			return fmt.Errorf("invalid quantity %q: %w", raw, err)
		}
		dst[key] = raw
		return nil
	}
	if err := add(requests, "cpu", cpuRequest); err != nil {
		return nil, err
	}
	if err := add(requests, "memory", memRequest); err != nil {
		return nil, err
	}
	if err := add(limits, "cpu", cpuLimit); err != nil {
		return nil, err
	}
	if err := add(limits, "memory", memLimit); err != nil {
		return nil, err
	}
	if len(requests) == 0 && len(limits) == 0 {
		return nil, fmt.Errorf("nothing to resize: set at least one request or limit")
	}

	resources := map[string]any{}
	if len(requests) > 0 {
		resources["requests"] = requests
	}
	if len(limits) > 0 {
		resources["limits"] = limits
	}
	patch := map[string]any{
		"spec": map[string]any{
			"containers": []any{
				map[string]any{"name": container, "resources": resources},
			},
		},
	}
	return json.Marshal(patch)
}

func (m *ClientManager) ScaleResource(ctx context.Context, contextName, kind, namespace, name string, replicas int32) error {
	if err := m.assertWritable(contextName); err != nil {
		return err
	}
	cs, err := m.Clientset(contextName)
	if err != nil {
		return err
	}
	switch kind {
	case "Deployment":
		scale, err := cs.AppsV1().Deployments(namespace).GetScale(ctx, name, metav1.GetOptions{})
		if err != nil {
			return err
		}
		scale.Spec.Replicas = replicas
		_, err = cs.AppsV1().Deployments(namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
		return err
	case "StatefulSet":
		scale, err := cs.AppsV1().StatefulSets(namespace).GetScale(ctx, name, metav1.GetOptions{})
		if err != nil {
			return err
		}
		scale.Spec.Replicas = replicas
		_, err = cs.AppsV1().StatefulSets(namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
		return err
	case "ReplicaSet":
		scale, err := cs.AppsV1().ReplicaSets(namespace).GetScale(ctx, name, metav1.GetOptions{})
		if err != nil {
			return err
		}
		scale.Spec.Replicas = replicas
		_, err = cs.AppsV1().ReplicaSets(namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
		return err
	default:
		return fmt.Errorf("scale not supported for kind %q", kind)
	}
}
