export const KLUSTR_CTX = '__klustrCtx' as const

export type Tagged<T> = T & { [KLUSTR_CTX]: string }

export function resourceContext(row: unknown): string {
  return (row as { [KLUSTR_CTX]?: string })[KLUSTR_CTX] ?? ''
}

export function resolveResourceContexts(activeContexts: string[], contexts?: string[]): string[] {
  return contexts ?? activeContexts
}
