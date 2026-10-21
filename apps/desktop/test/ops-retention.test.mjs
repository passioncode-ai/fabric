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

const { createOps, sampledByDefault } = await import(path.resolve(import.meta.dirname, '../src/main/ops.ts'))
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
// 0.3.9 review DA-2: every connected fabric-mcp pings the hub every 2 minutes and each ping was a ~375-byte line, so at
// the 40-odd agents this machine runs the pings were about 70 % of the log's bytes and the 96 MB budget cut the week at
// about 6 days. A successful fast `mcp.ping` is counted like an `ipc.*` read; a failed or slow ping is still written.
test('DA-2: forty agents pinging every 2 minutes for a week fit the default budget, and the week is kept', () => {
  assert.equal(sampledByDefault({ op: 'mcp.ping', outcome: 'ok', level: 'info', ms: 3 }), true)
  assert.equal(sampledByDefault({ op: 'mcp.ping', outcome: 'unknown', level: 'warn', ms: 3 }), false)
  assert.equal(sampledByDefault({ op: 'mcp.ping', outcome: 'ok', level: 'info', ms: 4_000 }), false)
  assert.equal(sampledByDefault({ op: 'mcp.initialize', outcome: 'ok', level: 'info', ms: 3 }), false, 'a session joining is a fact, never sampled')
  const dir = fresh()
  let t = Date.parse('2026-10-01T00:00:00Z')
  const ops = createOps({ dir, now: () => new Date(t) })
  const agents = 40
  const ping = (i) => ({ op: 'mcp.ping', outcome: 'ok', level: 'info', ms: 2, ctx: { correlationId: 'c0f1e2d3-a4b5-4c6d-8e7f-90a1b2c3d4e5', estateId: 'e0f1e2d3-a4b5-4c6d-8e7f-90a1b2c3d4e5', projectId: 'p0f1e2d3-a4b5-4c6d-8e7f-90a1b2c3d4e5', sessionId: `s${i}f1e2d3-a4b5-4c6d-8e7f-90a1b2c3d4e5` }, detail: { attempt_id: 'a0f1e2d3-a4b5-4c6d-8e7f-90a1b2c3d4e5', trace_outcome: 'returned', status: 200, rpc_id: 1234 } })
  // Every 2 minutes for 7 days: each agent's ping, and the rest of the log at the rate 0.3.9 still writes (about
  // 187 KB an hour, measured 2026-10-21, so about 6.2 KB per 2 minutes; written here as two lines of that size together,
  // the same bytes in fewer writes).
  for (let step = 0; step < 7 * 24 * 30; step++) {
    for (let a = 0; a < agents; a++) ops.record(ping(a))
    for (let k = 0; k < 2; k++) ops.record({ op: 'tool.fabric_heartbeat', outcome: 'ok', level: 'info', ms: 40, ctx, detail: { pad: 'p'.repeat(3_050) } })
    t += 120_000
  }
  const all = ops.read()
  assert.ok(!all.some((r) => r.op === 'ops.retention-short'), 'the budget cut the week')
  const oldest = Date.parse(all[0].at)
  assert.ok(t - oldest >= 7 * DAY - 2 * 60_000, `kept only ${((t - oldest) / HOUR).toFixed(1)} h`)
  assert.ok(bytesIn(dir) <= 96 * 1024 * 1024, `${bytesIn(dir)} bytes`)
  const pings = all.filter((r) => r.op === 'mcp.ping').length
  assert.ok(pings <= 7 * 24 * 6 + 10, `${pings} ping lines: pings are written, not counted`)
  const counted = all.filter((r) => r.op === 'ops.sampled').reduce((n, r) => n + (r.detail?.counts?.['mcp.ping'] ?? 0), 0)
  assert.ok(counted + pings >= agents * 7 * 24 * 30 - agents * 6, 'the pings were dropped, not counted')
})
// #endregion ops-retention

// #region ops-rotate-failing — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
// 0.3.9 review iteration 2, ER-3: a rotation that throws (Windows EBUSY or EPERM while another process holds the file;
// here, a directory that refuses renames) was counted as a lost append, so the log grew past its budget without end and
// wrote an `ops.gap` for nearly every record it had in fact written. A written record is never counted lost, the failed
// rotation is said once, and the budget stays a hard ceiling: past it nothing more is appended, and that is counted.
const posixOnly = process.platform === 'win32' || process.getuid?.() === 0
test('ER-3 (i2): a rotation that keeps failing never counts a written record as lost, and the budget holds', { skip: posixOnly && 'needs a directory that refuses renames' }, async () => {
  const { chmodSync } = await import('node:fs')
  const dir = fresh()
  let t = Date.parse('2026-10-21T00:00:00Z')
  const ops = createOps({ dir, now: () => new Date(t), segmentBytes: 1024, budgetBytes: 4096 })
  ops.record({ op: 'first', outcome: 'ok', ctx })
  chmodSync(dir, 0o500)
  try {
    // Room left in the budget: every record is written, none is reported lost, and the failure is said once.
    for (let i = 0; i < 8; i++) { ops.record({ op: 'cycle.ran', outcome: 'ok', ctx, detail: { i, pad: 'p'.repeat(150) } }); t += 1_000 }
    let lines = readFileSync(path.join(dir, 'operations.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    assert.equal(lines.filter((r) => r.op === 'cycle.ran').length, 8)
    assert.equal(lines.filter((r) => r.op === 'ops.gap').length, 0, 'a gap was written for records that are on disk')
    assert.equal(ops.lost(), 0, `lost() says ${ops.lost()} of records that were written`)
    // Past the budget: nothing more is appended, and what is not written is counted.
    for (let i = 8; i < 200; i++) { ops.record({ op: 'cycle.ran', outcome: 'ok', ctx, detail: { i, pad: 'p'.repeat(150) } }); t += 1_000 }
    assert.ok(statSync(path.join(dir, 'operations.jsonl')).size <= 4096, `the log holds ${statSync(path.join(dir, 'operations.jsonl')).size} bytes against a 4 KiB budget`)
    lines = readFileSync(path.join(dir, 'operations.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    assert.equal(lines.filter((r) => r.op === 'ops.rotate-failed').length, 1, 'the failed rotation is said once per streak')
    assert.equal(lines.filter((r) => r.op === 'ops.gap').length, 0)
    const written = lines.filter((r) => r.op === 'cycle.ran').length
    assert.equal(ops.lost(), 200 - written, 'every record not written is counted, and only those')
  } finally {
    chmodSync(dir, 0o700)
  }
  // Rotation works again (after its backoff): the gap is said once with the true count, and the log rotates.
  const missing = ops.lost()
  t += 15 * 60_000
  ops.record({ op: 'after', outcome: 'ok', ctx })
  for (let i = 0; i < 6; i++) { ops.record({ op: 'cycle.ran', outcome: 'ok', ctx, detail: { i, pad: 'q'.repeat(150) } }); t += 1_000 }
  const gaps = ops.read().filter((r) => r.op === 'ops.gap')
  assert.equal(gaps.length, 1)
  assert.equal(gaps[0].detail.lost, missing)
  assert.equal(ops.lost(), 0)
  assert.ok(readdirSync(dir).some((f) => /^operations\.\d+\.jsonl$/.test(f)), 'the log rotates again')
  assert.ok(bytesIn(dir) <= 4096 + 1024 + 512, `the log holds ${bytesIn(dir)} bytes`)
})
// #endregion ops-rotate-failing
