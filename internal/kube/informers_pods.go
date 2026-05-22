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
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Status       string `json:"status"`
	Ready        string `json:"ready"`
	Restarts     int32  `json:"restarts"`
	Node         string `json:"node"`
	PodIP        string `json:"podIP"`
	CreatedAt    string `json:"createdAt"`
	CPURequestMC int64  `json:"cpuRequestMC"`
	CPULimitMC   int64  `json:"cpuLimitMC"`
	MemRequestB  int64  `json:"memRequestB"`
	MemLimitB    int64  `json:"memLimitB"`
	HasPorts     bool   `json:"hasPorts"`
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
		InitContainers:    containerDetails(p, p.Spec.InitContainers, p.Status.InitContainerStatuses),
		Containers:        containerDetails(p, p.Spec.Containers, p.Status.ContainerStatuses),
		Conditions:        podConditions(p.Status.Conditions),
	}, nil
}

func containerDetails(pod *corev1.Pod, specs []corev1.Container, statuses []corev1.ContainerStatus) []ContainerDetail {
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
			Name:    c.Name,
			Image:   c.Image,
			Ports:   ports,
			Env:     envVarsFrom(pod, c, c.Env),
			EnvFrom: envFromSources(c.EnvFrom),
		}
		if s, ok := byName[c.Name]; ok {
			d.Ready = s.Ready
			d.RestartCount = s.RestartCount
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

func envVarsFrom(pod *corev1.Pod, container *corev1.Container, env []corev1.EnvVar) []ContainerEnvVar {
	if len(env) == 0 {
		return []ContainerEnvVar{}
	}
	out := make([]ContainerEnvVar, 0, len(env))
	for _, e := range env {
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
	}
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
