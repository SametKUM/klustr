export type KEDAPauseFields = {
  paused: boolean
  pausedReplicas: string
  scaleInPaused: boolean
  scaleOutPaused: boolean
}

// kedaPauseLabel names what is paused, '' when nothing is. A full pause wins
// over the one-direction ones, which leave KEDA scaling the other way.
export function kedaPauseLabel(s: KEDAPauseFields): string {
  if (s.paused) return s.pausedReplicas ? `Paused at ${s.pausedReplicas}` : 'Paused'
  if (s.scaleInPaused && s.scaleOutPaused) return 'Scale-in/out paused'
  if (s.scaleInPaused) return 'Scale-in paused'
  if (s.scaleOutPaused) return 'Scale-out paused'
  return ''
}
