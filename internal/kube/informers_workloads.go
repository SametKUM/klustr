package kube

import (
	"fmt"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
)

type DeploymentInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Ready     string `json:"ready"`
	UpToDate  int32  `json:"upToDate"`
	Available int32  `json:"available"`
	Strategy  string `json:"strategy"`
	Images    string `json:"images"`
	Paused    bool   `json:"paused"`
	CreatedAt string `json:"createdAt"`
}

type StatefulSetInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Ready     string `json:"ready"`
	Service   string `json:"service"`
	Images    string `json:"images"`
	CreatedAt string `json:"createdAt"`
}

type DaemonSetInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Desired      int32  `json:"desired"`
	Current      int32  `json:"current"`
	Ready        int32  `json:"ready"`
	UpToDate     int32  `json:"upToDate"`
	Available    int32  `json:"available"`
	NodeSelector string `json:"nodeSelector"`
	CreatedAt    string `json:"createdAt"`
}

type ReplicaSetInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Desired   int32  `json:"desired"`
	Current   int32  `json:"current"`
	Ready     int32  `json:"ready"`
	OwnedBy   string `json:"ownedBy"`
	Images    string `json:"images"`
	CreatedAt string `json:"createdAt"`
}

type ReplicationControllerInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Desired   int32  `json:"desired"`
	Current   int32  `json:"current"`
	Ready     int32  `json:"ready"`
	Images    string `json:"images"`
	CreatedAt string `json:"createdAt"`
}

type JobInfo struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	Completions string `json:"completions"`
	Duration    string `json:"duration"`
	Status      string `json:"status"`
	CreatedAt   string `json:"createdAt"`
}

type CronJobInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Schedule     string `json:"schedule"`
	Suspend      bool   `json:"suspend"`
	Active       int    `json:"active"`
	LastSchedule string `json:"lastSchedule"`
	CreatedAt    string `json:"createdAt"`
}

func (w *contextWatcher) Deployments(namespace string) []DeploymentInfo {
	lister := w.factory.Apps().V1().Deployments().Lister()
	var (
		deps []*appsv1.Deployment
		err  error
	)
	if namespace == "" {
		deps, err = lister.List(labels.Everything())
	} else {
		deps, err = lister.Deployments(namespace).List(labels.Everything())
	}
	if err != nil {
		return []DeploymentInfo{}
	}
	out := make([]DeploymentInfo, 0, len(deps))
	for _, d := range deps {
		var desired int32
		if d.Spec.Replicas != nil {
			desired = *d.Spec.Replicas
		}
		strategy := string(d.Spec.Strategy.Type)
		if strategy == "" {
			strategy = string(appsv1.RollingUpdateDeploymentStrategyType)
		}
		images := make([]string, 0, len(d.Spec.Template.Spec.Containers))
		for _, c := range d.Spec.Template.Spec.Containers {
			images = append(images, c.Image)
		}
		out = append(out, DeploymentInfo{
			Name:      d.Name,
			Namespace: d.Namespace,
			Ready:     fmt.Sprintf("%d/%d", d.Status.ReadyReplicas, desired),
			UpToDate:  d.Status.UpdatedReplicas,
			Available: d.Status.AvailableReplicas,
			Strategy:  strategy,
			Images:    strings.Join(images, ", "),
			Paused:    d.Spec.Paused,
			CreatedAt: d.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) StatefulSets(namespace string) []StatefulSetInfo {
	lister := w.factory.Apps().V1().StatefulSets().Lister()
	var (
		sets []*appsv1.StatefulSet
		err  error
	)
	if namespace == "" {
		sets, err = lister.List(labels.Everything())
	} else {
		sets, err = lister.StatefulSets(namespace).List(labels.Everything())
	}
	if err != nil {
		return []StatefulSetInfo{}
	}
	out := make([]StatefulSetInfo, 0, len(sets))
	for _, s := range sets {
		var desired int32
		if s.Spec.Replicas != nil {
			desired = *s.Spec.Replicas
		}
		images := make([]string, 0, len(s.Spec.Template.Spec.Containers))
		for _, c := range s.Spec.Template.Spec.Containers {
			images = append(images, c.Image)
		}
		out = append(out, StatefulSetInfo{
			Name:      s.Name,
			Namespace: s.Namespace,
			Ready:     fmt.Sprintf("%d/%d", s.Status.ReadyReplicas, desired),
			Service:   s.Spec.ServiceName,
			Images:    strings.Join(images, ", "),
			CreatedAt: s.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) DaemonSets(namespace string) []DaemonSetInfo {
	lister := w.factory.Apps().V1().DaemonSets().Lister()
	var (
		sets []*appsv1.DaemonSet
		err  error
	)
	if namespace == "" {
		sets, err = lister.List(labels.Everything())
	} else {
		sets, err = lister.DaemonSets(namespace).List(labels.Everything())
	}
	if err != nil {
		return []DaemonSetInfo{}
	}
	out := make([]DaemonSetInfo, 0, len(sets))
	for _, d := range sets {
		out = append(out, DaemonSetInfo{
			Name:         d.Name,
			Namespace:    d.Namespace,
			Desired:      d.Status.DesiredNumberScheduled,
			Current:      d.Status.CurrentNumberScheduled,
			Ready:        d.Status.NumberReady,
			UpToDate:     d.Status.UpdatedNumberScheduled,
			Available:    d.Status.NumberAvailable,
			NodeSelector: formatNodeSelector(d.Spec.Template.Spec.NodeSelector),
			CreatedAt:    d.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) ReplicaSets(namespace string) []ReplicaSetInfo {
	lister := w.factory.Apps().V1().ReplicaSets().Lister()
	var (
		sets []*appsv1.ReplicaSet
		err  error
	)
	if namespace == "" {
		sets, err = lister.List(labels.Everything())
	} else {
		sets, err = lister.ReplicaSets(namespace).List(labels.Everything())
	}
	if err != nil {
		return []ReplicaSetInfo{}
	}
	out := make([]ReplicaSetInfo, 0, len(sets))
	for _, r := range sets {
		var desired int32
		if r.Spec.Replicas != nil {
			desired = *r.Spec.Replicas
		}
		owner := ""
		for _, o := range r.OwnerReferences {
			if o.Controller != nil && *o.Controller {
				owner = o.Kind + "/" + o.Name
				break
			}
		}
		images := make([]string, 0, len(r.Spec.Template.Spec.Containers))
		for _, c := range r.Spec.Template.Spec.Containers {
			images = append(images, c.Image)
		}
		out = append(out, ReplicaSetInfo{
			Name:      r.Name,
			Namespace: r.Namespace,
			Desired:   desired,
			Current:   r.Status.Replicas,
			Ready:     r.Status.ReadyReplicas,
			OwnedBy:   owner,
			Images:    strings.Join(images, ", "),
			CreatedAt: r.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) ReplicationControllers(namespace string) []ReplicationControllerInfo {
	lister := w.factory.Core().V1().ReplicationControllers().Lister()
	var (
		rcs []*corev1.ReplicationController
		err error
	)
	if namespace == "" {
		rcs, err = lister.List(labels.Everything())
	} else {
		rcs, err = lister.ReplicationControllers(namespace).List(labels.Everything())
	}
	if err != nil {
		return []ReplicationControllerInfo{}
	}
	out := make([]ReplicationControllerInfo, 0, len(rcs))
	for _, r := range rcs {
		var desired int32
		if r.Spec.Replicas != nil {
			desired = *r.Spec.Replicas
		}
		images := make([]string, 0, len(r.Spec.Template.Spec.Containers))
		for _, c := range r.Spec.Template.Spec.Containers {
			images = append(images, c.Image)
		}
		out = append(out, ReplicationControllerInfo{
			Name:      r.Name,
			Namespace: r.Namespace,
			Desired:   desired,
			Current:   r.Status.Replicas,
			Ready:     r.Status.ReadyReplicas,
			Images:    strings.Join(images, ", "),
			CreatedAt: r.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) Jobs(namespace string) []JobInfo {
	lister := w.factory.Batch().V1().Jobs().Lister()
	var (
		jobs []*batchv1.Job
		err  error
	)
	if namespace == "" {
		jobs, err = lister.List(labels.Everything())
	} else {
		jobs, err = lister.Jobs(namespace).List(labels.Everything())
	}
	if err != nil {
		return []JobInfo{}
	}
	out := make([]JobInfo, 0, len(jobs))
	for _, j := range jobs {
		var desired int32 = 1
		if j.Spec.Completions != nil {
			desired = *j.Spec.Completions
		}
		out = append(out, JobInfo{
			Name:        j.Name,
			Namespace:   j.Namespace,
			Completions: fmt.Sprintf("%d/%d", j.Status.Succeeded, desired),
			Duration:    jobDuration(j),
			Status:      jobStatus(j),
			CreatedAt:   j.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) CronJobs(namespace string) []CronJobInfo {
	lister := w.factory.Batch().V1().CronJobs().Lister()
	var (
		cjs []*batchv1.CronJob
		err error
	)
	if namespace == "" {
		cjs, err = lister.List(labels.Everything())
	} else {
		cjs, err = lister.CronJobs(namespace).List(labels.Everything())
	}
	if err != nil {
		return []CronJobInfo{}
	}
	out := make([]CronJobInfo, 0, len(cjs))
	for _, c := range cjs {
		suspend := false
		if c.Spec.Suspend != nil {
			suspend = *c.Spec.Suspend
		}
		last := "—"
		if c.Status.LastScheduleTime != nil {
			last = c.Status.LastScheduleTime.UTC().Format(time.RFC3339)
		}
		out = append(out, CronJobInfo{
			Name:         c.Name,
			Namespace:    c.Namespace,
			Schedule:     c.Spec.Schedule,
			Suspend:      suspend,
			Active:       len(c.Status.Active),
			LastSchedule: last,
			CreatedAt:    c.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func jobDuration(j *batchv1.Job) string {
	if j.Status.StartTime == nil {
		return ""
	}
	end := time.Now()
	if j.Status.CompletionTime != nil {
		end = j.Status.CompletionTime.Time
	}
	d := end.Sub(j.Status.StartTime.Time).Round(time.Second)
	return d.String()
}

func jobStatus(j *batchv1.Job) string {
	for _, c := range j.Status.Conditions {
		if c.Status != corev1.ConditionTrue {
			continue
		}
		switch c.Type {
		case batchv1.JobComplete:
			return "Complete"
		case batchv1.JobFailed:
			return "Failed"
		case batchv1.JobSuspended:
			return "Suspended"
		}
	}
	if j.Status.Active > 0 {
		return "Running"
	}
	return "Pending"
}
