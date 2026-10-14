package kube

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const ciliumGroup = "cilium.io"

func ciliumGR(resource string) schema.GroupResource {
	return schema.GroupResource{Group: ciliumGroup, Resource: resource}
}

type ciliumResourceDefinition struct {
	kind       string
	namespaced bool
}

var ciliumResources = map[string]ciliumResourceDefinition{
	"ciliumnetworkpolicies":            {"CiliumNetworkPolicy", true},
	"ciliumclusterwidenetworkpolicies": {"CiliumClusterwideNetworkPolicy", false},
	"ciliumendpoints":                  {"CiliumEndpoint", true},
	"ciliumnodes":                      {"CiliumNode", false},
	"ciliumidentities":                 {"CiliumIdentity", false},
	"ciliumcidrgroups":                 {"CiliumCIDRGroup", false},
	"ciliumloadbalancerippools":        {"CiliumLoadBalancerIPPool", false},
	"ciliuml2announcementpolicies":     {"CiliumL2AnnouncementPolicy", false},
	"ciliumegressgatewaypolicies":      {"CiliumEgressGatewayPolicy", false},
	"ciliumbgpclusterconfigs":          {"CiliumBGPClusterConfig", false},
	"ciliumbgppeerconfigs":             {"CiliumBGPPeerConfig", false},
	"ciliumbgpadvertisements":          {"CiliumBGPAdvertisement", false},
	"ciliumbgpnodeconfigs":             {"CiliumBGPNodeConfig", false},
	"ciliumbgpnodeconfigoverrides":     {"CiliumBGPNodeConfigOverride", false},
}

type CiliumResourceInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Kind      string `json:"kind"`
	State     string `json:"state"`
	Primary   string `json:"primary"`
	Secondary string `json:"secondary"`
	CreatedAt string `json:"createdAt"`
}

type CiliumField struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

// Tables contain only explicitly projected Cilium fields. Never forward a raw
// spec: BGP auth and policy TLS configuration can reference sensitive material.
type CiliumTable struct {
	Title   string     `json:"title"`
	Columns []string   `json:"columns"`
	Rows    [][]string `json:"rows"`
}

type CiliumReference struct {
	Kind      string `json:"kind"`
	Resource  string `json:"resource"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

type CiliumResourceDetail struct {
	CiliumResourceInfo
	Fields     []CiliumField     `json:"fields"`
	Tables     []CiliumTable     `json:"tables"`
	References []CiliumReference `json:"references"`
}

func (m *ClientManager) ListCiliumResources(contextName, resource, namespace string) []CiliumResourceInfo {
	def, supported := ciliumResources[resource]
	if !supported {
		return []CiliumResourceInfo{}
	}
	if !def.namespaced {
		namespace = ""
	}
	extract := func(obj *unstructured.Unstructured) CiliumResourceInfo { return extractCiliumInfo(obj, resource) }
	return listServedRows(m, contextName, ciliumGR(resource), namespace, extract,
		func(r CiliumResourceInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetCiliumResource(ctx context.Context, contextName, resource, namespace, name string) (*CiliumResourceDetail, error) {
	def, supported := ciliumResources[resource]
	if !supported {
		return nil, fmt.Errorf("unsupported Cilium resource %q", resource)
	}
	if !def.namespaced {
		namespace = ""
	}
	obj, err := m.getServedCR(ctx, contextName, ciliumGR(resource), namespace, name)
	if err != nil {
		return nil, err
	}
	return extractCiliumDetail(obj, resource), nil
}

func extractCiliumInfo(obj *unstructured.Unstructured, resource string) CiliumResourceInfo {
	out := CiliumResourceInfo{
		Name: obj.GetName(), Namespace: obj.GetNamespace(), Kind: ciliumResources[resource].kind, CreatedAt: crCreatedAt(obj),
	}
	conds := crConditions(obj)
	states := make([]string, 0, len(conds))
	for _, c := range conds {
		states = append(states, strings.TrimPrefix(c.Type, "cilium.io/")+"="+c.Status)
	}
	out.State = strings.Join(states, ", ")
	spec := ciliumMap(obj.Object, "spec")
	switch resource {
	case "ciliumnetworkpolicies", "ciliumclusterwidenetworkpolicies":
		rules := ciliumPolicySpecs(obj)
		selectors := make([]string, 0, len(rules))
		ingress, egress, deny := 0, 0, 0
		for _, rule := range rules {
			selectors = append(selectors, ciliumPolicySelector(rule))
			ingress += len(ciliumSlice(rule, "ingress"))
			egress += len(ciliumSlice(rule, "egress"))
			deny += len(ciliumSlice(rule, "ingressDeny")) + len(ciliumSlice(rule, "egressDeny"))
		}
		out.Primary = strings.Join(selectors, "; ")
		out.Secondary = fmt.Sprintf("%d ingress · %d egress · %d deny", ingress, egress, deny)
	case "ciliumendpoints":
		status := ciliumMap(obj.Object, "status")
		out.State = ciliumText(status, "state")
		out.Primary = ciliumAddresses(ciliumSlice(status, "networking", "addressing"))
		out.Secondary = ciliumText(status, "identity", "id")
	case "ciliumnodes":
		out.Primary = strings.Join(ciliumStrings(spec, "ipam", "podCIDRs"), ", ")
		out.Secondary = fmt.Sprintf("%d allocated IPs", len(ciliumMap(obj.Object, "status", "ipam", "used")))
	case "ciliumidentities":
		out.Primary = ciliumPairs(ciliumMap(obj.Object, "security-labels"))
	case "ciliumcidrgroups":
		out.Primary = strings.Join(ciliumStrings(spec, "externalCIDRs"), ", ")
	case "ciliumloadbalancerippools":
		out.Primary = ciliumIPBlocks(ciliumSlice(spec, "blocks"))
		out.Secondary = ciliumSelector(spec, "serviceSelector", "all services")
		if ciliumText(spec, "disabled") == "true" {
			out.State = "Disabled"
		}
	case "ciliuml2announcementpolicies":
		out.Primary = ciliumSelector(spec, "serviceSelector", "all services")
		out.Secondary = ciliumSelector(spec, "nodeSelector", "all nodes")
	case "ciliumegressgatewaypolicies":
		out.Primary = strings.Join(ciliumStrings(spec, "destinationCIDRs"), ", ")
		out.Secondary = fmt.Sprintf("%d selectors", len(ciliumSlice(spec, "selectors")))
	case "ciliumbgpclusterconfigs", "ciliumbgpnodeconfigs":
		out.Primary = ciliumSelector(spec, "nodeSelector", "all nodes")
		if resource == "ciliumbgpnodeconfigs" {
			out.Primary = obj.GetName()
		}
		out.Secondary = fmt.Sprintf("%d instances", len(ciliumSlice(spec, "bgpInstances")))
	case "ciliumbgpnodeconfigoverrides":
		out.Primary = obj.GetName()
		out.Secondary = fmt.Sprintf("%d overrides", len(ciliumSlice(spec, "bgpInstances")))
	case "ciliumbgppeerconfigs":
		out.Primary = ciliumFamilies(ciliumSlice(spec, "families"))
		out.Secondary = ciliumText(spec, "authSecretRef")
	case "ciliumbgpadvertisements":
		advertisements := ciliumSlice(spec, "advertisements")
		types := make([]string, 0, len(advertisements))
		for _, item := range advertisements {
			types = append(types, ciliumText(ciliumObject(item), "advertisementType"))
		}
		out.Primary = strings.Join(types, ", ")
		out.Secondary = strconv.Itoa(len(types))
	}
	return out
}

func extractCiliumDetail(obj *unstructured.Unstructured, resource string) *CiliumResourceDetail {
	d := &CiliumResourceDetail{
		CiliumResourceInfo: extractCiliumInfo(obj, resource),
		Fields:             []CiliumField{}, Tables: []CiliumTable{}, References: []CiliumReference{},
	}
	for _, owner := range obj.GetOwnerReferences() {
		if owner.APIVersion == "v1" && (owner.Kind == "Pod" || owner.Kind == "Node") {
			ns := ""
			if owner.Kind == "Pod" {
				ns = obj.GetNamespace()
			}
			d.reference(owner.Kind, "", ns, owner.Name)
		}
		for res, def := range ciliumResources {
			if owner.Kind == def.kind && strings.HasPrefix(owner.APIVersion, ciliumGroup+"/") {
				d.reference(def.kind, res, "", owner.Name)
			}
		}
	}
	conds := crConditions(obj)
	rows := make([][]string, 0, len(conds))
	for _, c := range conds {
		rows = append(rows, []string{c.Type, c.Status, c.Reason, c.Message, c.LastTransitionTime})
	}
	d.table("Conditions", []string{"Type", "Status", "Reason", "Message", "Changed"}, rows)
	switch resource {
	case "ciliumnetworkpolicies", "ciliumclusterwidenetworkpolicies":
		extractCiliumPolicyDetail(d, obj)
	case "ciliumendpoints":
		extractCiliumEndpointDetail(d, obj)
	case "ciliumnodes", "ciliumidentities", "ciliumcidrgroups":
		extractCiliumIdentityDetail(d, obj, resource)
	case "ciliumloadbalancerippools", "ciliuml2announcementpolicies", "ciliumegressgatewaypolicies":
		extractCiliumNetworkDetail(d, obj, resource)
	default:
		extractCiliumBGPDetail(d, obj, resource)
	}
	return d
}

func (d *CiliumResourceDetail) field(label, value string) {
	d.Fields = append(d.Fields, CiliumField{Label: label, Value: value})
}

func (d *CiliumResourceDetail) table(title string, columns []string, rows [][]string) {
	if len(rows) > 0 {
		d.Tables = append(d.Tables, CiliumTable{Title: title, Columns: columns, Rows: rows})
	}
}

func (d *CiliumResourceDetail) reference(kind, resource, namespace, name string) {
	if name == "" {
		return
	}
	ref := CiliumReference{Kind: kind, Resource: resource, Namespace: namespace, Name: name}
	for _, existing := range d.References {
		if existing == ref {
			return
		}
	}
	d.References = append(d.References, ref)
}

func ciliumObject(value any) map[string]any {
	out, _ := value.(map[string]any)
	return out
}

func ciliumMap(obj map[string]any, path ...string) map[string]any {
	out, _, _ := nestedMapNoCopy(obj, path...)
	return out
}

func ciliumSlice(obj map[string]any, path ...string) []any {
	out, _, _ := nestedSliceNoCopy(obj, path...)
	return out
}

func ciliumStrings(obj map[string]any, path ...string) []string {
	out, _, _ := unstructured.NestedStringSlice(obj, path...)
	return append([]string{}, out...)
}

func ciliumText(obj map[string]any, path ...string) string {
	value, found, _ := unstructured.NestedFieldNoCopy(obj, path...)
	if !found || value == nil {
		return ""
	}
	switch v := value.(type) {
	case string:
		return v
	case int64:
		return strconv.FormatInt(v, 10)
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(v)
	default:
		return ""
	}
}

func ciliumPairs(obj map[string]any) string {
	keys := make([]string, 0, len(obj))
	for k := range obj {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+ciliumText(obj, k))
	}
	return strings.Join(parts, ", ")
}

func ciliumSelector(obj map[string]any, field, absent string) string {
	value, found, _ := nestedMapNoCopy(obj, field)
	if !found {
		return absent
	}
	var selector metav1.LabelSelector
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(value, &selector); err != nil {
		return "invalid selector"
	}
	return formatLabelSelector(&selector)
}

func ciliumAddresses(items []any) string {
	addresses := make([]string, 0, len(items)*2)
	for _, item := range items {
		m := ciliumObject(item)
		for _, key := range []string{"ipv4", "ipv6"} {
			if ip := ciliumText(m, key); ip != "" {
				addresses = append(addresses, ip)
			}
		}
	}
	return strings.Join(addresses, ", ")
}

func ciliumIPBlocks(items []any) string {
	blocks := make([]string, 0, len(items))
	for _, item := range items {
		m := ciliumObject(item)
		if cidr := ciliumText(m, "cidr"); cidr != "" {
			blocks = append(blocks, cidr)
		} else {
			blocks = append(blocks, ciliumText(m, "start")+" – "+ciliumText(m, "stop"))
		}
	}
	return strings.Join(blocks, ", ")
}

func ciliumFamilies(items []any) string {
	families := make([]string, 0, len(items))
	for _, item := range items {
		m := ciliumObject(item)
		families = append(families, ciliumText(m, "afi")+"/"+ciliumText(m, "safi"))
	}
	return strings.Join(families, ", ")
}
