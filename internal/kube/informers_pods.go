package kube

import (
	"fmt"
	"sort"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
)

type PodInfo struct {
	Name         string              `json:"name"`
	Namespace    string              `json:"namespace"`
	Status       string              `json:"status"`
	Ready        string              `json:"ready"`
	Restarts     int32               `json:"restarts"`
	Node         string              `json:"node"`
	PodIP        string              `json:"podIP"`
	CreatedAt    string              `json:"createdAt"`
	CPURequestMC int64               `json:"cpuRequestMC"`
	CPULimitMC   int64               `json:"cpuLimitMC"`
	MemRequestB  int64               `json:"memRequestB"`
	MemLimitB    int64               `json:"memLimitB"`
	HasPorts     bool                `json:"hasPorts"`
	Containers   []PodContainerBrief `json:"containers"`
}

// PodContainerBrief is the per-container summary the Pods list renders as a row
// of status squares. Regular containers come first, then init containers, so a
// pod's full makeup (e.g. cilium's one agent container plus several init
// containers) is visible at a glance without opening the detail panel.
type PodContainerBrief struct {
	Name  string `json:"name"`
	Init  bool   `json:"init"`
	Tone  string `json:"tone"`  // ready | warn | error | done
	State string `json:"state"` // human-readable state for the tooltip
}

type PodLogTarget struct {
	Pod        string   `json:"pod"`
	Containers []string `json:"containers"`
}

type ContainerDetail struct {
	Name         string             `json:"name"`
	Image        string             `json:"image"`
	State        string             `json:"state"`
	StateReason  string             `json:"stateReason"`
	Ready        bool               `json:"ready"`
	RestartCount int32              `json:"restartCount"`
	StartedAt    string             `json:"startedAt"`
	LastState    string             `json:"lastState"`
	Ports        []ContainerPort    `json:"ports"`
	Env          []ContainerEnvVar  `json:"env"`
	EnvFrom      []ContainerEnvFrom `json:"envFrom"`
	// Resources is what the spec asks for; Allocated is what the kubelet has
	// actually granted (status.containerStatuses[].resources). They diverge
	// while an in-place resize is still being applied or was Deferred.
	Resources ContainerResources `json:"resources"`
	Allocated ContainerResources `json:"allocated"`
}

type ContainerResources struct {
	CPURequest string `json:"cpuRequest"`
	CPULimit   string `json:"cpuLimit"`
	MemRequest string `json:"memRequest"`
	MemLimit   string `json:"memLimit"`
}

func containerResources(rr corev1.ResourceRequirements) ContainerResources {
	return resourcesFrom(rr.Requests, rr.Limits)
}

func resourcesFrom(requests, limits corev1.ResourceList) ContainerResources {
	q := func(list corev1.ResourceList, name corev1.ResourceName) string {
		if v, ok := list[name]; ok {
			return v.String()
		}
		return ""
	}
	return ContainerResources{
		CPURequest: q(requests, corev1.ResourceCPU),
		CPULimit:   q(limits, corev1.ResourceCPU),
		MemRequest: q(requests, corev1.ResourceMemory),
		MemLimit:   q(limits, corev1.ResourceMemory),
	}
}

type ContainerPort struct {
	Name          string `json:"name"`
	ContainerPort int32  `json:"containerPort"`
	Protocol      string `json:"protocol"`
}

type ContainerEnvVar struct {
	Name      string     `json:"name"`
	Value     string     `json:"value"`
	ValueFrom string     `json:"valueFrom"`
	Ref       *EnvVarRef `json:"ref,omitempty"`
}

type ContainerEnvFrom struct {
	Source string     `json:"source"`
	Prefix string     `json:"prefix"`
	Ref    *EnvVarRef `json:"ref,omitempty"`
}

type EnvVarRef struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
	Key  string `json:"key"`
}

type PodDetail struct {
	Name              string            `json:"name"`
	Namespace         string            `json:"namespace"`
	UID               string            `json:"uid"`
	Status            string            `json:"status"`
	Phase             string            `json:"phase"`
	Node              string            `json:"node"`
	PodIP             string            `json:"podIP"`
	HostIP            string            `json:"hostIP"`
	QOSClass          string            `json:"qosClass"`
	ServiceAccount    string            `json:"serviceAccount"`
	RestartPolicy     string            `json:"restartPolicy"`
	PriorityClassName string            `json:"priorityClassName"`
	CreatedAt         string            `json:"createdAt"`
	Labels            map[string]string `json:"labels"`
	Annotations       map[string]string `json:"annotations"`
	Owners            []OwnerRef        `json:"owners"`
	InitContainers    []ContainerDetail `json:"initContainers"`
	Containers        []ContainerDetail `json:"containers"`
	Conditions        []ConditionDetail `json:"conditions"`
	// ResizeStatus reflects an in-flight in-place resize: "Proposed",
	// "InProgress", "Deferred" or "Infeasible" (empty when none is pending).
	// Read from .status.resize on older clusters and from the
	// PodResizePending / PodResizeInProgress conditions on 1.33+.
	ResizeStatus string `json:"resizeStatus"`
}

func (w *contextWatcher) Pod(namespace, name string) (*PodDetail, error) {
	f := w.factoryFor("Pod")
	if f == nil {
		return nil, errKindNoAccess("Pod")
	}
	p, err := f.Core().V1().Pods().Lister().Pods(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	owners := make([]OwnerRef, 0, len(p.OwnerReferences))
	for _, o := range p.OwnerReferences {
		owners = append(owners, OwnerRef{Kind: o.Kind, Name: o.Name})
		if o.Kind == "ReplicaSet" {
			if grandparent := w.replicaSetController(p.Namespace, o.Name); grandparent != nil {
				owners = append(owners, *grandparent)
			}
		}
	}
	return &PodDetail{
		Name:              p.Name,
		Namespace:         p.Namespace,
		UID:               string(p.UID),
		Status:            derivePodStatus(p),
		Phase:             string(p.Status.Phase),
		Node:              p.Spec.NodeName,
		PodIP:             p.Status.PodIP,
		HostIP:            p.Status.HostIP,
		QOSClass:          string(p.Status.QOSClass),
		ServiceAccount:    p.Spec.ServiceAccountName,
		RestartPolicy:     string(p.Spec.RestartPolicy),
		PriorityClassName: p.Spec.PriorityClassName,
		CreatedAt:         p.CreationTimestamp.UTC().Format(time.RFC3339),
		Labels:            p.Labels,
		Annotations:       p.Annotations,
		Owners:            owners,
		InitContainers:    w.containerDetails(p, p.Spec.InitContainers, p.Status.InitContainerStatuses),
		Containers:        w.containerDetails(p, p.Spec.Containers, p.Status.ContainerStatuses),
		Conditions:        podConditions(p.Status.Conditions),
		ResizeStatus:      podResizeStatus(p),
	}, nil
}

// podResizeStatus surfaces an in-flight in-place resize. Kubernetes ≤1.32
// exposed it as the .status.resize enum; 1.33 moved it to the
// PodResizePending / PodResizeInProgress conditions, so both are checked.
func podResizeStatus(p *corev1.Pod) string {
	if s := string(p.Status.Resize); s != "" {
		return s
	}
	for _, c := range p.Status.Conditions {
		if c.Status != corev1.ConditionTrue {
			continue
		}
		switch c.Type {
		case "PodResizeInProgress":
			return "InProgress"
		case "PodResizePending":
			if c.Reason != "" {
				return c.Reason // "Deferred" or "Infeasible"
			}
			return "Pending"
		}
	}
	return ""
}

// replicaSetController resolves the controller that owns the named ReplicaSet
// (a Deployment for the common case) so a Pod's "Controlled By" can surface the
// full Deployment → ReplicaSet → Pod chain. Returns nil when the ReplicaSet is
// not in the cache or has no controller owner.
func (w *contextWatcher) replicaSetController(namespace, name string) *OwnerRef {
	f := w.factoryFor("ReplicaSet")
	if f == nil {
		return nil
	}
	rs, err := f.Apps().V1().ReplicaSets().Lister().ReplicaSets(namespace).Get(name)
	if err != nil {
		return nil
	}
	return controllerOwnerRef(rs.OwnerReferences)
}

func (w *contextWatcher) containerDetails(pod *corev1.Pod, specs []corev1.Container, statuses []corev1.ContainerStatus) []ContainerDetail {
	byName := make(map[string]corev1.ContainerStatus, len(statuses))
	for _, s := range statuses {
		byName[s.Name] = s
	}
	out := make([]ContainerDetail, 0, len(specs))
	for i := range specs {
		c := &specs[i]
		ports := make([]ContainerPort, 0, len(c.Ports))
		for _, p := range c.Ports {
			proto := string(p.Protocol)
			if proto == "" {
				proto = "TCP"
			}
			ports = append(ports, ContainerPort{
				Name:          p.Name,
				ContainerPort: p.ContainerPort,
				Protocol:      proto,
			})
		}
		d := ContainerDetail{
			Name:      c.Name,
			Image:     c.Image,
			Ports:     ports,
			Env:       w.envVarsFrom(pod, c, c.Env),
			EnvFrom:   envFromSources(c.EnvFrom),
			Resources: containerResources(c.Resources),
		}
		if s, ok := byName[c.Name]; ok {
			d.Ready = s.Ready
			d.RestartCount = s.RestartCount
			if s.Resources != nil {
				d.Allocated = resourcesFrom(s.Resources.Requests, s.Resources.Limits)
			}
			switch {
			case s.State.Running != nil:
				d.State = "Running"
				d.StartedAt = s.State.Running.StartedAt.UTC().Format(time.RFC3339)
			case s.State.Waiting != nil:
				d.State = "Waiting"
				d.StateReason = s.State.Waiting.Reason
			case s.State.Terminated != nil:
				d.State = "Terminated"
				d.StateReason = s.State.Terminated.Reason
				if s.State.Terminated.Reason == "" {
					d.StateReason = fmt.Sprintf("ExitCode:%d", s.State.Terminated.ExitCode)
				}
				if !s.State.Terminated.FinishedAt.IsZero() {
					d.StartedAt = s.State.Terminated.StartedAt.UTC().Format(time.RFC3339)
				}
			}
			if s.LastTerminationState.Terminated != nil {
				reason := s.LastTerminationState.Terminated.Reason
				if reason == "" {
					reason = fmt.Sprintf("ExitCode:%d", s.LastTerminationState.Terminated.ExitCode)
				}
				d.LastState = reason
			}
		}
		out = append(out, d)
	}
	return out
}

func (w *contextWatcher) envVarsFrom(pod *corev1.Pod, container *corev1.Container, env []corev1.EnvVar) []ContainerEnvVar {
	if len(env) == 0 {
		return []ContainerEnvVar{}
	}
	out := make([]ContainerEnvVar, 0, len(env))
	for _, e := range env {
		if w.optionalEnvKeyAbsent(pod.Namespace, e.ValueFrom) {
			continue
		}
		v := ContainerEnvVar{Name: e.Name}
		if e.ValueFrom != nil {
			v.ValueFrom, v.Ref = describeEnvVarSource(e.ValueFrom)
			if e.ValueFrom.FieldRef != nil {
				v.Value = resolveFieldRef(pod, e.ValueFrom.FieldRef.FieldPath)
			} else if e.ValueFrom.ResourceFieldRef != nil {
				v.Value = resolveResourceFieldRef(container, e.ValueFrom.ResourceFieldRef)
			}
		} else {
			v.Value = e.Value
		}
		out = append(out, v)
	}
	return out
}

// optionalEnvKeyAbsent reports whether an env var sourced from an optional
// ConfigMap/Secret key references a key we can positively confirm is missing.
// Kubernetes never sets such a var on the container, so listing it (and the
// "key not found" error the frontend would render) is pure noise. We only
// suppress when the backing object is readable from cache and the key is truly
// absent — when access is denied or the object is uncached we keep the row so
// nothing that may actually be set vanishes silently. Required (non-optional)
// missing keys are a real CreateContainerConfigError and stay visible.
func (w *contextWatcher) optionalEnvKeyAbsent(namespace string, src *corev1.EnvVarSource) bool {
	if src == nil {
		return false
	}
	if ref := src.ConfigMapKeyRef; ref != nil && ref.Optional != nil && *ref.Optional {
		return w.configMapKeyConfirmedAbsent(namespace, ref.Name, ref.Key)
	}
	if ref := src.SecretKeyRef; ref != nil && ref.Optional != nil && *ref.Optional {
		return w.secretKeyConfirmedAbsent(namespace, ref.Name, ref.Key)
	}
	return false
}

func (w *contextWatcher) configMapKeyConfirmedAbsent(namespace, name, key string) bool {
	f := w.factoryFor("ConfigMap")
	if f == nil {
		return false
	}
	cm, err := f.Core().V1().ConfigMaps().Lister().ConfigMaps(namespace).Get(name)
	if err != nil {
		return false
	}
	if _, ok := cm.Data[key]; ok {
		return false
	}
	_, ok := cm.BinaryData[key]
	return !ok
}

func (w *contextWatcher) secretKeyConfirmedAbsent(namespace, name, key string) bool {
	f := w.factoryFor("Secret")
	if f == nil {
		return false
	}
	s, err := f.Core().V1().Secrets().Lister().Secrets(namespace).Get(name)
	if err != nil {
		return false
	}
	_, ok := s.Data[key]
	return !ok
}

func describeEnvVarSource(src *corev1.EnvVarSource) (string, *EnvVarRef) {
	switch {
	case src.ConfigMapKeyRef != nil:
		return fmt.Sprintf("ConfigMap: %s/%s", src.ConfigMapKeyRef.Name, src.ConfigMapKeyRef.Key),
			&EnvVarRef{Kind: "ConfigMap", Name: src.ConfigMapKeyRef.Name, Key: src.ConfigMapKeyRef.Key}
	case src.SecretKeyRef != nil:
		return fmt.Sprintf("Secret: %s/%s", src.SecretKeyRef.Name, src.SecretKeyRef.Key),
			&EnvVarRef{Kind: "Secret", Name: src.SecretKeyRef.Name, Key: src.SecretKeyRef.Key}
	case src.FieldRef != nil:
		return "field: " + src.FieldRef.FieldPath, nil
	case src.ResourceFieldRef != nil:
		return "resource: " + src.ResourceFieldRef.Resource, nil
	}
	return "", nil
}

func resolveFieldRef(pod *corev1.Pod, fieldPath string) string {
	if pod == nil {
		return ""
	}
	switch fieldPath {
	case "metadata.name":
		return pod.Name
	case "metadata.namespace":
		return pod.Namespace
	case "metadata.uid":
		return string(pod.UID)
	case "spec.nodeName":
		return pod.Spec.NodeName
	case "spec.serviceAccountName":
		return pod.Spec.ServiceAccountName
	case "status.hostIP":
		return pod.Status.HostIP
	case "status.podIP":
		return pod.Status.PodIP
	case "status.phase":
		return string(pod.Status.Phase)
	}
	return ""
}

func resolveResourceFieldRef(container *corev1.Container, src *corev1.ResourceFieldSelector) string {
	if container == nil {
		return ""
	}
	get := func(rl corev1.ResourceList, name corev1.ResourceName) (string, bool) {
		if q, ok := rl[name]; ok {
			return q.String(), true
		}
		return "", false
	}
	switch src.Resource {
	case "limits.cpu":
		if v, ok := get(container.Resources.Limits, corev1.ResourceCPU); ok {
			return v
		}
	case "limits.memory":
		if v, ok := get(container.Resources.Limits, corev1.ResourceMemory); ok {
			return v
		}
	case "limits.ephemeral-storage":
		if v, ok := get(container.Resources.Limits, corev1.ResourceEphemeralStorage); ok {
			return v
		}
	case "requests.cpu":
		if v, ok := get(container.Resources.Requests, corev1.ResourceCPU); ok {
			return v
		}
	case "requests.memory":
		if v, ok := get(container.Resources.Requests, corev1.ResourceMemory); ok {
			return v
		}
	case "requests.ephemeral-storage":
		if v, ok := get(container.Resources.Requests, corev1.ResourceEphemeralStorage); ok {
			return v
		}
	}
	return ""
}

func envFromSources(sources []corev1.EnvFromSource) []ContainerEnvFrom {
	if len(sources) == 0 {
		return []ContainerEnvFrom{}
	}
	out := make([]ContainerEnvFrom, 0, len(sources))
	for _, s := range sources {
		entry := ContainerEnvFrom{Prefix: s.Prefix}
		switch {
		case s.ConfigMapRef != nil:
			entry.Source = "ConfigMap: " + s.ConfigMapRef.Name
			entry.Ref = &EnvVarRef{Kind: "ConfigMap", Name: s.ConfigMapRef.Name}
		case s.SecretRef != nil:
			entry.Source = "Secret: " + s.SecretRef.Name
			entry.Ref = &EnvVarRef{Kind: "Secret", Name: s.SecretRef.Name}
		default:
			continue
		}
		out = append(out, entry)
	}
	return out
}

func podConditions(conds []corev1.PodCondition) []ConditionDetail {
	out := make([]ConditionDetail, 0, len(conds))
	for _, c := range conds {
		out = append(out, ConditionDetail{
			Type:    string(c.Type),
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}
	return out
}

func (w *contextWatcher) PodLogTargets(namespace string, selector map[string]string) []PodLogTarget {
	if len(selector) == 0 {
		return []PodLogTarget{}
	}
	f := w.factoryFor("Pod")
	if f == nil {
		return []PodLogTarget{}
	}
	sel := labels.SelectorFromSet(labels.Set(selector))
	lister := f.Core().V1().Pods().Lister()
	var (
		pods []*corev1.Pod
		err  error
	)
	if namespace == "" {
		pods, err = lister.List(sel)
	} else {
		pods, err = lister.Pods(namespace).List(sel)
	}
	if err != nil {
		return []PodLogTarget{}
	}
	out := make([]PodLogTarget, 0, len(pods))
	for _, p := range pods {
		containers := make([]string, 0, len(p.Spec.Containers))
		for _, c := range p.Spec.Containers {
			containers = append(containers, c.Name)
		}
		out = append(out, PodLogTarget{Pod: p.Name, Containers: containers})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Pod < out[j].Pod })
	return out
}

func (w *contextWatcher) Pods(namespace string) []PodInfo {
	f := w.factoryFor("Pod")
	if f == nil {
		return []PodInfo{}
	}
	lister := f.Core().V1().Pods().Lister()
	var (
		pods []*corev1.Pod
		err  error
	)
	if namespace == "" {
		pods, err = lister.List(labels.Everything())
	} else {
		pods, err = lister.Pods(namespace).List(labels.Everything())
	}
	if err != nil {
		return []PodInfo{}
	}
	return podInfosFrom(pods)
}

// PodsOnNode returns pods scheduled on the given node, across all namespaces.
func (w *contextWatcher) PodsOnNode(nodeName string) []PodInfo {
	if nodeName == "" {
		return []PodInfo{}
	}
	f := w.factoryFor("Pod")
	if f == nil {
		return []PodInfo{}
	}
	all, err := f.Core().V1().Pods().Lister().List(labels.Everything())
	if err != nil {
		return []PodInfo{}
	}
	matched := make([]*corev1.Pod, 0, len(all))
	for _, p := range all {
		if p.Spec.NodeName == nodeName {
			matched = append(matched, p)
		}
	}
	return podInfosFrom(matched)
}

// PodsForOwner dispatches by kind: for Node it returns pods scheduled on
// that node, for workload kinds it looks up the workload's selector via the
// local lister and returns matching pods.
func (w *contextWatcher) PodsForOwner(kind, namespace, name string) ([]PodInfo, error) {
	switch kind {
	case "Node":
		return w.PodsOnNode(name), nil
	case "Deployment":
		f := w.factoryFor("Deployment")
		if f == nil {
			return nil, errKindNoAccess("Deployment")
		}
		d, err := f.Apps().V1().Deployments().Lister().Deployments(namespace).Get(name)
		if err != nil {
			return nil, err
		}
		return w.PodsForSelector(namespace, d.Spec.Selector), nil
	case "StatefulSet":
		f := w.factoryFor("StatefulSet")
		if f == nil {
			return nil, errKindNoAccess("StatefulSet")
		}
		s, err := f.Apps().V1().StatefulSets().Lister().StatefulSets(namespace).Get(name)
		if err != nil {
			return nil, err
		}
		return w.PodsForSelector(namespace, s.Spec.Selector), nil
	case "DaemonSet":
		f := w.factoryFor("DaemonSet")
		if f == nil {
			return nil, errKindNoAccess("DaemonSet")
		}
		d, err := f.Apps().V1().DaemonSets().Lister().DaemonSets(namespace).Get(name)
		if err != nil {
			return nil, err
		}
		return w.PodsForSelector(namespace, d.Spec.Selector), nil
	case "ReplicaSet":
		f := w.factoryFor("ReplicaSet")
		if f == nil {
			return nil, errKindNoAccess("ReplicaSet")
		}
		r, err := f.Apps().V1().ReplicaSets().Lister().ReplicaSets(namespace).Get(name)
		if err != nil {
			return nil, err
		}
		return w.PodsForSelector(namespace, r.Spec.Selector), nil
	default:
		return nil, fmt.Errorf("PodsForOwner: unsupported kind %q", kind)
	}
}

// PodsForSelector returns pods in the given namespace matching the selector.
// An empty selector returns no pods (a nil/empty selector would otherwise
// match every pod in the namespace, which is never what the caller wants).
func (w *contextWatcher) PodsForSelector(namespace string, sel *metav1.LabelSelector) []PodInfo {
	if sel == nil || (len(sel.MatchLabels) == 0 && len(sel.MatchExpressions) == 0) {
		return []PodInfo{}
	}
	selector, err := metav1.LabelSelectorAsSelector(sel)
	if err != nil {
		return []PodInfo{}
	}
	f := w.factoryFor("Pod")
	if f == nil {
		return []PodInfo{}
	}
	lister := f.Core().V1().Pods().Lister()
	var (
		pods    []*corev1.Pod
		listErr error
	)
	if namespace == "" {
		pods, listErr = lister.List(selector)
	} else {
		pods, listErr = lister.Pods(namespace).List(selector)
	}
	if listErr != nil {
		return []PodInfo{}
	}
	return podInfosFrom(pods)
}

func podInfosFrom(pods []*corev1.Pod) []PodInfo {
	out := make([]PodInfo, 0, len(pods))
	for _, p := range pods {
		out = append(out, podInfoFrom(p))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out
}

func podInfoFrom(p *corev1.Pod) PodInfo {
	ready, total := 0, len(p.Spec.Containers)
	var restarts int32
	for _, cs := range p.Status.ContainerStatuses {
		if cs.Ready {
			ready++
		}
		restarts += cs.RestartCount
	}
	cpuReq, cpuLim, memReq, memLim := podResourceTotals(p)
	hasPorts := false
	for _, c := range p.Spec.Containers {
		if len(c.Ports) > 0 {
			hasPorts = true
			break
		}
	}
	return PodInfo{
		Name:         p.Name,
		Namespace:    p.Namespace,
		Status:       derivePodStatus(p),
		Ready:        fmt.Sprintf("%d/%d", ready, total),
		Restarts:     restarts,
		Node:         p.Spec.NodeName,
		PodIP:        p.Status.PodIP,
		CreatedAt:    p.CreationTimestamp.UTC().Format(time.RFC3339),
		CPURequestMC: cpuReq,
		CPULimitMC:   cpuLim,
		MemRequestB:  memReq,
		MemLimitB:    memLim,
		HasPorts:     hasPorts,
		Containers:   podContainerBriefs(p),
	}
}

// podContainerBriefs summarizes every container's status for the Pods list,
// regular containers first then init containers so the row of squares reads as
// "app health, then the init chain behind it".
func podContainerBriefs(p *corev1.Pod) []PodContainerBrief {
	regStatus := make(map[string]corev1.ContainerStatus, len(p.Status.ContainerStatuses))
	for _, s := range p.Status.ContainerStatuses {
		regStatus[s.Name] = s
	}
	initStatus := make(map[string]corev1.ContainerStatus, len(p.Status.InitContainerStatuses))
	for _, s := range p.Status.InitContainerStatuses {
		initStatus[s.Name] = s
	}
	out := make([]PodContainerBrief, 0, len(p.Spec.Containers)+len(p.Spec.InitContainers))
	for _, c := range p.Spec.Containers {
		out = append(out, containerBrief(c.Name, lookupStatus(regStatus, c.Name), false))
	}
	for _, c := range p.Spec.InitContainers {
		out = append(out, containerBrief(c.Name, lookupStatus(initStatus, c.Name), true))
	}
	return out
}

func lookupStatus(byName map[string]corev1.ContainerStatus, name string) *corev1.ContainerStatus {
	if s, ok := byName[name]; ok {
		return &s
	}
	return nil
}

func containerBrief(name string, st *corev1.ContainerStatus, init bool) PodContainerBrief {
	b := PodContainerBrief{Name: name, Init: init}
	switch {
	case st == nil:
		b.Tone, b.State = "warn", "Pending"
	case st.State.Waiting != nil:
		b.State = st.State.Waiting.Reason
		if b.State == "" {
			b.State = "Waiting"
		}
		if isFailureReason(b.State) {
			b.Tone = "error"
		} else {
			b.Tone = "warn"
		}
	case st.State.Terminated != nil:
		t := st.State.Terminated
		if t.ExitCode == 0 {
			b.Tone, b.State = "done", "Completed"
		} else {
			b.Tone = "error"
			b.State = t.Reason
			if b.State == "" {
				b.State = fmt.Sprintf("ExitCode:%d", t.ExitCode)
			}
		}
	case st.State.Running != nil:
		if st.Ready {
			b.Tone, b.State = "ready", "Running"
		} else {
			b.Tone, b.State = "warn", "Running"
		}
	default:
		b.Tone, b.State = "warn", "Unknown"
	}
	return b
}

func isFailureReason(reason string) bool {
	switch reason {
	case "CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull", "InvalidImageName",
		"CreateContainerConfigError", "CreateContainerError", "RunContainerError",
		"ErrImageNeverPull", "ImageInspectError":
		return true
	}
	return false
}

// podResourceTotals sums cpu/mem requests and limits across init+regular
// containers, returning millicores and bytes. A zero result means unset
// for that dimension.
func podResourceTotals(p *corev1.Pod) (cpuReq, cpuLim, memReq, memLim int64) {
	add := func(list []corev1.Container) {
		for _, c := range list {
			if q, ok := c.Resources.Requests[corev1.ResourceCPU]; ok {
				cpuReq += q.MilliValue()
			}
			if q, ok := c.Resources.Limits[corev1.ResourceCPU]; ok {
				cpuLim += q.MilliValue()
			}
			if q, ok := c.Resources.Requests[corev1.ResourceMemory]; ok {
				memReq += q.Value()
			}
			if q, ok := c.Resources.Limits[corev1.ResourceMemory]; ok {
				memLim += q.Value()
			}
		}
	}
	add(p.Spec.Containers)
	return
}

// derivePodStatus mirrors kubectl's STATUS column logic: it walks init
// then regular container states to surface CrashLoopBackOff,
// ImagePullBackOff, ContainerCreating, Completed, OOMKilled, Init:Reason
// etc. instead of the coarse Pod.Status.Phase.
func derivePodStatus(p *corev1.Pod) string {
	if p.DeletionTimestamp != nil {
		return "Terminating"
	}

	for i, init := range p.Status.InitContainerStatuses {
		switch {
		case init.State.Terminated != nil && init.State.Terminated.ExitCode == 0:
			continue
		case init.State.Terminated != nil:
			if init.State.Terminated.Reason != "" {
				return "Init:" + init.State.Terminated.Reason
			}
			if init.State.Terminated.Signal != 0 {
				return fmt.Sprintf("Init:Signal:%d", init.State.Terminated.Signal)
			}
			return fmt.Sprintf("Init:ExitCode:%d", init.State.Terminated.ExitCode)
		case init.State.Waiting != nil && init.State.Waiting.Reason != "" && init.State.Waiting.Reason != "PodInitializing":
			return "Init:" + init.State.Waiting.Reason
		default:
			return fmt.Sprintf("Init:%d/%d", i, len(p.Spec.InitContainers))
		}
	}

	for i := len(p.Status.ContainerStatuses) - 1; i >= 0; i-- {
		c := p.Status.ContainerStatuses[i]
		if c.State.Waiting != nil && c.State.Waiting.Reason != "" {
			return c.State.Waiting.Reason
		}
		if c.State.Terminated != nil {
			if c.State.Terminated.Reason != "" {
				return c.State.Terminated.Reason
			}
			if c.State.Terminated.Signal != 0 {
				return fmt.Sprintf("Signal:%d", c.State.Terminated.Signal)
			}
			return fmt.Sprintf("ExitCode:%d", c.State.Terminated.ExitCode)
		}
	}

	if p.Status.Reason != "" {
		return p.Status.Reason
	}
	return string(p.Status.Phase)
}
