// The context a session ran from, recoverable months later (AX-04).
//
// PF-05.02 fixed the WRITE half: the pack is materialized into `{root}/packets`,
// outside the session directory that `discard` removes. Nothing read it back.
// `readPart` — described in its own module as "the only read path, so nothing
// reads a blob unchecked" — had ZERO consumers in the repository, tests
// included, and `verify` was called once at launch against blobs written a line
// earlier. The durable answer to "what did this session run from" sat on disk
// and no path in the product asked it, which from the operator's side is
// indistinguishable from the loss PF-05.02 exists to prevent.
//
// AND IT MUST NEVER REGENERATE. `storageContract.ts` calls context packs
// "regenerated rather than restored" — accurate about the table, and the exact
// belief AX-04's acceptance forbids for the bytes. Recompiling today reads
// today's memory: a different pack wearing the same session id.
//
// Real files in a real temporary directory, because the thing under test is a
// store on disk and a fake filesystem would prove the fake.

import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createPastContext } from '../src/main/pastContext.ts'
import { materialize } from '../src/main/executionPacket.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const PACK = '# Context\n\nA fact that was true in September, and is not any more.\n'
// NAMED, not written at the start of an assertion line. A line beginning with a
// regex literal after a call that ended without a semicolon is parsed as
// division — the third time this cost a run in two iterations, so the shape is
// removed rather than the instance fixed.
const EXPLAINS_NO_REBUILD = /recompil|different pack/i
const NAMES_THE_REWRITE = /rewrote|altered/i
const root = mkdtempSync(path.join(tmpdir(), 'fabric-past-'))
const packetRoot = path.join(root, 'packets')

/** Materialize one session's packet the way `sessionBundle` does. */
const record = (sessionId, bytes = PACK) =>
  materialize(packetRoot, { sessionId, projectId: 'p-1', taskId: 't-1' }, [{ name: 'context', bytes }])

const past = createPastContext({ root })

try {
  // ── the fixture is a real packet on disk, or nothing below proves anything ──
  {
    const packet = record('s-1')
    const blob = path.join(packetRoot, 'blobs', packet.refs[0].sha256)
    readFileSync(blob, 'utf8') === PACK
      ? ok('the fixture wrote a real blob at its digest, addressed by content rather than by path')
      : fail('the fixture did not materialize')
  }

  // ── the exact bytes come back ───────────────────────────────────────────────
  {
    const got = past.read('s-1')
    eq(got.held, true, 'a recorded session yields its context')
    eq(got.bytes, PACK, 'and the bytes are IDENTICAL to what the session was given — not a recompilation')
    eq(got.sha256, createHash('sha256').update(PACK).digest('hex'), 'addressed by the digest of those bytes')
    eq(got.projectId, 'p-1', 'and it carries which project it belonged to')
    eq(got.taskId, 't-1', 'and which task')
  }

  // ── the session directory dying changes nothing ────────────────────────────
  {
    // The whole reason the packet root hangs off the app root rather than off
    // `{root}/sessions/{id}`: `bundles.discard` removes the latter on every exit.
    const sessionDir = path.join(root, 'sessions', 's-1')
    mkdirSync(sessionDir, { recursive: true })
    writeFileSync(path.join(sessionDir, 'context.md'), PACK)
    rmSync(sessionDir, { recursive: true, force: true })
    eq(past.read('s-1').bytes, PACK, 'the context survives the session directory being removed on exit')
  }

  // ── a pack that was never recorded says so, and does NOT reconstruct ────────
  {
    const got = past.read('s-does-not-exist')
    eq(got.held, false, 'a session with no packet is not held')
    eq(got.why, 'no_packet', 'and it says which of the four reasons')
    EXPLAINS_NO_REBUILD.test(got.says)
      ? ok('and the sentence names the reason nothing is rebuilt: today’s memory would answer with a different pack wearing this id')
      : fail('the refusal does not explain why regeneration is not offered: ' + got.says)
    got.bytes === undefined
      ? ok('and it hands back NO bytes at all — an approximation offered as the record is the defect, not the fallback')
      : fail('bytes were produced for a session with no packet')
  }

  // ── a blob deleted under it is missing, not silently empty ──────────────────
  {
    const packet = record('s-2')
    rmSync(path.join(packetRoot, 'blobs', packet.refs[0].sha256))
    const got = past.read('s-2')
    eq(got.held, false, 'a deleted blob is not held')
    eq(got.why, 'blob_missing', 'and it is MISSING rather than corrupt — the two need different acts')
  }

  // ── a blob EDITED under it is corrupt, which is not the same as missing ─────
  {
    const packet = record('s-3')
    // Same path, different bytes: the file exists and no longer hashes to what
    // the packet records. This is the case that must never read as "gone".
    writeFileSync(path.join(packetRoot, 'blobs', packet.refs[0].sha256), PACK + 'and a line nobody wrote.\n')
    const got = past.read('s-3')
    eq(got.why, 'blob_corrupt', 'an edited blob is CORRUPT: something rewrote history, and that is not an absence')
    NAMES_THE_REWRITE.test(got.says)
      ? ok('and the sentence says so, because a record that can be edited without saying so is not a record')
      : fail('the corruption is reported without naming what it means: ' + got.says)
  }

  // ── a packet from a schema this build does not read ─────────────────────────
  {
    record('s-4')
    const p = path.join(packetRoot, 'packet-s-4.json')
    const packet = JSON.parse(readFileSync(p, 'utf8'))
    packet.schemaVersion = 'execution-packet/99'
    writeFileSync(p, JSON.stringify(packet))
    const got = past.read('s-4')
    eq(got.why, 'unreadable', 'a packet written by a newer build is unreadable rather than guessed at')
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log(
  '\nall green: the exact context a session ran from comes back, and every reason it cannot is named rather than filled in'
)
