// E0: the private pipe and descriptor adapters run only on a runtime whose behaviour was
// MEASURED — a tuple of Electron version, embedded Node, libuv, ABI, platform, arch and the
// SHA-256 of the binary that holds the runtime's code. Anything else fails closed.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { MEASURED_RUNTIMES, runtimeTuple, isMeasuredRuntime, sameRuntime } from '../src/main/runtimeAdmission.ts'

const here = runtimeTuple()
assert.ok(here, 'this runtime can describe itself')
assert.equal(here.runtime, process.versions.electron ? 'electron-main' : 'node')
assert.match(here.codeSha256, /^[a-f0-9]{64}$/)
assert.equal(isMeasuredRuntime(), MEASURED_RUNTIMES.some(t => sameRuntime(t, here)))
assert.equal(isMeasuredRuntime(), true, `this runtime is not in the measured list: ${JSON.stringify(here)}`)
// Every field is load-bearing: change any one and the tuple is no longer the measured one.
for (const key of Object.keys(here)) {
  const other = { ...here, [key]: key === 'electron' && here.electron === null ? '0.0.0' : 'x' + String(here[key]) }
  assert.equal(MEASURED_RUNTIMES.some(t => sameRuntime(t, other)), false, `${key} is not compared`)
}
assert.ok(Object.isFrozen(MEASURED_RUNTIMES) && MEASURED_RUNTIMES.every(Object.isFrozen), 'the list cannot be widened at runtime')
// Electron run as plain Node is a different process from Electron main, and was not measured.
if (!process.versions.electron) {
  const electron = path.join(import.meta.dirname, '..', 'node_modules', '.bin', 'electron')
  const r = spawnSync(electron, ['--experimental-strip-types', '-e',
    `import('${path.join(import.meta.dirname, '..', 'src', 'main', 'runtimeAdmission.ts')}').then(m=>console.log(JSON.stringify({measured:m.isMeasuredRuntime(),tuple:m.runtimeTuple()})))`],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8' })
  const out = JSON.parse(r.stdout.trim().split('\n').at(-1))
  assert.deepEqual(out, { measured: false, tuple: null }, 'ELECTRON_RUN_AS_NODE is refused')
  // And the registry that depends on it refuses to exist there. Everything else is valid —
  // a real executable with its hash, a private root — so the runtime is the only reason.
  const registry = path.join(import.meta.dirname, '..', 'src', 'main', 'ownedBackendProcessRegistry.ts')
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-runtime-admission-'))
  try {
    chmodSync(root, 0o700)
    const node = realpathSync(process.execPath), sha = createHash('sha256').update(readFileSync(node)).digest('hex')
    const construct = `import('${registry}').then(m=>{try{m.createOwnedBackendProcessRegistry({rootDir:${JSON.stringify(root)},estateId:'00000000-0000-4000-8000-000000000001',recipe:{executable:${JSON.stringify(node)},executableSha256:'${sha}',argv:[],cwd:${JSON.stringify(root)},env:{}},authority:()=>null});console.log('constructed')}catch(e){console.log(e.message)}})`
    const control = spawnSync(process.execPath, ['--experimental-strip-types', '-e', construct], { encoding: 'utf8' })
    assert.equal(control.stdout.trim().split('\n').at(-1), 'constructed', 'control: the same options construct on the measured runtime')
    const r2 = spawnSync(electron, ['--experimental-strip-types', '-e', construct], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8' })
    assert.equal(r2.stdout.trim().split('\n').at(-1), 'backend_ownership_unavailable', 'the registry refuses an unmeasured runtime')
  } finally { rmSync(root, { recursive: true, force: true }) }
}
console.log(`PASS runtime admission: ${here.runtime} ${here.electron ?? ''} node ${here.node} uv ${here.uv} is measured; every tuple field compared; Electron-as-Node refused`)
