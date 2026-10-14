package kube

import (
	"context"
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func ciliumTestTable(t *testing.T, detail *CiliumResourceDetail, title string) CiliumTable {
	t.Helper()
	for _, table := range detail.Tables {
		if table.Title == title {
			return table
		}
	}
	t.Fatalf("table %q missing", title)
	return CiliumTable{}
}

func TestCiliumPolicyRules(t *testing.T) {
	obj := mustUnstructured(t, `
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata: {name: web, namespace: app}
spec:
  endpointSelector:
    matchLabels: {"k8s:app": web}
    matchExpressions:
      - {key: "k8s:team", operator: In, values: [platform]}
  enableDefaultDeny: {ingress: false, egress: true}
  ingress:
    - fromEndpoints: [{matchLabels: {"k8s:app": client}}]
      toPorts:
        - ports: [{port: "8080", endPort: 8090, protocol: TCP}]
          rules:
            http:
              - {method: GET, path: "/health", headers: ["X-Team: platform"]}
          terminatingTLS:
            secret: {name: tls}
  egress:
    - toCIDRSet:
        - {cidr: "10.0.0.0/8", except: ["10.1.0.0/16"]}
        - {cidrGroupRef: external}
      icmps: [{fields: [{family: IPv4, type: 8}]}]
    - toFQDNs: [{matchPattern: "*.example.com"}]
      toPorts: [{ports: [{port: "443", protocol: TCP}]}]
  egressDeny:
    - toEntities: [world]
specs:
  - endpointSelector: {}
    ingressDeny: [{fromCIDR: ["192.0.2.0/24"]}]
`)
	before, err := json.Marshal(obj.Object)
	if err != nil {
		t.Fatal(err)
	}
	d := extractCiliumDetail(obj, "ciliumnetworkpolicies")
	if d.Secondary != "1 ingress · 2 egress · 2 deny" || !strings.Contains(d.Primary, "k8s:team In [platform]") {
		t.Fatalf("wrong policy summary: %+v", d.CiliumResourceInfo)
	}
	rows := ciliumTestTable(t, d, "Traffic rules").Rows
	if len(rows) != 5 || rows[0][3] != "8080–8090/TCP" || !strings.Contains(rows[0][4], "headers: X-Team: platform") {
		t.Fatalf("wrong traffic rows: %+v", rows)
	}
	if !strings.Contains(rows[1][2], "10.0.0.0/8 except 10.1.0.0/16") || !strings.Contains(rows[1][5], "type=8") || rows[3][1] != "egressDeny" || rows[4][1] != "ingressDeny" {
		t.Fatalf("CIDR/ICMP/deny rules lost: %+v", rows)
	}
	selectors := ciliumTestTable(t, d, "Policy selectors").Rows
	if selectors[0][3] != "false" || selectors[0][4] != "true" || selectors[1][1] != "<all>" {
		t.Fatalf("default deny or empty selector lost: %+v", selectors)
	}
	wantRefs := []CiliumReference{
		{Kind: "Secret", Namespace: "app", Name: "tls"},
		{Kind: "CiliumCIDRGroup", Resource: "ciliumcidrgroups", Name: "external"},
	}
	if !reflect.DeepEqual(d.References, wantRefs) {
		t.Fatalf("references = %+v", d.References)
	}
	after, err := json.Marshal(obj.Object)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) {
		t.Fatal("projection mutated informer cache")
	}
}

func TestCiliumEndpointReportedStatus(t *testing.T) {
	d := extractCiliumDetail(mustUnstructured(t, `
apiVersion: cilium.io/v2
kind: CiliumEndpoint
metadata:
  name: web
  namespace: app
  ownerReferences: [{apiVersion: v1, kind: Pod, name: web, uid: pod}]
status:
  state: waiting-for-identity
  identity: {id: 12345, labels: ["k8s:app=web"]}
  external-identifiers: {pod-name: app/web}
  networking:
    node: "10.0.0.1"
    addressing: [{ipv4: "10.0.1.2", ipv6: "fd00::2"}]
  policy:
    ingress: {enforcing: false, allowed: [{identity: 2, dest-port: 443, protocol: 6}]}
  controllers:
    - name: identity
      status: {consecutive-failure-count: 2, last-failure-msg: allocation-pending}
`), "ciliumendpoints")
	if d.State != "waiting-for-identity" || d.Primary != "10.0.1.2, fd00::2" || d.Secondary != "12345" {
		t.Fatalf("wrong endpoint status: %+v", d.CiliumResourceInfo)
	}
	if len(d.References) != 2 || d.References[0].Kind != "Pod" || d.References[1].Name != "12345" {
		t.Fatalf("wrong references: %+v", d.References)
	}
	for _, ref := range d.References {
		if ref.Kind == "Node" {
			t.Fatal("node IP must not become a Node name")
		}
	}
	if row := ciliumTestTable(t, d, "Reported ingress identities").Rows[0]; row[1] != "2" || row[3] != "443" {
		t.Fatalf("wrong identity tuple: %+v", row)
	}
	if row := ciliumTestTable(t, d, "Failing controllers").Rows[0]; row[1] != "2" || row[2] != "allocation-pending" {
		t.Fatalf("wrong controller status: %+v", row)
	}
}

func TestCiliumNetworkAndBGPSummaries(t *testing.T) {
	tests := []struct{ resource, manifest, primary, table string }{
		{"ciliumloadbalancerippools", `spec:
  blocks: [{cidr: "192.0.2.0/24"}, {start: "2001:db8::1", stop: "2001:db8::f"}]
  serviceSelector: {matchExpressions: [{key: team, operator: Exists}]}
status:
  conditions: [{type: cilium.io/IPsTotal, status: Unknown, message: "18446744073709551616"}]
`, "192.0.2.0/24, 2001:db8::1 – 2001:db8::f", "IP blocks"},
		{"ciliumegressgatewaypolicies", `spec:
  destinationCIDRs: ["0.0.0.0/0"]
  excludedCIDRs: ["10.0.0.0/8"]
  selectors: [{podSelector: {matchLabels: {app: web}}}]
  egressGateways: [{nodeSelector: {matchLabels: {role: gateway}}, egressIP: "192.0.2.1"}]
`, "0.0.0.0/0", "Egress gateways"},
		{"ciliumbgpclusterconfigs", `spec:
  bgpInstances:
    - name: router
      localASN: 4294967295
      peers: [{name: upstream, peerASN: 0, peerAddress: "192.0.2.2", peerConfigRef: {name: defaults}}]
`, "all nodes", "Configured peers"},
		{"ciliumbgppeerconfigs", `spec:
  authSecretRef: bgp-auth
  families: [{afi: ipv4, safi: unicast}, {afi: ipv6, safi: unicast, advertisements: {}}]
`, "ipv4/unicast, ipv6/unicast", "Address families"},
		{"ciliumbgpadvertisements", `spec:
  advertisements:
    - advertisementType: Service
      service: {addresses: [LoadBalancerIP]}
      attributes: {communities: {standard: ["65000:100"]}}
`, "Service", "Advertisements"},
		{"ciliumbgpnodeconfigs", `spec: {bgpInstances: [{name: router, localASN: 65001}]}
status:
  bgpInstances:
    - name: router
      peers:
        - name: upstream
          peeringState: established
          routeCount: [{afi: ipv4, safi: unicast, received: 3, advertised: 7}]
`, "example", "Reported routes"},
		{"ciliumbgpnodeconfigoverrides", `spec:
  bgpInstances:
    - name: router
      routerID: "192.0.2.1"
      peers: [{name: upstream, localAddress: "192.0.2.3", localPort: 179}]
`, "example", "Configured peers"},
		{"ciliumnodes", `spec:
  ipam: {podCIDRs: ["10.0.1.0/24"], pool: {"10.0.1.2": {resource: eni-example}}}
status:
  ipam: {used: {"10.0.1.2": {owner: app/web, resource: eni-example}}}
`, "10.0.1.0/24", "Allocated IPs"},
	}
	for _, tt := range tests {
		t.Run(tt.resource, func(t *testing.T) {
			obj := mustUnstructured(t, "metadata: {name: example}\n"+tt.manifest)
			d := extractCiliumDetail(obj, tt.resource)
			if d.Primary != tt.primary {
				t.Fatalf("primary = %q; want %q", d.Primary, tt.primary)
			}
			table := ciliumTestTable(t, d, tt.table)
			for _, row := range table.Rows {
				if len(row) != len(table.Columns) {
					t.Fatalf("table row does not match headers: %+v", row)
				}
			}
			if tt.resource == "ciliumloadbalancerippools" {
				found := false
				for _, f := range d.Fields {
					if f.Label == "Total IPs" && f.Value == "18446744073709551616" {
						found = true
					}
				}
				if !found {
					t.Fatal("IPv6 pool count lost precision")
				}
			}
			if tt.resource == "ciliumbgppeerconfigs" {
				if table.Rows[0][2] != "none" || table.Rows[1][2] != "<all>" {
					t.Fatal("absent and empty advertisement selectors conflated")
				}
				if len(d.References) != 0 {
					t.Fatal("auth Secret namespace cannot be inferred from CRD")
				}
			}
		})
	}
}

func TestCiliumDiscoveryAndScope(t *testing.T) {
	for resource, def := range ciliumResources {
		for _, version := range []string{"v2", "v2alpha1"} {
			t.Run(resource+"/"+version, func(t *testing.T) {
				gvr := schema.GroupVersionResource{Group: ciliumGroup, Version: version, Resource: resource}
				ns := ""
				if def.namespaced {
					ns = "app"
				}
				obj := &unstructured.Unstructured{Object: map[string]any{"apiVersion": ciliumGroup + "/" + version, "kind": def.kind}}
				obj.SetName("example")
				obj.SetNamespace(ns)
				m, dyn := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: def.kind, namespaced: def.namespaced}}, obj)
				d, err := m.GetCiliumResource(context.Background(), "ctx", resource, "app", "example")
				if err != nil {
					t.Fatal(err)
				}
				if d.Kind != def.kind || d.Fields == nil || d.Tables == nil || d.References == nil {
					t.Fatal("invalid detail shape")
				}
				actions := dyn.Actions()
				if len(actions) != 1 || actions[0].GetVerb() != "get" || actions[0].GetResource() != gvr || actions[0].GetNamespace() != ns {
					t.Fatalf("incorrect API routing: %+v", actions)
				}
			})
		}
	}
	m, _ := fakeCRDManager(t, nil)
	if got := m.ListCiliumResources("ctx", "ciliumendpoints", ""); got == nil || len(got) != 0 {
		t.Fatal("missing CRD must return []")
	}
	if _, err := m.GetCiliumResource(context.Background(), "ctx", "ciliumendpoints", "app", "web"); err == nil {
		t.Fatal("missing CRD must fail")
	}
	if _, err := m.GetCiliumResource(context.Background(), "ctx", "secrets", "app", "web"); err == nil {
		t.Fatal("unsupported resource must fail")
	}
}

func TestCiliumCachedListsAcrossNamespaces(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: ciliumGroup, Version: "v2", Resource: "ciliumendpoints"}
	m, dyn := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: "CiliumEndpoint", namespaced: true}})
	for _, ns := range []string{"z", "a", "b"} {
		obj := &unstructured.Unstructured{Object: map[string]any{"apiVersion": "cilium.io/v2", "kind": "CiliumEndpoint"}}
		obj.SetName("web")
		obj.SetNamespace(ns)
		startFakeCRWatch(t, m, gvr, obj)
	}
	rows := m.ListCiliumResources("ctx", "ciliumendpoints", "z,a")
	if len(rows) != 2 || rows[0].Namespace != "a" || rows[1].Namespace != "z" {
		t.Fatalf("multi-namespace list = %+v", rows)
	}
	if len(dyn.Actions()) != 0 {
		t.Fatal("list must read informer cache without API calls")
	}
}

func TestCiliumEmptyProjectionsAndSafeFields(t *testing.T) {
	for resource := range ciliumResources {
		d := extractCiliumDetail(&unstructured.Unstructured{Object: map[string]any{}}, resource)
		data, err := json.Marshal(d)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(data), "null") {
			t.Fatalf("%s emitted null arrays", resource)
		}
	}
	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{"authSecretRef": "auth", "password": "not-for-projection"},
	}}
	d := extractCiliumDetail(obj, "ciliumbgppeerconfigs")
	data, err := json.Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), "not-for-projection") {
		t.Fatal("unprojected spec was forwarded")
	}
}
