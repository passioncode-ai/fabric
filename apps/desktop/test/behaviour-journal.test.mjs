// ADR-0203 §6: the agents' behaviour journal. Who did what on whose word, one JSONL file a UTC day, redacted, bounded,
// kept 30 days, and read back newest first or by the voice call that asked.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readdirSync, statSync, writeFileSync, readFileSync, symlinkSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createBehaviourJournal, BEHAVIOUR_KEEP_DAYS } from '../src/main/behaviourJournal.ts'

const DAY = 86_400_000
const T0 = Date.parse('2026-11-20T21:00:00Z')

function fresh() { return mkdtempSync(path.join(tmpdir(), 'behaviour-')) }

test('an act is one private line, its reason redacted and cut, read back newest first and by call', () => {
  const folder = fresh()
  let t = T0
  const j = createBehaviourJournal({ folder, now: () => t })
  assert.equal(j.note({ actor: { kind: 'voice', id: 'call-1' }, act: 'session.start', target: 'p1', word: { of: 'owner', via: 'voice', ref: 'call-1' }, decision: 'done', reason: 'the owner said start it, key sk-ant-api03-' + 'x'.repeat(40) }), true)
  t += 1000
  j.note({ actor: { kind: 'session', id: 's9' }, act: 'effect.publication', target: 'https://example.invalid/p', word: { of: 'approval-mode', via: 'none' }, decision: 'allowed', reason: 'x'.repeat(2000) })
  const file = path.join(folder, 'behaviour', '2026-11-20.jsonl')
  assert.equal(statSync(file).mode & 0o777, 0o600)
  assert.equal(statSync(path.join(folder, 'behaviour')).mode & 0o777, 0o700)
  assert.ok(!readFileSync(file, 'utf8').includes('sk-ant-api03-'), 'a key in a reason never reaches the file')
  const all = j.read()
  assert.deepEqual(all.entries.map((e) => e.act), ['effect.publication', 'session.start'])
  assert.ok(all.entries[0].reason.length <= 300)
  assert.deepEqual(j.read({ call: 'call-1' }).entries.map((e) => e.act), ['session.start'])
})

test('a torn line is counted, not shown; a line over 4 KB keeps who, what and whose word', () => {
  const folder = fresh()
  const j = createBehaviourJournal({ folder, now: () => T0 })
  j.note({ actor: { kind: 'ceo', id: 'console' }, act: 'session.stop', target: 'x'.repeat(6000), word: { of: 'ceo', via: 'console' }, decision: 'done', reason: 'stuck' })
  writeFileSync(path.join(folder, 'behaviour', '2026-11-20.jsonl'), '{"t":"torn', { flag: 'a' })
  const r = j.read()
  assert.equal(r.unreadable, 1)
  assert.equal(r.entries.length, 1)
  assert.equal(r.entries[0].cut, true)
  assert.equal(r.entries[0].act, 'session.stop')
  assert.equal(r.entries[0].target, undefined)
})

test('days past the window are removed by their name, other files are left, and a linked folder is not written', () => {
  const folder = fresh()
  mkdirSync(path.join(folder, 'behaviour'), { recursive: true })
  const old = new Date(T0 - (BEHAVIOUR_KEEP_DAYS + 1) * DAY).toISOString().slice(0, 10)
  writeFileSync(path.join(folder, 'behaviour', `${old}.jsonl`), '')
  writeFileSync(path.join(folder, 'behaviour', 'notes.txt'), 'mine')
  const j = createBehaviourJournal({ folder, now: () => T0 })
  j.note({ actor: { kind: 'ceo', id: 'console' }, act: 'session.open', word: { of: 'ceo', via: 'console' }, decision: 'done' })
  assert.deepEqual(readdirSync(path.join(folder, 'behaviour')).sort(), ['2026-11-20.jsonl', 'notes.txt'])

  const linked = fresh(), elsewhere = fresh()
  symlinkSync(elsewhere, path.join(linked, 'behaviour'))
  const failed = []
  const k = createBehaviourJournal({ folder: linked, now: () => T0, failed: (w) => failed.push(w) })
  assert.equal(k.note({ actor: { kind: 'ceo', id: 'console' }, act: 'session.open', word: { of: 'ceo', via: 'console' }, decision: 'done' }), false)
  assert.deepEqual(readdirSync(elsewhere), [], 'nothing is written through a link')
  rmSync(linked, { recursive: true, force: true }); rmSync(elsewhere, { recursive: true, force: true })
})
