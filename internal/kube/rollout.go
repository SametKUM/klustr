package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

type WorkloadRevision struct {
	Revision    int32    `json:"revision"`
	CreatedAt   string   `json:"createdAt"`
	ChangeCause string   `json:"changeCause"`
	Active      bool     `json:"active"`
	Images      []string `json:"images"`
}

const (
	deploymentRevisionAnnotation = "deployment.kubernetes.io/revision"
	changeCauseAnnotation        = "kubernetes.io/change-cause"
	podTemplateHashLabel         = "pod-template-hash"
)

func isOwnedBy(refs []metav1.OwnerReference, kind, name string) bool {
	for _, r := range refs {
		if r.Kind == kind && r.Name == name {
			return true
		}
	}
	return false
}

// DeploymentRevisions returns the rollout history for a Deployment.
// Revisions come from owned ReplicaSets (filtered by owner reference) and
// are ordered newest-first. The currently-active revision is flagged so
// the UI can disable rollback to "self".
func (w *contextWatcher) DeploymentRevisions(namespace, name string) ([]WorkloadRevision, error) {
	d, err := w.factory.Apps().V1().Deployments().Lister().Deployments(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	rsAll, err := w.factory.Apps().V1().ReplicaSets().Lister().ReplicaSets(namespace).List(labels.Everything())
	if err != nil {
		return nil, err
	}
	currentRev := d.Annotations[deploymentRevisionAnnotation]
	out := make([]WorkloadRevision, 0, len(rsAll))
	for _, rs := range rsAll {
		if !isOwnedBy(rs.OwnerReferences, "Deployment", name) {
			continue
		}
		revStr := rs.Annotations[deploymentRevisionAnnotation]
		revInt, _ := strconv.ParseInt(revStr, 10, 32)
		images := make([]string, 0, len(rs.Spec.Template.Spec.Containers))
		for _, c := range rs.Spec.Template.Spec.Containers {
			images = append(images, c.Image)
		}
		out = append(out, WorkloadRevision{
			Revision:    int32(revInt),
			CreatedAt:   rs.CreationTimestamp.UTC().Format(time.RFC3339),
			ChangeCause: rs.Annotations[changeCauseAnnotation],
			Active:      revStr != "" && revStr == currentRev,
			Images:      images,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Revision > out[j].Revision })
	return out, nil
}

// StatefulSetRevisions returns the rollout history for a StatefulSet.
// Source of truth is the ControllerRevision API (apps/v1) — we fetch
// directly (no informer) since this is rarely-accessed data.
func (m *ClientManager) StatefulSetRevisions(ctx context.Context, contextName, namespace, name string) ([]WorkloadRevision, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return nil, err
	}
	ss, err := cs.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	revs, err := cs.AppsV1().ControllerRevisions(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	currentRev := ss.Status.CurrentRevision
	out := make([]WorkloadRevision, 0, len(revs.Items))
	for i := range revs.Items {
		r := &revs.Items[i]
		if !isOwnedBy(r.OwnerReferences, "StatefulSet", name) {
			continue
		}
		out = append(out, controllerRevisionToWorkloadRevision(r, currentRev))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Revision > out[j].Revision })
	return out, nil
}

// DaemonSetRevisions returns the rollout history for a DaemonSet,
// same pattern as StatefulSetRevisions.
func (m *ClientManager) DaemonSetRevisions(ctx context.Context, contextName, namespace, name string) ([]WorkloadRevision, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return nil, err
	}
	ds, err := cs.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	revs, err := cs.AppsV1().ControllerRevisions(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	// DaemonSet doesn't expose CurrentRevision on Status — derive from the
	// max-revision live revision (most recent + its template currently
	// running). For simplicity flag the highest revision as active.
	highest := int64(-1)
	for i := range revs.Items {
		r := &revs.Items[i]
		if !isOwnedBy(r.OwnerReferences, "DaemonSet", name) {
			continue
		}
		if r.Revision > highest {
			highest = r.Revision
		}
	}
	_ = ds // future use if we add an Active rule
	out := make([]WorkloadRevision, 0, len(revs.Items))
	for i := range revs.Items {
		r := &revs.Items[i]
		if !isOwnedBy(r.OwnerReferences, "DaemonSet", name) {
			continue
		}
		images := imagesFromControllerRevision(r.Data.Raw)
		out = append(out, WorkloadRevision{
			Revision:    int32(r.Revision),
			CreatedAt:   r.CreationTimestamp.UTC().Format(time.RFC3339),
			ChangeCause: r.Annotations[changeCauseAnnotation],
			Active:      r.Revision == highest,
			Images:      images,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Revision > out[j].Revision })
	return out, nil
}

// DeploymentRevisions on the manager forwards to the watcher.
func (m *ClientManager) DeploymentRevisions(contextName, namespace, name string) ([]WorkloadRevision, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.DeploymentRevisions(namespace, name)
}

// RollbackDeployment patches the Deployment's spec.template with the
// pod template from the target ReplicaSet (after stripping the
// controller-managed pod-template-hash label).
func (m *ClientManager) RollbackDeployment(ctx context.Context, contextName, namespace, name string, toRevision int32) error {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return err
	}
	rsList, err := cs.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return err
	}
	var target *appsv1.ReplicaSet
	for i := range rsList.Items {
		rs := &rsList.Items[i]
		if !isOwnedBy(rs.OwnerReferences, "Deployment", name) {
			continue
		}
		rev, _ := strconv.ParseInt(rs.Annotations[deploymentRevisionAnnotation], 10, 32)
		if int32(rev) == toRevision {
			target = rs
			break
		}
	}
	if target == nil {
		return fmt.Errorf("revision %d not found for deployment %s/%s", toRevision, namespace, name)
	}
	template := *target.Spec.Template.DeepCopy()
	delete(template.Labels, podTemplateHashLabel)
	patch := map[string]any{
		"spec": map[string]any{
			"template": template,
		},
		"metadata": map[string]any{
			"annotations": map[string]string{
				changeCauseAnnotation: fmt.Sprintf("rolled back to revision %d via klustr", toRevision),
			},
		},
	}
	data, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	_, err = cs.AppsV1().Deployments(namespace).Patch(ctx, name, types.StrategicMergePatchType, data, metav1.PatchOptions{FieldManager: "klustr"})
	return err
}

// RollbackStatefulSet applies the target ControllerRevision's Data as a
// strategic merge patch to the StatefulSet — same approach kubectl
// rollout undo uses.
func (m *ClientManager) RollbackStatefulSet(ctx context.Context, contextName, namespace, name string, toRevision int32) error {
	return rollbackViaControllerRevision(ctx, m, contextName, namespace, name, "StatefulSet", toRevision, func(cs *kubernetes.Clientset, data []byte) error {
		_, err := cs.AppsV1().StatefulSets(namespace).Patch(ctx, name, types.StrategicMergePatchType, data, metav1.PatchOptions{FieldManager: "klustr"})
		return err
	})
}

// RollbackDaemonSet same pattern as RollbackStatefulSet.
func (m *ClientManager) RollbackDaemonSet(ctx context.Context, contextName, namespace, name string, toRevision int32) error {
	return rollbackViaControllerRevision(ctx, m, contextName, namespace, name, "DaemonSet", toRevision, func(cs *kubernetes.Clientset, data []byte) error {
		_, err := cs.AppsV1().DaemonSets(namespace).Patch(ctx, name, types.StrategicMergePatchType, data, metav1.PatchOptions{FieldManager: "klustr"})
		return err
	})
}

func rollbackViaControllerRevision(
	ctx context.Context,
	m *ClientManager,
	contextName, namespace, name, kind string,
	toRevision int32,
	patch func(cs *kubernetes.Clientset, data []byte) error,
) error {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return err
	}
	revs, err := cs.AppsV1().ControllerRevisions(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return err
	}
	var target []byte
	for i := range revs.Items {
		r := &revs.Items[i]
		if !isOwnedBy(r.OwnerReferences, kind, name) {
			continue
		}
		if int32(r.Revision) == toRevision {
			target = r.Data.Raw
			break
		}
	}
	if target == nil {
		return fmt.Errorf("revision %d not found for %s %s/%s", toRevision, kind, namespace, name)
	}
	return patch(cs, target)
}

func controllerRevisionToWorkloadRevision(r *appsv1.ControllerRevision, currentRev string) WorkloadRevision {
	return WorkloadRevision{
		Revision:    int32(r.Revision),
		CreatedAt:   r.CreationTimestamp.UTC().Format(time.RFC3339),
		ChangeCause: r.Annotations[changeCauseAnnotation],
		Active:      r.Name == currentRev,
		Images:      imagesFromControllerRevision(r.Data.Raw),
	}
}

// WorkloadRevisionTemplate returns the pod template of one revision
// rendered as YAML so the UI can show a side-by-side diff. The diff
// editor's "current" side just asks for the active revision.
func (m *ClientManager) WorkloadRevisionTemplate(ctx context.Context, contextName, kind, namespace, name string, revision int32) (string, error) {
	switch kind {
	case "Deployment":
		return m.deploymentRevisionTemplate(ctx, contextName, namespace, name, revision)
	case "StatefulSet", "DaemonSet":
		return m.controllerRevisionTemplate(ctx, contextName, namespace, name, kind, revision)
	}
	return "", fmt.Errorf("unsupported kind %q", kind)
}

func (m *ClientManager) deploymentRevisionTemplate(ctx context.Context, contextName, namespace, name string, revision int32) (string, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return "", err
	}
	rsList, err := cs.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return "", err
	}
	for i := range rsList.Items {
		rs := &rsList.Items[i]
		if !isOwnedBy(rs.OwnerReferences, "Deployment", name) {
			continue
		}
		rev, _ := strconv.ParseInt(rs.Annotations[deploymentRevisionAnnotation], 10, 32)
		if int32(rev) != revision {
			continue
		}
		template := *rs.Spec.Template.DeepCopy()
		delete(template.Labels, podTemplateHashLabel)
		data, err := yaml.Marshal(template)
		if err != nil {
			return "", err
		}
		return string(data), nil
	}
	return "", fmt.Errorf("revision %d not found for deployment %s/%s", revision, namespace, name)
}

func (m *ClientManager) controllerRevisionTemplate(ctx context.Context, contextName, namespace, name, kind string, revision int32) (string, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return "", err
	}
	revs, err := cs.AppsV1().ControllerRevisions(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return "", err
	}
	for i := range revs.Items {
		r := &revs.Items[i]
		if !isOwnedBy(r.OwnerReferences, kind, name) {
			continue
		}
		if int32(r.Revision) != revision {
			continue
		}
		out, err := yaml.JSONToYAML(r.Data.Raw)
		if err != nil {
			return "", err
		}
		return string(out), nil
	}
	return "", fmt.Errorf("revision %d not found for %s %s/%s", revision, kind, namespace, name)
}

// imagesFromControllerRevision pulls container images out of a
// ControllerRevision's Data payload (which carries a partial spec for
// StatefulSet/DaemonSet — typically spec.template with containers).
func imagesFromControllerRevision(raw []byte) []string {
	if len(raw) == 0 {
		return []string{}
	}
	var blob struct {
		Spec struct {
			Template struct {
				Spec corev1.PodSpec `json:"spec"`
			} `json:"template"`
		} `json:"spec"`
	}
	if err := json.Unmarshal(raw, &blob); err != nil {
		return []string{}
	}
	out := make([]string, 0, len(blob.Spec.Template.Spec.Containers))
	for _, c := range blob.Spec.Template.Spec.Containers {
		out = append(out, c.Image)
	}
	return out
}
