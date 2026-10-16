package kube

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"

	batchv1 "k8s.io/api/batch/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const kedaGroup = "keda.sh"

var (
	kedaScaledJobGR                    = schema.GroupResource{Group: kedaGroup, Resource: "scaledjobs"}
	kedaTriggerAuthenticationGR        = schema.GroupResource{Group: kedaGroup, Resource: "triggerauthentications"}
	kedaClusterTriggerAuthenticationGR = schema.GroupResource{Group: kedaGroup, Resource: "clustertriggerauthentications"}
)

// KEDA's pause annotations. paused-replicas scales the target to that count
// and holds it there; paused freezes it at the current count. When both are
// set, paused-replicas wins. paused-scale-in and paused-scale-out block one
// direction while KEDA keeps scaling the other, and set the same Paused
// condition. A ScaledJob honors only paused.
const (
	kedaPausedAnnotation         = "autoscaling.keda.sh/paused"
	kedaPausedReplicasAnnotation = "autoscaling.keda.sh/paused-replicas"
	kedaPausedScaleInAnnotation  = "autoscaling.keda.sh/paused-scale-in"
	kedaPausedScaleOutAnnotation = "autoscaling.keda.sh/paused-scale-out"
	kedaScaledJobLabel           = "scaledjob.keda.sh/name"
)

// Defaults the KEDA admission webhook and operator apply to unset fields.
const (
	kedaDefaultPollingInterval = 30
	kedaDefaultCooldownPeriod  = 300
	kedaDefaultMaxReplicas     = 100
	kedaDefaultJobHistoryLimit = 100
)

// KEDATrigger is one entry of spec.triggers.
type KEDATrigger struct {
	Type string `json:"type"`
	Name string `json:"name"`
	// Summary is the metadata that decides how many replicas the trigger asks
	// for, as the HPA view's trigger labels show it.
	Summary          string            `json:"summary"`
	Metadata         map[string]string `json:"metadata"`
	MetricType       string            `json:"metricType"`
	UseCachedMetrics bool              `json:"useCachedMetrics"`
	// AuthKind is TriggerAuthentication or ClusterTriggerAuthentication; both
	// it and AuthName are "" for a trigger without authenticationRef.
	AuthKind string `json:"authKind"`
	AuthName string `json:"authName"`
}

// KEDAMetricHealth is one entry of status.health, keyed by the metric KEDA
// registered for a trigger.
type KEDAMetricHealth struct {
	Metric   string `json:"metric"`
	Status   string `json:"status"`
	Failures int64  `json:"failures"`
}

// KEDAPauseState is what the pause annotations say. Paused is a full pause;
// it also reflects the Paused condition, which is how the operator confirms
// it, when no one-direction annotation explains that condition.
type KEDAPauseState struct {
	Paused bool `json:"paused"`
	// PausedReplicas is the paused-replicas annotation, "" when unset.
	PausedReplicas string `json:"pausedReplicas"`
	ScaleInPaused  bool   `json:"scaleInPaused"`
	ScaleOutPaused bool   `json:"scaleOutPaused"`
	// Annotated reports that a pause annotation is set, so Resume has
	// something to remove.
	Annotated bool `json:"annotated"`
}

type KEDAScaledObjectInfo struct {
	Name             string `json:"name"`
	Namespace        string `json:"namespace"`
	TargetAPIVersion string `json:"targetAPIVersion"`
	TargetKind       string `json:"targetKind"`
	TargetName       string `json:"targetName"`
	MinReplicas      int64  `json:"minReplicas"`
	MaxReplicas      int64  `json:"maxReplicas"`
	TriggerTypes     string `json:"triggerTypes"`
	Ready            string `json:"ready"`
	Active           string `json:"active"`
	Fallback         string `json:"fallback"`
	Status           string `json:"status"`
	HPAName          string `json:"hpaName"`
	KEDAPauseState
	CreatedAt string `json:"createdAt"`
}

type KEDAScaledObjectDetail struct {
	KEDAScaledObjectInfo
	EnvSourceContainer    string `json:"envSourceContainer"`
	PollingInterval       int64  `json:"pollingInterval"`
	CooldownPeriod        int64  `json:"cooldownPeriod"`
	InitialCooldownPeriod int64  `json:"initialCooldownPeriod"`
	// IdleReplicas, FallbackReplicas and OriginalReplicas are "" when unset.
	IdleReplicas             string             `json:"idleReplicas"`
	FallbackReplicas         string             `json:"fallbackReplicas"`
	FallbackFailureThreshold string             `json:"fallbackFailureThreshold"`
	FallbackBehavior         string             `json:"fallbackBehavior"`
	RestoreOriginalReplicas  bool               `json:"restoreOriginalReplicas"`
	OriginalReplicas         string             `json:"originalReplicas"`
	ScalingFormula           string             `json:"scalingFormula"`
	ScalingTarget            string             `json:"scalingTarget"`
	LastActiveTime           string             `json:"lastActiveTime"`
	Triggers                 []KEDATrigger      `json:"triggers"`
	Health                   []KEDAMetricHealth `json:"health"`
	Conditions               []ConditionDetail  `json:"conditions"`
}

type KEDAScaledJobInfo struct {
	Name            string `json:"name"`
	Namespace       string `json:"namespace"`
	MinReplicas     int64  `json:"minReplicas"`
	MaxReplicas     int64  `json:"maxReplicas"`
	ScalingStrategy string `json:"scalingStrategy"`
	TriggerTypes    string `json:"triggerTypes"`
	Ready           string `json:"ready"`
	Active          string `json:"active"`
	Status          string `json:"status"`
	KEDAPauseState
	LastActiveTime string `json:"lastActiveTime"`
	CreatedAt      string `json:"createdAt"`
}

// KEDAContainer is a container of the Job template a ScaledJob creates.
type KEDAContainer struct {
	Name  string `json:"name"`
	Image string `json:"image"`
}

type KEDAScaledJobDetail struct {
	KEDAScaledJobInfo
	PollingInterval            int64             `json:"pollingInterval"`
	SuccessfulJobsHistoryLimit int64             `json:"successfulJobsHistoryLimit"`
	FailedJobsHistoryLimit     int64             `json:"failedJobsHistoryLimit"`
	RolloutStrategy            string            `json:"rolloutStrategy"`
	MultipleScalers            string            `json:"multipleScalers"`
	EnvSourceContainer         string            `json:"envSourceContainer"`
	Parallelism                string            `json:"parallelism"`
	Completions                string            `json:"completions"`
	BackoffLimit               string            `json:"backoffLimit"`
	ActiveDeadlineSeconds      string            `json:"activeDeadlineSeconds"`
	Containers                 []KEDAContainer   `json:"containers"`
	Triggers                   []KEDATrigger     `json:"triggers"`
	Conditions                 []ConditionDetail `json:"conditions"`
}

type KEDATriggerAuthenticationInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	// Sources names where the credentials come from ("Secret", "Pod identity
	// (aws)", "HashiCorp Vault", ...).
	Sources       []string `json:"sources"`
	ScaledObjects []string `json:"scaledObjects"`
	ScaledJobs    []string `json:"scaledJobs"`
	CreatedAt     string   `json:"createdAt"`
}

// KEDAAuthParameter maps one trigger parameter to where its value comes from.
// Only references are read; a literal credential (a Vault token) is never
// copied out of the object.
type KEDAAuthParameter struct {
	Parameter string `json:"parameter"`
	// Source is "Secret", "ConfigMap", "Env", "ServiceAccount token" or the
	// external store the value is fetched from.
	Source string `json:"source"`
	// Name is the Secret, ConfigMap, env var, service account, or the path or
	// id inside the external store.
	Name string `json:"name"`
	// Key is the key in the Secret or ConfigMap, the Vault key or the AWS
	// secret key; Container is the env var's container.
	Key       string `json:"key"`
	Container string `json:"container"`
	Version   string `json:"version"`
}

// KEDAAuthProvider is a credential provider block other than plain
// references: pod identity or an external secret store.
type KEDAAuthProvider struct {
	Kind   string      `json:"kind"`
	Fields []KEDAField `json:"fields"`
}

type KEDAField struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type KEDATriggerAuthenticationDetail struct {
	KEDATriggerAuthenticationInfo
	Parameters []KEDAAuthParameter `json:"parameters"`
	Providers  []KEDAAuthProvider  `json:"providers"`
	FilePath   string              `json:"filePath"`
}

func (m *ClientManager) ListKEDAScaledObjects(contextName, namespace string) []KEDAScaledObjectInfo {
	return listServedRows(m, contextName, kedaScaledObjectGR, namespace, extractKEDAScaledObject,
		func(r KEDAScaledObjectInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetKEDAScaledObject(ctx context.Context, contextName, namespace, name string) (*KEDAScaledObjectDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, kedaScaledObjectGR, namespace, name)
	if err != nil {
		return nil, err
	}
	return extractKEDAScaledObjectDetail(obj), nil
}

func (m *ClientManager) ListKEDAScaledJobs(contextName, namespace string) []KEDAScaledJobInfo {
	return listServedRows(m, contextName, kedaScaledJobGR, namespace, extractKEDAScaledJob,
		func(r KEDAScaledJobInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetKEDAScaledJob(ctx context.Context, contextName, namespace, name string) (*KEDAScaledJobDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, kedaScaledJobGR, namespace, name)
	if err != nil {
		return nil, err
	}
	return extractKEDAScaledJobDetail(obj), nil
}

// ListKEDAScaledJobJobs returns the cached Jobs a ScaledJob created, newest
// first, matched on the label KEDA puts on each.
func (m *ClientManager) ListKEDAScaledJobJobs(contextName, namespace, name string) []JobInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []JobInfo{}
	}
	f := w.factoryFor("Job")
	if f == nil {
		return []JobInfo{}
	}
	jobs, err := f.Batch().V1().Jobs().Lister().Jobs(namespace).List(labels.SelectorFromSet(labels.Set{kedaScaledJobLabel: name}))
	if err != nil {
		return []JobInfo{}
	}
	sort.Slice(jobs, func(i, j int) bool { return newerJob(jobs[i], jobs[j]) })
	out := make([]JobInfo, 0, len(jobs))
	for _, j := range jobs {
		out = append(out, jobInfoFrom(j))
	}
	return out
}

func newerJob(a, b *batchv1.Job) bool {
	if !a.CreationTimestamp.Equal(&b.CreationTimestamp) {
		return b.CreationTimestamp.Before(&a.CreationTimestamp)
	}
	return a.Name > b.Name
}

func (m *ClientManager) ListKEDATriggerAuthentications(contextName, namespace string) []KEDATriggerAuthenticationInfo {
	return listServedRows(m, contextName, kedaTriggerAuthenticationGR, namespace,
		func(obj *unstructured.Unstructured) KEDATriggerAuthenticationInfo {
			return m.extractKEDATriggerAuthentication(contextName, obj, "TriggerAuthentication")
		},
		func(r KEDATriggerAuthenticationInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetKEDATriggerAuthentication(ctx context.Context, contextName, namespace, name string) (*KEDATriggerAuthenticationDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, kedaTriggerAuthenticationGR, namespace, name)
	if err != nil {
		return nil, err
	}
	return m.extractKEDATriggerAuthenticationDetail(contextName, obj, "TriggerAuthentication"), nil
}

func (m *ClientManager) ListKEDAClusterTriggerAuthentications(contextName string) []KEDATriggerAuthenticationInfo {
	return listServedRows(m, contextName, kedaClusterTriggerAuthenticationGR, "",
		func(obj *unstructured.Unstructured) KEDATriggerAuthenticationInfo {
			return m.extractKEDATriggerAuthentication(contextName, obj, "ClusterTriggerAuthentication")
		},
		func(r KEDATriggerAuthenticationInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetKEDAClusterTriggerAuthentication(ctx context.Context, contextName, name string) (*KEDATriggerAuthenticationDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, kedaClusterTriggerAuthenticationGR, "", name)
	if err != nil {
		return nil, err
	}
	return m.extractKEDATriggerAuthenticationDetail(contextName, obj, "ClusterTriggerAuthentication"), nil
}

// PauseKEDAScaledObject sets KEDA's pause annotation. replicas < 0 freezes the
// target at its current count; otherwise KEDA scales it to replicas first.
func (m *ClientManager) PauseKEDAScaledObject(ctx context.Context, contextName, namespace, name string, replicas int32) error {
	annotations := map[string]any{kedaPausedAnnotation: "true", kedaPausedReplicasAnnotation: nil}
	if replicas >= 0 {
		annotations = map[string]any{kedaPausedAnnotation: nil, kedaPausedReplicasAnnotation: strconv.Itoa(int(replicas))}
	}
	return m.patchKEDAAnnotations(ctx, contextName, kedaScaledObjectGR, namespace, name, annotations)
}

// ResumeKEDAScaledObject removes every pause annotation, the one-direction
// ones included, since any of them keeps the Paused condition set.
func (m *ClientManager) ResumeKEDAScaledObject(ctx context.Context, contextName, namespace, name string) error {
	return m.patchKEDAAnnotations(ctx, contextName, kedaScaledObjectGR, namespace, name, map[string]any{
		kedaPausedAnnotation:         nil,
		kedaPausedReplicasAnnotation: nil,
		kedaPausedScaleInAnnotation:  nil,
		kedaPausedScaleOutAnnotation: nil,
	})
}

// SetKEDAScaledJobPaused stops or restarts a ScaledJob creating Jobs. Jobs
// already running are left alone.
func (m *ClientManager) SetKEDAScaledJobPaused(ctx context.Context, contextName, namespace, name string, paused bool) error {
	var value any
	if paused {
		value = "true"
	}
	return m.patchKEDAAnnotations(ctx, contextName, kedaScaledJobGR, namespace, name, map[string]any{kedaPausedAnnotation: value})
}

func (m *ClientManager) patchKEDAAnnotations(ctx context.Context, contextName string, gr schema.GroupResource, namespace, name string, annotations map[string]any) error {
	patch := map[string]any{"metadata": map[string]any{"annotations": annotations}}
	if err := m.mergePatchCR(ctx, contextName, gr, namespace, name, patch); err != nil {
		return fmt.Errorf("update %s %s/%s: %w", gr.Resource, namespace, name, err)
	}
	return nil
}

// kedaPauseState reads the pause annotations the way the operator does;
// scaledObject is false for a ScaledJob, which honors only paused.
func kedaPauseState(obj *unstructured.Unstructured, conds []ConditionDetail, scaledObject bool) KEDAPauseState {
	annotations := obj.GetAnnotations()
	keys := []string{kedaPausedAnnotation}
	if scaledObject {
		keys = append(keys, kedaPausedReplicasAnnotation, kedaPausedScaleInAnnotation, kedaPausedScaleOutAnnotation)
	}
	var s KEDAPauseState
	for _, k := range keys {
		if _, ok := annotations[k]; ok {
			s.Annotated = true
		}
	}
	s.Paused = kedaBoolAnnotation(annotations, kedaPausedAnnotation)
	if scaledObject {
		if replicas, ok := annotations[kedaPausedReplicasAnnotation]; ok {
			s.Paused, s.PausedReplicas = true, replicas
		}
		s.ScaleInPaused = kedaBoolAnnotation(annotations, kedaPausedScaleInAnnotation)
		s.ScaleOutPaused = kedaBoolAnnotation(annotations, kedaPausedScaleOutAnnotation)
	}
	if !s.ScaleInPaused && !s.ScaleOutPaused && conditionStatusByType(conds, "Paused") == "True" {
		s.Paused = true
	}
	return s
}

// kedaBoolAnnotation mirrors the operator, which treats a value that does not
// parse as a bool as true.
func kedaBoolAnnotation(annotations map[string]string, key string) bool {
	v, ok := annotations[key]
	if !ok {
		return false
	}
	b, err := strconv.ParseBool(v)
	return err != nil || b
}

// kedaReadyStatus is the Ready condition's status and the message to show
// next to it: Ready's own, or Fallback's while a trigger is failing.
func kedaReadyStatus(conds []ConditionDetail) (ready, message string) {
	ready, message = readyCondition(conds)
	if fb, ok := findCondition(conds, "Fallback"); ok && fb.Status == "True" && fb.Message != "" {
		message = fb.Message
	}
	return ready, message
}

func nestedInt(obj *unstructured.Unstructured, fallback int64, fields ...string) int64 {
	v, found, _ := unstructured.NestedFieldNoCopy(obj.Object, fields...)
	if !found || v == nil {
		return fallback
	}
	return toInt64(v)
}

// nestedIntString renders an optional integer field, "" when unset.
func nestedIntString(obj map[string]any, fields ...string) string {
	v, found, _ := unstructured.NestedFieldNoCopy(obj, fields...)
	if !found || v == nil {
		return ""
	}
	return strconv.FormatInt(toInt64(v), 10)
}

// kedaTriggerTypes joins the trigger types the operator recorded, or the
// spec's before the first reconcile.
func kedaTriggerTypes(obj *unstructured.Unstructured, triggers []KEDATrigger) string {
	if s, _, _ := unstructured.NestedString(obj.Object, "status", "triggersTypes"); s != "" {
		return s
	}
	types := make([]string, 0, len(triggers))
	for _, t := range triggers {
		types = append(types, t.Type)
	}
	return strings.Join(types, ",")
}

func extractKEDATriggers(obj *unstructured.Unstructured) []KEDATrigger {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "triggers")
	out := make([]KEDATrigger, 0, len(raw))
	for _, item := range raw {
		trig, ok := item.(map[string]any)
		if !ok {
			continue
		}
		t := KEDATrigger{Metadata: map[string]string{}}
		t.Type, _ = trig["type"].(string)
		t.Name, _ = trig["name"].(string)
		t.MetricType, _ = trig["metricType"].(string)
		t.UseCachedMetrics, _ = trig["useCachedMetrics"].(bool)
		meta, _ := trig["metadata"].(map[string]any)
		for k, v := range meta {
			t.Metadata[k] = fmt.Sprint(v)
		}
		t.Summary = kedaTriggerMetaSummary(t.Type, meta)
		if ref, ok := trig["authenticationRef"].(map[string]any); ok {
			t.AuthName, _ = ref["name"].(string)
			t.AuthKind, _ = ref["kind"].(string)
			if t.AuthName != "" && t.AuthKind == "" {
				t.AuthKind = "TriggerAuthentication"
			}
		}
		out = append(out, t)
	}
	return out
}

func extractKEDAScaledObject(obj *unstructured.Unstructured) KEDAScaledObjectInfo {
	conds := crConditions(obj)
	ready, status := kedaReadyStatus(conds)
	targetKind, _, _ := unstructured.NestedString(obj.Object, "spec", "scaleTargetRef", "kind")
	if targetKind == "" {
		targetKind = "Deployment"
	}
	targetAPIVersion, _, _ := unstructured.NestedString(obj.Object, "spec", "scaleTargetRef", "apiVersion")
	if targetAPIVersion == "" {
		targetAPIVersion = "apps/v1"
	}
	targetName, _, _ := unstructured.NestedString(obj.Object, "spec", "scaleTargetRef", "name")
	hpaName, _, _ := unstructured.NestedString(obj.Object, "status", "hpaName")
	return KEDAScaledObjectInfo{
		Name:             obj.GetName(),
		Namespace:        obj.GetNamespace(),
		TargetAPIVersion: targetAPIVersion,
		TargetKind:       targetKind,
		TargetName:       targetName,
		MinReplicas:      nestedInt(obj, 0, "spec", "minReplicaCount"),
		MaxReplicas:      nestedInt(obj, kedaDefaultMaxReplicas, "spec", "maxReplicaCount"),
		TriggerTypes:     kedaTriggerTypes(obj, extractKEDATriggers(obj)),
		Ready:            ready,
		Active:           conditionStatusByType(conds, "Active"),
		Fallback:         conditionStatusByType(conds, "Fallback"),
		Status:           status,
		HPAName:          hpaName,
		KEDAPauseState:   kedaPauseState(obj, conds, true),
		CreatedAt:        crCreatedAt(obj),
	}
}

func extractKEDAScaledObjectDetail(obj *unstructured.Unstructured) *KEDAScaledObjectDetail {
	envSource, _, _ := unstructured.NestedString(obj.Object, "spec", "scaleTargetRef", "envSourceContainerName")
	fallbackBehavior, _, _ := unstructured.NestedString(obj.Object, "spec", "fallback", "behavior")
	restore, _, _ := unstructured.NestedBool(obj.Object, "spec", "advanced", "restoreToOriginalReplicaCount")
	formula, _, _ := unstructured.NestedString(obj.Object, "spec", "advanced", "scalingModifiers", "formula")
	target, _, _ := unstructured.NestedString(obj.Object, "spec", "advanced", "scalingModifiers", "target")
	lastActive, _, _ := unstructured.NestedString(obj.Object, "status", "lastActiveTime")
	d := &KEDAScaledObjectDetail{
		KEDAScaledObjectInfo:     extractKEDAScaledObject(obj),
		EnvSourceContainer:       envSource,
		PollingInterval:          nestedInt(obj, kedaDefaultPollingInterval, "spec", "pollingInterval"),
		CooldownPeriod:           nestedInt(obj, kedaDefaultCooldownPeriod, "spec", "cooldownPeriod"),
		InitialCooldownPeriod:    nestedInt(obj, 0, "spec", "initialCooldownPeriod"),
		IdleReplicas:             nestedIntString(obj.Object, "spec", "idleReplicaCount"),
		FallbackReplicas:         nestedIntString(obj.Object, "spec", "fallback", "replicas"),
		FallbackFailureThreshold: nestedIntString(obj.Object, "spec", "fallback", "failureThreshold"),
		FallbackBehavior:         fallbackBehavior,
		RestoreOriginalReplicas:  restore,
		OriginalReplicas:         nestedIntString(obj.Object, "status", "originalReplicaCount"),
		ScalingFormula:           formula,
		ScalingTarget:            target,
		LastActiveTime:           lastActive,
		Triggers:                 extractKEDATriggers(obj),
		Health:                   []KEDAMetricHealth{},
		Conditions:               crConditions(obj),
	}
	health, _, _ := nestedMapNoCopy(obj.Object, "status", "health")
	for metric, raw := range health {
		h, _ := raw.(map[string]any)
		status, _ := h["status"].(string)
		d.Health = append(d.Health, KEDAMetricHealth{Metric: metric, Status: status, Failures: toInt64(h["numberOfFailures"])})
	}
	sort.Slice(d.Health, func(i, j int) bool { return d.Health[i].Metric < d.Health[j].Metric })
	return d
}

func extractKEDAScaledJob(obj *unstructured.Unstructured) KEDAScaledJobInfo {
	conds := crConditions(obj)
	ready, status := kedaReadyStatus(conds)
	strategy, _, _ := unstructured.NestedString(obj.Object, "spec", "scalingStrategy", "strategy")
	if strategy == "" {
		strategy = "default"
	}
	lastActive, _, _ := unstructured.NestedString(obj.Object, "status", "lastActiveTime")
	return KEDAScaledJobInfo{
		Name:            obj.GetName(),
		Namespace:       obj.GetNamespace(),
		MinReplicas:     nestedInt(obj, 0, "spec", "minReplicaCount"),
		MaxReplicas:     nestedInt(obj, kedaDefaultMaxReplicas, "spec", "maxReplicaCount"),
		ScalingStrategy: strategy,
		TriggerTypes:    kedaTriggerTypes(obj, extractKEDATriggers(obj)),
		Ready:           ready,
		Active:          conditionStatusByType(conds, "Active"),
		Status:          status,
		KEDAPauseState:  kedaPauseState(obj, conds, false),
		LastActiveTime:  lastActive,
		CreatedAt:       crCreatedAt(obj),
	}
}

func extractKEDAScaledJobDetail(obj *unstructured.Unstructured) *KEDAScaledJobDetail {
	rollout, _, _ := unstructured.NestedString(obj.Object, "spec", "rollout", "strategy")
	if rollout == "" {
		// rolloutStrategy is the deprecated spelling of rollout.strategy.
		rollout, _, _ = unstructured.NestedString(obj.Object, "spec", "rolloutStrategy")
	}
	if rollout == "" {
		rollout = "default"
	}
	multiple, _, _ := unstructured.NestedString(obj.Object, "spec", "scalingStrategy", "multipleScalersCalculation")
	envSource, _, _ := unstructured.NestedString(obj.Object, "spec", "envSourceContainerName")
	jobSpec, _, _ := nestedMapNoCopy(obj.Object, "spec", "jobTargetRef")
	if jobSpec == nil {
		jobSpec = map[string]any{}
	}
	d := &KEDAScaledJobDetail{
		KEDAScaledJobInfo:          extractKEDAScaledJob(obj),
		PollingInterval:            nestedInt(obj, kedaDefaultPollingInterval, "spec", "pollingInterval"),
		SuccessfulJobsHistoryLimit: nestedInt(obj, kedaDefaultJobHistoryLimit, "spec", "successfulJobsHistoryLimit"),
		FailedJobsHistoryLimit:     nestedInt(obj, kedaDefaultJobHistoryLimit, "spec", "failedJobsHistoryLimit"),
		RolloutStrategy:            rollout,
		MultipleScalers:            multiple,
		EnvSourceContainer:         envSource,
		Parallelism:                nestedIntString(jobSpec, "parallelism"),
		Completions:                nestedIntString(jobSpec, "completions"),
		BackoffLimit:               nestedIntString(jobSpec, "backoffLimit"),
		ActiveDeadlineSeconds:      nestedIntString(jobSpec, "activeDeadlineSeconds"),
		Containers:                 []KEDAContainer{},
		Triggers:                   extractKEDATriggers(obj),
		Conditions:                 crConditions(obj),
	}
	containers, _, _ := nestedSliceNoCopy(jobSpec, "template", "spec", "containers")
	for _, item := range containers {
		c, _ := item.(map[string]any)
		name, _ := c["name"].(string)
		image, _ := c["image"].(string)
		d.Containers = append(d.Containers, KEDAContainer{Name: name, Image: image})
	}
	return d
}

func (m *ClientManager) extractKEDATriggerAuthentication(contextName string, obj *unstructured.Unstructured, kind string) KEDATriggerAuthenticationInfo {
	spec, _, _ := nestedMapNoCopy(obj.Object, "spec")
	sources := []string{}
	add := func(present bool, label string) {
		if present {
			sources = append(sources, label)
		}
	}
	has := func(key string) bool {
		v, ok := spec[key]
		if !ok || v == nil {
			return false
		}
		if s, ok := v.([]any); ok {
			return len(s) > 0
		}
		return true
	}
	add(has("secretTargetRef"), "Secret")
	add(has("configMapTargetRef"), "ConfigMap")
	add(has("env"), "Env")
	add(has("boundServiceAccountToken"), "ServiceAccount token")
	if provider, _, _ := unstructured.NestedString(obj.Object, "spec", "podIdentity", "provider"); provider != "" && provider != "none" {
		sources = append(sources, "Pod identity ("+provider+")")
	}
	add(has("filePath"), "File")
	add(has("hashiCorpVault"), "HashiCorp Vault")
	add(has("azureKeyVault"), "Azure Key Vault")
	add(has("awsSecretManager"), "AWS Secrets Manager")
	add(has("gcpSecretManager"), "GCP Secret Manager")
	add(has("oauth2"), "OAuth2")
	add(has("azureServicePrincipal"), "Azure service principal")

	scaledObjects, scaledJobs := m.kedaAuthUsers(contextName, obj, kind)
	return KEDATriggerAuthenticationInfo{
		Name:          obj.GetName(),
		Namespace:     obj.GetNamespace(),
		Sources:       sources,
		ScaledObjects: scaledObjects,
		ScaledJobs:    scaledJobs,
		CreatedAt:     crCreatedAt(obj),
	}
}

// kedaAuthUsers lists the ScaledObjects and ScaledJobs that reference an
// authentication: any cached scaler whose trigger points at it, plus the
// names the operator records in status (status lags a new reference). The
// operator records bare names even for a ClusterTriggerAuthentication, whose
// users span namespaces, so those come from the cache as
// "<namespace>/<name>"; a status name the cache cannot place stays bare.
func (m *ClientManager) kedaAuthUsers(contextName string, auth *unstructured.Unstructured, kind string) (scaledObjects, scaledJobs []string) {
	cluster := kind == "ClusterTriggerAuthentication"
	collect := func(statusKey string, gr schema.GroupResource) []string {
		seen := map[string]bool{}
		placed := map[string]bool{}
		for _, obj := range m.listServedCRs(contextName, gr, auth.GetNamespace()) {
			for _, t := range extractKEDATriggers(obj) {
				if t.AuthKind != kind || t.AuthName != auth.GetName() {
					continue
				}
				if cluster {
					seen[obj.GetNamespace()+"/"+obj.GetName()] = true
					placed[obj.GetName()] = true
				} else {
					seen[obj.GetName()] = true
				}
			}
		}
		if s, _, _ := unstructured.NestedString(auth.Object, "status", statusKey); s != "" {
			for _, name := range strings.Split(s, ",") {
				if name = strings.TrimSpace(name); name != "" && !placed[name] {
					seen[name] = true
				}
			}
		}
		out := make([]string, 0, len(seen))
		for name := range seen {
			out = append(out, name)
		}
		sort.Strings(out)
		return out
	}
	return collect("scaledobjects", kedaScaledObjectGR), collect("scaledjobs", kedaScaledJobGR)
}

func (m *ClientManager) extractKEDATriggerAuthenticationDetail(contextName string, obj *unstructured.Unstructured, kind string) *KEDATriggerAuthenticationDetail {
	filePath, _, _ := unstructured.NestedString(obj.Object, "spec", "filePath")
	d := &KEDATriggerAuthenticationDetail{
		KEDATriggerAuthenticationInfo: m.extractKEDATriggerAuthentication(contextName, obj, kind),
		Parameters:                    []KEDAAuthParameter{},
		Providers:                     []KEDAAuthProvider{},
		FilePath:                      filePath,
	}
	str := func(src map[string]any, key string) string {
		s, _ := src[key].(string)
		return s
	}
	refs := func(source string, fields ...string) {
		raw, _, _ := nestedSliceNoCopy(obj.Object, fields...)
		for _, item := range raw {
			r, _ := item.(map[string]any)
			p := KEDAAuthParameter{Parameter: str(r, "parameter"), Source: source}
			switch source {
			case "Env":
				p.Name, p.Container = str(r, "name"), str(r, "containerName")
			case "ServiceAccount token":
				p.Name = str(r, "serviceAccountName")
			default:
				p.Name, p.Key = str(r, "name"), str(r, "key")
			}
			d.Parameters = append(d.Parameters, p)
		}
	}
	refs("Secret", "spec", "secretTargetRef")
	refs("ConfigMap", "spec", "configMapTargetRef")
	refs("Env", "spec", "env")
	refs("ServiceAccount token", "spec", "boundServiceAccountToken")

	if pi, ok, _ := nestedMapNoCopy(obj.Object, "spec", "podIdentity"); ok && pi != nil {
		d.Providers = append(d.Providers, KEDAAuthProvider{Kind: "Pod identity", Fields: kedaPodIdentityFields(pi)})
	}
	if v, ok, _ := nestedMapNoCopy(obj.Object, "spec", "hashiCorpVault"); ok && v != nil {
		fields := kedaFields(v, [][2]string{{"Address", "address"}, {"Authentication", "authentication"}, {"Namespace", "namespace"}, {"Role", "role"}, {"Mount", "mount"}})
		if cred, ok := v["credential"].(map[string]any); ok {
			// credential.token is a literal Vault token: say how Vault is
			// reached, never what the token is.
			if sa := str(cred, "serviceAccountName"); sa != "" {
				fields = append(fields, KEDAField{Label: "Service account", Value: sa})
			} else if str(cred, "serviceAccount") != "" {
				fields = append(fields, KEDAField{Label: "Credential", Value: "service account token file"})
			} else if str(cred, "token") != "" {
				fields = append(fields, KEDAField{Label: "Credential", Value: "token in spec"})
			}
		}
		d.Providers = append(d.Providers, KEDAAuthProvider{Kind: "HashiCorp Vault", Fields: fields})
		for _, item := range sliceOf(v["secrets"]) {
			s, _ := item.(map[string]any)
			d.Parameters = append(d.Parameters, KEDAAuthParameter{Parameter: str(s, "parameter"), Source: "HashiCorp Vault",
				Name: str(s, "path"), Key: str(s, "key"), Version: str(s, "type")})
		}
	}
	if v, ok, _ := nestedMapNoCopy(obj.Object, "spec", "azureKeyVault"); ok && v != nil {
		fields := kedaFields(v, [][2]string{{"Vault URI", "vaultUri"}})
		fields = append(fields, kedaCredentialFields(v)...)
		d.Providers = append(d.Providers, KEDAAuthProvider{Kind: "Azure Key Vault", Fields: fields})
		for _, item := range sliceOf(v["secrets"]) {
			s, _ := item.(map[string]any)
			d.Parameters = append(d.Parameters, KEDAAuthParameter{Parameter: str(s, "parameter"), Source: "Azure Key Vault",
				Name: str(s, "name"), Version: str(s, "version")})
		}
	}
	if v, ok, _ := nestedMapNoCopy(obj.Object, "spec", "awsSecretManager"); ok && v != nil {
		fields := kedaFields(v, [][2]string{{"Region", "region"}})
		fields = append(fields, kedaCredentialFields(v)...)
		d.Providers = append(d.Providers, KEDAAuthProvider{Kind: "AWS Secrets Manager", Fields: fields})
		for _, item := range sliceOf(v["secrets"]) {
			s, _ := item.(map[string]any)
			version := str(s, "versionId")
			if version == "" {
				version = str(s, "versionStage")
			}
			d.Parameters = append(d.Parameters, KEDAAuthParameter{Parameter: str(s, "parameter"), Source: "AWS Secrets Manager",
				Name: str(s, "name"), Key: str(s, "secretKey"), Version: version})
		}
	}
	if v, ok, _ := nestedMapNoCopy(obj.Object, "spec", "gcpSecretManager"); ok && v != nil {
		d.Providers = append(d.Providers, KEDAAuthProvider{Kind: "GCP Secret Manager", Fields: kedaCredentialFields(v)})
		for _, item := range sliceOf(v["secrets"]) {
			s, _ := item.(map[string]any)
			d.Parameters = append(d.Parameters, KEDAAuthParameter{Parameter: str(s, "parameter"), Source: "GCP Secret Manager",
				Name: str(s, "id"), Version: str(s, "version")})
		}
	}
	if v, ok, _ := nestedMapNoCopy(obj.Object, "spec", "oauth2"); ok && v != nil {
		fields := kedaFields(v, [][2]string{{"Grant type", "type"}, {"Client ID", "clientId"}, {"Token URL", "tokenUrl"}})
		if scopes := sliceOf(v["scopes"]); len(scopes) > 0 {
			parts := make([]string, 0, len(scopes))
			for _, s := range scopes {
				parts = append(parts, fmt.Sprint(s))
			}
			fields = append(fields, KEDAField{Label: "Scopes", Value: strings.Join(parts, " ")})
		}
		fields = append(fields, kedaSecretRefField("Client secret", v, "clientSecret")...)
		d.Providers = append(d.Providers, KEDAAuthProvider{Kind: "OAuth2", Fields: fields})
	}
	if v, ok, _ := nestedMapNoCopy(obj.Object, "spec", "azureServicePrincipal"); ok && v != nil {
		fields := kedaFields(v, [][2]string{{"Tenant ID", "tenantId"}, {"Client ID", "clientId"}, {"Cloud", "cloud"}})
		fields = append(fields, kedaSecretRefField("Client secret", v, "clientSecret")...)
		fields = append(fields, kedaSecretRefField("Client certificate", v, "clientCertificate")...)
		d.Providers = append(d.Providers, KEDAAuthProvider{Kind: "Azure service principal", Fields: fields})
	}
	return d
}

func sliceOf(v any) []any {
	s, _ := v.([]any)
	return s
}

// kedaFields reads the listed string fields of m that are set.
func kedaFields(m map[string]any, keys [][2]string) []KEDAField {
	out := []KEDAField{}
	for _, k := range keys {
		if v, _ := m[k[1]].(string); v != "" {
			out = append(out, KEDAField{Label: k[0], Value: v})
		}
	}
	return out
}

func kedaPodIdentityFields(pi map[string]any) []KEDAField {
	return kedaFields(pi, [][2]string{
		{"Provider", "provider"}, {"Identity ID", "identityId"}, {"Tenant ID", "identityTenantId"},
		{"Role ARN", "roleArn"}, {"Identity owner", "identityOwner"},
	})
}

// kedaCredentialFields describes how an external store is reached: pod
// identity, or Secret references for each credential.
func kedaCredentialFields(store map[string]any) []KEDAField {
	out := []KEDAField{}
	if pi, ok := store["podIdentity"].(map[string]any); ok {
		for _, f := range kedaPodIdentityFields(pi) {
			out = append(out, KEDAField{Label: "Pod identity " + strings.ToLower(f.Label), Value: f.Value})
		}
	}
	creds, _ := store["credentials"].(map[string]any)
	out = append(out, kedaFields(creds, [][2]string{{"Client ID", "clientId"}, {"Tenant ID", "tenantId"}})...)
	for _, k := range [][2]string{{"Client secret", "clientSecret"}, {"Access key", "accessKey"}, {"Secret access key", "accessSecretKey"}, {"Session token", "accessToken"}} {
		out = append(out, kedaSecretRefField(k[0], creds, k[1])...)
	}
	return out
}

// kedaSecretRefField renders a valueFrom.secretKeyRef as "secret/key".
func kedaSecretRefField(label string, m map[string]any, key string) []KEDAField {
	v, _ := m[key].(map[string]any)
	ref, _, _ := nestedMapNoCopy(v, "valueFrom", "secretKeyRef")
	name, _ := ref["name"].(string)
	if name == "" {
		return nil
	}
	k, _ := ref["key"].(string)
	return []KEDAField{{Label: label, Value: "Secret " + name + "/" + k}}
}
