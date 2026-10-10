/**
 * Measured runtimes for the private pipe and descriptor adapters (first-slice plan E0).
 *
 * The owned backend process registry and the native view host read a private Node field
 * (`stdin._handle.fd`), bigint `fstat().isSocket()`, and rely on how libuv answers a short or
 * EAGAIN write. None of that is a public contract, so they run only where it was MEASURED:
 * an exact tuple of runtime kind, Electron version, embedded Node, libuv, ABI, platform, arch
 * and the SHA-256 of the binary that holds the runtime's code. A version string alone is not
 * the runtime — Homebrew's `node` is a 50 KB launcher around `libnode.<abi>.dylib`, and the
 * packaged app's Electron Framework is re-signed — so the bytes are part of the tuple.
 *
 * Adding a tuple means running the registry's and the native view host's suites on that
 * runtime first (`electron test/electron-main-runner.mjs <suite>` for Electron main). If any
 * descriptor behaviour differs, stop and bring the separate-supervisor alternative back to
 * the operator; do not widen this list.
 */
import { createHash } from 'node:crypto'
import { closeSync, existsSync, openSync, readSync, realpathSync } from 'node:fs'
import path from 'node:path'

export interface RuntimeTuple {
  runtime: 'electron-main' | 'node'
  electron: string | null
  node: string
  uv: string
  modules: string
  platform: string
  arch: string
  codeSha256: string
}

/** Measured 2026-09-28: all 17 registry groups and all 14 native view host groups pass here. */
// #region measured-runtimes — docs: docs/launch/harness-r0/checks.md#intel-x86_64-runtimes--2026-10-09
export const MEASURED_RUNTIMES: readonly RuntimeTuple[] = Object.freeze(([
  // Electron 44 main process (process.type === 'browser'); the npm-installed, ad-hoc-signed
  // framework. The packaged, hardened app is re-signed and is measured separately (N1).
  { runtime: 'electron-main', electron: '44.0.0', node: '24.18.1', uv: '1.52.1', modules: '149', platform: 'darwin', arch: 'arm64',
    codeSha256: '3e7bf6741fd4ae3e4bec8b385720ef8c86dda24e93093d56a5967a033000e38c' },
  // Homebrew Node 26.8.2, the development and CI runtime; code in libnode.147.dylib.
  { runtime: 'node', electron: null, node: '26.8.2', uv: '1.52.1', modules: '147', platform: 'darwin', arch: 'arm64',
    codeSha256: '88ff1063ca8ecdba021e48a56905d8b4c9af8874b654bafd164a562d2134b3d3' },
  // Homebrew Node 26.10.0, the development and CI runtime from 2026-10-05 (a Homebrew upgrade
  // replaced 26.8.2). Re-measured that day: all 17 registry groups and all 14 native view host groups
  // pass (docs/launch/harness-r0/checks.md).
  { runtime: 'node', electron: null, node: '26.10.0', uv: '1.53.0', modules: '147', platform: 'darwin', arch: 'arm64',
    codeSha256: '80335f41c8d19799b203b1831ed51e900c21ef986e38479c69bd4381aedac3db' },
  // Intel Macs (operator decision 2026-10-09: the release is universal). Electron 44.0.0's darwin-x64
  // build (npm, `npm_config_arch=x64`, checksum-verified by @electron/get) run under Rosetta as
  // `arch -x86_64`; measured 2026-10-09 — all 17 registry groups and all 14 native view host groups
  // pass (docs/launch/harness-r0/checks.md "Intel (x86_64) runtimes").
  { runtime: 'electron-main', electron: '44.0.0', node: '24.18.1', uv: '1.52.1', modules: '149', platform: 'darwin', arch: 'x64',
    codeSha256: 'd2a5a75b572630817cb2893f20def244b21ed8d6e8b77db751db1b874ccfef6c' },
] satisfies RuntimeTuple[]).map(t => Object.freeze(t)))
// #endregion measured-runtimes

const KEYS: readonly (keyof RuntimeTuple)[] = ['runtime', 'electron', 'node', 'uv', 'modules', 'platform', 'arch', 'codeSha256']
export const sameRuntime = (a: RuntimeTuple, b: RuntimeTuple): boolean => KEYS.every(k => a[k] === b[k])

/** The file whose bytes are the runtime's code: Electron's framework, or the libnode a Node
 * launcher links; a statically linked Node is its own executable. */
function codeBinary(runtime: RuntimeTuple['runtime']): string {
  const exe = realpathSync(process.execPath)
  if (runtime === 'electron-main')
    return path.join(path.dirname(exe), '..', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Electron Framework')
  const lib = path.join(path.dirname(exe), '..', 'lib', `libnode.${process.versions.modules}.dylib`)
  return existsSync(lib) ? lib : exe
}
/** Chunked, so a 200 MB framework never sits in memory at once. */
function sha256File(file: string): string {
  const hash = createHash('sha256'), fd = openSync(file, 'r'), chunk = Buffer.allocUnsafe(1 << 20)
  try { for (let n; (n = readSync(fd, chunk, 0, chunk.length, null)) > 0;) hash.update(chunk.subarray(0, n)) }
  finally { closeSync(fd) }
  return hash.digest('hex')
}

let cached: { tuple: RuntimeTuple | null } | undefined
/** This process's tuple, or null when it is neither Electron main nor plain Node (for
 * example Electron with ELECTRON_RUN_AS_NODE, a renderer, or a utility process). */
export function runtimeTuple(): RuntimeTuple | null {
  if (cached) return cached.tuple
  let tuple: RuntimeTuple | null = null
  try {
    const electron = process.versions.electron ?? null
    const kind = electron === null ? 'node' : (process as { type?: string }).type === 'browser' ? 'electron-main' : null
    if (kind) tuple = Object.freeze({ runtime: kind, electron, node: process.versions.node, uv: process.versions.uv ?? '',
      modules: process.versions.modules, platform: process.platform, arch: process.arch, codeSha256: sha256File(codeBinary(kind)) })
  } catch {
    // Not silence: a runtime that cannot be read is an unmeasured runtime; the adapters refuse it.
    tuple = null
  }
  cached = { tuple }
  return tuple
}
export function isMeasuredRuntime(): boolean {
  const here = runtimeTuple()
  return here !== null && MEASURED_RUNTIMES.some(t => sameRuntime(t, here))
}
