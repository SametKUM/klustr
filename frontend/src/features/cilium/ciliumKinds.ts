export const CILIUM_GROUP = 'cilium.io'

export const CILIUM_RESOURCES = {
  ciliumnetworkpolicies: { kind: 'CiliumNetworkPolicy', label: 'NetworkPolicies', scope: 'namespaced', primary: 'Endpoint selector', secondary: 'Rules' },
  ciliumclusterwidenetworkpolicies: { kind: 'CiliumClusterwideNetworkPolicy', label: 'ClusterwideNetworkPolicies', scope: 'cluster', primary: 'Endpoint / node selector', secondary: 'Rules' },
  ciliumendpoints: { kind: 'CiliumEndpoint', label: 'Endpoints', scope: 'namespaced', primary: 'Addresses', secondary: 'Security identity' },
  ciliumnodes: { kind: 'CiliumNode', label: 'Nodes', scope: 'cluster', primary: 'Pod CIDRs', secondary: 'IP allocation' },
  ciliumidentities: { kind: 'CiliumIdentity', label: 'Identities', scope: 'cluster', primary: 'Security labels', secondary: '' },
  ciliumcidrgroups: { kind: 'CiliumCIDRGroup', label: 'CIDRGroups', scope: 'cluster', primary: 'External CIDRs', secondary: '' },
  ciliumloadbalancerippools: { kind: 'CiliumLoadBalancerIPPool', label: 'LoadBalancerIPPools', scope: 'cluster', primary: 'IP blocks', secondary: 'Service selector' },
  ciliuml2announcementpolicies: { kind: 'CiliumL2AnnouncementPolicy', label: 'L2AnnouncementPolicies', scope: 'cluster', primary: 'Service selector', secondary: 'Node selector' },
  ciliumegressgatewaypolicies: { kind: 'CiliumEgressGatewayPolicy', label: 'EgressGatewayPolicies', scope: 'cluster', primary: 'Destination CIDRs', secondary: 'Selectors' },
  ciliumbgpclusterconfigs: { kind: 'CiliumBGPClusterConfig', label: 'BGPClusterConfigs', scope: 'cluster', primary: 'Node selector', secondary: 'BGP instances' },
  ciliumbgppeerconfigs: { kind: 'CiliumBGPPeerConfig', label: 'BGPPeerConfigs', scope: 'cluster', primary: 'Address families', secondary: 'Authentication Secret' },
  ciliumbgpadvertisements: { kind: 'CiliumBGPAdvertisement', label: 'BGPAdvertisements', scope: 'cluster', primary: 'Advertisement types', secondary: 'Entries' },
  ciliumbgpnodeconfigs: { kind: 'CiliumBGPNodeConfig', label: 'BGPNodeConfigs', scope: 'cluster', primary: 'Node', secondary: 'BGP instances' },
  ciliumbgpnodeconfigoverrides: { kind: 'CiliumBGPNodeConfigOverride', label: 'BGPNodeConfigOverrides', scope: 'cluster', primary: 'Node', secondary: 'Overrides' },
} as const

export type CiliumView = keyof typeof CILIUM_RESOURCES

export function isCiliumView(view: string): view is CiliumView {
  return Object.hasOwn(CILIUM_RESOURCES, view)
}
