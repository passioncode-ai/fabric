import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { execFileSync, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, readdir, writeFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createGitLeaseSnapshotReader, exactLeaseRef, leaseGit } from '../src/main/gitLeaseSnapshot.ts'
import { HARDENED_GIT_ARGS, hardenedGitEnv } from '../src/main/gitRun.ts'
const exec = promisify(execFile)
const remote = 'https://lease.invalid/fixture.git', timestamp = Date.parse('2026-10-13T12:00:00Z')
// 10 s, not 1.5: these cases check what a read answers, not its speed, and under load a real git outlasted 1.5 s and
// read as 'timeout' (2026-10-17). The timeout case sets its own short deadline.
const base = { approvedRemote: remote, key: 'scope:docs/test.lock', runId: 'owned-run', repositoryName: 'fixture', expectedTip: null, maxAgeMs: 60_000, timeoutMs: 10_000 }
const payload = (delta = {}) => ({ key: base.key, run: base.runId, repo: base.repositoryName, ts: '2026-10-13T11:59:50Z', since: '2026-10-13T11:59:00Z', ttl: 60, host: 'fixture', ...delta })
let root, repo
const calls = []
const fixtureGit = (args, input) => execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: repo, input, encoding: 'utf8', env: { ...hardenedGitEnv(), GIT_CONFIG_GLOBAL: '/dev/null' } }).trim()
function install(value = payload(), options = {}) {
  const tree = fixtureGit(['mktree'], '')
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const tip = fixtureGit(['commit-tree', tree, ...(options.parent ? ['-p', options.parent] : [])], text + '\n')
  fixtureGit(['update-ref', exactLeaseRef(base.key), tip]); return tip
}
// Real Git objects and remote refs in an owned bare fixture. Only the transport URL/protocol
// is substituted. Production verification, exact-ref read/fetch/object/hash/parser/currentness
// remain unmodified; this is not live HTTPS or installed agent-sync runtime certification.
async function git(args, options) {
  calls.push([...args])
  const mapped = args.map(a => a === remote ? repo : a)
  return (await exec('git', [...HARDENED_GIT_ARGS, '-c', 'protocol.file.allow=always', ...mapped], {
    cwd: options.cwd, timeout: options.timeoutMs, maxBuffer: options.maxBytes,
    env: { ...hardenedGitEnv(), GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1' }
  })).stdout
}
const reader = (config = {}, deps = {}) => createGitLeaseSnapshotReader({ ...base, ...config }, { git, now: () => timestamp, ...deps })
before(async () => { root = await mkdtemp(join(tmpdir(), 'fabric-lease-test-')); repo = join(root, 'remote.git'); execFileSync('git', ['init', '--bare', '--quiet', repo]); })
after(async () => { await rm(root, { recursive: true, force: true }) })

test('real parentless lease: exact binding, SHA, freshness, and no launch authority', async () => {
  const tip = install(), result = await reader({ expectedTip: tip }).read()
  assert.deepEqual(result, { status: 'observed', remoteDigest: createHash('sha256').update(remote).digest('hex'), key: base.key,
    runId: base.runId, repositoryName: base.repositoryName, tip, observedAt: timestamp, leaseUpdatedAt: timestamp - 10_000,
    expiresAt: timestamp + 50_000, executionAuthorized: false })
  assert.equal('fence' in result, false)
})
test('expired own lease refuses, even if agent-sync acquire once accepted the same run', async () => {
  install(payload({ ttl: 9 })); assert.equal((await reader().read()).reason, 'expired_or_future')
})
for (const [label, delta, reason] of [
  ['foreign run', { run: 'foreign' }, 'binding_mismatch'], ['foreign repo', { repo: 'foreign' }, 'binding_mismatch'],
  ['wrong exact key', { key: 'other' }, 'binding_mismatch'], ['keyless legacy', { key: undefined }, 'binding_mismatch'],
  ['future', { ts: '2026-10-13T12:00:01Z' }, 'expired_or_future'], ['expiry boundary', { ttl: 10 }, 'expired_or_future'],
  ['zero ttl', { ttl: 0 }, 'malformed_freshness'], ['ttl string', { ttl: '60' }, 'malformed_freshness'],
  ['negative ttl', { ttl: -1 }, 'malformed_freshness'], ['huge ttl', { ttl: 86401 }, 'malformed_freshness'],
  ['fraction ttl', { ttl: 1.5 }, 'malformed_freshness'], ['invalid calendar', { ts: '2026-02-30T12:00:00Z' }, 'malformed_freshness'],
  ['local timestamp', { ts: '2026-10-13T11:59:50' }, 'malformed_freshness'], ['since more than one second after ts', { since: '2026-10-13T11:59:52Z' }, 'malformed_freshness']
]) test(label, async () => { install(payload(delta)); assert.equal((await reader().read()).reason, reason) })
test('stale but still leased is refused by configured snapshot age', async () => {
  install(); assert.equal((await reader({ maxAgeMs: 9999 }).read()).reason, 'stale_observation')
})
test('own renewal changes expected opaque tip and requires new explicit observation', async () => {
  const old = install(), next = install(payload({ ts: '2026-10-13T11:59:51Z' }))
  assert.notEqual(next, old); assert.equal((await reader({ expectedTip: old }).read()).reason, 'tip_changed')
  assert.equal((await reader({ expectedTip: next }).read()).status, 'observed')
})
test('ref changes after reading object: no success for a superseded lease', async () => {
  install(); let reads = 0
  const r = reader({}, { git: async (args, opts) => {
    if (args[0] === 'ls-remote' && ++reads === 2) install(payload({ run: 'foreign' }))
    return git(args, opts)
  } })
  assert.equal((await r.read()).reason, 'tip_changed')
})
test('ref changes between ls-remote and fetch: exact old object cannot become new object proof', async () => {
  install(); let changed = false
  const r = reader({}, { git: async (args, opts) => {
    if (args[0] === 'fetch' && !changed) { changed = true; install(payload({ ts: '2026-10-13T11:59:52Z' })) }
    return git(args, opts)
  } })
  assert.equal((await r.read()).status, 'unknown')
})
test('missing ref and ambiguous remote output never become free ownership', async () => {
  fixtureGit(['update-ref', '-d', exactLeaseRef(base.key)])
  assert.equal((await reader().read()).reason, 'missing_or_ambiguous_ref')
  install()
  const r = reader({}, { git: async (args, opts) => { const out = await git(args, opts); return args[0] === 'ls-remote' ? out + out : out } })
  assert.equal((await r.read()).reason, 'missing_or_ambiguous_ref')
})
for (const value of ['not json', '[]', 'null']) test('malformed commit payload ' + value, async () => {
  install(value); assert.equal((await reader().read()).reason, 'unsupported_or_malformed_lease')
})
test('parent-bearing commit is not a supported lease object', async () => {
  const parent = install(); install(payload({ host: 'next' }), { parent })
  assert.equal((await reader().read()).reason, 'unsupported_or_malformed_lease')
})
test('object bytes must hash to advertised tip, even with a faulty trusted transport', async () => {
  install(); const r = reader({}, { git: async (args, opts) => (await git(args, opts)) + (args[0] === 'cat-file' ? ' ' : '') })
  assert.equal((await r.read()).reason, 'unsupported_or_malformed_lease')
})
test('clock rollback and invalid clock refuse', async () => {
  install(); let call = 0
  assert.equal((await reader({}, { now: () => ++call === 1 ? timestamp : timestamp - 1 }).read()).reason, 'clock_invalid')
  assert.equal((await reader({}, { now: () => NaN }).read()).reason, 'clock_invalid')
})
test('expiry while transport was running refuses', async () => {
  install(); let call = 0
  assert.equal((await reader({}, { now: () => ++call === 1 ? timestamp : timestamp + 51_000 }).read()).reason, 'expired_or_future')
})
test('configuration is copied and not redirectable after construction', async () => {
  install(); const config = { ...base }, r = createGitLeaseSnapshotReader(config, { git, now: () => timestamp })
  config.approvedRemote = 'https://foreign.invalid/other.git'; config.runId = 'foreign'
  assert.equal((await r.read()).status, 'observed')
})
for (const approvedRemote of ['/tmp/repo', 'file:///tmp/r', 'ext::anything', 'ssh://host/repo', 'http://host/repo',
  'https://user:secret@host/repo', 'https://host/repo?token=secret', 'https://host/repo#fragment']) test('reject task-unapproved URL form ' + approvedRemote.split(':')[0], async () => {
  let ran = false; const result = await reader({ approvedRemote }, { git: async () => { ran = true; throw 0 } }).read()
  assert.equal(result.reason, 'invalid_configuration'); assert.equal(ran, false)
})
test('timeout keeps the outstanding slot; repeated calls do not accumulate I/O; late settling permits a fresh read', async () => {
  install(); let settle, count = 0, first = true
  // 4 s: the first read hangs and must time out, but the fresh read after it runs a real git under the same deadline,
  // and at load 300 that git outlasted 1.5 s (2026-10-17).
  const r = reader({ timeoutMs: 4000 }, { git: async (args, opts) => {
    count++
    if (first) { first = false; return new Promise(resolve => { settle = resolve }) }
    return git(args, opts)
  } })
  assert.equal((await r.read()).reason, 'timeout')
  for (let i = 0; i < 50; i++) assert.equal((await r.read()).reason, 'prior_io_unresolved')
  assert.equal(count, 1); settle('')
  // The settled read frees its slot on a later tick; under load 30 ms was not always enough. Wait for it, bounded.
  let fresh = await r.read()
  for (const until = Date.now() + 5000; fresh.reason === 'prior_io_unresolved' && Date.now() < until; fresh = await r.read())
    await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(fresh.status, 'observed', JSON.stringify(fresh))
  assert.ok(count > 1, 'fresh proof performs fresh Git I/O')
})
test('ordinary transport rejection is consumed and exposes no raw secret/path', async () => {
  const r = reader({}, { git: async () => { throw new Error('/private/path?token=verysecret') } })
  const result = await r.read(); assert.deepEqual(result, { status: 'unknown', reason: 'remote_unreadable', executionAuthorized: false })
  assert.equal(JSON.stringify(result).includes('secret'), false)
})
test('raw oversized output is bounded even if a transport ignores requested maxBytes', async () => {
  const r = reader({}, { git: async () => 'x'.repeat(20_000) })
  assert.equal((await r.read()).reason, 'remote_unreadable')
})
test('exact lease_name percent encoding preserves otherwise-colliding keys', () => {
  assert.equal(exactLeaseRef('a:b'), 'refs/agent-sync/leases/a%3Ab')
  assert.equal(exactLeaseRef('a/b'), 'refs/agent-sync/leases/a%2Fb')
  assert.equal(exactLeaseRef('.a..b.lock'), 'refs/agent-sync/leases/%2Ea%2E.b%2Elock')
  assert.equal(exactLeaseRef('scope:док'), 'refs/agent-sync/leases/scope%3A%D0%B4%D0%BE%D0%BA')
  for (const key of ['', 'a b', 'a|b', 'a`b', 'x'.repeat(201)]) assert.throws(() => exactLeaseRef(key))
})

test('default command transport isolates inherited config, TLS bypass and executable redirects', async () => {
  const bin = join(root, 'bin'); await (await import('node:fs/promises')).mkdir(bin)
  const executable = join(bin, 'git')
  await writeFile(executable, '#!' + process.execPath + '\n' +
    'process.stdout.write(JSON.stringify({args:process.argv.slice(2),env:Object.fromEntries(Object.entries(process.env).filter(([k])=>k.startsWith("GIT_")||k==="HTTPS_PROXY"))}))\n')
  await chmod(executable, 0o700)
  const names = ['PATH', 'GIT_SSL_NO_VERIFY', 'GIT_EXEC_PATH', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_GLOBAL', 'HTTPS_PROXY']
  const saved = Object.fromEntries(names.map(k => [k, process.env[k]]))
  try {
    process.env.PATH = bin + ':' + process.env.PATH
    for (const name of names.slice(1)) process.env[name] = 'untrusted-fixture'
    // What is checked is the argv and the environment, not speed: the fake git is a Node script, and at load 300 its
    // start alone outlasted a 1 s deadline (0.3.6 release gate, 2026-10-15). 10 s keeps a hang a failure.
    const out = JSON.parse(await leaseGit(['ls-remote', '--refs', remote, exactLeaseRef(base.key)], { cwd: root, timeoutMs: 10_000, maxBytes: 16384 }))
    assert.ok(out.args.includes('protocol.allow=never')); assert.ok(out.args.includes('protocol.https.allow=always'))
    assert.ok(out.args.includes('http.followRedirects=false')); assert.ok(out.args.includes('credential.helper='))
    assert.equal(out.env.GIT_CONFIG_GLOBAL, '/dev/null'); assert.equal(out.env.GIT_ALLOW_PROTOCOL, 'https')
    for (const name of names.slice(1).filter(n => n !== 'GIT_CONFIG_GLOBAL')) assert.equal(out.env[name], undefined)
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
  }
})
test('default fetch reader rejects scratch overflow, even when a fetch finishes before sampled monitoring', async () => {
  const bin = join(root, 'budget-bin'), scratch = join(root, 'budget-scratch')
  await (await import('node:fs/promises')).mkdir(bin); await (await import('node:fs/promises')).mkdir(scratch)
  const executable = join(bin, 'git')
  await writeFile(executable, '#!' + process.execPath + '\n' +
    'require("node:fs").writeFileSync("oversized",Buffer.alloc(9*1024*1024));\n')
  await chmod(executable, 0o700)
  const saved = process.env.PATH
  try {
    process.env.PATH = bin + ':' + saved
    await assert.rejects(leaseGit(['fetch', remote], { cwd: scratch, timeoutMs: 1000, maxBytes: 16384 }))
  } finally { process.env.PATH = saved; await rm(scratch, { recursive: true, force: true }) }
})

test('expiry between object validation and publication after async cleanup still refuses', async () => {
  install(); let count = 0
  const r = reader({}, { now: () => ++count < 3 ? timestamp : timestamp + 51_000 })
  assert.equal((await r.read()).reason, 'expired_or_future')
})

test('ordinary rejected async clock at start, after reads, or before publication never crashes the process', () => {
  const source = new URL('../src/main/gitLeaseSnapshot.ts', import.meta.url).href
  for (const rejectAt of [1, 2, 3]) {
    const code = `
      import assert from 'node:assert/strict';
      import {createHash} from 'node:crypto';
      import {createGitLeaseSnapshotReader,exactLeaseRef} from ${JSON.stringify(source)};
      const cfg=${JSON.stringify(base)};
      const raw='tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904\\n' +
        'author fixture <fixture@example.invalid> 1791889190 +0000\\n' +
        'committer fixture <fixture@example.invalid> 1791889190 +0000\\n\\n' + ${JSON.stringify(JSON.stringify(payload()))} + '\\n';
      const tip=createHash('sha1').update('commit '+Buffer.byteLength(raw)+'\\0').update(raw).digest('hex');
      let count=0;
      const reader=createGitLeaseSnapshotReader(cfg,{
        now:()=>++count===${rejectAt}?Promise.reject(Error('synthetic-clock-failure')):${timestamp},
        git:async args=>args[0]==='ls-remote'?tip+'\\t'+exactLeaseRef(cfg.key)+'\\n':args[0]==='cat-file'?raw:''
      });
      const result=await reader.read();assert.equal(result.reason,'clock_invalid');
      assert.equal(result.executionAuthorized,false);
      await new Promise(resolve=>setTimeout(resolve,20));
    `
    execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', code], { timeout: 4000, stdio: 'pipe' })
  }
})
test('invalid thenable clock never reads arbitrary then or constructor getters', async () => {
  let thenReads=0, constructorReads=0
  const invalid=Object.defineProperties({}, {
    then: {get(){thenReads++;throw Error('do not read then')}},
    constructor: {get(){constructorReads++;throw Error('do not read constructor')}}
  })
  assert.equal((await reader({}, {now:()=>invalid}).read()).reason,'clock_invalid')
  assert.equal(thenReads,0);assert.equal(constructorReads,0)
})
test('spoofed native Promise prototype is invalid time without throwing', async () => {
  assert.equal((await reader({}, {now:()=>Object.create(Promise.prototype)}).read()).reason,'clock_invalid')
})

test('producer crossing one rounded second is accepted without extending ts-based expiry', async () => {
  // Actual installed 1.22.2 _git_acquire payload-expression output, fixed fixture inputs.
  const produced = {"key":"scope:docs/test.lock","run":"owned-run","ts":"2026-10-13T11:59:50Z","ttl":60,"repo":"fixture","host":"fixture","since":"2026-10-13T11:59:51Z"}
  install(produced)
  const result=await reader().read()
  assert.equal(result.status,'observed');assert.equal(result.expiresAt,timestamp+50_000)
  install(payload({since:'2026-10-13T11:59:51Z',ttl:10}))
  assert.equal((await reader().read()).reason,'expired_or_future')
})
test('one-second tolerance never accepts a since timestamp still in the future', async () => {
  install(payload({ts:'2026-10-13T12:00:00Z',since:'2026-10-13T12:00:01Z'}))
  assert.equal((await reader().read()).reason,'expired_or_future')
})
