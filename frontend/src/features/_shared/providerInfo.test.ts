import { describe, expect, it } from 'vitest'
import { versionProbeTargets } from './providerInfo'
import type { ContextInfo } from '@/lib/api'

function ctx(name: string, execCommand = ''): ContextInfo {
  return {
    name,
    cluster: name,
    server: `https://${name}.example`,
    user: name,
    namespace: '',
    execCommand,
    awsExec: execCommand === 'aws',
    awsVaultExec: execCommand === 'aws-vault',
    awsProfileHint: '',
  }
}

describe('versionProbeTargets', () => {
  it('probes only contexts without an exec credential helper', () => {
    const contexts = [
      ctx('plain'),
      ctx('eks', 'aws'),
      ctx('eks-vault', 'aws-vault'),
      ctx('gke', 'gke-gcloud-auth-plugin'),
      ctx('aks', 'kubelogin'),
      ctx('oidc', '/usr/local/bin/kubectl-oidc_login'),
    ]
    expect(versionProbeTargets(contexts).map((c) => c.name)).toEqual(['plain'])
  })
})
