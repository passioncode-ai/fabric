// Version/profile verification is not a signed binary attestation, complete
// native SDK pin, or proof of reproducible packaging. No installer is invoked.
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { sha256 } from './build-identity.mjs'

const tools = ['electron', 'electron-builder', 'electron-vite', 'vite', 'typescript', '@electron/rebuild', 'node-pty']
const entrypoints = { electron: 'cli.js', 'electron-builder': 'cli.js', 'electron-vite': 'bin/electron-vite.js', vite: 'bin/vite.js', typescript: 'bin/tsc', '@electron/rebuild': 'lib/cli.js' }
const version = value => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value)
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const keys = (value, expected) => object(value) && Object.keys(value).sort().join('\0') === [...expected].sort().join('\0')

export function validToolchainPin(pin) {
  return keys(pin, ['schema', 'profile', 'scope', 'host', 'node', 'pnpm', 'lockfileSha256', 'packages']) &&
    pin.schema === 'DesktopBundleToolchain@1' && pin.scope === 'desktop-bundle-and-packager-versions' &&
    typeof pin.profile === 'string' && /^[a-z0-9-]{1,80}$/.test(pin.profile) &&
    keys(pin.host, ['platform', 'arch', 'release']) &&
    ['darwin', 'linux', 'win32'].includes(pin.host.platform) && ['arm64', 'x64'].includes(pin.host.arch) &&
    typeof pin.host.release === 'string' && /^[a-zA-Z0-9._+-]{1,80}$/.test(pin.host.release) &&
    version(pin.node) && version(pin.pnpm) && typeof pin.lockfileSha256 === 'string' && /^[a-f0-9]{64}$/.test(pin.lockfileSha256) &&
    keys(pin.packages, tools) && tools.every(name => version(pin.packages[name]))
}

export function observeToolchain(root) {
  const read = relative => { try { return readFileSync(path.join(root, relative)) } catch { return null } }
  const json = relative => { try { return JSON.parse(read(relative)?.toString() ?? '') } catch { return null } }
  let pnpm = null
  try {
    pnpm = execFileSync(process.env.FABRIC_PNPM_EXECUTABLE || 'pnpm', ['--version'], {
      cwd: root, encoding: 'utf8', timeout: 10_000, maxBuffer: 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, COREPACK_ENABLE_NETWORK: '0', npm_config_manage_package_manager_versions: 'false', pnpm_config_verify_deps_before_run: 'error' }
    }).trim()
  } catch { /* Missing/unavailable executable is evidence of an unverified toolchain. */ }
  const lock = read('pnpm-lock.yaml'), installedLock = read('node_modules/.pnpm/lock.yaml')
  const packages = Object.fromEntries(tools.map(name => [name, json(`apps/desktop/node_modules/${name}/package.json`)?.version ?? null]))
  return {
    entrypoints: Object.fromEntries(Object.entries(entrypoints).map(([name, entry]) => {
      try { return [name, statSync(path.join(root, 'apps/desktop/node_modules', name, entry)).isFile()] }
      catch { return [name, false] }
    })),
    electronRuntimeVersion: read('apps/desktop/node_modules/electron/dist/version')?.toString().trim() ?? null,
    host: { platform: process.platform, arch: process.arch, release: os.release() },
    node: process.versions.node, pnpm, packageManager: json('package.json')?.packageManager ?? null,
    lockfileSha256: lock === null ? null : sha256(lock),
    installedLockfileSha256: installedLock === null ? null : sha256(installedLock), packages
  }
}

// Observations are injectable for negative fixtures; production callers always
// measure the current host. Fixed reason codes avoid echoing command stderr.
export function verifyToolchain(root, observations) {
  let bytes, pin
  try { bytes = readFileSync(path.join(root, 'toolchain.lock.json')); pin = JSON.parse(bytes) }
  catch { return { scope: 'desktop-bundle-and-packager-versions', status: 'unverified', profile: null, digest: null, reasons: ['pin_absent_or_unreadable'] } }
  if (!validToolchainPin(pin)) return { scope: 'desktop-bundle-and-packager-versions', status: 'unverified', profile: null, digest: null, reasons: ['pin_invalid'] }
  const actual = observations ?? observeToolchain(root), reasons = []
  if (!['platform', 'arch', 'release'].every(key => actual.host?.[key] === pin.host[key])) reasons.push('host_mismatch')
  if (actual.node !== pin.node) reasons.push('node_mismatch_or_unavailable')
  if (actual.pnpm !== pin.pnpm) reasons.push('pnpm_mismatch_or_unavailable')
  if (actual.packageManager !== `pnpm@${pin.pnpm}`) reasons.push('package_manager_declaration_mismatch')
  if (actual.lockfileSha256 !== pin.lockfileSha256) reasons.push('lockfile_mismatch_or_unavailable')
  if (actual.installedLockfileSha256 !== pin.lockfileSha256) reasons.push('installed_lockfile_mismatch_or_unavailable')
  for (const name of tools) if (actual.packages?.[name] !== pin.packages[name]) reasons.push(`package_mismatch_or_unavailable:${name}`)
  for (const name of Object.keys(entrypoints)) if (actual.entrypoints?.[name] !== true) reasons.push(`entrypoint_unavailable:${name}`)
  if (actual.electronRuntimeVersion !== pin.packages.electron) reasons.push('electron_runtime_version_mismatch_or_unavailable')
  return {
    scope: 'desktop-bundle-and-packager-versions', status: reasons.length ? 'unverified' : 'verified', profile: pin.profile,
    digest: reasons.length ? null : sha256(bytes), reasons
  }
}
