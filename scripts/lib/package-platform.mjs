// #region package-platform — docs: docs/evidence/plans/2026-10-10-windows-linux-port.md#req-table
// What scripts/package-platform.mjs passes to electron-builder for a Windows or Linux package (0.3.5, CO-238):
// the names (our own arch words, never the target tool's `amd64`/`x86_64`; platforms.md, lessons), the Azure
// signing options when the release environment holds all three settings (PL-03), and no publishing.

const PLATFORMS = new Set(['win32', 'linux'])
const ARCHS = new Set(['x64', 'arm64'])

/** `--platform win32|linux --arch x64|arm64`, each also as `--name=value`. */
export function parsePlatformArgs(argv) {
  const out = { platform: null, arch: null }
  for (let i = 0; i < argv.length; i++) {
    const m = /^--(platform|arch)(?:=(.*))?$/.exec(argv[i])
    if (!m) throw new Error(`unknown argument ${argv[i]}`)
    out[m[1]] = m[2] ?? argv[++i] ?? null
  }
  if (!PLATFORMS.has(out.platform)) throw new Error(`--platform must be win32 or linux (macOS is scripts/release-mac.mjs), not ${out.platform}`)
  if (!ARCHS.has(out.arch)) throw new Error(`--arch must be x64 or arm64, not ${out.arch}`)
  return out
}

/** The release files this package makes, in the order the builder writes them. */
export function artifactNames({ platform, arch, version }) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error(`not a release version: ${version}`)
  return platform === 'win32'
    ? [`Fabric-${version}-windows-${arch}-setup.exe`]
    : [`Fabric-${version}-linux-${arch}.AppImage`, `Fabric-${version}-linux-${arch}.deb`]
}

/** Azure Artifact Signing's options for electron-builder, or null (NOT_SIGNED) unless all three are set. */
export function signingOptions(env) {
  const endpoint = env.AZURE_SIGNING_ENDPOINT, account = env.AZURE_SIGNING_ACCOUNT, profile = env.AZURE_SIGNING_PROFILE
  if (!endpoint || !account || !profile) return null
  return { endpoint, codeSigningAccountName: account, certificateProfileName: profile, publisherName: 'PassionCode' }
}

export function builderArgs({ platform, arch, version, signing }) {
  const names = artifactNames({ platform, arch, version })
  const ext = '${ext}'
  const args = platform === 'win32'
    ? ['--win', `--${arch}`, '--publish', 'never', `-c.nsis.artifactName=${names[0].replace(/\.exe$/, `.${ext}`)}`]
    : ['--linux', `--${arch}`, '--publish', 'never', `-c.appImage.artifactName=${names[0]}`, `-c.deb.artifactName=${names[1]}`]
  if (platform === 'win32' && signing)
    for (const [k, v] of Object.entries(signing)) args.push(`-c.win.azureSignOptions.${k}=${v}`)
  return args
}
/** PL-10: a release whose Windows installers are not signed says so in its notes — a line of its `## X.Y.Z` section
 *  naming Windows and saying the installer is not signed, so nobody is surprised by SmartScreen. Null when it does. */
export function unsignedWindowsNoteProblem({ version, text }) {
  const lines = String(text ?? '').split('\n')
  const start = lines.findIndex(l => l.trim() === `## ${version}`)
  if (start < 0) return `the changelog has no "## ${version}" section`
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l))
  const body = lines.slice(start + 1, end < 0 ? lines.length : end).join('\n')
  return /windows[^\n]*\b(?:not (?:code-)?signed|unsigned)\b|\b(?:not (?:code-)?signed|unsigned)\b[^\n]*windows/i.test(body) ? null
    : `the ${version} notes do not say the Windows installers are not signed (windows_authenticode: NOT_SIGNED); add the line`
}
// #endregion package-platform
