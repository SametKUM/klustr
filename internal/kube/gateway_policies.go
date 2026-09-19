package kube

import (
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
)

type ListenerSetInfo struct {
	Name           string `json:"name"`
	Namespace      string `json:"namespace"`
	Parent         string `json:"parent"`
	Listeners      string `json:"listeners"`
	AttachedRoutes int32  `json:"attachedRoutes"`
	Accepted       string `json:"accepted"`
	Programmed     string `json:"programmed"`
	CreatedAt      string `json:"createdAt"`
}

type ListenerSetListenerDetail struct {
	Name              string            `json:"name"`
	Hostname          string            `json:"hostname"`
	Protocol          string            `json:"protocol"`
	Port              int32             `json:"port"`
	AllowedNamespaces string            `json:"allowedNamespaces"`
	NamespaceSelector string            `json:"namespaceSelector"`
	AllowedKinds      []string          `json:"allowedKinds"`
	SupportedKinds    []string          `json:"supportedKinds"`
	TLSMode           string            `json:"tlsMode"`
	CertificateRefs   []ParentRefDetail `json:"certificateRefs"`
	AttachedRoutes    int32             `json:"attachedRoutes"`
	Conditions        []ConditionDetail `json:"conditions"`
}

type ListenerSetDetail struct {
	Name        string                      `json:"name"`
	Namespace   string                      `json:"namespace"`
	UID         string                      `json:"uid"`
	Parent      ParentRefDetail             `json:"parent"`
	Listeners   []ListenerSetListenerDetail `json:"listeners"`
	Conditions  []ConditionDetail           `json:"conditions"`
	Labels      map[string]string           `json:"labels"`
	Annotations map[string]string           `json:"annotations"`
	CreatedAt   string                      `json:"createdAt"`
}

type BackendTLSPolicyInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Targets      string `json:"targets"`
	Hostname     string `json:"hostname"`
	Accepted     string `json:"accepted"`
	ResolvedRefs string `json:"resolvedRefs"`
	CreatedAt    string `json:"createdAt"`
}

type BackendTLSSubjectAltNameDetail struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type PolicyAncestorStatusDetail struct {
	Ancestor   ParentRefDetail   `json:"ancestor"`
	Controller string            `json:"controller"`
	Conditions []ConditionDetail `json:"conditions"`
}

type BackendTLSPolicyDetail struct {
	Name                    string                           `json:"name"`
	Namespace               string                           `json:"namespace"`
	UID                     string                           `json:"uid"`
	TargetRefs              []ParentRefDetail                `json:"targetRefs"`
	Hostname                string                           `json:"hostname"`
	WellKnownCACertificates string                           `json:"wellKnownCACertificates"`
	CACertificateRefs       []ParentRefDetail                `json:"caCertificateRefs"`
	SubjectAltNames         []BackendTLSSubjectAltNameDetail `json:"subjectAltNames"`
	Ancestors               []PolicyAncestorStatusDetail     `json:"ancestors"`
	Options                 map[string]string                `json:"options"`
	Labels                  map[string]string                `json:"labels"`
	Annotations             map[string]string                `json:"annotations"`
	CreatedAt               string                           `json:"createdAt"`
}

func listenerSetInfo(set *gatewayv1.ListenerSet) ListenerSetInfo {
	parent := listenerSetParent(set.Spec.ParentRef, set.Namespace)
	parentName := parent.Name
	if parent.Namespace != set.Namespace {
		parentName = parent.Namespace + "/" + parent.Name
	}
	listeners := make([]string, 0, len(set.Spec.Listeners))
	for _, listener := range set.Spec.Listeners {
		listeners = append(listeners, fmt.Sprintf("%s:%d/%s", listener.Name, listener.Port, listener.Protocol))
	}
	var attachedRoutes int32
	for _, status := range set.Status.Listeners {
		attachedRoutes += status.AttachedRoutes
	}
	return ListenerSetInfo{
		Name: set.Name, Namespace: set.Namespace, Parent: parentName,
		Listeners: strings.Join(listeners, ", "), AttachedRoutes: attachedRoutes,
		Accepted:   conditionStatus(set.Status.Conditions, "Accepted", set.Generation),
		Programmed: conditionStatus(set.Status.Conditions, "Programmed", set.Generation),
		CreatedAt:  set.CreationTimestamp.UTC().Format(time.RFC3339),
	}
}

func listenerSetDetail(set *gatewayv1.ListenerSet) *ListenerSetDetail {
	statuses := make(map[gatewayv1.SectionName]gatewayv1.ListenerEntryStatus, len(set.Status.Listeners))
	for _, status := range set.Status.Listeners {
		statuses[status.Name] = status
	}
	listeners := make([]ListenerSetListenerDetail, 0, len(set.Spec.Listeners))
	for _, listener := range set.Spec.Listeners {
		status := statuses[listener.Name]
		detail := ListenerSetListenerDetail{
			Name: string(listener.Name), Protocol: string(listener.Protocol), Port: listener.Port,
			AllowedNamespaces: "Same", AllowedKinds: []string{},
			SupportedKinds:  gatewayRouteKinds(status.SupportedKinds),
			CertificateRefs: []ParentRefDetail{}, AttachedRoutes: status.AttachedRoutes,
			Conditions: conditionsToDetail(status.Conditions, set.Generation),
		}
		if listener.Hostname != nil {
			detail.Hostname = string(*listener.Hostname)
		}
		if allowed := listener.AllowedRoutes; allowed != nil {
			detail.AllowedKinds = gatewayRouteKinds(allowed.Kinds)
			if namespaces := allowed.Namespaces; namespaces != nil {
				if namespaces.From != nil {
					detail.AllowedNamespaces = string(*namespaces.From)
				}
				if namespaces.Selector != nil {
					detail.NamespaceSelector = metav1.FormatLabelSelector(namespaces.Selector)
				}
			}
		}
		if tls := listener.TLS; tls != nil {
			detail.TLSMode = "Terminate"
			if tls.Mode != nil {
				detail.TLSMode = string(*tls.Mode)
			}
			for _, cert := range tls.CertificateRefs {
				ref := ParentRefDetail{Kind: "Secret", Name: string(cert.Name), Namespace: set.Namespace}
				if cert.Group != nil {
					ref.Group = string(*cert.Group)
				}
				if cert.Kind != nil {
					ref.Kind = string(*cert.Kind)
				}
				if cert.Namespace != nil {
					ref.Namespace = string(*cert.Namespace)
				}
				detail.CertificateRefs = append(detail.CertificateRefs, ref)
			}
		}
		listeners = append(listeners, detail)
	}
	return &ListenerSetDetail{
		Name: set.Name, Namespace: set.Namespace, UID: string(set.UID),
		Parent:    listenerSetParent(set.Spec.ParentRef, set.Namespace),
		Listeners: listeners, Conditions: conditionsToDetail(set.Status.Conditions, set.Generation),
		Labels: set.Labels, Annotations: set.Annotations,
		CreatedAt: set.CreationTimestamp.UTC().Format(time.RFC3339),
	}
}

func listenerSetParent(parent gatewayv1.ParentGatewayReference, namespace string) ParentRefDetail {
	return normalizedGatewayParentRef(gatewayv1.ParentReference{
		Group: parent.Group, Kind: parent.Kind, Name: parent.Name, Namespace: parent.Namespace,
	}, namespace)
}

func gatewayRouteKinds(kinds []gatewayv1.RouteGroupKind) []string {
	out := make([]string, 0, len(kinds))
	for _, kind := range kinds {
		group := gatewayv1.GroupName
		if kind.Group != nil {
			group = string(*kind.Group)
		}
		if group == "" {
			group = "core"
		}
		out = append(out, group+"/"+string(kind.Kind))
	}
	return out
}

func backendTLSPolicyInfo(policy *gatewayv1.BackendTLSPolicy) BackendTLSPolicyInfo {
	targets := make([]string, 0, len(policy.Spec.TargetRefs))
	for _, ref := range policy.Spec.TargetRefs {
		name := string(ref.Kind) + "/" + string(ref.Name)
		if ref.SectionName != nil {
			name += "/" + string(*ref.SectionName)
		}
		targets = append(targets, name)
	}
	conditions := make([][]metav1.Condition, 0, len(policy.Status.Ancestors))
	for _, ancestor := range policy.Status.Ancestors {
		conditions = append(conditions, ancestor.Conditions)
	}
	return BackendTLSPolicyInfo{
		Name: policy.Name, Namespace: policy.Namespace,
		Targets: strings.Join(targets, ", "), Hostname: string(policy.Spec.Validation.Hostname),
		Accepted:     anyConditionStatus(conditions, "Accepted", policy.Generation),
		ResolvedRefs: anyConditionStatus(conditions, "ResolvedRefs", policy.Generation),
		CreatedAt:    policy.CreationTimestamp.UTC().Format(time.RFC3339),
	}
}

func backendTLSPolicyDetail(policy *gatewayv1.BackendTLSPolicy) *BackendTLSPolicyDetail {
	targets := make([]ParentRefDetail, 0, len(policy.Spec.TargetRefs))
	for _, target := range policy.Spec.TargetRefs {
		ref := ParentRefDetail{
			Group: string(target.Group), Kind: string(target.Kind),
			Name: string(target.Name), Namespace: policy.Namespace,
		}
		if target.SectionName != nil {
			ref.SectionName = string(*target.SectionName)
		}
		targets = append(targets, ref)
	}
	validation := policy.Spec.Validation
	certs := make([]ParentRefDetail, 0, len(validation.CACertificateRefs))
	for _, cert := range validation.CACertificateRefs {
		certs = append(certs, ParentRefDetail{
			Group: string(cert.Group), Kind: string(cert.Kind),
			Name: string(cert.Name), Namespace: policy.Namespace,
		})
	}
	sans := make([]BackendTLSSubjectAltNameDetail, 0, len(validation.SubjectAltNames))
	for _, san := range validation.SubjectAltNames {
		value := ""
		switch san.Type {
		case gatewayv1.HostnameSubjectAltNameType:
			value = string(san.Hostname)
		case gatewayv1.URISubjectAltNameType:
			value = string(san.URI)
		}
		sans = append(sans, BackendTLSSubjectAltNameDetail{Type: string(san.Type), Value: value})
	}
	ancestors := make([]PolicyAncestorStatusDetail, 0, len(policy.Status.Ancestors))
	for _, ancestor := range policy.Status.Ancestors {
		ancestors = append(ancestors, PolicyAncestorStatusDetail{
			Ancestor:   normalizedGatewayParentRef(ancestor.AncestorRef, policy.Namespace),
			Controller: string(ancestor.ControllerName), Conditions: conditionsToDetail(ancestor.Conditions, policy.Generation),
		})
	}
	options := make(map[string]string, len(policy.Spec.Options))
	for key, value := range policy.Spec.Options {
		options[string(key)] = string(value)
	}
	wellKnown := ""
	if validation.WellKnownCACertificates != nil {
		wellKnown = string(*validation.WellKnownCACertificates)
	}
	return &BackendTLSPolicyDetail{
		Name: policy.Name, Namespace: policy.Namespace, UID: string(policy.UID),
		TargetRefs: targets, Hostname: string(validation.Hostname),
		WellKnownCACertificates: wellKnown, CACertificateRefs: certs, SubjectAltNames: sans,
		Ancestors: ancestors, Options: options, Labels: policy.Labels, Annotations: policy.Annotations,
		CreatedAt: policy.CreationTimestamp.UTC().Format(time.RFC3339),
	}
}
