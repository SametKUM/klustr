import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type KarpenterEC2NodeClassInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { COL_SM, COL_MD } from '@/features/_shared/columnSizes'

const columnHelper = createColumnHelper<KarpenterEC2NodeClassInfo>()

export function KarpenterEC2NodeClassesView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (info) => (
          <span title={info.row.original.status}>
            <ConditionPill status={info.getValue()} />
          </span>
        ),
      }),
      columnHelper.accessor('amiFamily', {
        header: 'AMI family',
        size: COL_MD,
        cell: (info) => info.getValue() || '—',
      }),
      columnHelper.accessor('role', {
        header: 'Role',
        size: 260,
        cell: (info) => info.getValue() || '—',
      }),
      columnHelper.accessor('instanceProfile', {
        header: 'Instance profile',
        size: 180,
        cell: (info) => info.getValue() || '—',
      }),
      columnHelper.accessor('subnetCount', {
        header: 'Subnets',
        size: COL_SM,
        cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      }),
      columnHelper.accessor('securityGroupCount', {
        header: 'Security groups',
        size: 150,
        cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      }),
      columnHelper.accessor('amiCount', {
        header: 'AMIs',
        size: COL_SM,
        cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )

  return (
    <CustomResourceTable
      group="karpenter.k8s.aws"
      resource="ec2nodeclasses"
      kind="EC2NodeClass"
      noun={{ singular: 'EC2 node class', plural: 'EC2 node classes' }}
      scope="cluster"
      fetch={api.listKarpenterEC2NodeClasses}
      columns={columns}
      identity={(row) => ({ namespace: '', name: row.name })}
      unavailableMessage="EC2NodeClass is not installed in the active contexts."
    />
  )
}
