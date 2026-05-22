package kube

import (
	"fmt"
	"time"

	appsv1 "k8s.io/api/apps/v1"
)

type DeploymentDetail struct {
	Name        string             `json:"name"`
	Namespace   string             `json:"namespace"`
	UID         string             `json:"uid"`
	Strategy    string             `json:"strategy"`
	Replicas    int32              `json:"replicas"`
	Ready       int32              `json:"ready"`
	Updated     int32              `json:"updated"`
	Available   int32              `json:"available"`
	Unavailable int32              `json:"unavailable"`
	Paused      bool               `json:"paused"`
	Selector    map[string]string  `json:"selector"`
	Containers  []ContainerSummary `json:"containers"`
	Conditions  []ConditionDetail  `json:"conditions"`
	Labels      map[string]string  `json:"labels"`
	Annotations map[string]string  `json:"annotations"`
	CreatedAt   string             `json:"createdAt"`
}

type StatefulSetDetail struct {
	Name                string             `json:"name"`
	Namespace           string             `json:"namespace"`
	UID                 string             `json:"uid"`
	Replicas            int32              `json:"replicas"`
	Ready               int32              `json:"ready"`
	Service             string             `json:"service"`
	UpdateStrategy      string             `json:"updateStrategy"`
	PodManagementPolicy string             `json:"podManagementPolicy"`
	Selector            map[string]string  `json:"selector"`
	Containers          []ContainerSummary `json:"containers"`
	Labels              map[string]string  `json:"labels"`
	Annotations         map[string]string  `json:"annotations"`
	CreatedAt           string             `json:"createdAt"`
}

type ReplicationControllerDetail struct {
	Name        string             `json:"name"`
	Namespace   string             `json:"namespace"`
	UID         string             `json:"uid"`
	Desired     int32              `json:"desired"`
	Current     int32              `json:"current"`
	Ready       int32              `json:"ready"`
	Available   int32              `json:"available"`
	Selector    map[string]string  `json:"selector"`
	Containers  []ContainerSummary `json:"containers"`
	Labels      map[string]string  `json:"labels"`
	Annotations map[string]string  `json:"annotations"`
	CreatedAt   string             `json:"createdAt"`
}

type ReplicaSetDetail struct {
	Name        string             `json:"name"`
	Namespace   string             `json:"namespace"`
	UID         string             `json:"uid"`
	Desired     int32              `json:"desired"`
	Current     int32              `json:"current"`
	Ready       int32              `json:"ready"`
	Available   int32              `json:"available"`
	Owners      []OwnerRef         `json:"owners"`
	Selector    map[string]string  `json:"selector"`
	Containers  []ContainerSummary `json:"containers"`
	Conditions  []ConditionDetail  `json:"conditions"`
	Labels      map[string]string  `json:"labels"`
	Annotations map[string]string  `json:"annotations"`
	CreatedAt   string             `json:"createdAt"`
}

type DaemonSetDetail struct {
	Name           string             `json:"name"`
	Namespace      string             `json:"namespace"`
	UID            string             `json:"uid"`
	Desired        int32              `json:"desired"`
	Current        int32              `json:"current"`
	Ready          int32              `json:"ready"`
	UpToDate       int32              `json:"upToDate"`
	Available      int32              `json:"available"`
	Misscheduled   int32              `json:"misscheduled"`
	NodeSelector   map[string]string  `json:"nodeSelector"`
	UpdateStrategy string             `json:"updateStrategy"`
	Selector       map[string]string  `json:"selector"`
	Containers     []ContainerSummary `json:"containers"`
	Labels         map[string]string  `json:"labels"`
	Annotations    map[string]string  `json:"annotations"`
	CreatedAt      string             `json:"createdAt"`
}

type JobDetail struct {
	Name           string             `json:"name"`
	Namespace      string             `json:"namespace"`
	UID            string             `json:"uid"`
	Completions    string             `json:"completions"`
	Parallelism    int32              `json:"parallelism"`
	BackoffLimit   int32              `json:"backoffLimit"`
	Active         int32              `json:"active"`
	Succeeded      int32              `json:"succeeded"`
	Failed         int32              `json:"failed"`
	StartTime      string             `json:"startTime"`
	CompletionTime string             `json:"completionTime"`
	Duration       string             `json:"duration"`
	Status         string             `json:"status"`
	Containers     []ContainerSummary `json:"containers"`
	Labels         map[string]string  `json:"labels"`
	Annotations    map[string]string  `json:"annotations"`
	CreatedAt      string             `json:"createdAt"`
}

type CronJobDetail struct {
	Name                       string             `json:"name"`
	Namespace                  string             `json:"namespace"`
	UID                        string             `json:"uid"`
	Schedule                   string             `json:"schedule"`
	TimeZone                   string             `json:"timeZone"`
	Suspend                    bool               `json:"suspend"`
	ConcurrencyPolicy          string             `json:"concurrencyPolicy"`
	StartingDeadlineSeconds    int64              `json:"startingDeadlineSeconds"`
	SuccessfulJobsHistoryLimit int32              `json:"successfulJobsHistoryLimit"`
	FailedJobsHistoryLimit     int32              `json:"failedJobsHistoryLimit"`
	Active                     int                `json:"active"`
	LastSchedule               string             `json:"lastSchedule"`
	Containers                 []ContainerSummary `json:"containers"`
	Labels                     map[string]string  `json:"labels"`
	Annotations                map[string]string  `json:"annotations"`
	CreatedAt                  string             `json:"createdAt"`
}

func (w *contextWatcher) Deployment(namespace, name string) (*DeploymentDetail, error) {
	f := w.factoryFor("Deployment")
	if f == nil {
		return nil, errKindNoAccess("Deployment")
	}
	d, err := f.Apps().V1().Deployments().Lister().Deployments(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	var desired int32
	if d.Spec.Replicas != nil {
		desired = *d.Spec.Replicas
	}
	strategy := string(d.Spec.Strategy.Type)
	if strategy == "" {
		strategy = string(appsv1.RollingUpdateDeploymentStrategyType)
	}
	return &DeploymentDetail{
		Name:        d.Name,
		Namespace:   d.Namespace,
		UID:         string(d.UID),
		Strategy:    strategy,
		Replicas:    desired,
		Ready:       d.Status.ReadyReplicas,
		Updated:     d.Status.UpdatedReplicas,
		Available:   d.Status.AvailableReplicas,
		Unavailable: d.Status.UnavailableReplicas,
		Paused:      d.Spec.Paused,
		Selector:    matchLabels(d.Spec.Selector),
		Containers:  containerSummaries(d.Spec.Template.Spec.Containers),
		Conditions:  deploymentConditions(d.Status.Conditions),
		Labels:      d.Labels,
		Annotations: d.Annotations,
		CreatedAt:   d.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) StatefulSet(namespace, name string) (*StatefulSetDetail, error) {
	f := w.factoryFor("StatefulSet")
	if f == nil {
		return nil, errKindNoAccess("StatefulSet")
	}
	s, err := f.Apps().V1().StatefulSets().Lister().StatefulSets(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	var desired int32
	if s.Spec.Replicas != nil {
		desired = *s.Spec.Replicas
	}
	return &StatefulSetDetail{
		Name:                s.Name,
		Namespace:           s.Namespace,
		UID:                 string(s.UID),
		Replicas:            desired,
		Ready:               s.Status.ReadyReplicas,
		Service:             s.Spec.ServiceName,
		UpdateStrategy:      string(s.Spec.UpdateStrategy.Type),
		PodManagementPolicy: string(s.Spec.PodManagementPolicy),
		Selector:            matchLabels(s.Spec.Selector),
		Containers:          containerSummaries(s.Spec.Template.Spec.Containers),
		Labels:              s.Labels,
		Annotations:         s.Annotations,
		CreatedAt:           s.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ReplicationController(namespace, name string) (*ReplicationControllerDetail, error) {
	f := w.factoryFor("ReplicationController")
	if f == nil {
		return nil, errKindNoAccess("ReplicationController")
	}
	r, err := f.Core().V1().ReplicationControllers().Lister().ReplicationControllers(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	var desired int32
	if r.Spec.Replicas != nil {
		desired = *r.Spec.Replicas
	}
	return &ReplicationControllerDetail{
		Name:        r.Name,
		Namespace:   r.Namespace,
		UID:         string(r.UID),
		Desired:     desired,
		Current:     r.Status.Replicas,
		Ready:       r.Status.ReadyReplicas,
		Available:   r.Status.AvailableReplicas,
		Selector:    r.Spec.Selector,
		Containers:  containerSummaries(r.Spec.Template.Spec.Containers),
		Labels:      r.Labels,
		Annotations: r.Annotations,
		CreatedAt:   r.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ReplicaSet(namespace, name string) (*ReplicaSetDetail, error) {
	f := w.factoryFor("ReplicaSet")
	if f == nil {
		return nil, errKindNoAccess("ReplicaSet")
	}
	r, err := f.Apps().V1().ReplicaSets().Lister().ReplicaSets(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	var desired int32
	if r.Spec.Replicas != nil {
		desired = *r.Spec.Replicas
	}
	owners := make([]OwnerRef, 0, len(r.OwnerReferences))
	for _, o := range r.OwnerReferences {
		owners = append(owners, OwnerRef{Kind: o.Kind, Name: o.Name})
	}
	conds := make([]ConditionDetail, 0, len(r.Status.Conditions))
	for _, c := range r.Status.Conditions {
		conds = append(conds, ConditionDetail{
			Type:    string(c.Type),
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}
	return &ReplicaSetDetail{
		Name:        r.Name,
		Namespace:   r.Namespace,
		UID:         string(r.UID),
		Desired:     desired,
		Current:     r.Status.Replicas,
		Ready:       r.Status.ReadyReplicas,
		Available:   r.Status.AvailableReplicas,
		Owners:      owners,
		Selector:    matchLabels(r.Spec.Selector),
		Containers:  containerSummaries(r.Spec.Template.Spec.Containers),
		Conditions:  conds,
		Labels:      r.Labels,
		Annotations: r.Annotations,
		CreatedAt:   r.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) DaemonSet(namespace, name string) (*DaemonSetDetail, error) {
	f := w.factoryFor("DaemonSet")
	if f == nil {
		return nil, errKindNoAccess("DaemonSet")
	}
	d, err := f.Apps().V1().DaemonSets().Lister().DaemonSets(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	return &DaemonSetDetail{
		Name:           d.Name,
		Namespace:      d.Namespace,
		UID:            string(d.UID),
		Desired:        d.Status.DesiredNumberScheduled,
		Current:        d.Status.CurrentNumberScheduled,
		Ready:          d.Status.NumberReady,
		UpToDate:       d.Status.UpdatedNumberScheduled,
		Available:      d.Status.NumberAvailable,
		Misscheduled:   d.Status.NumberMisscheduled,
		NodeSelector:   d.Spec.Template.Spec.NodeSelector,
		UpdateStrategy: string(d.Spec.UpdateStrategy.Type),
		Selector:       matchLabels(d.Spec.Selector),
		Containers:     containerSummaries(d.Spec.Template.Spec.Containers),
		Labels:         d.Labels,
		Annotations:    d.Annotations,
		CreatedAt:      d.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) Job(namespace, name string) (*JobDetail, error) {
	f := w.factoryFor("Job")
	if f == nil {
		return nil, errKindNoAccess("Job")
	}
	j, err := f.Batch().V1().Jobs().Lister().Jobs(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	var desired int32 = 1
	if j.Spec.Completions != nil {
		desired = *j.Spec.Completions
	}
	var parallelism int32 = 1
	if j.Spec.Parallelism != nil {
		parallelism = *j.Spec.Parallelism
	}
	var backoff int32 = 6
	if j.Spec.BackoffLimit != nil {
		backoff = *j.Spec.BackoffLimit
	}
	startTime := ""
	if j.Status.StartTime != nil {
		startTime = j.Status.StartTime.UTC().Format(time.RFC3339)
	}
	completionTime := ""
	if j.Status.CompletionTime != nil {
		completionTime = j.Status.CompletionTime.UTC().Format(time.RFC3339)
	}
	return &JobDetail{
		Name:           j.Name,
		Namespace:      j.Namespace,
		UID:            string(j.UID),
		Completions:    fmt.Sprintf("%d/%d", j.Status.Succeeded, desired),
		Parallelism:    parallelism,
		BackoffLimit:   backoff,
		Active:         j.Status.Active,
		Succeeded:      j.Status.Succeeded,
		Failed:         j.Status.Failed,
		StartTime:      startTime,
		CompletionTime: completionTime,
		Duration:       jobDuration(j),
		Status:         jobStatus(j),
		Containers:     containerSummaries(j.Spec.Template.Spec.Containers),
		Labels:         j.Labels,
		Annotations:    j.Annotations,
		CreatedAt:      j.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) CronJob(namespace, name string) (*CronJobDetail, error) {
	f := w.factoryFor("CronJob")
	if f == nil {
		return nil, errKindNoAccess("CronJob")
	}
	c, err := f.Batch().V1().CronJobs().Lister().CronJobs(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	suspend := false
	if c.Spec.Suspend != nil {
		suspend = *c.Spec.Suspend
	}
	var startingDeadline int64
	if c.Spec.StartingDeadlineSeconds != nil {
		startingDeadline = *c.Spec.StartingDeadlineSeconds
	}
	var successHistory int32 = 3
	if c.Spec.SuccessfulJobsHistoryLimit != nil {
		successHistory = *c.Spec.SuccessfulJobsHistoryLimit
	}
	var failedHistory int32 = 1
	if c.Spec.FailedJobsHistoryLimit != nil {
		failedHistory = *c.Spec.FailedJobsHistoryLimit
	}
	timeZone := ""
	if c.Spec.TimeZone != nil {
		timeZone = *c.Spec.TimeZone
	}
	last := ""
	if c.Status.LastScheduleTime != nil {
		last = c.Status.LastScheduleTime.UTC().Format(time.RFC3339)
	}
	return &CronJobDetail{
		Name:                       c.Name,
		Namespace:                  c.Namespace,
		UID:                        string(c.UID),
		Schedule:                   c.Spec.Schedule,
		TimeZone:                   timeZone,
		Suspend:                    suspend,
		ConcurrencyPolicy:          string(c.Spec.ConcurrencyPolicy),
		StartingDeadlineSeconds:    startingDeadline,
		SuccessfulJobsHistoryLimit: successHistory,
		FailedJobsHistoryLimit:     failedHistory,
		Active:                     len(c.Status.Active),
		LastSchedule:               last,
		Containers:                 containerSummaries(c.Spec.JobTemplate.Spec.Template.Spec.Containers),
		Labels:                     c.Labels,
		Annotations:                c.Annotations,
		CreatedAt:                  c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}
