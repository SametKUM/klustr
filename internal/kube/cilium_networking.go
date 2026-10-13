package kube

import (
	"fmt"
	"sort"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func extractCiliumIdentityDetail(d *CiliumResourceDetail, obj *unstructured.Unstructured, resource string) {
	spec := ciliumMap(obj.Object, "spec")
	switch resource {
	case "ciliumidentities":
		d.field("Security labels", d.Primary)
	case "ciliumcidrgroups":
		d.field("External CIDRs", d.Primary)
	case "ciliumnodes":
		d.reference("Node", "", "", obj.GetName())
		d.field("Pod CIDRs", d.Primary)
		d.field("Health IPv4", ciliumText(spec, "health", "ipv4"))
		d.field("Health IPv6", ciliumText(spec, "health", "ipv6"))
		d.field("Encryption key ID", ciliumText(spec, "encryption", "key"))
		d.field("IPAM minimum allocation", ciliumText(spec, "ipam", "min-allocate"))
		d.field("IPAM pre-allocation", ciliumText(spec, "ipam", "pre-allocate"))
		d.field("IPAM maximum allocation", ciliumText(spec, "ipam", "max-allocate"))
		d.field("Operator error", ciliumText(obj.Object, "status", "ipam", "operator-status", "error"))
		rawAddresses := ciliumSlice(spec, "addresses")
		addresses := make([][]string, 0, len(rawAddresses))
		for _, raw := range rawAddresses {
			address := ciliumObject(raw)
			addresses = append(addresses, []string{ciliumText(address, "type"), ciliumText(address, "ip")})
		}
		d.table("Node addresses", []string{"Type", "IP"}, addresses)
		for _, pool := range []struct {
			title string
			data  map[string]any
		}{
			{"Allocated IPs", ciliumMap(obj.Object, "status", "ipam", "used")},
			{"Available IPs", ciliumMap(spec, "ipam", "pool")},
		} {
			keys := make([]string, 0, len(pool.data))
			for ip := range pool.data {
				keys = append(keys, ip)
			}
			sort.Strings(keys)
			rows := make([][]string, 0, len(keys))
			for _, ip := range keys {
				entry := ciliumObject(pool.data[ip])
				rows = append(rows, []string{ip, ciliumText(entry, "owner"), ciliumText(entry, "resource")})
			}
			d.table(pool.title, []string{"IP", "Owner", "Resource"}, rows)
		}
	}
}

func extractCiliumNetworkDetail(d *CiliumResourceDetail, obj *unstructured.Unstructured, resource string) {
	spec := ciliumMap(obj.Object, "spec")
	switch resource {
	case "ciliumloadbalancerippools":
		d.field("Service selector", d.Secondary)
		d.field("Disabled", ciliumText(spec, "disabled"))
		d.field("Allow first / last IPs", ciliumText(spec, "allowFirstLastIPs"))
		rows := make([][]string, 0)
		for _, raw := range ciliumSlice(spec, "blocks") {
			block := ciliumObject(raw)
			rows = append(rows, []string{ciliumText(block, "cidr"), ciliumText(block, "start"), ciliumText(block, "stop")})
		}
		d.table("IP blocks", []string{"CIDR", "Start", "Stop"}, rows)
		// LB IPAM reports exact counts as condition messages, potentially larger
		// than JS's safe integers. Preserve them as strings.
		for _, raw := range ciliumSlice(obj.Object, "status", "conditions") {
			c := ciliumObject(raw)
			switch ciliumText(c, "type") {
			case "cilium.io/IPsTotal":
				d.field("Total IPs", ciliumText(c, "message"))
			case "cilium.io/IPsAvailable":
				d.field("Available IPs", ciliumText(c, "message"))
			case "cilium.io/IPsUsed":
				d.field("Used IPs", ciliumText(c, "message"))
			}
		}
	case "ciliuml2announcementpolicies":
		d.field("Service selector", d.Primary)
		d.field("Node selector", d.Secondary)
		d.field("Interfaces", strings.Join(ciliumStrings(spec, "interfaces"), ", "))
		d.field("External IPs", ciliumText(spec, "externalIPs"))
		d.field("LoadBalancer IPs", ciliumText(spec, "loadBalancerIPs"))
	case "ciliumegressgatewaypolicies":
		d.field("Destination CIDRs", d.Primary)
		d.field("Excluded CIDRs", strings.Join(ciliumStrings(spec, "excludedCIDRs"), ", "))
		rawSelectors := ciliumSlice(spec, "selectors")
		selectors := make([][]string, 0, len(rawSelectors))
		for _, raw := range rawSelectors {
			sel := ciliumObject(raw)
			selectors = append(selectors, []string{ciliumSelector(sel, "namespaceSelector", "not specified"), ciliumSelector(sel, "podSelector", "not specified"), ciliumSelector(sel, "nodeSelector", "not specified")})
		}
		d.table("Endpoint selectors", []string{"Namespaces", "Pods", "Nodes"}, selectors)
		gateways := append([]any{}, ciliumSlice(spec, "egressGateways")...)
		if gateway := ciliumMap(spec, "egressGateway"); gateway != nil {
			gateways = append(gateways, gateway)
		}
		rows := make([][]string, 0, len(gateways))
		for _, raw := range gateways {
			gateway := ciliumObject(raw)
			rows = append(rows, []string{ciliumSelector(gateway, "nodeSelector", "not specified"), ciliumText(gateway, "interface"), ciliumText(gateway, "egressIP")})
		}
		d.table("Egress gateways", []string{"Node selector", "Interface", "Egress IP"}, rows)
	}
}

func extractCiliumBGPDetail(d *CiliumResourceDetail, obj *unstructured.Unstructured, resource string) {
	spec := ciliumMap(obj.Object, "spec")
	switch resource {
	case "ciliumbgpclusterconfigs", "ciliumbgpnodeconfigs", "ciliumbgpnodeconfigoverrides":
		if resource == "ciliumbgpclusterconfigs" {
			d.field("Node selector", d.Primary)
		} else {
			d.reference("Node", "", "", obj.GetName())
		}
		rawInstances := ciliumSlice(spec, "bgpInstances")
		instances := make([][]string, 0, len(rawInstances))
		peers := make([][]string, 0)
		for _, raw := range rawInstances {
			instance := ciliumObject(raw)
			name := ciliumText(instance, "name")
			instances = append(instances, []string{name, ciliumText(instance, "localASN"), ciliumText(instance, "routerID"), ciliumText(instance, "localPort")})
			for _, rawPeer := range ciliumSlice(instance, "peers") {
				peer := ciliumObject(rawPeer)
				ref := ciliumText(peer, "peerConfigRef", "name")
				peers = append(peers, []string{name, ciliumText(peer, "name"), ciliumText(peer, "peerASN"), ciliumText(peer, "peerAddress"), ciliumText(peer, "localAddress"), ciliumText(peer, "localPort"), ref, ciliumText(peer, "autoDiscovery", "mode")})
				d.reference("CiliumBGPPeerConfig", "ciliumbgppeerconfigs", "", ref)
			}
		}
		d.table("BGP instances", []string{"Name", "Local ASN", "Router ID", "Local port"}, instances)
		d.table("Configured peers", []string{"Instance", "Name", "Peer ASN", "Peer address", "Local address", "Local port", "Peer config", "Auto discovery"}, peers)
		extractCiliumBGPStatus(d, obj)
	case "ciliumbgppeerconfigs":
		d.field("Authentication Secret", ciliumText(spec, "authSecretRef"))
		d.field("Peer port", ciliumText(spec, "transport", "peerPort"))
		d.field("Source interface", ciliumText(spec, "transport", "sourceInterface"))
		d.field("eBGP multihop TTL", ciliumText(spec, "ebgpMultihop"))
		d.field("Connect retry (s)", ciliumText(spec, "timers", "connectRetryTimeSeconds"))
		d.field("Hold time (s)", ciliumText(spec, "timers", "holdTimeSeconds"))
		d.field("Keepalive (s)", ciliumText(spec, "timers", "keepAliveTimeSeconds"))
		d.field("Graceful restart", ciliumText(spec, "gracefulRestart", "enabled"))
		d.field("Restart time (s)", ciliumText(spec, "gracefulRestart", "restartTimeSeconds"))
		families := ciliumSlice(spec, "families")
		rows := make([][]string, 0, len(families))
		for _, raw := range families {
			family := ciliumObject(raw)
			rows = append(rows, []string{ciliumText(family, "afi"), ciliumText(family, "safi"), ciliumSelector(family, "advertisements", "none")})
		}
		d.table("Address families", []string{"AFI", "SAFI", "Advertisement selector"}, rows)
	case "ciliumbgpadvertisements":
		advertisements := ciliumSlice(spec, "advertisements")
		rows := make([][]string, 0, len(advertisements))
		for _, raw := range advertisements {
			advert := ciliumObject(raw)
			communities := ciliumMap(advert, "attributes", "communities")
			parts := make([]string, 0)
			for _, field := range []string{"standard", "wellKnown", "large"} {
				if values := ciliumStrings(communities, field); len(values) > 0 {
					parts = append(parts, field+": "+strings.Join(values, ", "))
				}
			}
			rows = append(rows, []string{ciliumText(advert, "advertisementType"), ciliumSelector(advert, "selector", "none"), strings.Join(ciliumStrings(advert, "service", "addresses"), ", "), ciliumText(advert, "service", "aggregationLengthIPv4"), ciliumText(advert, "service", "aggregationLengthIPv6"), ciliumText(advert, "attributes", "localPreference"), strings.Join(parts, "; ")})
		}
		d.table("Advertisements", []string{"Type", "Selector", "Service addresses", "IPv4 aggregation", "IPv6 aggregation", "Local preference", "Communities"}, rows)
	}
}

func extractCiliumBGPStatus(d *CiliumResourceDetail, obj *unstructured.Unstructured) {
	peers := make([][]string, 0)
	routes := make([][]string, 0)
	for _, raw := range ciliumSlice(obj.Object, "status", "bgpInstances") {
		instance := ciliumObject(raw)
		instanceName := ciliumText(instance, "name")
		for _, rawPeer := range ciliumSlice(instance, "peers") {
			peer := ciliumObject(rawPeer)
			peerName := ciliumText(peer, "name")
			peers = append(peers, []string{instanceName, peerName, ciliumText(peer, "peerAddress"), ciliumText(peer, "peerASN"), ciliumText(peer, "peeringState"), ciliumText(peer, "establishedTime")})
			for _, rawCount := range ciliumSlice(peer, "routeCount") {
				count := ciliumObject(rawCount)
				routes = append(routes, []string{fmt.Sprintf("%s / %s", instanceName, peerName), ciliumText(count, "afi"), ciliumText(count, "safi"), ciliumText(count, "received"), ciliumText(count, "advertised")})
			}
		}
	}
	d.table("Reported peers", []string{"Instance", "Name", "Peer address", "Peer ASN", "State", "Established"}, peers)
	d.table("Reported routes", []string{"Peer", "AFI", "SAFI", "Received", "Advertised"}, routes)
}
