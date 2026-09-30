// The operations log, against a real filesystem (M81).
//
// The property that matters most is the one a fake filesystem cannot show: this
// runs inside other people's catch blocks, so it must not throw when the disk is
// full, the directory is read-only, or the file is corrupt. A logger that throws
// there turns a handled failure into a crash — the observability becoming the
// outage.

import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const SRC = path.resolve(import.meta.dirname, '../src/main/ops.ts')
const dir = mkdtempSync(path.join(tmpdir(), 'fabric-ops-'))

const script = `
import { createOps } from ${JSON.stringify(SRC)}
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const dir = ${JSON.stringify(dir)}
let bad = 0
const ok = (m) => console.log('ok   ' + m)
const fail = (m) => { bad++; console.log('FAIL ' + m) }

const ops = createOps({ dir })
const c = ops.correlate()

// ————————————————————————————————————————————————— it writes, and it is readable
ops.record({ op: 'ipc.tasks.start', outcome: 'ok', ctx: { correlationId: c, projectId: 'p1' } })
ops.record({ op: 'db.select.routines', outcome: 'failed', ctx: { correlationId: c }, error: new Error('permission denied') })
const all = ops.read()
if (all.length !== 2) fail('expected two records, got ' + all.length)
else if (all[1].error?.message !== 'permission denied') fail('the failure lost its reason')
else ok('an operation and its failure are both recorded, with the reason')

if (!existsSync(ops.file())) fail('nothing on disk at ' + ops.file())
else ok('and it is a file a person can open without the app')

// ————————————————————————————————————————————————— the correlation is the point
const other = ops.correlate()
ops.record({ op: 'ipc.other', outcome: 'ok', ctx: { correlationId: other } })
const joined = ops.read({ correlationId: c })
if (joined.length !== 2) fail('correlation filter returned ' + joined.length)
else ok('one click can be followed through everything it caused, and nothing else')

// ————————————————————————————————————————————————— level filter means this and worse
const errorsOnly = ops.read({ level: 'error' })
if (errorsOnly.length !== 1 || errorsOnly[0].outcome !== 'failed')
  fail('the level filter returned ' + JSON.stringify(errorsOnly.map((r) => r.level)))
else ok('a level filter means this level and worse, not this level exactly')

// ————————————————————————————————————————————————— it never throws
const locked = path.join(dir, 'locked')
mkdirSync(locked, { recursive: true })
chmodSync(locked, 0o500)
const blind = createOps({ dir: locked })
try {
  blind.record({ op: 'x', outcome: 'failed', ctx: { correlationId: blind.correlate() } })
  ok('a log it cannot write does not throw — it runs inside other catch blocks')
} catch (e) {
  fail('the logger threw where it must not: ' + String(e))
}

// ——————————————————————————————— S05: silence is counted, not just survived
// Surviving an unwritable disk is half of it. The other half is knowing HOW
// MUCH was lost, because a log that drops lines and says nothing turns a
// partial corpus into a claimed whole one — and an eval run over it measures a
// subset and reports a total.
blind.record({ op: 'y', outcome: 'ok', ctx: { correlationId: 'c' } })
blind.record({ op: 'z', outcome: 'ok', ctx: { correlationId: 'c' } })
if (blind.lost() === 3) ok('and it COUNTS what it could not write, rather than only surviving it')
else fail('lost() said ' + blind.lost() + ', expected 3')

chmodSync(locked, 0o700)
blind.record({ op: 'after.recovery', outcome: 'ok', ctx: { correlationId: 'c' } })
const recovered = blind.read()
const gap = recovered.filter((r) => r.op === 'ops.gap')
if (gap.length === 1 && gap[0].detail?.lost === 3)
  ok('the first write that works leaves ONE gap marker naming the three it lost')
else fail('expected a single gap marker for 3 records, got ' + JSON.stringify(gap))

if (gap[0] && recovered.indexOf(gap[0]) < recovered.findIndex((r) => r.op === 'after.recovery'))
  ok('and the marker sits BEFORE the record that recovered, where the hole actually is')
else fail('the gap marker is not where the gap was')

if (blind.lost() === 0) ok('and the count clears once it has been published, so it is not double-reported')
else fail('lost() still says ' + blind.lost() + ' after publishing the gap')

// A corrupt line must not lose the rest of the log.
writeFileSync(path.join(dir, 'operations.jsonl'),
  readFileSync(path.join(dir, 'operations.jsonl'), 'utf8') + 'not json at all\\n')
ops.record({ op: 'after.corruption', outcome: 'ok', ctx: { correlationId: ops.correlate() } })
const survived = ops.read()
if (!survived.some((r) => r.op === 'after.corruption')) fail('a corrupt line lost the log')
else if (survived.length < 4) fail('a corrupt line took the earlier records with it')
else ok('one unparseable line is litter, not a reason to lose the rest')

// ————————————————————————————————————————————————— it stays bounded
const small = createOps({ dir: path.join(dir, 'capped'), cap: 50 })
for (let i = 0; i < 1200; i++)
  small.record({ op: 'noise', outcome: 'ok', ctx: { correlationId: 'c' }, detail: { i } })
const kept = small.read()
if (kept.length > 200) fail('the log grew to ' + kept.length + ' with a cap of 50')
else if (!kept.some((r) => r.detail?.i >= 1100)) fail('the cap dropped the NEWEST records')
else ok('a capped log keeps the newest — the failure being investigated right now')

// ————————————————————————————————————————————————— a secret never lands
ops.record({
  op: 'gateway.call', outcome: 'failed', ctx: { correlationId: ops.correlate() },
  detail: { authorization: 'Bearer sk-live_abcdefghijklmnopqrstuvwxyz012345' }
})
if (readFileSync(ops.file(), 'utf8').includes('sk-live_abcdefghijklmnopqrstuvwxyz012345'))
  fail('a secret reached the log file on disk')
else ok('and a secret in a detail never reaches the bytes on disk')

// PEM redaction must run before the log's value cap removes its footer.
const pem = '-----BEGIN PRIVATE KEY-----\\n' + 'synthetic-private-body '.repeat(50) + '\\n-----END PRIVATE KEY-----'
ops.record({ op: 'private-key', outcome: 'failed', ctx: { correlationId: ops.correlate() },
  detail: { body: pem, API_TOKEN: 'synthetic-opaque-token' }, error: new Error(pem) })
const privateBytes = readFileSync(ops.file(), 'utf8')
if (privateBytes.includes('synthetic-private-body') || privateBytes.includes('synthetic-opaque-token'))
  fail('truncation or a structured credential leaked into operations.jsonl')
else ok('complete PEM and named opaque credentials are scrubbed before any log bytes are written')

// Never walk discarded array tails, or one cycle can suppress the whole record.
const cyclic = []; cyclic.push(cyclic)
const boundedValues = Array.from({ length: 20 }, (_, i) => i)
boundedValues.push(cyclic)
Object.defineProperty(boundedValues, 100000, { get() { throw new Error('discarded tail was visited') } })
ops.record({ op: 'bounded-tree', outcome: 'ok', ctx: { correlationId: ops.correlate() }, detail: { boundedValues } })
const boundedRecord = ops.read().find((r) => r.op === 'bounded-tree')
if (boundedRecord?.detail?.boundedValues?.length !== 20) fail('discarded cycle/getter swallowed the real sink record')
else ok('discarded cyclic/getter tails are never read and the record still reaches disk')

// Serialization itself must be inert after sanitization.
let serializedCallbacks = 0
const freshSecret = () => { serializedCallbacks++; return { API_TOKEN: 'synthetic-fresh-secret' } }
const hostile = Object.create(null)
hostile.toJSON = freshSecret
hostile.__proto__ = { toJSON: freshSecret }
hostile.constructor = { prototype: { toJSON: freshSecret } }
hostile.big = 1n
hostile.symbol = Symbol('synthetic-symbol')
ops.record({ op: 'inert-json', outcome: 'ok', ctx: { correlationId: ops.correlate() }, detail: { hostile } })
const inertBytes = readFileSync(ops.file(), 'utf8')
if (serializedCallbacks !== 0 || inertBytes.includes('synthetic-fresh-secret')) fail('toJSON generated a secret after sanitization')
else if (!ops.read().some((r) => r.op === 'inert-json')) fail('non-JSON values swallowed the log record')
else ok('serialization hooks are inert and non-JSON values cannot suppress or inject log records')

// ————————————————————————————————————————————————— duration is measured
const done = ops.begin('slow.thing', { correlationId: ops.correlate() })
done('ok')
const timed = ops.read().filter((r) => r.op === 'slow.thing')[0]
if (typeof timed?.ms !== 'number') fail('begin did not measure a duration')
else ok('an operation carries how long it took, measured rather than guessed')

if (bad > 0) { console.log(bad + ' ops failure(s)'); process.exit(1) }
`

try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  process.stdout.write(out.split('\n').filter((l) => l.startsWith('ok') || l.startsWith('FAIL')).join('\n') + '\n')
  if (out.includes('FAIL')) process.exit(1)
  console.log('all green: the log records, correlates, stays bounded, and never becomes the outage')
} catch (e) {
  console.error('ops probe failed:', e.stdout?.toString() ?? e.message)
  console.error(e.stderr?.toString() ?? '')
  process.exit(1)
}
