// Operator-local state that does not lie about being saved (S14 · REQ-S14-4…6).
//
// THE DEFECT THIS PROBES WAS MEASURED, not imagined. `settings.ts` returned
// DEFAULTS when the file would not parse, and `writeSettings` merged the next
// patch onto those defaults and wrote them back — so one malformed byte in
// `settings.json` destroyed the operator's workspace path, tabs and locale
// through a save that reported success. `localStore.write` returned `void` and
// logged its failures, and `toggleFavourite` returned the value it HOPED it had
// persisted.
//
// Real filesystem, real permissions, real interrupted write. A fake fs would
// prove the code calls rename; the question is what survives when it does not.

import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const SRC = path.resolve(import.meta.dirname, '../src/main/localState.ts')
const dir = mkdtempSync(path.join(tmpdir(), 'fabric-local-'))

const script = `
import { readLocal, writeLocal, updateLocal } from ${JSON.stringify(SRC)}
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createOps } from ${JSON.stringify(path.resolve(import.meta.dirname, '../src/main/ops.ts'))}
import { useOps } from ${JSON.stringify(path.resolve(import.meta.dirname, '../src/main/opsSink.ts'))}

const dir = ${JSON.stringify(dir)}
const log = createOps({dir: path.join(dir, 'logs')})
useOps(log)
const at = (n) => path.join(dir, n)
let bad = 0
const ok = (m) => console.log('ok   ' + m)
const fail = (m) => { bad++; console.log('FAIL ' + m) }
const list = (t) => Array.isArray(t) ? t : null

// ————————————————————————————————————————————————— an absent file
const missing = readLocal({ dir, file: 'pins.json', empty: [], validate: list })
if (missing.status !== 'default_missing' || missing.value.length !== 0)
  fail('an absent file should read as default_missing, got ' + missing.status)
else ok('an absent file is default_missing — not ready, and not an error either')

// ————————————————————————————————————————————————— a committed write
const first = writeLocal({ dir, file: 'pins.json', empty: [], validate: list }, ['a'])
if (first.status !== 'committed') fail('a plain write returned ' + first.status)
else ok('a write into a writable folder is committed, and says so')

const back = readLocal({ dir, file: 'pins.json', empty: [], validate: list })
if (back.status !== 'ready' || back.value.join() !== 'a') fail('read back ' + JSON.stringify(back))
else if (back.revision !== first.revision) fail('the revision moved without a write')
else ok('and reads back ready, at the revision the write reported')

// The temp file must not survive as litter that a later read could pick up.
const litter = readdirSync(dir).filter((f) => f.includes('.tmp'))
if (litter.length) fail('temp files left behind: ' + litter.join(', '))
else ok('no temp file is left behind')

// ————————————————————————————————————————————————— optimistic concurrency
const stale = writeLocal({ dir, file: 'pins.json', empty: [], validate: list }, ['b'], 'not-the-revision')
if (stale.status !== 'conflict') fail('a stale expected revision returned ' + stale.status)
else if (stale.currentValue.join() !== 'a') fail('the conflict did not carry the current value')
else ok('a write at a revision that moved is a conflict carrying the current value')

const untouched = readLocal({ dir, file: 'pins.json', empty: [], validate: list })
if (untouched.value.join() !== 'a') fail('the refused write changed the file anyway')
else ok('and the file it refused to write is unchanged')

// ————————————————————————————————————————————————— a malformed file
// The case that destroyed data: parse failure must not become defaults, and the
// bytes must be kept rather than overwritten.
writeFileSync(at('conf.json'), '{ "theme": "dark", oops')
const broken = readLocal({ dir, file: 'conf.json', empty: { theme: 'light' }, validate: (v) => v })
if (broken.status !== 'unreadable') fail('a malformed file read as ' + broken.status)
else if (broken.value.theme !== 'light') fail('the caller did not get its empty value to work from')
else ok('a malformed file is unreadable — the empty value is handed over, labelled')

const quarantined = readdirSync(dir).filter((f) => f.startsWith('conf.json.quarantined'))
if (quarantined.length !== 1) fail('the malformed bytes were not quarantined: ' + readdirSync(dir).join(','))
else if (!readFileSync(path.join(dir, quarantined[0]), 'utf8').includes('oops'))
  fail('the quarantined copy does not hold the original bytes')
else ok('and its bytes are quarantined beside it, recoverable by hand')

const again = readLocal({ dir, file: 'conf.json', empty: { theme: 'light' }, validate: (v) => v })
if (again.status !== 'unreadable') fail('quarantine became a pristine missing file on the second read')
else ok('quarantined state remains unreadable across repeated reads and fresh callers')

// The original is gone from the live path, so the next write cannot merge onto
// half-parsed rubbish — but it was MOVED, never deleted.
if (existsSync(at('conf.json'))) fail('the malformed file is still in the live path')
else ok('the live path is clear, so a save cannot merge onto rubbish')

// ————————————————————————————————————————————————— recovery from last-good
writeLocal({ dir, file: 'kept.json', empty: { a: 1 }, validate: (v) => v }, { a: 7 })
writeFileSync(at('kept.json'), 'not json at all')
const recovered = readLocal({ dir, file: 'kept.json', empty: { a: 1 }, validate: (v) => v })
if (recovered.status !== 'recovered') fail('with a last-good present the status was ' + recovered.status)
else if (recovered.value.a !== 7) fail('recovery returned ' + JSON.stringify(recovered.value))
else if (!recovered.lastGoodAt) fail('recovery did not say when the last good copy was written')
else ok('a malformed file with a last-good copy recovers the last good value, and dates it')

// ————————————————————————————————————————————————— shape validation
// Parsed, and the wrong shape. A hand-edited list-turned-object used to reach
// the renderer and break the estate home.
writeFileSync(at('shape.json'), '{"pinned":true}')
const wrong = readLocal({ dir, file: 'shape.json', empty: [], validate: list })
if (wrong.status !== 'unreadable') fail('a wrong-shaped file read as ' + wrong.status)
else ok('a file that parses into the wrong shape is unreadable, not passed through')

// ————————————————————————————————————————————————— write denied
const locked = path.join(dir, 'locked')
mkdirSync(locked, { recursive: true })
writeLocal({ dir: locked, file: 'pins.json', empty: [], validate: list }, ['before'])
chmodSync(locked, 0o500)
const denied = writeLocal({ dir: locked, file: 'pins.json', empty: [], validate: list }, ['after'])
chmodSync(locked, 0o700)
if (denied.status !== 'failed') fail('a write into a read-only folder returned ' + denied.status)
else if (!denied.reason) fail('the failure carries no reason for the operator')
else ok('a write the filesystem refuses is failed, with a reason — never a silent success')

const preserved = readLocal({ dir: locked, file: 'pins.json', empty: [], validate: list })
if (preserved.value.join() !== 'before') fail('the refused write lost the previous value: ' + preserved.value.join())
else ok('and the previously persisted value is still there')

// ————————————————————————————————————————————————— interrupted before rename
// A temp file left by a killed process must never be read as the answer.
writeLocal({ dir, file: 'crash.json', empty: [], validate: list }, ['committed'])
writeFileSync(at('crash.json.tmp'), JSON.stringify(['half-written']))
const afterCrash = readLocal({ dir, file: 'crash.json', empty: [], validate: list })
if (afterCrash.value.join() !== 'committed')
  fail('a leftover temp file was read as the answer: ' + afterCrash.value.join())
else ok('a temp file left by an interrupted write is ignored — the committed file wins')


// Private-state prerequisites for the CEO draft service. Only synthetic text.
const spec = (file, validate = list) => ({dir, file, empty: [], validate})
const damaged = spec('private.json')
writeFileSync(at(damaged.file), '{"text":PRIVATE42}')
const privateRead = readLocal(damaged)
assert.equal(privateRead.status, 'unreadable')
assert.equal(privateRead.error, 'local_state_invalid_json')
let changes = 0
assert.deepEqual(updateLocal(damaged, () => { changes++; return ['reset'] }),
  {status: 'failed', reason: 'local_state_recovery_required'})
assert.equal(changes, 0)
assert.deepEqual(writeLocal(damaged, ['reset'], privateRead.revision),
  {status: 'failed', reason: 'local_state_recovery_required'})
assert.equal(existsSync(at(damaged.file)), false)
assert.equal(existsSync(at(damaged.file + '.last-good')), false)
assert.equal(readLocal(damaged).status, 'unreadable')
assert.equal(readdirSync(dir).filter(f => f.startsWith(damaged.file + '.quarantined-')).length, 1)
ok('unreadable private state refuses write and update before invoking the change callback')

const kept = spec('validated.json')
const saved = writeLocal(kept, ['kept'])
assert.equal(saved.status, 'committed')
const before = [readFileSync(at(kept.file), 'utf8'), readFileSync(at(kept.file + '.last-good'), 'utf8')]
let serialized = false
const invalid = {toJSON() { serialized = true; return ['bypass'] }}
assert.deepEqual(writeLocal(kept, invalid, saved.revision), {status: 'failed', reason: 'local_state_invalid_next'})
assert.equal(serialized, false)
const throwing = {...kept, validate(value) { if (Array.isArray(value)) return value; throw new Error('PRIVATE42') }}
assert.equal(writeLocal(throwing, {bad:true}, saved.revision).reason, 'local_state_invalid_next')
const cycle = []; cycle.push(cycle)
assert.equal(writeLocal(kept, cycle, saved.revision).reason, 'local_state_invalid_next')
const deceptive = []; deceptive.toJSON = () => ({bad:true})
assert.equal(writeLocal(kept, deceptive, saved.revision).reason, 'local_state_invalid_next')
assert.equal(updateLocal(kept, () => { throw new Error('PRIVATE42') }).reason, 'local_state_update_failed')
assert.deepEqual([readFileSync(at(kept.file), 'utf8'), readFileSync(at(kept.file + '.last-good'), 'utf8')], before)
ok('invalid, throwing and non-serializable proposals preserve both live and last-good bytes')

writeFileSync(at(kept.file), '{"text":PRIVATE42}')
const recoveredPrivate = readLocal(kept)
assert.equal(recoveredPrivate.status, 'recovered')
assert.deepEqual(recoveredPrivate.value, ['kept'])
assert.equal(writeLocal(kept, ['restored'], recoveredPrivate.revision).status, 'committed')
assert.deepEqual(readLocal(kept).value, ['restored'])
ok('valid last-good recovery remains writable at its observed revision')

const fresh = spec('fresh.json')
assert.equal(updateLocal(fresh, old => [...old, 'first']).status, 'committed')
const initial = readLocal(fresh)
const newer = writeLocal(fresh, ['newer'], initial.revision)
assert.equal(newer.status, 'committed')
const refused = writeLocal(fresh, ['stale'], initial.revision)
assert.equal(refused.status, 'conflict')
assert.equal(refused.currentRevision, newer.revision)
assert.deepEqual(refused.currentValue, ['newer'])
assert.deepEqual(readLocal(fresh).value, ['newer'])
const duringChange = updateLocal(fresh, () => {
  assert.equal(writeLocal(fresh, ['latest']).status, 'committed')
  return ['stale transform']
})
assert.equal(duringChange.status, 'conflict')
assert.deepEqual(readLocal(fresh).value, ['latest'])
ok('first save is allowed; stale CAS and a stale transform cannot overwrite newer data')

const normalizing = spec('canonical.json', value => Array.isArray(value) ? value.filter(v => typeof v === 'string') : null)
const canonical = writeLocal(normalizing, ['a', 4])
assert.equal(canonical.status, 'committed')
assert.deepEqual(canonical.value, ['a'])
assert.equal(canonical.revision, readLocal(normalizing).revision)
assert.deepEqual(JSON.parse(readFileSync(at(normalizing.file), 'utf8')), canonical.value)
ok('normalizing validators persist the canonical value and return its exact revision')

const badRead = spec('validator.json', () => { throw new Error('PRIVATE42') })
writeFileSync(at(badRead.file), '[]')
assert.equal(readLocal(badRead).error, 'local_state_validation_failed')
const badRecovery = spec('recovery-private.json')
writeFileSync(at(badRecovery.file + '.last-good'), '{"text":PRIVATE42}')
assert.equal(readLocal(badRecovery).status, 'unreadable')
const privatePath = path.join(dir, 'PRIVATE42')
mkdirSync(privatePath)
writeFileSync(path.join(privatePath, 'read.json'), '[]')
chmodSync(path.join(privatePath, 'read.json'), 0o000)
try {
  assert.equal(readLocal({...spec('read.json'), dir:privatePath}).error, 'local_state_read_failed')
} finally { chmodSync(path.join(privatePath, 'read.json'), 0o600) }
chmodSync(privatePath, 0o500)
try {
  assert.equal(writeLocal({...spec('write.json'), dir:privatePath}, ['x']).reason, 'local_state_write_failed')
} finally { chmodSync(privatePath, 0o700) }
const lostMetadata = spec('metadata.json')
writeLocal(lostMetadata, ['recovered value'])
writeFileSync(at(lostMetadata.file), 'broken')
const deletedDuringValidation = {...lostMetadata, validate(value) {
  if (existsSync(at(lostMetadata.file + '.last-good'))) unlinkSync(at(lostMetadata.file + '.last-good'))
  return list(value)
}}
const stillRecovered = readLocal(deletedDuringValidation)
assert.equal(stillRecovered.status, 'recovered')
assert.deepEqual(stillRecovered.value, ['recovered value'])
assert.equal(stillRecovered.lastGoodAt, null)
ok('a recovery-copy deletion between validation and metadata lookup preserves the value without throwing')
const logged = readFileSync(log.file(), 'utf8')
assert.equal(logged.includes('PRIVATE42'), false)
assert.equal(logged.includes(dir), false)
assert.ok(logged.includes('local_state_invalid_json'))
assert.ok(logged.includes('local_state_write_failed'))
assert.ok(logged.includes('local_state_recovery_read_failed'))
assert.ok(logged.includes('local_state_metadata_unavailable'))
ok('actual operations file and public diagnostics contain fixed codes, never private excerpts or paths')

if (bad > 0) { console.log(bad + ' local-state failure(s)'); process.exit(1) }
`

try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  process.stdout.write(out.split('\n').filter((l) => l.startsWith('ok') || l.startsWith('FAIL')).join('\n') + '\n')
  if (out.includes('FAIL')) process.exit(1)
  console.log('all green: local state reports what it did, and keeps what it could not parse')
} catch (e) {
  console.error('local-state probe failed:', e.stdout?.toString() ?? e.message)
  console.error(e.stderr?.toString() ?? '')
  process.exitCode = 1
} finally {
  rmSync(dir, {recursive: true, force: true})
}
