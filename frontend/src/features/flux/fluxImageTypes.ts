import type { FluxImageRepositoryInfo } from '@/lib/api'

export type FluxImageStatus = Pick<
  FluxImageRepositoryInfo,
  'name' | 'namespace' | 'ready' | 'status' | 'suspended' | 'interval' | 'createdAt'
>
