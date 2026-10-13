import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
const source = process.env.N034_SOURCE || new URL('../src/main/resourcePoolRegistry.ts', import.meta.url).href
const { createResourcePoolRegistry } = await import(source)
const H = 'a'.repeat(64)
async function fixture(t, change = {}, hooks = {}) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'fabric-registry-test-')), root = await fs.realpath(tmp)
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const host = { hostInstanceId: randomUUID(), bootId: randomUUID() }
  await fs.mkdir(path.join(root, 'stop-host')); await fs.writeFile(path.join(root, 'stop-host/installation-id'), host.hostInstanceId + '\n')
  const config = { installationRoot: root, hostId: host.hostInstanceId, poolId: 'pool', estateId: randomUUID(), maxUnits: 8,
    maxRecordBytes: 2048, maxRegistryBytes: 16384, timeoutMs: 5000, ...change }
  const deps = { host, ...hooks }, registry = createResourcePoolRegistry(config, deps)
  const declaration = (changes = {}) => ({ unitId: randomUUID(), originInvocationId: host.bootId,
    policyBindingRevision: 'policy-sha256-v1:' + H, intentRecordSha256: H, coverageSha256: H, ...changes })
  const ledger = async () => path.join(root, 'resource-pools', (await fs.readdir(path.join(root, 'resource-pools')))[0])
  const open = async () => { assert.equal((await registry.provision()).state, 'observed'); const r = await registry.acquire(); assert.equal(r.state, 'observed'); return r.value }
  return { root, host, config, deps, registry, declaration, ledger, open }
}
const unavailable = r => { assert.equal(r.state, 'unknown'); assert.equal(r.complete, false); assert.equal(r.executionAuthorized, false) }
const yes = r => { assert.equal(r.state, 'observed'); assert.equal(r.complete, false); assert.equal(r.executionAuthorized, false); return r.value }

test('real FS provision, exact retry, snapshot and clean historical handoff', async t => {
  const f = await fixture(t), w = await f.open(), u = f.declaration()
  yes(await f.registry.append(w, u)); assert.equal(yes(await f.registry.append(w, { ...u })).retainedDeclarationCount, 1)
  const snap = yes(await f.registry.snapshot(w)); assert.equal(snap.retainedDeclarationCount, 1); assert.ok(Object.isFrozen(snap.units[0]))
  yes(await f.registry.seal(w)); unavailable(await f.registry.snapshot(w))
  const nextHost = { ...f.host, bootId: randomUUID() }, next = createResourcePoolRegistry(f.config, { host: nextHost })
  unavailable(await next.provision()); const nw = yes(await next.acquire())
  assert.deepEqual(yes(await next.snapshot(nw)).units, [u])
  yes(await next.append(nw, f.declaration({ originInvocationId: nextHost.bootId, policyBindingRevision: 'policy-sha256-v1:' + 'b'.repeat(64) })))
  assert.equal(yes(await next.snapshot(nw)).retainedDeclarationCount, 2); yes(await next.seal(nw))
})
test('single writer excludes same and new invocation without stale takeover', async t => {
  const f = await fixture(t), w = await f.open()
  const second = createResourcePoolRegistry(f.config, { host: { ...f.host, bootId: randomUUID() } })
  unavailable(await second.acquire()); unavailable(await f.registry.acquire()); yes(await f.registry.seal(w))
})
test('missing ledger with preserved external anchor never becomes empty pool', async t => {
  const f = await fixture(t); yes(await f.registry.provision()); await fs.rm(await f.ledger(), { recursive: true })
  const next = createResourcePoolRegistry(f.config, f.deps)
  unavailable(await next.provision()); unavailable(await next.acquire())
})
test('unsealed head without lock is not a clean handoff', async t => {
  const f = await fixture(t), w = await f.open(); await fs.unlink(path.join(await f.ledger(), 'writer.lock'))
  unavailable(await createResourcePoolRegistry(f.config, f.deps).acquire()); unavailable(await f.registry.snapshot(w))
})
test('same host pool cannot fork by estate or boot', async t => {
  const f = await fixture(t); yes(await f.registry.provision())
  const other = createResourcePoolRegistry({ ...f.config, estateId: randomUUID() }, { host: { ...f.host, bootId: randomUUID() } })
  unavailable(await other.provision()); unavailable(await other.acquire())
})
test('copied and foreign writer handles do not authorize storage changes', async t => {
  const f = await fixture(t), w = await f.open()
  unavailable(await f.registry.append({ ...w }, f.declaration())); unavailable(await f.registry.seal({ ...w })); unavailable(await createResourcePoolRegistry(f.config, f.deps).snapshot(w))
  yes(await f.registry.seal(w))
})
test('count and byte bounds reject growth and never exclude caller unit', async t => {
  const f = await fixture(t, { maxUnits: 1 }), w = await f.open(), u = f.declaration()
  yes(await f.registry.append(w, u)); unavailable(await f.registry.append(w, f.declaration()))
  assert.equal(yes(await f.registry.snapshot(w)).retainedDeclarationCount, 1); yes(await f.registry.seal(w))
})
test('conflicting same unit and wrong invocation refuse', async t => {
  const f = await fixture(t), w = await f.open(), u = f.declaration(); yes(await f.registry.append(w, u))
  unavailable(await f.registry.append(w, { ...u, coverageSha256: 'b'.repeat(64) }))
  unavailable(await f.registry.append(w, f.declaration({ originInvocationId: randomUUID() }))); yes(await f.registry.seal(w))
})
test('deleted committed record is unknown, never empty', async t => {
  const f = await fixture(t), w = await f.open(); yes(await f.registry.append(w, f.declaration()))
  await fs.unlink(path.join(await f.ledger(), 'unit.00000001.json')); unavailable(await f.registry.snapshot(w)); unavailable(await f.registry.seal(w))
})
test('surplus orphan and unknown version are refused', async t => {
  const f = await fixture(t), w = await f.open(), dir = await f.ledger()
  await fs.writeFile(path.join(dir, 'orphan.json'), '{}'); unavailable(await f.registry.snapshot(w)); await fs.unlink(path.join(dir, 'orphan.json'))
  const h = JSON.parse(await fs.readFile(path.join(dir, 'head.json'), 'utf8')); h.schema = 99
  await fs.writeFile(path.join(dir, 'head.json'), JSON.stringify(h) + '\n'); unavailable(await f.registry.snapshot(w))
})
test('replaced writer inode with identical bytes refuses old handle', async t => {
  const f = await fixture(t), w = await f.open(), file = path.join(await f.ledger(), 'writer.lock'), bytes = await fs.readFile(file)
  await fs.rename(file, file + '.old'); await fs.writeFile(file, bytes)
  unavailable(await f.registry.snapshot(w)); unavailable(await f.registry.seal(w))
})
test('symlink record refuses without following its target', async t => {
  const f = await fixture(t), w = await f.open(); yes(await f.registry.append(w, f.declaration()))
  const file = path.join(await f.ledger(), 'unit.00000001.json'); await fs.rename(file, file + '.old'); await fs.symlink(file + '.old', file)
  unavailable(await f.registry.snapshot(w))
})
test('malformed/accessor inputs rejected without evaluating getter', async t => {
  const f = await fixture(t), w = await f.open(); let reads = 0
  const u = f.declaration(); Object.defineProperty(u, 'unitId', { get() { reads++; throw Error('private') } })
  unavailable(await f.registry.append(w, u)); assert.equal(reads, 0)
  unavailable(await f.registry.append(w, { ...f.declaration(), extra: 1 })); yes(await f.registry.seal(w))
})
test('external root and host changes refuse', async t => {
  const f = await fixture(t), w = await f.open(); f.host.bootId = randomUUID(); unavailable(await f.registry.snapshot(w))
})
test('failed event fsync exact retry reestablishes event and head durability', async t => {
  let armed = false, syncs = 0
  const f = await fixture(t, {}, { afterIO(label) { if (label === 'file-sync' && armed) { armed = false; throw Error('synthetic') } }, beforeIO(label) { if (label === 'file-sync') syncs++ } })
  const w = await f.open(), u = f.declaration(); armed = true
  unavailable(await f.registry.append(w, u)); unavailable(await f.registry.append(w, f.declaration())); unavailable(await f.registry.snapshot(w))
  const before = syncs; yes(await f.registry.append(w, u)); assert.ok(syncs >= before + 2)
  assert.equal(yes(await f.registry.snapshot(w)).retainedDeclarationCount, 1); yes(await f.registry.seal(w))
})
test('lost head rename result reconciles exact operation without duplicate declaration', async t => {
  let armed = false
  const f = await fixture(t, {}, { afterIO(label) { if (label === 'head-rename' && armed) { armed = false; throw Error('synthetic') } } })
  const w = await f.open(), u = f.declaration(); armed = true
  unavailable(await f.registry.append(w, u)); yes(await f.registry.append(w, u))
  assert.equal(yes(await f.registry.snapshot(w)).retainedDeclarationCount, 1); yes(await f.registry.seal(w))
})
test('timeout retains one actual outstanding operation across 30 retries', async t => {
  let block = false, calls = 0, release
  const waiting = new Promise(r => { release = r })
  const f = await fixture(t, { timeoutMs: 1500 }, { beforeIO(label) { if (block && label === 'writer-stat') { calls++; return waiting } } })
  const w = await f.open(); block = true; unavailable(await f.registry.snapshot(w))
  for (let n = 0; n < 30; n++) unavailable(await f.registry.snapshot(w))
  assert.equal(calls, 1); block = false; release(); await new Promise(r => setTimeout(r, 10))
  yes(await f.registry.snapshot(w)); yes(await f.registry.seal(w))
})
test('seal blocks new calls synchronously and waits actual pending work', async t => {
  let block = false, entered, release
  const started = new Promise(r => { entered = r }), pending = new Promise(r => { release = r })
  const f = await fixture(t, {}, { beforeIO(label) { if (block && label === 'writer-stat') { block = false; entered(); return pending } } })
  const w = await f.open(); block = true; const snap = f.registry.snapshot(w); await started
  const seal = f.registry.seal(w); unavailable(await f.registry.append(w, f.declaration())); release()
  yes(await snap); yes(await seal); unavailable(await f.registry.snapshot(w))
})
test('seal timeout never releases an unresolved writer after late dependency settlement', async t => {
  let block = false, entered, release
  const started = new Promise(r => { entered = r }), pending = new Promise(r => { release = r })
  const f = await fixture(t, { timeoutMs: 1500 }, { beforeIO(label) { if (block && label === 'writer-stat') { entered(); return pending } } })
  const w = await f.open(); block = true; const snap = f.registry.snapshot(w); await started
  unavailable(await f.registry.seal(w)); unavailable(await snap); block = false; release(); await new Promise(r => setTimeout(r, 10))
  assert.ok((await fs.stat(path.join(await f.ledger(), 'writer.lock'))).isFile())
  unavailable(await createResourcePoolRegistry(f.config, f.deps).acquire())
})

test('head cardinality and predecessor tampering refuse', async t => {
  const f = await fixture(t), w = await f.open(); yes(await f.registry.append(w, f.declaration()))
  const file = path.join(await f.ledger(), 'head.json'), bytes = await fs.readFile(file, 'utf8'), h = JSON.parse(bytes)
  await fs.writeFile(file, JSON.stringify({ ...h, retainedCount: 0 }) + '\n'); unavailable(await f.registry.snapshot(w))
  await fs.writeFile(file, JSON.stringify({ ...h, lastDigest: 'b'.repeat(64) }) + '\n'); unavailable(await f.registry.snapshot(w))
  await fs.writeFile(file, bytes); yes(await f.registry.seal(w))
})
test('oversized record read and cumulative append bound refuse', async t => {
  const f = await fixture(t, { maxRegistryBytes: 4096, maxUnits: 16 }), w = await f.open()
  let added = 0
  for (let n = 0; n < 16; n++) { const r = await f.registry.append(w, f.declaration()); if (r.state === 'unknown') break; added++ }
  assert.ok(added > 0 && added < 16); assert.equal(yes(await f.registry.snapshot(w)).retainedDeclarationCount, added)
  const file = path.join(await f.ledger(), 'unit.00000001.json'); await fs.writeFile(file, 'x'.repeat(2049)); unavailable(await f.registry.snapshot(w))
})
test('symbolic linked installation root and parent refuse', async t => {
  const f = await fixture(t), alias = f.root + '-alias'; await fs.symlink(f.root, alias); t.after(() => fs.unlink(alias))
  unavailable(await createResourcePoolRegistry({ ...f.config, installationRoot: alias }, f.deps).provision())
  await fs.mkdir(path.join(f.root, 'outside')); await fs.symlink(path.join(f.root, 'outside'), path.join(f.root, 'resource-pool-bindings'))
  unavailable(await f.registry.provision())
})

test('seal cache never lends a success acknowledgement to a copied handle', async t => {
  const f = await fixture(t), w = await f.open(), seal = f.registry.seal(w)
  unavailable(await f.registry.seal({ ...w })); yes(await seal)
  unavailable(await f.registry.seal({ ...w })); yes(await f.registry.seal(w))
})
test('head digest binds exact canonical bytes, not only parsed semantics', async t => {
  const f = await fixture(t), w = await f.open(), file = path.join(await f.ledger(), 'head.json'), bytes = await fs.readFile(file, 'utf8')
  await fs.writeFile(file, JSON.stringify(JSON.parse(bytes), null, 2) + '\n'); unavailable(await f.registry.snapshot(w))
  await fs.writeFile(file, bytes); yes(await f.registry.seal(w))
})

test('discarded unsealed writer keeps lock without a FileHandle GC exception', async t => {
  const f = await fixture(t)
  const code = `import { createResourcePoolRegistry } from ${JSON.stringify(source)};
    let registry = createResourcePoolRegistry(${JSON.stringify(f.config)}, {host:${JSON.stringify(f.host)}});
    if ((await registry.provision()).state !== 'observed') throw Error('setup provision');
    if ((await registry.acquire()).state !== 'observed') throw Error('setup acquire');
    registry = null;
    for (let n = 0; n < 12; n++) { await new Promise(r => setTimeout(r, 10)); global.gc(); }
  `
  const r = await new Promise(resolve => execFile(process.execPath, ['--expose-gc', '--experimental-strip-types', '--input-type=module', '-e', code],
    { timeout: 15000 }, (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stderr })))
  assert.equal(r.code, 0, r.stderr)
  assert.ok((await fs.stat(path.join(await f.ledger(), 'writer.lock'))).isFile())
  unavailable(await createResourcePoolRegistry(f.config, f.deps).acquire())
})
