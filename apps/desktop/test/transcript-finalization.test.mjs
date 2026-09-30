// HAR04: native filesystem evidence, not a null-as-success capture receipt.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createTranscriptStore } from '../src/main/transcripts.ts'

const root = fs.mkdtempSync(path.join(tmpdir(), 'fabric-finalization-'))
const meta = { optionId: 'test', startedAt: '2026-09-27T10:00:00Z', endedAt: '2026-09-27T10:02:00Z', exitCode: 0 }
const changedMeta = { ...meta, endedAt: '2026-09-27T12:00:00Z', exitCode: 9 }
const store = createTranscriptStore({ root })
const file = (id) => path.join(root, 'transcripts', `${id}.log`)
let checks = 0
const check = (name, fn) => { fn(); checks++; console.log(`ok ${name}`) }

try {
  check('readable empty capture is proved empty; missing capture is unavailable', () => {
    const id = randomUUID()
    assert.deepEqual(store.finalize(id, meta), { state: 'unavailable', reason: 'missing-capture' })
    store.open(id)
    assert.deepEqual(store.finalize(id, meta), { state: 'empty', truncated: false })
    assert.deepEqual(store.finalize(id, changedMeta), { state: 'empty', truncated: false })
    store.settle(id)
    assert.equal(store.finalize(id, meta).state, 'unavailable')
  })
  check('lost journal reply retries the exact snapshot, including across store recreation', () => {
    const id = randomUUID()
    store.open(id)
    store.write(id, 'first line\nlast unterminated line')
    const first = store.finalize(id, meta)
    assert.equal(first.state, 'captured')
    assert.equal(first.record.body, 'first line\nlast unterminated line')
    assert.deepEqual(store.finalize(id, changedMeta), first)
    assert.deepEqual(createTranscriptStore({ root }).finalize(id, changedMeta), first)
    const { close } = store
    assert.deepEqual(close(id, changedMeta), first.record)
    store.open(id) // accidental repeat must not truncate evidence
    assert.deepEqual(store.finalize(id, changedMeta), first)
    store.settle(id)
    assert.equal(fs.existsSync(file(id)), false)
    assert.equal(fs.existsSync(file(id).replace('.log', '.final.json')), false)
    assert.equal(fs.existsSync(file(id).replace('.log', '.pending.json')), false)
  })
  check('missing or unreadable finalized spool never becomes empty and can be retried', () => {
    const id = randomUUID()
    store.open(id); store.write(id, 'retained evidence\n')
    const first = store.finalize(id, meta)
    const bytes = fs.readFileSync(file(id))
    fs.unlinkSync(file(id))
    assert.deepEqual(store.finalize(id, changedMeta), { state: 'unavailable', reason: 'spool-unreadable' })
    fs.mkdirSync(file(id))
    assert.equal(store.finalize(id, changedMeta).state, 'unavailable')
    assert.equal(createTranscriptStore({ root }).recover().some((r) => r.sessionId === id), false)
    assert.equal(fs.existsSync(file(id)), true) // recovery must not settle a read failure
    fs.rmdirSync(file(id)); fs.writeFileSync(file(id), bytes)
    assert.deepEqual(store.finalize(id, changedMeta), first)
    store.discard(id)
    assert.equal(store.finalize(id, meta).state, 'unavailable')
  })
  check('first-read failure preserves exit metadata for a later successful retry', () => {
    const id = randomUUID()
    store.open(id); store.write(id, 'lost path, retained bytes\n')
    const bytes = fs.readFileSync(file(id))
    fs.unlinkSync(file(id))
    assert.deepEqual(store.finalize(id, meta), { state: 'unavailable', reason: 'spool-unreadable' })
    fs.writeFileSync(file(id), bytes)
    const result = store.finalize(id, changedMeta)
    assert.equal(result.state, 'captured')
    assert.match(result.record.annotation, /2 min/)
    assert.match(result.record.annotation, /exit 0/)
    store.settle(id)
  })
  check('open failure is unavailable, including mkdir failure, rather than empty', () => {
    const blocked = path.join(root, 'not-a-directory')
    fs.writeFileSync(blocked, 'file')
    const unavailable = createTranscriptStore({ root: blocked })
    const id = randomUUID()
    assert.doesNotThrow(() => unavailable.open(id))
    assert.deepEqual(unavailable.finalize(id, meta), { state: 'unavailable', reason: 'capture-open-failed' })
    unavailable.discard(id)
  })
  check('capture gap without retained text is unavailable; retained prefix exposes truncation', () => {
    const limited = createTranscriptStore({ root, maxBytes: 6 })
    const empty = randomUUID()
    limited.open(empty); limited.write(empty, 'too long to retain\n')
    assert.deepEqual(limited.finalize(empty, meta), { state: 'unavailable', reason: 'capture-gap' })
    const partial = randomUUID()
    limited.open(partial); limited.write(partial, 'ok\n'); limited.write(partial, 'too long to retain\n')
    const result = limited.finalize(partial, meta)
    assert.equal(result.state, 'captured'); assert.equal(result.record.truncated, true)
    assert.match(result.record.annotation, /truncated/)
    const recovered = createTranscriptStore({ root }).recover().find((r) => r.sessionId === partial)
    assert.equal(recovered.record.truncated, true)
    assert.equal(fs.existsSync(file(empty)), true)
    limited.discard(empty); limited.discard(partial)
  })
  check('real write failure while flushing an open capture cannot acknowledge empty', () => {
    const id = randomUUID()
    const original = fs.openSync
    // Allocate a real read-only fd so actual writeSync fails with EBADF. This
    // does not replace the write implementation or any user file.
    fs.openSync = (name, flags, ...args) => {
      if (name === file(id) && flags === 'w') {
        fs.writeFileSync(name, '')
        return original(name, 'r', ...args)
      }
      return original(name, flags, ...args)
    }
    syncBuiltinESMExports()
    try { store.open(id) } finally { fs.openSync = original; syncBuiltinESMExports() }
    store.write(id, 'buffered until finalization')
    assert.deepEqual(store.finalize(id, meta), { state: 'unavailable', reason: 'capture-gap' })
    assert.deepEqual(store.finalize(id, changedMeta), { state: 'unavailable', reason: 'capture-gap' })
    store.discard(id)
  })
  check('metadata publication failure retries without rewriting the first exit metadata', () => {
    const id = randomUUID()
    store.open(id); store.write(id, 'evidence\n')
    const seal = file(id).replace('.log', '.pending.json')
    fs.mkdirSync(seal) // pending first metadata cannot be published
    assert.deepEqual(store.finalize(id, meta), { state: 'unavailable', reason: 'finalization-unavailable' })
    fs.rmdirSync(seal)
    const result = store.finalize(id, changedMeta)
    assert.equal(result.state, 'captured')
    assert.match(result.record.annotation, /2 min/)
    assert.match(result.record.annotation, /exit 0/)
    store.settle(id)
  })
  check('snapshot mutation or a corrupt seal is unavailable and never rewrites the original seal', () => {
    const id = randomUUID()
    store.open(id); store.write(id, 'original evidence\n')
    const original = store.finalize(id, meta)
    const seal = file(id).replace('.log', '.final.json')
    const firstSeal = fs.readFileSync(seal, 'utf8')
    fs.writeFileSync(file(id), 'changed evidence\n')
    assert.equal(store.finalize(id, changedMeta).state, 'unavailable')
    assert.equal(createTranscriptStore({ root }).finalize(id, changedMeta).state, 'unavailable')
    assert.equal(fs.readFileSync(seal, 'utf8'), firstSeal)
    fs.writeFileSync(file(id), original.record.body)
    fs.writeFileSync(seal, 'broken JSON')
    assert.equal(createTranscriptStore({ root }).finalize(id, meta).state, 'unavailable')
    assert.equal(fs.readFileSync(seal, 'utf8'), 'broken JSON')
    fs.writeFileSync(seal, firstSeal)
    assert.deepEqual(createTranscriptStore({ root }).finalize(id, changedMeta), original)
    store.settle(id)
  })
  check('short actual writes expose retained-prefix capture gaps', () => {
    const id = randomUUID()
    store.open(id)
    store.write(id, 'buffered line')
    const original = fs.writeSync
    let injected = false
    fs.writeSync = (fd, value, ...args) => {
      if (!injected && Buffer.isBuffer(value)) { injected = true; return original(fd, value.subarray(0, 1), ...args) }
      return original(fd, value, ...args)
    }
    syncBuiltinESMExports()
    let result
    try { result = store.finalize(id, meta) } finally { fs.writeSync = original; syncBuiltinESMExports() }
    assert.equal(result.state, 'captured')
    assert.equal(result.record.body, 'b')
    assert.equal(result.record.truncated, true)
    store.settle(id)
  })
  check('recovery ignores open captures and marks unsealed crash evidence incomplete', () => {
    const id = randomUUID()
    store.open(id); store.write(id, 'live evidence\n')
    assert.equal(store.recover().some((r) => r.sessionId === id), false)
    const recovered = createTranscriptStore({ root }).recover().find((r) => r.sessionId === id)
    assert.equal(recovered.record.truncated, true)
    assert.match(recovered.record.annotation, /duration unknown.*exit unknown/)
    assert.equal(createTranscriptStore({ root }).finalize(id, changedMeta).state, 'unavailable')
    store.discard(id)
  })
  check('failed spool read survives cache eviction and restart with the first exit facts', () => {
    const id = randomUUID()
    store.open(id); store.write(id, 'first exit facts\n')
    const bytes = fs.readFileSync(file(id)); fs.unlinkSync(file(id))
    assert.equal(store.finalize(id, meta).state, 'unavailable')
    assert.equal(fs.existsSync(file(id).replace('.log', '.pending.json')), true)
    const others = []
    for (let i = 0; i < 260; i++) {
      const other = randomUUID(); others.push(other); store.open(other); store.finalize(other, meta)
    }
    fs.writeFileSync(file(id), bytes)
    const restarted = createTranscriptStore({ root }).finalize(id, changedMeta)
    assert.equal(restarted.state, 'captured')
    assert.match(restarted.record.annotation, /2 min.*exit 0/)
    assert.deepEqual(store.finalize(id, changedMeta), restarted)
    for (const other of others) store.settle(other)
    store.settle(id)
  })
  check('metadata write failures are not evicted by later successful closures', () => {
    const id = randomUUID()
    store.open(id); store.write(id, 'unpersisted first metadata\n')
    const pending = file(id).replace('.log', '.pending.json')
    fs.mkdirSync(pending)
    assert.equal(store.finalize(id, meta).state, 'unavailable')
    const others = []
    for (let i = 0; i < 260; i++) {
      const other = randomUUID(); others.push(other); store.open(other)
      assert.equal(store.finalize(other, meta).state, 'empty')
    }
    fs.rmdirSync(pending)
    const result = store.finalize(id, changedMeta)
    assert.equal(result.state, 'captured')
    assert.match(result.record.annotation, /2 min.*exit 0/)
    for (const other of others) store.settle(other)
    store.settle(id)
  })
  check('capacity exhaustion refuses new captures instead of dropping unpersisted first metadata', () => {
    const ids = []
    for (let i = 0; i < 256; i++) {
      const id = randomUUID(); ids.push(id)
      store.open(id); store.write(id, 'held metadata\n')
      fs.mkdirSync(file(id).replace('.log', '.pending.json'))
      assert.equal(store.finalize(id, meta).state, 'unavailable')
    }
    const refused = randomUUID()
    store.open(refused)
    assert.equal(fs.existsSync(file(refused)), false)
    assert.equal(store.finalize(refused, meta).state, 'unavailable')
    fs.rmdirSync(file(ids[0]).replace('.log', '.pending.json'))
    const first = store.finalize(ids[0], changedMeta)
    assert.equal(first.state, 'captured')
    assert.match(first.record.annotation, /2 min.*exit 0/)
    // Once one attempt becomes durable, admission can use the freed slot.
    store.open(refused)
    assert.equal(store.finalize(refused, meta).state, 'empty')
    store.settle(refused)
    for (const id of ids) {
      const pending = file(id).replace('.log', '.pending.json')
      if (fs.existsSync(pending) && fs.statSync(pending).isDirectory()) fs.rmdirSync(pending)
      store.discard(id)
    }
  })
  check('atomic snapshot publication uses independent temporary inodes across stores', () => {
    const id = randomUUID()
    store.open(id); store.write(id, 'racing snapshot\n')
    const originalLink = fs.linkSync
    let interleaved = false
    let winner
    const temporaryPaths = []
    fs.linkSync = (source, destination) => {
      temporaryPaths.push(source)
      if (!interleaved && destination === file(id).replace('.log', '.final.json')) {
        interleaved = true
        winner = createTranscriptStore({ root }).finalize(id, changedMeta)
      }
      return originalLink(source, destination)
    }
    syncBuiltinESMExports()
    let result
    try { result = store.finalize(id, meta) } finally { fs.linkSync = originalLink; syncBuiltinESMExports() }
    assert.equal(result.state, 'captured')
    assert.deepEqual(result, winner)
    assert.match(result.record.annotation, /2 min.*exit 0/)
    assert.equal(new Set(temporaryPaths).size, temporaryPaths.length)
    assert.deepEqual(createTranscriptStore({ root }).finalize(id, changedMeta), result)
    store.settle(id)
  })
  check('detailed recovery preserves saved exit facts and never settles empty before a receipt', () => {
    const capturedId = randomUUID(), emptyId = randomUUID()
    const observed = { ...meta, exitCode: 7, endedAt: '2026-09-27T10:03:00Z' }
    const context = { projectId: 'project-test', optionId: 'test', startedAt: meta.startedAt, taskId: 'task-test' }
    store.open(capturedId, context); store.write(capturedId, 'sealed body\n'); store.finalize(capturedId, observed)
    store.open(emptyId, context); store.finalize(emptyId, observed)
    const restarted = createTranscriptStore({ root })
    const recovered = restarted.recoverFinalizations()
    assert.equal(recovered.state, 'listed')
    const captured = recovered.items.find((r) => r.sessionId === capturedId)
    const empty = recovered.items.find((r) => r.sessionId === emptyId)
    assert.equal(captured.result.state, 'captured')
    assert.deepEqual(captured.context, context)
    assert.equal(captured.meta.endedAt, observed.endedAt)
    assert.equal(captured.meta.exitCode, 7)
    assert.deepEqual(empty.result, { state: 'empty', truncated: false })
    assert.equal(empty.meta.exitCode, 7)
    assert.equal(fs.existsSync(file(emptyId)), true)
    assert.deepEqual(restarted.recoverFinalizations().items.find((r) => r.sessionId === emptyId), empty)
    restarted.settle(emptyId) // caller now represents its durable receipt
    assert.equal(restarted.recoverFinalizations().items.some((r) => r.sessionId === emptyId), false)
    store.settle(capturedId)
  })
  check('detailed recovery represents unknown crash exit without invented timestamps', () => {
    const id = randomUUID()
    store.open(id); store.write(id, 'unsealed crash evidence\n')
    const recovered = createTranscriptStore({ root }).recoverFinalizations().items.find((r) => r.sessionId === id)
    assert.equal(recovered.meta, null)
    assert.equal(recovered.result.state, 'captured')
    assert.equal(recovered.result.record.truncated, true)
    assert.match(recovered.result.record.annotation, /duration unknown.*exit unknown/)
    assert.equal(fs.existsSync(file(id)), true)
    store.discard(id)
  })
  check('descriptor-only, unreadable metadata and gap captures remain explicit recovery items', () => {
    const missing = randomUUID(), corrupt = randomUUID(), gap = randomUUID()
    store.open(missing); store.write(missing, 'body\n'); store.finalize(missing, meta); fs.unlinkSync(file(missing))
    store.open(corrupt); store.write(corrupt, 'body\n'); store.finalize(corrupt, meta)
    fs.writeFileSync(file(corrupt).replace('.log', '.final.json'), 'unreadable descriptor')
    const limited = createTranscriptStore({ root, maxBytes: 1 })
    limited.open(gap); limited.write(gap, 'lost output\n'); limited.finalize(gap, meta)
    const recovered = createTranscriptStore({ root }).recoverFinalizations()
    for (const id of [missing, corrupt, gap]) {
      const item = recovered.items.find((r) => r.sessionId === id)
      assert.equal(item.result.state, 'unavailable')
      assert.equal(fs.existsSync(file(id).replace('.log', '.pending.json')), true)
    }
    assert.equal(recovered.items.find((r) => r.sessionId === missing).meta.exitCode, 0)
    assert.equal(recovered.items.find((r) => r.sessionId === corrupt).meta, null)
    store.discard(missing); store.discard(corrupt); limited.discard(gap)
  })
  check('directory read failure differs from a genuinely absent recovery directory', () => {
    const unavailableRoot = path.join(root, 'recovery-read-failure')
    fs.mkdirSync(unavailableRoot)
    fs.writeFileSync(path.join(unavailableRoot, 'transcripts'), 'not a directory')
    assert.deepEqual(createTranscriptStore({ root: unavailableRoot }).recoverFinalizations(),
      { state: 'unavailable', reason: 'directory-unreadable', items: [] })
    assert.deepEqual(createTranscriptStore({ root: path.join(root, 'absent-recovery') }).recoverFinalizations(),
      { state: 'listed', items: [] })
  })
  check('legacy recovery still returns captured records and settles proved empty captures', () => {
    const id = randomUUID(); store.open(id); store.finalize(id, meta)
    const restarted = createTranscriptStore({ root })
    assert.equal(restarted.recover().some((r) => r.sessionId === id), false)
    assert.equal(fs.existsSync(file(id)), false)
  })
  check('paged recovery reads at most eight bodies and moves past unavailable rows', () => {
    const pagedRoot = fs.mkdtempSync(path.join(root, 'paged-'))
    const pagedStore = createTranscriptStore({ root: pagedRoot })
    for (let i = 0; i < 10; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
      pagedStore.open(id, { projectId: 'project', taskId: null, optionId: 'test', startedAt: meta.startedAt })
      pagedStore.write(id, 'captured text\n'); pagedStore.finalize(id, meta)
    }
    const restarted = createTranscriptStore({ root: pagedRoot })
    const original = fs.readFileSync; let bodyReads = 0
    fs.readFileSync = function (target, ...args) {
      if (String(target).endsWith('.log')) bodyReads++
      return original.call(this, target, ...args)
    }; syncBuiltinESMExports()
    try {
      const first = restarted.recoverFinalizations({ after: null, limit: 100 })
      assert.equal(first.items.length, 8); assert.equal(first.remaining, 2)
      assert.ok(bodyReads <= 8, 'page must be selected before any body materialization')
      assert.ok(first.nextCursor)
      const next = restarted.recoverFinalizations({ after: first.nextCursor, limit: 8 })
      assert.equal(next.items.length, 2); assert.equal(next.remaining, 0); assert.equal(next.nextCursor, null)
      assert.equal(bodyReads, 10)
    } finally { fs.readFileSync = original; syncBuiltinESMExports() }
  })
  check('bounded memory eviction keeps disk snapshots resumable until settlement', () => {
    const ids = []
    for (let i = 0; i < 260; i++) {
      const id = randomUUID(); ids.push(id)
      store.open(id); store.write(id, `record ${i}\n`)
      assert.equal(store.finalize(id, meta).state, 'captured')
    }
    const replay = store.finalize(ids[0], changedMeta)
    assert.equal(replay.state, 'captured')
    assert.equal(replay.record.body, 'record 0\n')
    assert.match(replay.record.annotation, /exit 0/)
    for (const id of ids) store.settle(id)
  })
} finally { fs.rmSync(root, { recursive: true, force: true }) }
console.log(`${checks} transcript finalization checks passed`)
