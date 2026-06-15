import './style.css'
import {
  createIcons,
  Copy,
  Download,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ShieldCheck,
  Zap,
  KeyRound,
  Layers,
  Maximize2,
  ScanSearch,
  Boxes,
  Puzzle,
  Ship,
  GitMerge,
  Waypoints,
  ScrollText,
  FileCode2,
  Hammer,
  Rocket,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide'
import { siApple, siArchlinux, siUbuntu, siLinux } from 'simple-icons'
import * as Swetrix from 'swetrix'

Swetrix.init('DaI17c1xdlkD', { respectDNT: true })
Swetrix.trackViews()

const REPO = 'SametKUM/klustr'
const BASE = import.meta.env.BASE_URL

type Shot = { file: string; title: string; theme: string }

const SHOTS: Shot[] = [
  { file: '01-welcome-default-dark.png', title: 'Connections', theme: 'Default Dark' },
  { file: '02-pods-aggregated-dracula.png', title: 'Aggregated pods', theme: 'Dracula' },
  { file: '03-cluster-overview-nord.png', title: 'Cluster overview', theme: 'Nord' },
  { file: '04-nodes-usage-one-dark.png', title: 'Node usage & pressure', theme: 'One Dark' },
  { file: '05-helm-upgrade-tokyo-night-day.png', title: 'Helm upgrade', theme: 'Tokyo Night Day' },
  { file: '06-argo-applications-one-light.png', title: 'Argo CD applications', theme: 'One Light' },
  { file: '07-flux-kustomization-monokai.png', title: 'Flux CD', theme: 'Monokai' },
  { file: '08-certmanager-chain-nord-light.png', title: 'cert-manager chain', theme: 'Nord Light' },
  { file: '09-gateway-httproutes-tokyo-night.png', title: 'Gateway API · HTTPRoutes', theme: 'Tokyo Night' },
  { file: '10-pod-diagnosis-default-light.png', title: 'Pod diagnosis', theme: 'Default Light' },
  { file: '11-logs-stream-dracula-light.png', title: 'Multi-pod log stream', theme: 'Dracula Light' },
  { file: '13-keda-hpa-nord.png', title: 'KEDA-driven HPA', theme: 'Nord' },
  { file: '15-yaml-diff-default-dark.png', title: 'YAML edit with diff', theme: 'Default Dark' },
  { file: '12-pod-detail-monokai-light.png', title: 'Pod detail', theme: 'Monokai Light' },
  { file: '14-read-only-tokyo-night.png', title: 'Read-only mode', theme: 'Tokyo Night' },
  { file: '16-terminal-drawer-one-dark.png', title: 'Terminal drawer', theme: 'One Dark' },
]

// ── Screenshots gallery ──────────────────────────────────────────────
const gallery = document.querySelector<HTMLElement>('[data-gallery]')
if (gallery) {
  SHOTS.forEach((s, i) => {
    const fig = document.createElement('figure')
    fig.className = 'shot reveal'
    fig.style.animationDelay = `${(i % 3) * 80}ms`
    fig.dataset.index = String(i)
    fig.innerHTML = `
      <img loading="lazy" src="${BASE}screenshots/${s.file}" alt="${s.title} — ${s.theme} theme" />
      <figcaption class="flex items-center justify-between gap-2 px-4 py-3 text-sm">
        <span class="font-medium">${s.title}</span>
        <span class="font-mono text-xs text-muted-foreground">${s.theme}</span>
      </figcaption>`
    fig.addEventListener('click', () => openLightbox(i))
    gallery.appendChild(fig)
  })
}

// ── Lightbox ─────────────────────────────────────────────────────────
const lb = document.getElementById('lightbox')
const lbImg = lb?.querySelector<HTMLImageElement>('[data-lb-img]')
const lbCap = lb?.querySelector<HTMLElement>('[data-lb-caption]')
let lbIndex = 0

function renderLightbox() {
  if (!lbImg || !lbCap) return
  const s = SHOTS[lbIndex]
  lbImg.src = `${BASE}screenshots/${s.file}`
  lbImg.alt = `${s.title} — ${s.theme} theme`
  lbCap.textContent = `${s.title} · ${s.theme} theme`
}

function openLightbox(i: number) {
  if (!lb) return
  lbIndex = i
  renderLightbox()
  lb.classList.remove('hidden')
  lb.classList.add('flex')
  lb.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'hidden'
}

function closeLightbox() {
  if (!lb) return
  lb.classList.add('hidden')
  lb.classList.remove('flex')
  lb.setAttribute('aria-hidden', 'true')
  document.body.style.overflow = ''
}

function stepLightbox(delta: number) {
  lbIndex = (lbIndex + delta + SHOTS.length) % SHOTS.length
  renderLightbox()
}

if (lb) {
  lb.querySelector('[data-lb-close]')?.addEventListener('click', closeLightbox)
  lb.querySelector('[data-lb-prev]')?.addEventListener('click', () => stepLightbox(-1))
  lb.querySelector('[data-lb-next]')?.addEventListener('click', () => stepLightbox(1))
  lb.addEventListener('click', (e) => {
    if (e.target === lb) closeLightbox()
  })
  document.addEventListener('keydown', (e) => {
    if (lb.classList.contains('hidden')) return
    if (e.key === 'Escape') closeLightbox()
    else if (e.key === 'ArrowLeft') stepLightbox(-1)
    else if (e.key === 'ArrowRight') stepLightbox(1)
  })
}

// ── Tabs ─────────────────────────────────────────────────────────────
function selectTab(group: HTMLElement, name: string) {
  group.querySelectorAll<HTMLElement>('[data-tab]').forEach((t) => {
    t.setAttribute('aria-selected', String(t.dataset.tab === name))
  })
  group.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => {
    p.hidden = p.dataset.panel !== name
  })
}

document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((group) => {
  group.querySelectorAll<HTMLElement>('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => selectTab(group, tab.dataset.tab ?? ''))
  })
})

// Pre-select the install tab that matches the visitor's OS.
function detectTab(): string {
  const ua = navigator.userAgent
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac'
  if (/Windows/.test(ua)) return 'build'
  if (/Linux|X11|CrOS/.test(ua)) return 'deb'
  return 'mac'
}
const heroTabs = document.querySelector<HTMLElement>('[data-tabs="hero"]')
if (heroTabs) selectTab(heroTabs, detectTab())

// ── Copy-to-clipboard ────────────────────────────────────────────────
// Each command block is split into one row per command, and every command
// gets its own copy button. Sequenced installs (e.g. the .deb flow) must be
// run one step at a time, so a single block-level copy would be misleading.
// A prompt line ("$ ") starts a command; an unprompted line is a continuation
// only when the previous line ends in a backslash, otherwise it is a free
// comment row (e.g. "# or") with no copy button.
type Command = { lines: string[]; copyable: boolean }

function isPromptLine(html: string): boolean {
  return /^\s*<span class="prompt">/.test(html)
}

function endsWithBackslash(html: string): boolean {
  const probe = document.createElement('div')
  probe.innerHTML = html
  return (probe.textContent ?? '').trimEnd().endsWith('\\')
}

function splitCommands(html: string): Command[] {
  const out: Command[] = []
  for (const line of html.split('\n')) {
    const last = out[out.length - 1]
    if (isPromptLine(line)) {
      out.push({ lines: [line], copyable: true })
    } else if (last?.copyable && endsWithBackslash(last.lines[last.lines.length - 1])) {
      last.lines.push(line)
    } else {
      out.push({ lines: [line], copyable: false })
    }
  }
  return out
}

function makeCopyButton(text: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'cmd-copy'
  btn.setAttribute('aria-label', 'Copy command')
  btn.innerHTML =
    '<i data-lucide="copy" class="cmd-copy-i"></i><i data-lucide="check" class="cmd-copy-check"></i>'
  btn.addEventListener('click', () => {
    void navigator.clipboard.writeText(text).then(
      () => {
        btn.classList.add('copied')
        window.setTimeout(() => btn.classList.remove('copied'), 1600)
      },
      () => {},
    )
  })
  return btn
}

function enhanceCommandBlock(pre: HTMLElement) {
  const list = document.createElement('div')
  list.className = 'cmd-list'
  for (const cmd of splitCommands(pre.innerHTML)) {
    const row = document.createElement('div')
    row.className = 'cmd-row'
    const code = document.createElement('pre')
    code.className = 'cmd-code'
    code.innerHTML = cmd.lines.join('\n')
    row.appendChild(code)
    if (cmd.copyable) {
      // Copy the runnable command only: drop inline comments (# …) and the
      // trailing whitespace they leave behind, so it pastes-and-runs as-is.
      const runnable = code.cloneNode(true) as HTMLElement
      runnable.querySelectorAll('.comment').forEach((c) => c.remove())
      const text = (runnable.textContent ?? '')
        .replace(/^\$\s/, '')
        .replace(/[ \t]+$/gm, '')
        .trim()
      row.appendChild(makeCopyButton(text))
    }
    list.appendChild(row)
  }
  pre.replaceWith(list)
}

document.querySelectorAll<HTMLElement>('pre.cmd').forEach(enhanceCommandBlock)

// ── Live data from GitHub (version + stars), best-effort ─────────────
async function hydrateFromGitHub() {
  try {
    const [release, repo] = await Promise.allSettled([
      fetch(`https://api.github.com/repos/${REPO}/releases/latest`).then((r) =>
        r.ok ? r.json() : Promise.reject(),
      ),
      fetch(`https://api.github.com/repos/${REPO}`).then((r) =>
        r.ok ? r.json() : Promise.reject(),
      ),
    ])

    if (release.status === 'fulfilled' && release.value?.tag_name) {
      const tag = String(release.value.tag_name)
      document.querySelectorAll('[data-version]').forEach((el) => (el.textContent = tag))
      document.querySelectorAll('[data-version-inline]').forEach((el) => (el.textContent = tag))
    }
    if (repo.status === 'fulfilled' && typeof repo.value?.stargazers_count === 'number') {
      const stars = repo.value.stargazers_count as number
      const text = stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : String(stars)
      document.querySelectorAll('[data-stars]').forEach((el) => (el.textContent = text))
    }
  } catch {
    /* offline or rate-limited — defaults stay in place */
  }
}

// ── Scroll reveal ────────────────────────────────────────────────────
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (reduceMotion) {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'))
} else {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in')
          io.unobserve(entry.target)
        }
      })
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  )
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
}

// ── Sticky nav state + back-to-top ───────────────────────────────────
const nav = document.getElementById('nav')
const toTop = document.getElementById('to-top')
if (nav || toTop) {
  const onScroll = () => {
    const y = window.scrollY
    nav?.classList.toggle('nav-scrolled', y > 8)
    toTop?.classList.toggle('show', y > 600)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}
toTop?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
})

// ── Brand (OS) logos via simple-icons ────────────────────────────────
const BRANDS: Record<string, { path: string; color: string }> = {
  apple: { path: siApple.path, color: 'currentColor' },
  archlinux: { path: siArchlinux.path, color: `#${siArchlinux.hex}` },
  ubuntu: { path: siUbuntu.path, color: `#${siUbuntu.hex}` },
  linux: { path: siLinux.path, color: 'currentColor' },
}
document.querySelectorAll<HTMLElement>('[data-brand]').forEach((el) => {
  const brand = BRANDS[el.dataset.brand ?? '']
  if (!brand) return
  const size = el.dataset.brandSize ?? '1em'
  el.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${brand.color}" aria-hidden="true"><path d="${brand.path}"/></svg>`
})

// ── Fullscreen the hero clip ─────────────────────────────────────────
const heroVideo = document.querySelector<HTMLVideoElement>('video')
document.querySelector<HTMLButtonElement>('[data-fs]')?.addEventListener('click', () => {
  if (!heroVideo) return
  const v = heroVideo as HTMLVideoElement & { webkitEnterFullscreen?: () => void }
  if (v.requestFullscreen) void v.requestFullscreen()
  else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen()
})

// ── Icons (run last so injected nodes are covered) ───────────────────
createIcons({
  icons: {
    Copy,
    Download,
    ArrowDown,
    ArrowUp,
    ArrowUpRight,
    Check,
    ShieldCheck,
    Zap,
    KeyRound,
    Layers,
    Maximize2,
    ScanSearch,
    Boxes,
    Puzzle,
    Ship,
    GitMerge,
    Waypoints,
    ScrollText,
    FileCode2,
    Hammer,
    Rocket,
    X,
    ChevronLeft,
    ChevronRight,
  },
})

void hydrateFromGitHub()
