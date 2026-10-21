// #region ops-retention — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
// ST-4 of the 0.3.9 stability audit: the operations log held 12 hours (a 20 000-line cap at 1 770 lines an hour, 59 %
// of them successful polling reads), so the evidence of every outage of the week was gone; startup-failure.log was
// overwritten, so only the last of eight failed starts survived. Here, against a real filesystem and a fake clock:
//   - the log keeps days: a week of records survives, older segments go, the byte budget is a hard ceiling;
//   - a successful fast IPC read is written once per window and counted, never once per call; failures always land;
//   - startup-failure.log appends, bounded, newest kept.
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const { createOps } = await import(path.resolve(import.meta.dirname, '../src/main/ops.ts'))
const { appendBounded } = await import(path.resolve(import.meta.dirname, '../src/main/boundedLog.ts'))

const HOUR = 3_600_000
const DAY = 24 * HOUR
const ctx = { correlationId: 'c' }
const fresh = () => mkdtempSync(path.join(tmpdir(), 'fabric-ops-retention-'))
const bytesIn = (dir) => readdirSync(dir).filter((f) => f.startsWith('operations')).reduce((n, f) => n + statSync(path.join(dir, f)).size, 0)

test('ST-4: the log keeps a week, not twelve hours', () => {
  const dir = fresh()
  let t = Date.parse('2026-10-01T00:00:00Z')
  // About the measured rate of non-polling lines: one a minute is ~1 440 a day.
  const ops = createOps({ dir, now: () => new Date(t), segmentBytes: 64 * 1024, budgetBytes: 64 * 1024 * 1024 })
  for (let i = 0; i < 9 * 24 * 60; i++) {
    ops.record({ op: 'cycle.ran', outcome: 'ok', ctx, detail: { i, pad: 'x'.repeat(120) } })
    t += 60_000
  }
  const kept = ops.read()
  const oldest = Date.parse(kept[0].at)
  const newest = Date.parse(kept.at(-1).at)
  assert.ok(newest - oldest >= 7 * DAY, `kept only ${((newest - oldest) / HOUR).toFixed(1)} h`)
  assert.equal(kept.at(-1).detail.i, 9 * 24 * 60 - 1, 'the newest record is kept')
  // Nothing is ever rewritten in place: rotation renames, so the 4.7 MB trim rewrite of ST-9 is gone.
  assert.ok(readdirSync(dir).filter((f) => /^operations\.\d+\.jsonl$/.test(f)).length > 1, 'the log rotates into segments')
})

test('ST-4: segments older than the age limit go, and the byte budget is a hard ceiling', () => {
  const dir = fresh()
  let t = Date.parse('2026-10-01T00:00:00Z')
  const ops = createOps({ dir, now: () => new Date(t), segmentBytes: 16 * 1024, budgetBytes: 200 * 1024, maxAgeMs: 30 * DAY })
  for (let i = 0; i < 3000; i++) {
    ops.record({ op: 'cycle.ran', outcome: 'ok', ctx, detail: { i, pad: 'y'.repeat(200) } })
    t += 5 * 60_000
  }
  assert.ok(bytesIn(dir) <= 200 * 1024 + 16 * 1024 + 2048, `the log holds ${bytesIn(dir)} bytes against a 200 KiB budget`)
  const kept = ops.read()
  assert.equal(kept.at(-1).detail.i, 2999)
  // The budget cut into the last 7 days: said once per cut, so a too-small budget is visible.
  assert.ok(kept.some((r) => r.op === 'ops.retention-short'), 'a cut inside the 7-day floor is recorded')

  const dir2 = fresh()
  let t2 = Date.parse('2026-10-01T00:00:00Z')
  const aged = createOps({ dir: dir2, now: () => new Date(t2), segmentBytes: 8 * 1024, budgetBytes: 64 * 1024 * 1024, maxAgeMs: 10 * DAY })
  for (let i = 0; i < 40 * 24; i++) {
    aged.record({ op: 'cycle.ran', outcome: 'ok', ctx, detail: { i, pad: 'z'.repeat(100) } })
    t2 += HOUR
  }
  const left = aged.read()
  assert.ok(Date.parse(left[0].at) >= t2 - 12 * DAY, `a record from ${left[0].at} outlived the 10-day age limit`)
  assert.ok(Date.parse(left[0].at) <= t2 - 7 * DAY, 'the age limit cut into the week')
})

test('ST-4: successful fast IPC reads are counted, not written per call; failures and slow calls always land', () => {
  const dir = fresh()
  let t = Date.parse('2026-10-01T00:00:00Z')
  const ops = createOps({ dir, now: () => new Date(t), sampleWindowMs: 10 * 60_000 })
  for (let i = 0; i < 600; i++) {
    ops.record({ op: 'ipc.comms:heads', outcome: 'ok', ms: 4, ctx })
    ops.record({ op: 'ipc.feed:replay', outcome: 'ok', ms: 12, ctx })
    t += 5_000
  }
  ops.record({ op: 'ipc.feed:replay', outcome: 'failed', ms: 15_000, ctx, error: new Error('DatabaseDeadline') })
  ops.record({ op: 'ipc.stack:exposure', outcome: 'ok', ms: 2_401, ctx })
  ops.record({ op: 'stack.lost', outcome: 'failed', ctx })
  const all = ops.read()
  const heads = all.filter((r) => r.op === 'ipc.comms:heads')
  // 600 calls over 50 minutes: once per 10-minute window, not 600 times.
  assert.ok(heads.length >= 1 && heads.length <= 6, `${heads.length} lines for 600 successful polls`)
  const sampled = all.filter((r) => r.op === 'ops.sampled')
  assert.ok(sampled.length >= 4, 'each closed window says how many calls it did not write')
  const counted = sampled.reduce((n, r) => n + (r.detail?.counts?.['ipc.comms:heads'] ?? 0), 0)
  assert.equal(counted + heads.length >= 590, true, `the count lost calls: ${counted} counted + ${heads.length} written`)
  assert.ok(all.some((r) => r.op === 'ipc.feed:replay' && r.outcome === 'failed'), 'a failed read is always written')
  assert.ok(all.some((r) => r.op === 'ipc.stack:exposure'), 'a slow successful read is written: it is the one worth finding')
  assert.ok(all.some((r) => r.op === 'stack.lost'), 'a state change is always written')
})

test('ST-4: startup-failure.log appends, bounded, and keeps the newest', () => {
  const dir = fresh()
  const file = path.join(dir, 'startup-failure.log')
  for (let i = 0; i < 8; i++) appendBounded(file, `2026-10-20T05:2${i}:00Z  stack-would-not-start\nattempt ${i}\n`, { maxBytes: 4096 })
  const text = readFileSync(file, 'utf8')
  for (let i = 0; i < 8; i++) assert.match(text, new RegExp(`attempt ${i}\\b`), `attempt ${i} was overwritten`)
  for (let i = 0; i < 200; i++) appendBounded(file, `entry ${i} ${'w'.repeat(80)}\n`, { maxBytes: 4096 })
  const bounded = readFileSync(file, 'utf8')
  assert.ok(Buffer.byteLength(bounded) <= 4096, `${Buffer.byteLength(bounded)} bytes against a 4 KiB bound`)
  assert.match(bounded, /entry 199 /, 'the newest entry is kept')
  assert.ok(!/^w/.test(bounded), 'the cut lands on an entry boundary, not inside one')
  // A file it cannot write does not throw: it runs on the way to a dialog.
  writeFileSync(path.join(dir, 'blocker'), '')
  assert.doesNotThrow(() => appendBounded(path.join(dir, 'blocker', 'nested.log'), 'x\n', { maxBytes: 100 }))
})
// #endregion ops-retention
