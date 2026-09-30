// M103 — the instruction waits for the agent to be listening.
//
// Driven through PtyManager's spawn seam with a fake pty, because the branch
// under test is a TIMING one: what the manager does between "the process
// exists" and "the agent has stopped printing". A real agent would make this a
// race and the probe would tell us about the machine rather than the code.
//
// A file of its own rather than an appendix to `pty.test.mjs`, which exits
// inside a callback — appending there is the mid-file-exit trap that cost an
// iteration two commits ago.

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PtyManager } from '../src/main/pty.ts'
import { PASTE_END, PASTE_START } from '../src/shared/delivery.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => {
  failures++
  console.log('  FAIL ' + m)
}
const after = (ms) => new Promise((r) => setTimeout(r, ms))

const written = []
let emit = null
const fakePty = {
  onData: (cb) => {
    emit = cb
  },
  onExit: () => {},
  write: (d) => written.push(d),
  resize: () => {},
  kill: () => {},
  pid: 1234
}

const ptys = new PtyManager(
  { append: async () => ({ seq: 1 }) },
  randomUUID(),
  { onData: () => {}, onExit: () => {} },
  undefined,
  () => fakePty,
  undefined,
  // FA-07 — the actor is handed in now, from the one port that may produce one.
  // The default throws on purpose: a terminal journalled before a subject is
  // established would be a write nobody can attribute.
  () => ({ kind: 'person', id: 'operator' })
)

const { sessionId } = await ptys.open(randomUUID(), process.cwd(), 'shell')
ptys.deliverWhenReady(sessionId, 'read the release script\n\nthen fix the signing step')

written.length === 0
  ? ok('nothing is written to a silent session — the old code typed after 1200ms regardless of whether anyone was listening')
  : fail('the instruction was delivered before the agent said anything: ' + JSON.stringify(written))

emit('Welcome to the agent\n')
await after(150)
emit('checking for updates…')
await after(150)
written.length === 0
  ? ok('and not while it is still printing — every byte restarts the wait')
  : fail('delivered mid-output')

await after(700)
written.length === 1
  ? ok('once it goes quiet, the instruction is delivered — readiness OBSERVED, not assumed')
  : fail('after settling, written = ' + written.length)

const sent = written[0] ?? ''
sent.split('\r').length - 1 === 1
  ? ok('as ONE submission: a two-paragraph instruction is no longer submitted after its first paragraph')
  : fail('the instruction carried ' + (sent.split('\r').length - 1) + ' submissions')
sent.includes('then fix the signing step')
  ? ok('with the whole instruction inside the paste')
  : fail('the instruction was truncated: ' + JSON.stringify(sent))

// The markers themselves, asserted because counting carriage returns does NOT
// catch their absence: the instruction's line breaks are \n, so removing
// bracketed paste entirely leaves the \r count at one and this probe green.
// Found by planting exactly that and watching nothing fail.
sent.startsWith(PASTE_START) && sent.includes(PASTE_END)
  ? ok('wrapped in the paste markers, which is what makes the newlines content instead of Enter')
  : fail('the paste markers are gone; the terminal will read every newline as a submission')
sent.indexOf('\r') > sent.indexOf(PASTE_END)
  ? ok('and the submission is outside them, or it would submit nothing')
  : fail('the carriage return is inside the paste')

emit('more output\n')
await after(700)
written.length === 1
  ? ok('and exactly once — later output does not deliver it again')
  : fail('delivered ' + written.length + ' times')

// Failure and concurrency cases use the real manager and fake native PTY. Short
// injected timings avoid 30-second tests without weakening production defaults.
async function fixture({ maxWaitMs = 240, capacity = 32, write } = {}) {
  const writes = []
  let output, exit
  let kills = 0
  const native = {
    onData: (cb) => { output = cb }, onExit: (cb) => { exit = cb },
    write: (text) => { writes.push(text); write?.(text) },
    resize: () => {}, kill: () => { kills++ }, pid: 4321
  }
  const manager = new PtyManager(
    { append: async () => ({ seq: 1 }) }, randomUUID(),
    { onData: () => {}, onExit: () => {} }, undefined, () => native, undefined,
    () => ({ kind: 'person', id: 'operator' }), { settleMs: 15, maxWaitMs, capacity }
  )
  const { sessionId: id } = await manager.open(randomUUID(), process.cwd(), 'shell')
  return { manager, id, writes, emit: (data = 'ready') => output(data), exit: () => exit({ exitCode: 0 }), kills: () => kills }
}
const deferred = () => {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

{
  const f = await fixture()
  const first = f.manager.deliverWhenReady(f.id, 'first')
  const second = f.manager.deliverWhenReady(f.id, 'second')
  f.emit()
  assert.deepEqual(await first, { state: 'written' })
  await after(30)
  assert.equal(f.writes.length, 1, 'queued successor waits for fresh output')
  f.emit('first response')
  assert.deepEqual(await second, { state: 'written' })
  assert.ok(f.writes[0].includes('first'))
  assert.ok(f.writes[1].includes('second'))
  f.emit('later output')
  await after(30)
  assert.equal(f.writes.length, 2, 'each queued item is submitted once')
  await f.manager.end(f.id)
  ok('FIFO preserves multiple instructions and requires fresh output between writes')
}
{
  const f = await fixture()
  f.emit('welcome before enqueue')
  await after(30)
  assert.equal((await f.manager.deliverWhenReady(f.id, 'late first instruction')).state, 'written')
  await f.manager.end(f.id)
  ok('already-observed settled output permits first instruction after enqueue')
}
{
  const f = await fixture({ maxWaitMs: 55 })
  assert.deepEqual(await f.manager.deliverWhenReady(f.id, 'silent'), { state: 'failed_before_write', reason: 'readiness_timeout' })
  assert.equal(f.writes.length, 0)
  const continuous = f.manager.deliverWhenReady(f.id, 'spinner')
  const timer = setInterval(() => f.emit('busy'), 4)
  try { assert.equal((await continuous).reason, 'readiness_timeout') } finally { clearInterval(timer) }
  f.emit('finally settled')
  await after(30)
  assert.equal(f.writes.length, 0, 'deadline never forces delivery, even after later output')
  await f.manager.end(f.id)
  ok('silence and continuous output fail before write; no deadline fallback writes')
}
for (const action of ['stop', 'exit']) {
  const f = await fixture()
  const gate = deferred(), entered = deferred()
  const pending = f.manager.deliverWhenReady(f.id, 'must not reach dead session', {
    beforeWrite: async () => { entered.resolve(); return gate.promise }
  })
  f.emit()
  await entered.promise
  if (action === 'stop') await f.manager.end(f.id)
  else await f.exit()
  assert.equal((await pending).state, 'failed_before_write')
  gate.resolve(true)
  f.emit('late output')
  await after(30)
  assert.equal(f.writes.length, 0)
  assert.equal((await f.manager.deliverWhenReady(f.id, 'later')).state, 'failed_before_write')
  ok(action + ' cancels an in-flight gate and prevents late writes')
}
{
  const f = await fixture({ maxWaitMs: 55 })
  const gate = deferred(), entered = deferred()
  const pending = f.manager.deliverWhenReady(f.id, 'gate timed out', {
    beforeWrite: async () => { entered.resolve(); return gate.promise }
  })
  f.emit()
  await entered.promise
  assert.equal((await pending).reason, 'readiness_timeout')
  gate.resolve(true)
  await after(30)
  assert.equal(f.writes.length, 0)
  await f.manager.end(f.id)
  ok('deadline also fences a delayed gate callback')
}
{
  const f = await fixture()
  f.emit()
  const refused = await f.manager.deliverWhenReady(f.id, 'refused', { beforeWrite: async () => false })
  assert.equal(refused.reason, 'write_gate_refused')
  const rejected = await f.manager.deliverWhenReady(f.id, 'throws', { beforeWrite: async () => { throw new Error('secret-value') } })
  assert.equal(rejected.reason, 'write_gate_refused')
  assert.ok(!JSON.stringify(rejected).includes('secret-value'))
  assert.equal(f.writes.length, 0)
  await f.manager.end(f.id)
  ok('false/throwing gates never write or expose callback errors')
}
{
  const f = await fixture()
  const entered = deferred(), gate = deferred()
  let calls = 0
  const pending = f.manager.deliverWhenReady(f.id, 'after noisy gate', {
    beforeWrite: async () => { calls++; entered.resolve(); return gate.promise }
  })
  f.emit()
  await entered.promise
  f.emit('new output during gate')
  gate.resolve(true)
  await after(3)
  assert.equal(f.writes.length, 0, 'awaited gate cannot bypass new output')
  assert.deepEqual(await pending, { state: 'failed_before_write', reason: 'readiness_changed' })
  assert.equal(calls, 1, 'a claimed gate is not claimed twice')
  let revalidated = false
  const retry = await f.manager.deliverWhenReady(f.id, 'new attempt', {
    beforeWrite: async () => { revalidated = true; return false }
  })
  assert.equal(revalidated, true)
  assert.equal(retry.state, 'failed_before_write', 'changed authority on retry cannot reuse a prior gate')
  assert.equal(f.writes.length, 0)
  await f.manager.end(f.id)
  ok('output during a gate cancels before write and retry revalidates authority')
}
{
  const f = await fixture({ write: () => { throw new Error('native may have written a prefix') } })
  const first = f.manager.deliverWhenReady(f.id, 'partial')
  const next = f.manager.deliverWhenReady(f.id, 'must not follow')
  f.emit()
  assert.deepEqual(await first, { state: 'outcome_unknown', reason: 'pty_write_failed' })
  assert.equal((await next).reason, 'prior_write_unknown')
  f.emit('later output')
  assert.equal((await f.manager.deliverWhenReady(f.id, 'retry')).state, 'failed_before_write')
  assert.equal(f.writes.length, 1)
  await f.manager.end(f.id)
  ok('a possibly partial native write is unknown and halts automatic delivery')
}
{
  const f = await fixture({ capacity: 2 })
  assert.equal((await f.manager.deliverWhenReady('missing', 'x')).reason, 'unknown_session')
  assert.equal((await f.manager.deliverWhenReady(f.id, '  ')).reason, 'empty_instruction')
  const first = f.manager.deliverWhenReady(f.id, 'one')
  const second = f.manager.deliverWhenReady(f.id, 'two')
  assert.equal((await f.manager.deliverWhenReady(f.id, 'overflow')).reason, 'queue_full')
  await f.manager.end(f.id)
  assert.equal((await first).reason, 'stop_requested')
  assert.equal((await second).reason, 'stop_requested')
  assert.equal(f.kills(), 1)
  ok('bounded queue rejects overflow, empty input and unknown sessions explicitly')
}
{
  const f = await fixture()
  const pending = f.manager.deliverWhenReady(f.id, 'shutdown')
  const closing = f.manager.closeAll()
  assert.equal((await pending).reason, 'shutdown_requested')
  f.emit()
  await f.exit()
  await closing
  assert.equal(f.writes.length, 0)
  ok('shutdown cancels pending writes before signalling native exit')
}

for (const phase of ['before_enqueue', 'during_settle', 'during_gate']) {
  const f = await fixture()
  const entered = deferred(), gate = deferred()
  let pending
  f.emit('ready before human input')
  if (phase === 'before_enqueue') {
    await after(30)
    f.manager.write(f.id, 'human command\r')
    pending = f.manager.deliverWhenReady(f.id, 'automatic command')
  } else if (phase === 'during_settle') {
    pending = f.manager.deliverWhenReady(f.id, 'automatic command')
    f.manager.write(f.id, 'human command\r')
  } else {
    pending = f.manager.deliverWhenReady(f.id, 'automatic command', {
      beforeWrite: async () => { entered.resolve(); return gate.promise }
    })
    await entered.promise
    f.manager.write(f.id, 'human command\r')
    gate.resolve(true)
  }
  await after(30)
  assert.equal(f.writes.length, 1, phase + ': old readiness cannot authorize automatic delivery after manual input')
  assert.equal(f.writes[0], 'human command\r')
  f.emit('response to human command')
  if (phase === 'during_gate') {
    assert.deepEqual(await pending, { state: 'failed_before_write', reason: 'readiness_changed' })
    pending = f.manager.deliverWhenReady(f.id, 'automatic command', { beforeWrite: async () => true })
  }
  assert.equal((await pending).state, 'written')
  assert.equal(f.writes.length, 2)
  assert.ok(f.writes[1].includes('automatic command'))
  await f.manager.end(f.id)
  ok('manual input ' + phase + ' consumes readiness; only new output unlocks delivery')
}
{
  const f = await fixture({ write: () => { throw new Error('partial manual write') } })
  const pending = f.manager.deliverWhenReady(f.id, 'must not follow failed manual input')
  f.emit()
  assert.throws(() => f.manager.write(f.id, 'human command\r'), /partial manual write/)
  assert.equal((await pending).reason, 'prior_write_unknown')
  f.emit('later output')
  await after(30)
  assert.equal(f.writes.length, 1)
  assert.equal((await f.manager.deliverWhenReady(f.id, 'new automatic instruction')).state, 'failed_before_write')
  await f.manager.end(f.id)
  ok('a throwing manual write fences pending and future automatic delivery')
}

// THE SUMMARY STAYS LAST. Anything below it runs with its failures counted by
// nobody, and the file exits 0 while printing FAIL.
if (failures > 0) {
  console.log('\n' + failures + ' delivery failure(s)')
  process.exit(1)
}
console.log('\nall green: the instruction reaches a listening agent, whole, once')
