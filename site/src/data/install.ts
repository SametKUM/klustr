import { SITE } from '../lib/site'

export type InstallTab = {
  id: 'mac' | 'arch' | 'deb' | 'build'
  label: string
  brand: 'apple' | 'archlinux' | 'ubuntu' | 'source'
  html: string
}

const P = '<span class="prompt">$ </span>'
const C = (text: string) => `<span class="comment">${text}</span>`

// Each command block is HTML for a `pre.cmd`: a prompt span starts a copyable
// command, a comment span is a free note, and a trailing backslash continues
// the command on the next line. CommandBlock splits it into per-command rows.
export const INSTALL_TABS: InstallTab[] = [
  {
    id: 'mac',
    label: 'macOS',
    brand: 'apple',
    html: `${P}brew tap sametkum/klustr
${P}brew install klustr`,
  },
  {
    id: 'arch',
    label: 'Arch',
    brand: 'archlinux',
    html: `${P}paru -S klustr-bin   ${C('# or: yay -S klustr-bin')}`,
  },
  {
    id: 'deb',
    label: 'Debian / Ubuntu',
    brand: 'ubuntu',
    html: `${P}V=$(curl -fsSL https://api.github.com/repos/${SITE.repo}/releases/latest \\
    | grep -oP '"tag_name":\\s*"\\K[^"]+')
${P}curl -LO https://github.com/${SITE.repo}/releases/download/$V/klustr_\${V#v}_amd64.deb
${P}sudo apt install ./klustr_\${V#v}_amd64.deb`,
  },
  {
    id: 'build',
    label: 'Build',
    brand: 'source',
    html: `${P}mise install   ${C('# Go, Node, Wails CLI')}
${P}wails dev`,
  },
]

export const MAC_MANUAL = `${P}tar -xzf klustr-*-darwin-arm64.tar.gz
${P}mv klustr.app /Applications/
${P}open /Applications/klustr.app`

export const ARCH_HELPERS = `${P}paru -S klustr-bin
${C('# or')}
${P}yay -S klustr-bin`

export const LINUX_TARBALL = `${P}tar -xzf klustr-*-linux-amd64.tar.gz
${P}install -Dm755 klustr ~/.local/bin/klustr`

export const FROM_SOURCE = `${P}mise install
${P}wails dev`

export const BUILD_RELEASE = `${P}mise install
${P}wails build -trimpath -clean`

export const BREW_UPGRADE = `${P}brew upgrade klustr`

export const AUR_UPGRADE = `${P}paru -Syu`

export const VERIFY_DOWNLOAD = `${P}V=$(curl -fsSL https://api.github.com/repos/${SITE.repo}/releases/latest \\
    | grep -oP '"tag_name":\\s*"\\K[^"]+')
${P}curl -LO https://github.com/${SITE.repo}/releases/download/$V/SHA256SUMS
${P}sha256sum -c --ignore-missing SHA256SUMS   ${C('# macOS: shasum -a 256 -c --ignore-missing SHA256SUMS')}
${P}gh attestation verify klustr-$V-linux-amd64.tar.gz --repo ${SITE.repo}`
