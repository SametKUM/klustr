package kube

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func ciliumPolicySpecs(obj *unstructured.Unstructured) []map[string]any {
	out := make([]map[string]any, 0)
	if spec, found, _ := nestedMapNoCopy(obj.Object, "spec"); found {
		out = append(out, spec)
	}
	for _, item := range ciliumSlice(obj.Object, "specs") {
		if rule := ciliumObject(item); rule != nil {
			out = append(out, rule)
		}
	}
	return out
}

func ciliumPolicySelector(rule map[string]any) string {
	if _, exists := rule["nodeSelector"]; exists {
		return "nodes: " + ciliumSelector(rule, "nodeSelector", "not specified")
	}
	return ciliumSelector(rule, "endpointSelector", "not specified")
}

func extractCiliumPolicyDetail(d *CiliumResourceDetail, obj *unstructured.Unstructured) {
	policySpecs := ciliumPolicySpecs(obj)
	selectors := make([][]string, 0, len(policySpecs))
	rules := make([][]string, 0)
	for index, spec := range policySpecs {
		ruleName := strconv.Itoa(index + 1)
		selectors = append(selectors, []string{ruleName, ciliumPolicySelector(spec), ciliumText(spec, "description"),
			ciliumText(spec, "enableDefaultDeny", "ingress"), ciliumText(spec, "enableDefaultDeny", "egress")})
		for _, direction := range []string{"ingress", "egress", "ingressDeny", "egressDeny"} {
			for _, raw := range ciliumSlice(spec, direction) {
				rule := ciliumObject(raw)
				peers := ciliumPolicyPeers(d, rule)
				ports := ciliumSlice(rule, "toPorts")
				if len(ports) == 0 {
					rules = append(rules, []string{ruleName, direction, peers, "all ports", "", ciliumICMP(rule), ciliumText(rule, "authentication", "mode")})
				}
				for _, p := range ports {
					portRule := ciliumObject(p)
					portLabels := make([]string, 0)
					for _, port := range ciliumSlice(portRule, "ports") {
						pm := ciliumObject(port)
						label := ciliumText(pm, "port")
						if end := ciliumText(pm, "endPort"); end != "" && end != "0" {
							label += "–" + end
						}
						protocol := ciliumText(pm, "protocol")
						if protocol == "" {
							protocol = "ANY"
						}
						portLabels = append(portLabels, label+"/"+protocol)
					}
					if len(portLabels) == 0 {
						portLabels = append(portLabels, "all ports")
					}
					l7 := ciliumL7(ciliumMap(portRule, "rules"))
					if names := ciliumStrings(portRule, "serverNames"); len(names) > 0 {
						l7 = strings.TrimSpace(l7 + " SNI: " + strings.Join(names, ", "))
					}
					rules = append(rules, []string{ruleName, direction, peers, strings.Join(portLabels, ", "), l7, ciliumICMP(rule), ciliumText(rule, "authentication", "mode")})
					for _, tls := range []string{"terminatingTLS", "originatingTLS"} {
						secret := ciliumMap(portRule, tls, "secret")
						ns := ciliumText(secret, "namespace")
						if ns == "" {
							ns = obj.GetNamespace()
						}
						// A clusterwide policy's default TLS secret namespace depends on
						// agent configuration, so leave that reference unlinked.
						if ns != "" {
							d.reference("Secret", "", ns, ciliumText(secret, "name"))
						}
					}
				}
			}
		}
	}
	d.table("Policy selectors", []string{"Rule", "Selector", "Description", "Default deny ingress", "Default deny egress"}, selectors)
	d.table("Traffic rules", []string{"Rule", "Direction", "Peers", "Ports", "L7 / SNI", "ICMP", "Authentication"}, rules)
	nodeStatus := ciliumMap(obj.Object, "status", "nodes")
	rows := make([][]string, 0, len(nodeStatus))
	names := make([]string, 0, len(nodeStatus))
	for name := range nodeStatus {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		node := ciliumObject(nodeStatus[name])
		rows = append(rows, []string{name, ciliumText(node, "ok"), ciliumText(node, "enforcing"), ciliumText(node, "error"), ciliumText(node, "lastUpdated")})
	}
	d.table("Reported node status", []string{"Node", "Accepted", "Enforcing", "Error", "Updated"}, rows)
}

func ciliumPolicyPeers(d *CiliumResourceDetail, rule map[string]any) string {
	parts := make([]string, 0)
	for _, field := range []string{"fromEndpoints", "toEndpoints", "fromRequires", "toRequires", "fromNodes", "toNodes"} {
		for _, raw := range ciliumSlice(rule, field) {
			parts = append(parts, field+": "+ciliumSelector(map[string]any{"selector": raw}, "selector", "not specified"))
		}
	}
	for _, field := range []string{"fromEntities", "toEntities", "fromCIDR", "toCIDR"} {
		if values := ciliumStrings(rule, field); len(values) > 0 {
			parts = append(parts, field+": "+strings.Join(values, ", "))
		}
	}
	for _, field := range []string{"fromCIDRSet", "toCIDRSet"} {
		for _, raw := range ciliumSlice(rule, field) {
			m := ciliumObject(raw)
			value := ciliumText(m, "cidr")
			if ref := ciliumText(m, "cidrGroupRef"); ref != "" {
				value = "CIDRGroup/" + ref
				d.reference("CiliumCIDRGroup", "ciliumcidrgroups", "", ref)
			}
			if _, found := m["cidrGroupSelector"]; found {
				value = "CIDR groups: " + ciliumSelector(m, "cidrGroupSelector", "none")
			}
			if except := ciliumStrings(m, "except"); len(except) > 0 {
				value += " except " + strings.Join(except, ", ")
			}
			parts = append(parts, field+": "+value)
		}
	}
	for _, raw := range ciliumSlice(rule, "toFQDNs") {
		parts = append(parts, "FQDN: "+ciliumPairs(ciliumObject(raw)))
	}
	for _, raw := range ciliumSlice(rule, "toServices") {
		m := ciliumObject(raw)
		if service := ciliumMap(m, "k8sService"); service != nil {
			ns := ciliumText(service, "namespace")
			if ns == "" {
				ns = d.Namespace
			}
			name := ciliumText(service, "serviceName")
			parts = append(parts, "Service: "+ns+"/"+name)
			if ns != "" {
				d.reference("Service", "", ns, name)
			}
		}
		if selector := ciliumMap(m, "k8sServiceSelector"); selector != nil {
			parts = append(parts, "Services: "+ciliumText(selector, "namespace")+" "+ciliumSelector(selector, "selector", "not specified"))
		}
	}
	// Cloud group selectors are provider-specific. Signal their presence rather
	// than presenting an incomplete rule as unrestricted traffic.
	for _, field := range []string{"toGroups", "fromGroups"} {
		if count := len(ciliumSlice(rule, field)); count > 0 {
			parts = append(parts, fmt.Sprintf("%s: %d cloud selectors (see YAML)", field, count))
		}
	}
	if len(parts) == 0 {
		return "all peers"
	}
	return strings.Join(parts, "; ")
}

func ciliumL7(rules map[string]any) string {
	parts := make([]string, 0)
	for _, protocol := range []string{"http", "dns", "kafka", "l7"} {
		for _, raw := range ciliumSlice(rules, protocol) {
			m := ciliumObject(raw)
			scalars := make(map[string]any)
			for key := range m {
				if value := ciliumText(m, key); value != "" {
					scalars[key] = value
				}
			}
			label := ciliumPairs(scalars)
			if headers := ciliumStrings(m, "headers"); len(headers) > 0 {
				label += "; headers: " + strings.Join(headers, ", ")
			}
			if count := len(ciliumSlice(m, "headerMatches")); count > 0 {
				label += fmt.Sprintf("; %d header matches (see YAML)", count)
			}
			if label == "" {
				label = "all requests"
			}
			parts = append(parts, protocol+": "+label)
		}
	}
	if proto := ciliumText(rules, "l7proto"); proto != "" {
		parts = append(parts, "parser: "+proto)
	}
	return strings.Join(parts, "; ")
}

func ciliumICMP(rule map[string]any) string {
	parts := make([]string, 0)
	for _, raw := range ciliumSlice(rule, "icmps") {
		for _, field := range ciliumSlice(ciliumObject(raw), "fields") {
			parts = append(parts, ciliumPairs(ciliumObject(field)))
		}
	}
	return strings.Join(parts, "; ")
}

func extractCiliumEndpointDetail(d *CiliumResourceDetail, obj *unstructured.Unstructured) {
	status := ciliumMap(obj.Object, "status")
	d.field("Endpoint ID", ciliumText(status, "id"))
	d.field("Security identity", ciliumText(status, "identity", "id"))
	d.field("Identity labels", strings.Join(ciliumStrings(status, "identity", "labels"), ", "))
	d.field("Addresses", d.Primary)
	d.field("Node address", ciliumText(status, "networking", "node"))
	d.field("Service account", ciliumText(status, "service-account"))
	d.field("Encryption key ID", ciliumText(status, "encryption", "key"))
	d.reference("CiliumIdentity", "ciliumidentities", "", ciliumText(status, "identity", "id"))
	if pod := ciliumText(status, "external-identifiers", "pod-name"); pod != "" {
		ns, name, hasNamespace := strings.Cut(pod, "/")
		if !hasNamespace {
			ns, name = obj.GetNamespace(), pod
		}
		d.reference("Pod", "", ns, name)
	}
	for _, direction := range []string{"ingress", "egress"} {
		policy := ciliumMap(status, "policy", direction)
		state := ciliumText(policy, "state")
		if state == "" {
			state = ciliumText(policy, "enforcing")
		}
		d.field(direction+" enforcement", state)
		rows := make([][]string, 0)
		for _, action := range []string{"allowed", "denied"} {
			for _, raw := range ciliumSlice(policy, action) {
				tuple := ciliumObject(raw)
				rows = append(rows, []string{action, ciliumText(tuple, "identity"), ciliumPairs(ciliumMap(tuple, "identity-labels")), ciliumText(tuple, "dest-port"), ciliumText(tuple, "protocol")})
			}
		}
		d.table("Reported "+direction+" identities", []string{"Action", "Identity", "Labels", "Port", "Protocol number"}, rows)
	}
	rawControllers := ciliumSlice(status, "controllers")
	controllers := make([][]string, 0, len(rawControllers))
	for _, raw := range rawControllers {
		controller := ciliumObject(raw)
		controllers = append(controllers, []string{ciliumText(controller, "name"), ciliumText(controller, "status", "consecutive-failure-count"), ciliumText(controller, "status", "last-failure-msg"), ciliumText(controller, "status", "last-failure-timestamp")})
	}
	d.table("Failing controllers", []string{"Name", "Consecutive failures", "Last error", "Last failure"}, controllers)
	namedPorts := ciliumSlice(status, "named-ports")
	ports := make([][]string, 0, len(namedPorts))
	for _, raw := range namedPorts {
		p := ciliumObject(raw)
		ports = append(ports, []string{ciliumText(p, "name"), ciliumText(p, "port"), ciliumText(p, "protocol")})
	}
	d.table("Named ports", []string{"Name", "Port", "Protocol"}, ports)
}
