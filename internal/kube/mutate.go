package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

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

	"Job":         {Group: "batch", Version: "v1", Resource: "jobs"},
	"CronJob":     {Group: "batch", Version: "v1", Resource: "cronjobs"},
	"Ingress":     {Group: "networking.k8s.io", Version: "v1", Resource: "ingresses"},
	"PersistentVolumeClaim": {Group: "", Version: "v1", Resource: "persistentvolumeclaims"},
	"PersistentVolume":      {Group: "", Version: "v1", Resource: "persistentvolumes"},
	"StorageClass":          {Group: "storage.k8s.io", Version: "v1", Resource: "storageclasses"},
	"NetworkPolicy":         {Group: "networking.k8s.io", Version: "v1", Resource: "networkpolicies"},
	"HorizontalPodAutoscaler": {Group: "autoscaling", Version: "v2", Resource: "horizontalpodautoscalers"},
	"PodDisruptionBudget":   {Group: "policy", Version: "v1", Resource: "poddisruptionbudgets"},
	"EndpointSlice":         {Group: "discovery.k8s.io", Version: "v1", Resource: "endpointslices"},
	"ResourceQuota":         {Group: "", Version: "v1", Resource: "resourcequotas"},
	"LimitRange":            {Group: "", Version: "v1", Resource: "limitranges"},
	"IngressClass":          {Group: "networking.k8s.io", Version: "v1", Resource: "ingressclasses"},
	"PriorityClass":         {Group: "scheduling.k8s.io", Version: "v1", Resource: "priorityclasses"},
	"RuntimeClass":          {Group: "node.k8s.io", Version: "v1", Resource: "runtimeclasses"},
	"Lease":                 {Group: "coordination.k8s.io", Version: "v1", Resource: "leases"},
	"MutatingWebhookConfiguration":   {Group: "admissionregistration.k8s.io", Version: "v1", Resource: "mutatingwebhookconfigurations"},
	"ValidatingWebhookConfiguration": {Group: "admissionregistration.k8s.io", Version: "v1", Resource: "validatingwebhookconfigurations"},
	"Endpoints":              {Group: "", Version: "v1", Resource: "endpoints"},
	"ReplicationController":  {Group: "", Version: "v1", Resource: "replicationcontrollers"},

	"ServiceAccount":     {Group: "", Version: "v1", Resource: "serviceaccounts"},
	"Role":               {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "roles"},
	"RoleBinding":        {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "rolebindings"},
	"ClusterRole":        {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterroles"},
	"ClusterRoleBinding": {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterrolebindings"},

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
func (m *ClientManager) resolveKind(contextName, kind string) (schema.GroupVersionResource, error) {
	if gvr, ok := kindToGVR[kind]; ok {
		return gvr, nil
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

func (m *ClientManager) DeleteResource(ctx context.Context, contextName, kind, namespace, name string) error {
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

func (m *ClientManager) ScaleResource(ctx context.Context, contextName, kind, namespace, name string, replicas int32) error {
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
