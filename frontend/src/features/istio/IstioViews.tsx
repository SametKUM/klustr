import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import {
  api,
  type IstioAuthorizationPolicyInfo,
  type IstioGatewayInfo,
  type IstioRequestAuthenticationInfo,
  type IstioServiceEntryInfo,
  type IstioSidecarInfo,
} from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import {
  ISTIO_AUTHORIZATIONPOLICY_RESOURCE,
  ISTIO_GATEWAY_RESOURCE,
  ISTIO_NETWORKING_GROUP,
  ISTIO_REQUESTAUTHENTICATION_RESOURCE,
  ISTIO_SECURITY_GROUP,
  ISTIO_SERVICEENTRY_RESOURCE,
  ISTIO_SIDECAR_RESOURCE,
} from './istioKinds'

const age = { header: 'Age', size: COL_SM, sortingFn: 'datetime' as const }

function Scope({ value }: { value: string }) {
  return value === 'namespace-wide' || value === 'mesh-wide' ? (
    <span className="text-muted-foreground">{value}</span>
  ) : (
    <span className="font-mono text-xs">{value}</span>
  )
}

function List({ items }: { items: string[] }) {
  const text = items.join(', ')
  return <span title={text}>{text || '—'}</span>
}

const gw = createColumnHelper<IstioGatewayInfo>()

export function IstioGatewaysView() {
  const columns = useMemo(
    () => [
      gw.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      gw.accessor('name', { header: 'Name' }),
      gw.accessor('selector', { header: 'Selector', size: 180, cell: (i) => <span className="font-mono text-xs">{i.getValue() || '—'}</span> }),
      gw.accessor('ports', { header: 'Ports', size: 150 }),
      gw.accessor((r) => r.hosts.join(', '), { id: 'hosts', header: 'Hosts', cell: (i) => <List items={i.row.original.hosts} /> }),
      gw.accessor('createdAt', { ...age, cell: (i) => formatAge(i.getValue()) }),
    ],
    [],
  )
  return (
    <CustomResourceTable
      group={ISTIO_NETWORKING_GROUP}
      resource={ISTIO_GATEWAY_RESOURCE}
      kind="IstioGateway"
      noun={{ singular: 'gateway', plural: 'gateways' }}
      scope="namespaced"
      fetch={api.listIstioGateways}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Istio Gateways are not available in the active contexts."
    />
  )
}

const se = createColumnHelper<IstioServiceEntryInfo>()

export function IstioServiceEntriesView() {
  const columns = useMemo(
    () => [
      se.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      se.accessor('name', { header: 'Name' }),
      se.accessor((r) => r.hosts.join(', '), { id: 'hosts', header: 'Hosts', cell: (i) => <List items={i.row.original.hosts} /> }),
      se.accessor('location', { header: 'Location', size: COL_MD }),
      se.accessor('resolution', { header: 'Resolution', size: COL_SM }),
      se.accessor('ports', { header: 'Ports', size: 140 }),
      se.accessor('endpoints', { header: 'Endpoints', size: COL_SM, cell: (i) => <span className="tabular-nums">{i.getValue()}</span> }),
      se.accessor('createdAt', { ...age, cell: (i) => formatAge(i.getValue()) }),
    ],
    [],
  )
  return (
    <CustomResourceTable
      group={ISTIO_NETWORKING_GROUP}
      resource={ISTIO_SERVICEENTRY_RESOURCE}
      kind="IstioServiceEntry"
      noun={{ singular: 'service entry', plural: 'service entries' }}
      scope="namespaced"
      fetch={api.listIstioServiceEntries}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Istio ServiceEntries are not available in the active contexts."
    />
  )
}

const sc = createColumnHelper<IstioSidecarInfo>()

export function IstioSidecarsView() {
  const columns = useMemo(
    () => [
      sc.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      sc.accessor('name', { header: 'Name' }),
      sc.accessor('selector', { header: 'Applies to', size: 180, cell: (i) => <Scope value={i.getValue()} /> }),
      sc.accessor((r) => r.egressHosts.join(', '), {
        id: 'egressHosts',
        header: 'Egress hosts',
        cell: (i) => <List items={i.row.original.egressHosts} />,
      }),
      sc.accessor('outboundPolicy', { header: 'Outbound', size: 140 }),
      sc.accessor('createdAt', { ...age, cell: (i) => formatAge(i.getValue()) }),
    ],
    [],
  )
  return (
    <CustomResourceTable
      group={ISTIO_NETWORKING_GROUP}
      resource={ISTIO_SIDECAR_RESOURCE}
      kind="IstioSidecar"
      noun={{ singular: 'sidecar', plural: 'sidecars' }}
      scope="namespaced"
      fetch={api.listIstioSidecars}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Istio Sidecars are not available in the active contexts."
    />
  )
}

const ap = createColumnHelper<IstioAuthorizationPolicyInfo>()

export function IstioAuthorizationPoliciesView() {
  const columns = useMemo(
    () => [
      ap.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      ap.accessor('name', { header: 'Name' }),
      ap.accessor('action', { header: 'Action', size: COL_SM, cell: (i) => <ActionPill action={i.getValue()} /> }),
      ap.accessor('scope', { header: 'Applies to', size: 200, cell: (i) => <Scope value={i.getValue()} /> }),
      ap.accessor('rules', {
        header: 'Rules',
        size: 200,
        cell: (i) =>
          i.row.original.effect ? (
            <span className="text-amber-700 dark:text-amber-300">{i.row.original.effect}</span>
          ) : (
            <span className="tabular-nums">{i.getValue()}</span>
          ),
      }),
      ap.accessor('createdAt', { ...age, cell: (i) => formatAge(i.getValue()) }),
    ],
    [],
  )
  return (
    <CustomResourceTable
      group={ISTIO_SECURITY_GROUP}
      resource={ISTIO_AUTHORIZATIONPOLICY_RESOURCE}
      kind="IstioAuthorizationPolicy"
      noun={{ singular: 'authorization policy', plural: 'authorization policies' }}
      scope="namespaced"
      fetch={api.listIstioAuthorizationPolicies}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Istio AuthorizationPolicies are not available in the active contexts."
    />
  )
}

export function ActionPill({ action }: { action: string }) {
  const cls =
    action === 'DENY'
      ? 'bg-destructive/15 text-destructive'
      : action === 'ALLOW'
        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
        : 'bg-muted text-muted-foreground'
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {action}
    </span>
  )
}

const ra = createColumnHelper<IstioRequestAuthenticationInfo>()

export function IstioRequestAuthenticationsView() {
  const columns = useMemo(
    () => [
      ra.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      ra.accessor('name', { header: 'Name' }),
      ra.accessor('scope', { header: 'Applies to', size: 200, cell: (i) => <Scope value={i.getValue()} /> }),
      ra.accessor((r) => r.issuers.join(', '), { id: 'issuers', header: 'Issuers', cell: (i) => <List items={i.row.original.issuers} /> }),
      ra.accessor('createdAt', { ...age, cell: (i) => formatAge(i.getValue()) }),
    ],
    [],
  )
  return (
    <CustomResourceTable
      group={ISTIO_SECURITY_GROUP}
      resource={ISTIO_REQUESTAUTHENTICATION_RESOURCE}
      kind="IstioRequestAuthentication"
      noun={{ singular: 'request authentication', plural: 'request authentications' }}
      scope="namespaced"
      fetch={api.listIstioRequestAuthentications}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Istio RequestAuthentications are not available in the active contexts."
    />
  )
}
