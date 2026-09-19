import { useCallback } from 'react'
import { api, type TLSRouteDetail } from '@/lib/api'
import { ErrorBox } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { L4RouteOverview } from '@/features/gateways/L4RouteOverview'

export function TLSRouteDetailBody({ contextName, namespace, name }: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((context: string) => api.getTLSRoute(context, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<TLSRouteDetail>(contextName, 'TLSRoute', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return <L4RouteOverview detail={detail} kind="TLSRoute" contextName={contextName} />
}
