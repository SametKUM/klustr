package kube

import (
	"fmt"
	"sort"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ContainerSummary struct {
	Name     string   `json:"name"`
	Image    string   `json:"image"`
	Ports    []string `json:"ports"`
	Command  []string `json:"command"`
	Args     []string `json:"args"`
	EnvCount int      `json:"envCount"`
}

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

type EndpointsSubsetAddress struct {
	IP       string `json:"ip"`
	Hostname string `json:"hostname"`
	NodeName string `json:"nodeName"`
	Ready    bool   `json:"ready"`
}

type EndpointsSubsetPort struct {
	Name     string `json:"name"`
	Port     int32  `json:"port"`
	Protocol string `json:"protocol"`
}

type EndpointsSubset struct {
	Addresses []EndpointsSubsetAddress `json:"addresses"`
	Ports     []EndpointsSubsetPort    `json:"ports"`
}

type EndpointsDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	Subsets     []EndpointsSubset `json:"subsets"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type WebhookSummary struct {
	Name        string   `json:"name"`
	ClientCfg   string   `json:"clientCfg"`
	FailPolicy  string   `json:"failPolicy"`
	SideEffects string   `json:"sideEffects"`
	Operations  []string `json:"operations"`
	Resources   []string `json:"resources"`
}

type WebhookConfigurationDetail struct {
	Name        string            `json:"name"`
	UID         string            `json:"uid"`
	Webhooks    []WebhookSummary  `json:"webhooks"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type LeaseDetail struct {
	Name                 string            `json:"name"`
	Namespace            string            `json:"namespace"`
	UID                  string            `json:"uid"`
	HolderIdentity       string            `json:"holderIdentity"`
	LeaseDurationSeconds int32             `json:"leaseDurationSeconds"`
	AcquireTime          string            `json:"acquireTime"`
	RenewTime            string            `json:"renewTime"`
	LeaseTransitions     int32             `json:"leaseTransitions"`
	Labels               map[string]string `json:"labels"`
	Annotations          map[string]string `json:"annotations"`
	CreatedAt            string            `json:"createdAt"`
}

type RuntimeClassDetail struct {
	Name        string            `json:"name"`
	UID         string            `json:"uid"`
	Handler     string            `json:"handler"`
	Overhead    map[string]string `json:"overhead"`
	Scheduling  string            `json:"scheduling"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type PriorityClassDetail struct {
	Name             string            `json:"name"`
	UID              string            `json:"uid"`
	Value            int32             `json:"value"`
	GlobalDefault    bool              `json:"globalDefault"`
	Description      string            `json:"description"`
	PreemptionPolicy string            `json:"preemptionPolicy"`
	Labels           map[string]string `json:"labels"`
	Annotations      map[string]string `json:"annotations"`
	CreatedAt        string            `json:"createdAt"`
}

type IngressClassDetail struct {
	Name        string            `json:"name"`
	UID         string            `json:"uid"`
	Controller  string            `json:"controller"`
	IsDefault   bool              `json:"isDefault"`
	Parameters  string            `json:"parameters"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type LimitRangeItem struct {
	Type                 string            `json:"type"`
	Max                  map[string]string `json:"max"`
	Min                  map[string]string `json:"min"`
	Default              map[string]string `json:"default"`
	DefaultRequest       map[string]string `json:"defaultRequest"`
	MaxLimitRequestRatio map[string]string `json:"maxLimitRequestRatio"`
}

type LimitRangeDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	Limits      []LimitRangeItem  `json:"limits"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type ResourceQuotaEntry struct {
	Resource string `json:"resource"`
	Used     string `json:"used"`
	Hard     string `json:"hard"`
}

type ResourceQuotaDetail struct {
	Name        string               `json:"name"`
	Namespace   string               `json:"namespace"`
	UID         string               `json:"uid"`
	Scopes      []string             `json:"scopes"`
	Entries     []ResourceQuotaEntry `json:"entries"`
	Labels      map[string]string    `json:"labels"`
	Annotations map[string]string    `json:"annotations"`
	CreatedAt   string               `json:"createdAt"`
}

type EndpointSliceEndpoint struct {
	Addresses []string `json:"addresses"`
	NodeName  string   `json:"nodeName"`
	Hostname  string   `json:"hostname"`
	Ready     bool     `json:"ready"`
}

type EndpointSlicePort struct {
	Name     string `json:"name"`
	Port     int32  `json:"port"`
	Protocol string `json:"protocol"`
}

type EndpointSliceDetail struct {
	Name        string                  `json:"name"`
	Namespace   string                  `json:"namespace"`
	UID         string                  `json:"uid"`
	AddressType string                  `json:"addressType"`
	Service     string                  `json:"service"`
	Endpoints   []EndpointSliceEndpoint `json:"endpoints"`
	Ports       []EndpointSlicePort     `json:"ports"`
	Labels      map[string]string       `json:"labels"`
	Annotations map[string]string       `json:"annotations"`
	CreatedAt   string                  `json:"createdAt"`
}

type PodDisruptionBudgetDetail struct {
	Name             string            `json:"name"`
	Namespace        string            `json:"namespace"`
	UID              string            `json:"uid"`
	MinAvailable     string            `json:"minAvailable"`
	MaxUnavailable   string            `json:"maxUnavailable"`
	Selector         string            `json:"selector"`
	CurrentHealthy   int32             `json:"currentHealthy"`
	DesiredHealthy   int32             `json:"desiredHealthy"`
	ExpectedPods     int32             `json:"expectedPods"`
	DisruptionsAllowed int32           `json:"disruptionsAllowed"`
	Conditions       []ConditionDetail `json:"conditions"`
	Labels           map[string]string `json:"labels"`
	Annotations      map[string]string `json:"annotations"`
	CreatedAt        string            `json:"createdAt"`
}

type HorizontalPodAutoscalerDetail struct {
	Name            string            `json:"name"`
	Namespace       string            `json:"namespace"`
	UID             string            `json:"uid"`
	Reference       string            `json:"reference"`
	MinReplicas     int32             `json:"minReplicas"`
	MaxReplicas     int32             `json:"maxReplicas"`
	CurrentReplicas int32             `json:"currentReplicas"`
	DesiredReplicas int32             `json:"desiredReplicas"`
	Metrics         []HPAMetricTarget `json:"metrics"`
	Conditions      []ConditionDetail `json:"conditions"`
	Labels          map[string]string `json:"labels"`
	Annotations     map[string]string `json:"annotations"`
	CreatedAt       string            `json:"createdAt"`
}

type NetworkPolicyDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	PodSelector string            `json:"podSelector"`
	PolicyTypes []string          `json:"policyTypes"`
	Ingress     int               `json:"ingress"`
	Egress      int               `json:"egress"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type StorageClassDetail struct {
	Name              string            `json:"name"`
	UID               string            `json:"uid"`
	Provisioner       string            `json:"provisioner"`
	ReclaimPolicy     string            `json:"reclaimPolicy"`
	VolumeBindingMode string            `json:"volumeBindingMode"`
	AllowExpansion    bool              `json:"allowExpansion"`
	IsDefault         bool              `json:"isDefault"`
	Parameters        map[string]string `json:"parameters"`
	MountOptions      []string          `json:"mountOptions"`
	Labels            map[string]string `json:"labels"`
	Annotations       map[string]string `json:"annotations"`
	CreatedAt         string            `json:"createdAt"`
}

type PersistentVolumeDetail struct {
	Name          string            `json:"name"`
	UID           string            `json:"uid"`
	Status        string            `json:"status"`
	Capacity      string            `json:"capacity"`
	AccessModes   []string          `json:"accessModes"`
	ReclaimPolicy string            `json:"reclaimPolicy"`
	StorageClass  string            `json:"storageClass"`
	VolumeMode    string            `json:"volumeMode"`
	Claim         string            `json:"claim"`
	Source        string            `json:"source"`
	Message       string            `json:"message"`
	Reason        string            `json:"reason"`
	Labels        map[string]string `json:"labels"`
	Annotations   map[string]string `json:"annotations"`
	CreatedAt     string            `json:"createdAt"`
}

type PersistentVolumeClaimDetail struct {
	Name         string            `json:"name"`
	Namespace    string            `json:"namespace"`
	UID          string            `json:"uid"`
	Status       string            `json:"status"`
	Volume       string            `json:"volume"`
	StorageClass string            `json:"storageClass"`
	VolumeMode   string            `json:"volumeMode"`
	AccessModes  []string          `json:"accessModes"`
	Capacity     string            `json:"capacity"`
	Request      string            `json:"request"`
	Selector     map[string]string `json:"selector"`
	Conditions   []ConditionDetail `json:"conditions"`
	Labels       map[string]string `json:"labels"`
	Annotations  map[string]string `json:"annotations"`
	CreatedAt    string            `json:"createdAt"`
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

type ServicePortDetail struct {
	Name       string `json:"name"`
	Protocol   string `json:"protocol"`
	Port       int32  `json:"port"`
	TargetPort string `json:"targetPort"`
	NodePort   int32  `json:"nodePort"`
}

type ServiceDetail struct {
	Name            string              `json:"name"`
	Namespace       string              `json:"namespace"`
	UID             string              `json:"uid"`
	Type            string              `json:"type"`
	ClusterIPs      []string            `json:"clusterIPs"`
	ExternalIPs     []string            `json:"externalIPs"`
	Selector        map[string]string   `json:"selector"`
	Ports           []ServicePortDetail `json:"ports"`
	SessionAffinity string              `json:"sessionAffinity"`
	Labels          map[string]string   `json:"labels"`
	Annotations     map[string]string   `json:"annotations"`
	CreatedAt       string              `json:"createdAt"`
}

type ConfigMapDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	Data        map[string]string `json:"data"`
	BinaryKeys  []string          `json:"binaryKeys"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type SecretKeyInfo struct {
	Key  string `json:"key"`
	Size int    `json:"size"`
}

type SecretDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	Type        string            `json:"type"`
	Keys        []SecretKeyInfo   `json:"keys"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type IngressPathDetail struct {
	Path        string `json:"path"`
	PathType    string `json:"pathType"`
	ServiceName string `json:"serviceName"`
	ServicePort string `json:"servicePort"`
}

type IngressRuleDetail struct {
	Host  string              `json:"host"`
	Paths []IngressPathDetail `json:"paths"`
}

type IngressTLSDetail struct {
	Hosts      []string `json:"hosts"`
	SecretName string   `json:"secretName"`
}

type IngressDetail struct {
	Name        string              `json:"name"`
	Namespace   string              `json:"namespace"`
	UID         string              `json:"uid"`
	Class       string              `json:"class"`
	Rules       []IngressRuleDetail `json:"rules"`
	TLS         []IngressTLSDetail  `json:"tls"`
	Addresses   []string            `json:"addresses"`
	Labels      map[string]string   `json:"labels"`
	Annotations map[string]string   `json:"annotations"`
	CreatedAt   string              `json:"createdAt"`
}

type NodeTaintDetail struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Effect string `json:"effect"`
}

type NodeDetail struct {
	Name             string            `json:"name"`
	UID              string            `json:"uid"`
	Status           string            `json:"status"`
	Roles            string            `json:"roles"`
	Version          string            `json:"version"`
	OSImage          string            `json:"osImage"`
	KernelVersion    string            `json:"kernelVersion"`
	ContainerRuntime string            `json:"containerRuntime"`
	Architecture     string            `json:"architecture"`
	InternalIP       string            `json:"internalIP"`
	Hostname         string            `json:"hostname"`
	Capacity         map[string]string `json:"capacity"`
	Allocatable      map[string]string `json:"allocatable"`
	Taints           []NodeTaintDetail `json:"taints"`
	Labels           map[string]string `json:"labels"`
	Annotations      map[string]string `json:"annotations"`
	Conditions       []ConditionDetail `json:"conditions"`
	CreatedAt        string            `json:"createdAt"`
}

type NamespaceDetail struct {
	Name        string            `json:"name"`
	UID         string            `json:"uid"`
	Phase       string            `json:"phase"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type ObjectRefDetail struct {
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

type ServiceAccountDetail struct {
	Name                         string            `json:"name"`
	Namespace                    string            `json:"namespace"`
	UID                          string            `json:"uid"`
	AutomountServiceAccountToken string            `json:"automountServiceAccountToken"`
	Secrets                      []ObjectRefDetail `json:"secrets"`
	ImagePullSecrets             []ObjectRefDetail `json:"imagePullSecrets"`
	Labels                       map[string]string `json:"labels"`
	Annotations                  map[string]string `json:"annotations"`
	CreatedAt                    string            `json:"createdAt"`
}

type PolicyRuleDetail struct {
	Verbs           []string `json:"verbs"`
	APIGroups       []string `json:"apiGroups"`
	Resources       []string `json:"resources"`
	ResourceNames   []string `json:"resourceNames"`
	NonResourceURLs []string `json:"nonResourceURLs"`
}

type RoleDetail struct {
	Name        string             `json:"name"`
	Namespace   string             `json:"namespace"`
	UID         string             `json:"uid"`
	Rules       []PolicyRuleDetail `json:"rules"`
	Labels      map[string]string  `json:"labels"`
	Annotations map[string]string  `json:"annotations"`
	CreatedAt   string             `json:"createdAt"`
}

type SubjectDetail struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	APIGroup  string `json:"apiGroup"`
}

type RoleRefDetail struct {
	Kind     string `json:"kind"`
	Name     string `json:"name"`
	APIGroup string `json:"apiGroup"`
}

type RoleBindingDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	RoleRef     RoleRefDetail     `json:"roleRef"`
	Subjects    []SubjectDetail   `json:"subjects"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type ClusterRoleDetail struct {
	Name             string             `json:"name"`
	UID              string             `json:"uid"`
	Rules            []PolicyRuleDetail `json:"rules"`
	AggregationLabel map[string]string  `json:"aggregationLabel"`
	Labels           map[string]string  `json:"labels"`
	Annotations      map[string]string  `json:"annotations"`
	CreatedAt        string             `json:"createdAt"`
}

type ClusterRoleBindingDetail struct {
	Name        string            `json:"name"`
	UID         string            `json:"uid"`
	RoleRef     RoleRefDetail     `json:"roleRef"`
	Subjects    []SubjectDetail   `json:"subjects"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

// ===== Lister-backed Get methods =====

func (w *contextWatcher) Deployment(namespace, name string) (*DeploymentDetail, error) {
	d, err := w.factory.Apps().V1().Deployments().Lister().Deployments(namespace).Get(name)
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
		Selector:    matchLabels(d.Spec.Selector),
		Containers:  containerSummaries(d.Spec.Template.Spec.Containers),
		Conditions:  deploymentConditions(d.Status.Conditions),
		Labels:      d.Labels,
		Annotations: d.Annotations,
		CreatedAt:   d.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) StatefulSet(namespace, name string) (*StatefulSetDetail, error) {
	s, err := w.factory.Apps().V1().StatefulSets().Lister().StatefulSets(namespace).Get(name)
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
	r, err := w.factory.Core().V1().ReplicationControllers().Lister().ReplicationControllers(namespace).Get(name)
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

func (w *contextWatcher) Endpoints(namespace, name string) (*EndpointsDetail, error) {
	e, err := w.factory.Core().V1().Endpoints().Lister().Endpoints(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	subs := make([]EndpointsSubset, 0, len(e.Subsets))
	for _, s := range e.Subsets {
		addrs := make([]EndpointsSubsetAddress, 0, len(s.Addresses)+len(s.NotReadyAddresses))
		for _, a := range s.Addresses {
			node := ""
			if a.NodeName != nil {
				node = *a.NodeName
			}
			addrs = append(addrs, EndpointsSubsetAddress{IP: a.IP, Hostname: a.Hostname, NodeName: node, Ready: true})
		}
		for _, a := range s.NotReadyAddresses {
			node := ""
			if a.NodeName != nil {
				node = *a.NodeName
			}
			addrs = append(addrs, EndpointsSubsetAddress{IP: a.IP, Hostname: a.Hostname, NodeName: node, Ready: false})
		}
		ports := make([]EndpointsSubsetPort, 0, len(s.Ports))
		for _, p := range s.Ports {
			ports = append(ports, EndpointsSubsetPort{Name: p.Name, Port: p.Port, Protocol: string(p.Protocol)})
		}
		subs = append(subs, EndpointsSubset{Addresses: addrs, Ports: ports})
	}
	return &EndpointsDetail{
		Name:        e.Name,
		Namespace:   e.Namespace,
		UID:         string(e.UID),
		Subsets:     subs,
		Labels:      e.Labels,
		Annotations: e.Annotations,
		CreatedAt:   e.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ValidatingWebhookConfiguration(name string) (*WebhookConfigurationDetail, error) {
	c, err := w.factory.Admissionregistration().V1().ValidatingWebhookConfigurations().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	whs := make([]WebhookSummary, 0, len(c.Webhooks))
	for _, h := range c.Webhooks {
		summary := WebhookSummary{Name: h.Name}
		if h.ClientConfig.Service != nil {
			summary.ClientCfg = h.ClientConfig.Service.Namespace + "/" + h.ClientConfig.Service.Name
		} else if h.ClientConfig.URL != nil {
			summary.ClientCfg = *h.ClientConfig.URL
		}
		if h.FailurePolicy != nil {
			summary.FailPolicy = string(*h.FailurePolicy)
		}
		if h.SideEffects != nil {
			summary.SideEffects = string(*h.SideEffects)
		}
		seenOps := map[string]struct{}{}
		seenRes := map[string]struct{}{}
		for _, r := range h.Rules {
			for _, op := range r.Operations {
				if _, ok := seenOps[string(op)]; !ok {
					seenOps[string(op)] = struct{}{}
					summary.Operations = append(summary.Operations, string(op))
				}
			}
			for _, rs := range r.Resources {
				if _, ok := seenRes[rs]; !ok {
					seenRes[rs] = struct{}{}
					summary.Resources = append(summary.Resources, rs)
				}
			}
		}
		whs = append(whs, summary)
	}
	return &WebhookConfigurationDetail{
		Name:        c.Name,
		UID:         string(c.UID),
		Webhooks:    whs,
		Labels:      c.Labels,
		Annotations: c.Annotations,
		CreatedAt:   c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) MutatingWebhookConfiguration(name string) (*WebhookConfigurationDetail, error) {
	c, err := w.factory.Admissionregistration().V1().MutatingWebhookConfigurations().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	whs := make([]WebhookSummary, 0, len(c.Webhooks))
	for _, h := range c.Webhooks {
		summary := WebhookSummary{Name: h.Name}
		if h.ClientConfig.Service != nil {
			summary.ClientCfg = h.ClientConfig.Service.Namespace + "/" + h.ClientConfig.Service.Name
		} else if h.ClientConfig.URL != nil {
			summary.ClientCfg = *h.ClientConfig.URL
		}
		if h.FailurePolicy != nil {
			summary.FailPolicy = string(*h.FailurePolicy)
		}
		if h.SideEffects != nil {
			summary.SideEffects = string(*h.SideEffects)
		}
		seenOps := map[string]struct{}{}
		seenRes := map[string]struct{}{}
		for _, r := range h.Rules {
			for _, op := range r.Operations {
				if _, ok := seenOps[string(op)]; !ok {
					seenOps[string(op)] = struct{}{}
					summary.Operations = append(summary.Operations, string(op))
				}
			}
			for _, rs := range r.Resources {
				if _, ok := seenRes[rs]; !ok {
					seenRes[rs] = struct{}{}
					summary.Resources = append(summary.Resources, rs)
				}
			}
		}
		whs = append(whs, summary)
	}
	return &WebhookConfigurationDetail{
		Name:        c.Name,
		UID:         string(c.UID),
		Webhooks:    whs,
		Labels:      c.Labels,
		Annotations: c.Annotations,
		CreatedAt:   c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) Lease(namespace, name string) (*LeaseDetail, error) {
	l, err := w.factory.Coordination().V1().Leases().Lister().Leases(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	holder := ""
	if l.Spec.HolderIdentity != nil {
		holder = *l.Spec.HolderIdentity
	}
	var dur int32 = 0
	if l.Spec.LeaseDurationSeconds != nil {
		dur = *l.Spec.LeaseDurationSeconds
	}
	acquire := ""
	if l.Spec.AcquireTime != nil {
		acquire = l.Spec.AcquireTime.UTC().Format(time.RFC3339)
	}
	renew := ""
	if l.Spec.RenewTime != nil {
		renew = l.Spec.RenewTime.UTC().Format(time.RFC3339)
	}
	var trans int32 = 0
	if l.Spec.LeaseTransitions != nil {
		trans = *l.Spec.LeaseTransitions
	}
	return &LeaseDetail{
		Name:                 l.Name,
		Namespace:            l.Namespace,
		UID:                  string(l.UID),
		HolderIdentity:       holder,
		LeaseDurationSeconds: dur,
		AcquireTime:          acquire,
		RenewTime:            renew,
		LeaseTransitions:     trans,
		Labels:               l.Labels,
		Annotations:          l.Annotations,
		CreatedAt:            l.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) RuntimeClass(name string) (*RuntimeClassDetail, error) {
	r, err := w.factory.Node().V1().RuntimeClasses().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	overhead := map[string]string{}
	if r.Overhead != nil {
		for k, v := range r.Overhead.PodFixed {
			overhead[string(k)] = v.String()
		}
	}
	sched := ""
	if r.Scheduling != nil && len(r.Scheduling.NodeSelector) > 0 {
		sched = formatNodeSelector(r.Scheduling.NodeSelector)
	}
	return &RuntimeClassDetail{
		Name:        r.Name,
		UID:         string(r.UID),
		Handler:     r.Handler,
		Overhead:    overhead,
		Scheduling:  sched,
		Labels:      r.Labels,
		Annotations: r.Annotations,
		CreatedAt:   r.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) PriorityClass(name string) (*PriorityClassDetail, error) {
	p, err := w.factory.Scheduling().V1().PriorityClasses().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	pp := ""
	if p.PreemptionPolicy != nil {
		pp = string(*p.PreemptionPolicy)
	}
	return &PriorityClassDetail{
		Name:             p.Name,
		UID:              string(p.UID),
		Value:            p.Value,
		GlobalDefault:    p.GlobalDefault,
		Description:      p.Description,
		PreemptionPolicy: pp,
		Labels:           p.Labels,
		Annotations:      p.Annotations,
		CreatedAt:        p.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) IngressClass(name string) (*IngressClassDetail, error) {
	c, err := w.factory.Networking().V1().IngressClasses().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	params := ""
	if c.Spec.Parameters != nil {
		params = c.Spec.Parameters.Kind + "/" + c.Spec.Parameters.Name
	}
	return &IngressClassDetail{
		Name:        c.Name,
		UID:         string(c.UID),
		Controller:  c.Spec.Controller,
		IsDefault:   c.Annotations["ingressclass.kubernetes.io/is-default-class"] == "true",
		Parameters:  params,
		Labels:      c.Labels,
		Annotations: c.Annotations,
		CreatedAt:   c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) LimitRange(namespace, name string) (*LimitRangeDetail, error) {
	l, err := w.factory.Core().V1().LimitRanges().Lister().LimitRanges(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	items := make([]LimitRangeItem, 0, len(l.Spec.Limits))
	for _, li := range l.Spec.Limits {
		items = append(items, LimitRangeItem{
			Type:                 string(li.Type),
			Max:                  quantitiesToStrings(li.Max),
			Min:                  quantitiesToStrings(li.Min),
			Default:              quantitiesToStrings(li.Default),
			DefaultRequest:       quantitiesToStrings(li.DefaultRequest),
			MaxLimitRequestRatio: quantitiesToStrings(li.MaxLimitRequestRatio),
		})
	}
	return &LimitRangeDetail{
		Name:        l.Name,
		Namespace:   l.Namespace,
		UID:         string(l.UID),
		Limits:      items,
		Labels:      l.Labels,
		Annotations: l.Annotations,
		CreatedAt:   l.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ResourceQuota(namespace, name string) (*ResourceQuotaDetail, error) {
	q, err := w.factory.Core().V1().ResourceQuotas().Lister().ResourceQuotas(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	scopes := make([]string, 0, len(q.Spec.Scopes))
	for _, s := range q.Spec.Scopes {
		scopes = append(scopes, string(s))
	}
	keys := make([]string, 0, len(q.Status.Hard))
	for k := range q.Status.Hard {
		keys = append(keys, string(k))
	}
	sort.Strings(keys)
	entries := make([]ResourceQuotaEntry, 0, len(keys))
	for _, k := range keys {
		used := ""
		if u, ok := q.Status.Used[corev1.ResourceName(k)]; ok {
			used = u.String()
		}
		hard := ""
		if h, ok := q.Status.Hard[corev1.ResourceName(k)]; ok {
			hard = h.String()
		}
		entries = append(entries, ResourceQuotaEntry{Resource: k, Used: used, Hard: hard})
	}
	return &ResourceQuotaDetail{
		Name:        q.Name,
		Namespace:   q.Namespace,
		UID:         string(q.UID),
		Scopes:      scopes,
		Entries:     entries,
		Labels:      q.Labels,
		Annotations: q.Annotations,
		CreatedAt:   q.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) EndpointSlice(namespace, name string) (*EndpointSliceDetail, error) {
	s, err := w.factory.Discovery().V1().EndpointSlices().Lister().EndpointSlices(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	endpoints := make([]EndpointSliceEndpoint, 0, len(s.Endpoints))
	for _, e := range s.Endpoints {
		ready := false
		if e.Conditions.Ready != nil {
			ready = *e.Conditions.Ready
		}
		node := ""
		if e.NodeName != nil {
			node = *e.NodeName
		}
		host := ""
		if e.Hostname != nil {
			host = *e.Hostname
		}
		endpoints = append(endpoints, EndpointSliceEndpoint{
			Addresses: append([]string(nil), e.Addresses...),
			NodeName:  node,
			Hostname:  host,
			Ready:     ready,
		})
	}
	ports := make([]EndpointSlicePort, 0, len(s.Ports))
	for _, p := range s.Ports {
		port := int32(0)
		if p.Port != nil {
			port = *p.Port
		}
		proto := ""
		if p.Protocol != nil {
			proto = string(*p.Protocol)
		}
		pname := ""
		if p.Name != nil {
			pname = *p.Name
		}
		ports = append(ports, EndpointSlicePort{Name: pname, Port: port, Protocol: proto})
	}
	return &EndpointSliceDetail{
		Name:        s.Name,
		Namespace:   s.Namespace,
		UID:         string(s.UID),
		AddressType: string(s.AddressType),
		Service:     s.Labels["kubernetes.io/service-name"],
		Endpoints:   endpoints,
		Ports:       ports,
		Labels:      s.Labels,
		Annotations: s.Annotations,
		CreatedAt:   s.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) PodDisruptionBudget(namespace, name string) (*PodDisruptionBudgetDetail, error) {
	p, err := w.factory.Policy().V1().PodDisruptionBudgets().Lister().PodDisruptionBudgets(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	minAvail := ""
	if p.Spec.MinAvailable != nil {
		minAvail = p.Spec.MinAvailable.String()
	}
	maxUnavail := ""
	if p.Spec.MaxUnavailable != nil {
		maxUnavail = p.Spec.MaxUnavailable.String()
	}
	conds := make([]ConditionDetail, 0, len(p.Status.Conditions))
	for _, c := range p.Status.Conditions {
		conds = append(conds, ConditionDetail{
			Type:    c.Type,
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}
	return &PodDisruptionBudgetDetail{
		Name:               p.Name,
		Namespace:          p.Namespace,
		UID:                string(p.UID),
		MinAvailable:       minAvail,
		MaxUnavailable:     maxUnavail,
		Selector:           formatLabelSelector(p.Spec.Selector),
		CurrentHealthy:     p.Status.CurrentHealthy,
		DesiredHealthy:     p.Status.DesiredHealthy,
		ExpectedPods:       p.Status.ExpectedPods,
		DisruptionsAllowed: p.Status.DisruptionsAllowed,
		Conditions:         conds,
		Labels:             p.Labels,
		Annotations:        p.Annotations,
		CreatedAt:          p.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) HorizontalPodAutoscaler(namespace, name string) (*HorizontalPodAutoscalerDetail, error) {
	h, err := w.factory.Autoscaling().V2().HorizontalPodAutoscalers().Lister().HorizontalPodAutoscalers(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	var minR int32 = 1
	if h.Spec.MinReplicas != nil {
		minR = *h.Spec.MinReplicas
	}
	metrics := hpaMetricTargets(h)
	conds := make([]ConditionDetail, 0, len(h.Status.Conditions))
	for _, c := range h.Status.Conditions {
		conds = append(conds, ConditionDetail{
			Type:    string(c.Type),
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}
	return &HorizontalPodAutoscalerDetail{
		Name:            h.Name,
		Namespace:       h.Namespace,
		UID:             string(h.UID),
		Reference:       h.Spec.ScaleTargetRef.Kind + "/" + h.Spec.ScaleTargetRef.Name,
		MinReplicas:     minR,
		MaxReplicas:     h.Spec.MaxReplicas,
		CurrentReplicas: h.Status.CurrentReplicas,
		DesiredReplicas: h.Status.DesiredReplicas,
		Metrics:         metrics,
		Conditions:      conds,
		Labels:          h.Labels,
		Annotations:     h.Annotations,
		CreatedAt:       h.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) NetworkPolicy(namespace, name string) (*NetworkPolicyDetail, error) {
	p, err := w.factory.Networking().V1().NetworkPolicies().Lister().NetworkPolicies(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	types := make([]string, 0, len(p.Spec.PolicyTypes))
	for _, t := range p.Spec.PolicyTypes {
		types = append(types, string(t))
	}
	return &NetworkPolicyDetail{
		Name:        p.Name,
		Namespace:   p.Namespace,
		UID:         string(p.UID),
		PodSelector: formatLabelSelector(&p.Spec.PodSelector),
		PolicyTypes: types,
		Ingress:     len(p.Spec.Ingress),
		Egress:      len(p.Spec.Egress),
		Labels:      p.Labels,
		Annotations: p.Annotations,
		CreatedAt:   p.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) StorageClass(name string) (*StorageClassDetail, error) {
	s, err := w.factory.Storage().V1().StorageClasses().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	mode := ""
	if s.VolumeBindingMode != nil {
		mode = string(*s.VolumeBindingMode)
	}
	reclaim := ""
	if s.ReclaimPolicy != nil {
		reclaim = string(*s.ReclaimPolicy)
	}
	allow := false
	if s.AllowVolumeExpansion != nil {
		allow = *s.AllowVolumeExpansion
	}
	return &StorageClassDetail{
		Name:              s.Name,
		UID:               string(s.UID),
		Provisioner:       s.Provisioner,
		ReclaimPolicy:     reclaim,
		VolumeBindingMode: mode,
		AllowExpansion:    allow,
		IsDefault:         s.Annotations["storageclass.kubernetes.io/is-default-class"] == "true",
		Parameters:        s.Parameters,
		MountOptions:      append([]string(nil), s.MountOptions...),
		Labels:            s.Labels,
		Annotations:       s.Annotations,
		CreatedAt:         s.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) PersistentVolume(name string) (*PersistentVolumeDetail, error) {
	p, err := w.factory.Core().V1().PersistentVolumes().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	modes := make([]string, 0, len(p.Spec.AccessModes))
	for _, m := range p.Spec.AccessModes {
		modes = append(modes, string(m))
	}
	cap := ""
	if q, ok := p.Spec.Capacity[corev1.ResourceStorage]; ok {
		cap = q.String()
	}
	vm := ""
	if p.Spec.VolumeMode != nil {
		vm = string(*p.Spec.VolumeMode)
	}
	claim := ""
	if p.Spec.ClaimRef != nil {
		claim = p.Spec.ClaimRef.Namespace + "/" + p.Spec.ClaimRef.Name
	}
	return &PersistentVolumeDetail{
		Name:          p.Name,
		UID:           string(p.UID),
		Status:        string(p.Status.Phase),
		Capacity:      cap,
		AccessModes:   modes,
		ReclaimPolicy: string(p.Spec.PersistentVolumeReclaimPolicy),
		StorageClass:  p.Spec.StorageClassName,
		VolumeMode:    vm,
		Claim:         claim,
		Source:        pvSource(p),
		Message:       p.Status.Message,
		Reason:        p.Status.Reason,
		Labels:        p.Labels,
		Annotations:   p.Annotations,
		CreatedAt:     p.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func pvSource(p *corev1.PersistentVolume) string {
	s := p.Spec.PersistentVolumeSource
	switch {
	case s.HostPath != nil:
		return "HostPath:" + s.HostPath.Path
	case s.NFS != nil:
		return "NFS:" + s.NFS.Server + ":" + s.NFS.Path
	case s.CSI != nil:
		return "CSI:" + s.CSI.Driver
	case s.Local != nil:
		return "Local:" + s.Local.Path
	}
	return ""
}

func (w *contextWatcher) PersistentVolumeClaim(namespace, name string) (*PersistentVolumeClaimDetail, error) {
	p, err := w.factory.Core().V1().PersistentVolumeClaims().Lister().PersistentVolumeClaims(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	modes := make([]string, 0, len(p.Spec.AccessModes))
	for _, m := range p.Spec.AccessModes {
		modes = append(modes, string(m))
	}
	cap := ""
	if q, ok := p.Status.Capacity[corev1.ResourceStorage]; ok {
		cap = q.String()
	}
	req := ""
	if q, ok := p.Spec.Resources.Requests[corev1.ResourceStorage]; ok {
		req = q.String()
	}
	sc := ""
	if p.Spec.StorageClassName != nil {
		sc = *p.Spec.StorageClassName
	}
	vm := ""
	if p.Spec.VolumeMode != nil {
		vm = string(*p.Spec.VolumeMode)
	}
	conds := make([]ConditionDetail, 0, len(p.Status.Conditions))
	for _, c := range p.Status.Conditions {
		conds = append(conds, ConditionDetail{
			Type:    string(c.Type),
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}
	return &PersistentVolumeClaimDetail{
		Name:         p.Name,
		Namespace:    p.Namespace,
		UID:          string(p.UID),
		Status:       string(p.Status.Phase),
		Volume:       p.Spec.VolumeName,
		StorageClass: sc,
		VolumeMode:   vm,
		AccessModes:  modes,
		Capacity:     cap,
		Request:      req,
		Selector:     matchLabels(p.Spec.Selector),
		Conditions:   conds,
		Labels:       p.Labels,
		Annotations:  p.Annotations,
		CreatedAt:    p.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ReplicaSet(namespace, name string) (*ReplicaSetDetail, error) {
	r, err := w.factory.Apps().V1().ReplicaSets().Lister().ReplicaSets(namespace).Get(name)
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
	d, err := w.factory.Apps().V1().DaemonSets().Lister().DaemonSets(namespace).Get(name)
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
	j, err := w.factory.Batch().V1().Jobs().Lister().Jobs(namespace).Get(name)
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
	c, err := w.factory.Batch().V1().CronJobs().Lister().CronJobs(namespace).Get(name)
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

func (w *contextWatcher) Service(namespace, name string) (*ServiceDetail, error) {
	s, err := w.factory.Core().V1().Services().Lister().Services(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	clusterIPs := append([]string{}, s.Spec.ClusterIPs...)
	if len(clusterIPs) == 0 && s.Spec.ClusterIP != "" {
		clusterIPs = []string{s.Spec.ClusterIP}
	}
	ports := make([]ServicePortDetail, 0, len(s.Spec.Ports))
	for _, p := range s.Spec.Ports {
		ports = append(ports, ServicePortDetail{
			Name:       p.Name,
			Protocol:   string(p.Protocol),
			Port:       p.Port,
			TargetPort: p.TargetPort.String(),
			NodePort:   p.NodePort,
		})
	}
	externalIPs := append([]string{}, s.Spec.ExternalIPs...)
	if s.Spec.Type == corev1.ServiceTypeLoadBalancer {
		for _, ing := range s.Status.LoadBalancer.Ingress {
			if ing.IP != "" {
				externalIPs = append(externalIPs, ing.IP)
			} else if ing.Hostname != "" {
				externalIPs = append(externalIPs, ing.Hostname)
			}
		}
	}
	return &ServiceDetail{
		Name:            s.Name,
		Namespace:       s.Namespace,
		UID:             string(s.UID),
		Type:            string(s.Spec.Type),
		ClusterIPs:      clusterIPs,
		ExternalIPs:     externalIPs,
		Selector:        s.Spec.Selector,
		Ports:           ports,
		SessionAffinity: string(s.Spec.SessionAffinity),
		Labels:          s.Labels,
		Annotations:     s.Annotations,
		CreatedAt:       s.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ConfigMap(namespace, name string) (*ConfigMapDetail, error) {
	c, err := w.factory.Core().V1().ConfigMaps().Lister().ConfigMaps(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	binaryKeys := make([]string, 0, len(c.BinaryData))
	for k := range c.BinaryData {
		binaryKeys = append(binaryKeys, k)
	}
	sort.Strings(binaryKeys)
	return &ConfigMapDetail{
		Name:        c.Name,
		Namespace:   c.Namespace,
		UID:         string(c.UID),
		Data:        c.Data,
		BinaryKeys:  binaryKeys,
		Labels:      c.Labels,
		Annotations: c.Annotations,
		CreatedAt:   c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) Secret(namespace, name string) (*SecretDetail, error) {
	s, err := w.factory.Core().V1().Secrets().Lister().Secrets(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	keys := make([]SecretKeyInfo, 0, len(s.Data))
	for k, v := range s.Data {
		keys = append(keys, SecretKeyInfo{Key: k, Size: len(v)})
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i].Key < keys[j].Key })
	return &SecretDetail{
		Name:        s.Name,
		Namespace:   s.Namespace,
		UID:         string(s.UID),
		Type:        string(s.Type),
		Keys:        keys,
		Labels:      s.Labels,
		Annotations: s.Annotations,
		CreatedAt:   s.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

// SecretValue returns the decoded UTF-8 value for a single key of a
// Secret. Values are only fetched when the user explicitly asks the UI
// to reveal them — never as part of a list or detail load.
func (w *contextWatcher) SecretValue(namespace, name, key string) (string, error) {
	s, err := w.factory.Core().V1().Secrets().Lister().Secrets(namespace).Get(name)
	if err != nil {
		return "", err
	}
	v, ok := s.Data[key]
	if !ok {
		return "", fmt.Errorf("secret %s/%s has no key %q", namespace, name, key)
	}
	return string(v), nil
}

func (w *contextWatcher) Ingress(namespace, name string) (*IngressDetail, error) {
	ing, err := w.factory.Networking().V1().Ingresses().Lister().Ingresses(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	class := ""
	if ing.Spec.IngressClassName != nil {
		class = *ing.Spec.IngressClassName
	}
	rules := make([]IngressRuleDetail, 0, len(ing.Spec.Rules))
	for _, r := range ing.Spec.Rules {
		paths := []IngressPathDetail{}
		if r.HTTP != nil {
			for _, p := range r.HTTP.Paths {
				svcName := ""
				svcPort := ""
				if p.Backend.Service != nil {
					svcName = p.Backend.Service.Name
					if p.Backend.Service.Port.Number != 0 {
						svcPort = fmt.Sprintf("%d", p.Backend.Service.Port.Number)
					} else {
						svcPort = p.Backend.Service.Port.Name
					}
				}
				pathType := ""
				if p.PathType != nil {
					pathType = string(*p.PathType)
				}
				paths = append(paths, IngressPathDetail{
					Path:        p.Path,
					PathType:    pathType,
					ServiceName: svcName,
					ServicePort: svcPort,
				})
			}
		}
		rules = append(rules, IngressRuleDetail{Host: r.Host, Paths: paths})
	}
	tls := make([]IngressTLSDetail, 0, len(ing.Spec.TLS))
	for _, t := range ing.Spec.TLS {
		tls = append(tls, IngressTLSDetail{Hosts: t.Hosts, SecretName: t.SecretName})
	}
	addresses := make([]string, 0, len(ing.Status.LoadBalancer.Ingress))
	for _, lb := range ing.Status.LoadBalancer.Ingress {
		if lb.IP != "" {
			addresses = append(addresses, lb.IP)
		} else if lb.Hostname != "" {
			addresses = append(addresses, lb.Hostname)
		}
	}
	return &IngressDetail{
		Name:        ing.Name,
		Namespace:   ing.Namespace,
		UID:         string(ing.UID),
		Class:       class,
		Rules:       rules,
		TLS:         tls,
		Addresses:   addresses,
		Labels:      ing.Labels,
		Annotations: ing.Annotations,
		CreatedAt:   ing.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) Node(name string) (*NodeDetail, error) {
	n, err := w.factory.Core().V1().Nodes().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	capacity := quantitiesToStrings(n.Status.Capacity)
	allocatable := quantitiesToStrings(n.Status.Allocatable)
	taints := make([]NodeTaintDetail, 0, len(n.Spec.Taints))
	for _, t := range n.Spec.Taints {
		taints = append(taints, NodeTaintDetail{Key: t.Key, Value: t.Value, Effect: string(t.Effect)})
	}
	hostname := ""
	for _, a := range n.Status.Addresses {
		if a.Type == corev1.NodeHostName {
			hostname = a.Address
			break
		}
	}
	return &NodeDetail{
		Name:             n.Name,
		UID:              string(n.UID),
		Status:           nodeStatus(n),
		Roles:            nodeRoles(n),
		Version:          n.Status.NodeInfo.KubeletVersion,
		OSImage:          n.Status.NodeInfo.OSImage,
		KernelVersion:    n.Status.NodeInfo.KernelVersion,
		ContainerRuntime: n.Status.NodeInfo.ContainerRuntimeVersion,
		Architecture:     n.Status.NodeInfo.Architecture,
		InternalIP:       nodeInternalIP(n),
		Hostname:         hostname,
		Capacity:         capacity,
		Allocatable:      allocatable,
		Taints:           taints,
		Labels:           n.Labels,
		Annotations:      n.Annotations,
		Conditions:       nodeConditions(n.Status.Conditions),
		CreatedAt:        n.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) Namespace(name string) (*NamespaceDetail, error) {
	n, err := w.factory.Core().V1().Namespaces().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	return &NamespaceDetail{
		Name:        n.Name,
		UID:         string(n.UID),
		Phase:       string(n.Status.Phase),
		Labels:      n.Labels,
		Annotations: n.Annotations,
		CreatedAt:   n.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ServiceAccount(namespace, name string) (*ServiceAccountDetail, error) {
	s, err := w.factory.Core().V1().ServiceAccounts().Lister().ServiceAccounts(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	secrets := make([]ObjectRefDetail, 0, len(s.Secrets))
	for _, r := range s.Secrets {
		secrets = append(secrets, ObjectRefDetail{Kind: "Secret", Namespace: r.Namespace, Name: r.Name})
	}
	pulls := make([]ObjectRefDetail, 0, len(s.ImagePullSecrets))
	for _, r := range s.ImagePullSecrets {
		pulls = append(pulls, ObjectRefDetail{Kind: "Secret", Namespace: s.Namespace, Name: r.Name})
	}
	automount := ""
	if s.AutomountServiceAccountToken != nil {
		if *s.AutomountServiceAccountToken {
			automount = "true"
		} else {
			automount = "false"
		}
	}
	return &ServiceAccountDetail{
		Name:                         s.Name,
		Namespace:                    s.Namespace,
		UID:                          string(s.UID),
		AutomountServiceAccountToken: automount,
		Secrets:                      secrets,
		ImagePullSecrets:             pulls,
		Labels:                       s.Labels,
		Annotations:                  s.Annotations,
		CreatedAt:                    s.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) Role(namespace, name string) (*RoleDetail, error) {
	r, err := w.factory.Rbac().V1().Roles().Lister().Roles(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	return &RoleDetail{
		Name:        r.Name,
		Namespace:   r.Namespace,
		UID:         string(r.UID),
		Rules:       policyRules(r.Rules),
		Labels:      r.Labels,
		Annotations: r.Annotations,
		CreatedAt:   r.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) RoleBinding(namespace, name string) (*RoleBindingDetail, error) {
	b, err := w.factory.Rbac().V1().RoleBindings().Lister().RoleBindings(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	return &RoleBindingDetail{
		Name:      b.Name,
		Namespace: b.Namespace,
		UID:       string(b.UID),
		RoleRef: RoleRefDetail{
			Kind:     b.RoleRef.Kind,
			Name:     b.RoleRef.Name,
			APIGroup: b.RoleRef.APIGroup,
		},
		Subjects:    rbacSubjects(b.Subjects),
		Labels:      b.Labels,
		Annotations: b.Annotations,
		CreatedAt:   b.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ClusterRole(name string) (*ClusterRoleDetail, error) {
	r, err := w.factory.Rbac().V1().ClusterRoles().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	var aggLabel map[string]string
	if r.AggregationRule != nil && len(r.AggregationRule.ClusterRoleSelectors) > 0 {
		merged := map[string]string{}
		for _, sel := range r.AggregationRule.ClusterRoleSelectors {
			for k, v := range sel.MatchLabels {
				merged[k] = v
			}
		}
		if len(merged) > 0 {
			aggLabel = merged
		}
	}
	return &ClusterRoleDetail{
		Name:             r.Name,
		UID:              string(r.UID),
		Rules:            policyRules(r.Rules),
		AggregationLabel: aggLabel,
		Labels:           r.Labels,
		Annotations:      r.Annotations,
		CreatedAt:        r.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ClusterRoleBinding(name string) (*ClusterRoleBindingDetail, error) {
	b, err := w.factory.Rbac().V1().ClusterRoleBindings().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	return &ClusterRoleBindingDetail{
		Name: b.Name,
		UID:  string(b.UID),
		RoleRef: RoleRefDetail{
			Kind:     b.RoleRef.Kind,
			Name:     b.RoleRef.Name,
			APIGroup: b.RoleRef.APIGroup,
		},
		Subjects:    rbacSubjects(b.Subjects),
		Labels:      b.Labels,
		Annotations: b.Annotations,
		CreatedAt:   b.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func policyRules(rules []rbacv1.PolicyRule) []PolicyRuleDetail {
	out := make([]PolicyRuleDetail, 0, len(rules))
	for _, r := range rules {
		out = append(out, PolicyRuleDetail{
			Verbs:           append([]string{}, r.Verbs...),
			APIGroups:       append([]string{}, r.APIGroups...),
			Resources:       append([]string{}, r.Resources...),
			ResourceNames:   append([]string{}, r.ResourceNames...),
			NonResourceURLs: append([]string{}, r.NonResourceURLs...),
		})
	}
	return out
}

func rbacSubjects(subjects []rbacv1.Subject) []SubjectDetail {
	out := make([]SubjectDetail, 0, len(subjects))
	for _, s := range subjects {
		out = append(out, SubjectDetail{
			Kind:      s.Kind,
			Name:      s.Name,
			Namespace: s.Namespace,
			APIGroup:  s.APIGroup,
		})
	}
	return out
}

// ===== helpers =====

func containerSummaries(specs []corev1.Container) []ContainerSummary {
	out := make([]ContainerSummary, 0, len(specs))
	for _, c := range specs {
		ports := make([]string, 0, len(c.Ports))
		for _, p := range c.Ports {
			proto := string(p.Protocol)
			if proto == "" {
				proto = "TCP"
			}
			ports = append(ports, fmt.Sprintf("%d/%s", p.ContainerPort, proto))
		}
		out = append(out, ContainerSummary{
			Name:     c.Name,
			Image:    c.Image,
			Ports:    ports,
			Command:  append([]string(nil), c.Command...),
			Args:     append([]string(nil), c.Args...),
			EnvCount: len(c.Env) + len(c.EnvFrom),
		})
	}
	return out
}

func matchLabels(sel *metav1.LabelSelector) map[string]string {
	if sel == nil {
		return nil
	}
	return sel.MatchLabels
}

func deploymentConditions(conds []appsv1.DeploymentCondition) []ConditionDetail {
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

func nodeConditions(conds []corev1.NodeCondition) []ConditionDetail {
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

func quantitiesToStrings(m corev1.ResourceList) map[string]string {
	out := make(map[string]string, len(m))
	for k, v := range m {
		out[string(k)] = v.String()
	}
	return out
}

