import { execFileSync } from 'node:child_process'
import path from 'node:path'

// The site builds from the site/ directory; paths here are repository-relative.
const ROOT = path.resolve(process.cwd(), '..')

function git(args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return undefined
  }
}

// ISO timestamp of the last commit touching any of the paths, or undefined
// when git is unavailable (a shallow CI checkout still answers, with the
// clone's tip commit, which is why the workflows fetch full history).
export function lastCommitDate(...paths: string[]): string | undefined {
  const out = git(['log', '-1', '--format=%cI', '--', ...paths])
  return out || undefined
}

// ISO timestamp of the commit that added the first of the paths.
export function firstCommitDate(...paths: string[]): string | undefined {
  const out = git(['log', '--diff-filter=A', '--format=%cI', '--', ...paths])
  if (!out) return undefined
  const dates = out.split('\n').filter(Boolean)
  return dates[dates.length - 1]
}
