// Transcript capture (M45).
//
// The decode is the part worth probing hardest. "Verbatim" in ADR-0032 means no
// model touched it — it does NOT mean storing a raw PTY stream, which is text
// interleaved with cursor movement and is neither readable nor searchable. What
// must hold is that the decode is faithful to what the operator saw, and that
// nothing summarises, shortens or reorders the content itself.

import { createTranscriptStore } from '../src/main/transcripts.ts'
import { decodePty } from '../src/shared/pty-decode.ts'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'

let failures = 0
const ok = (m) => console.log(`  ok   ${m}`)
const fail = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}

console.log('transcripts: what the session actually did')

// --- the decode --------------------------------------------------------
{
  const coloured = '\x1b[32mBUILD OK\x1b[0m\n'
  if (decodePty(coloured) !== 'BUILD OK\n') fail(`colour codes survived: ${JSON.stringify(decodePty(coloured))}`)
  else ok('ANSI colour codes are removed, the words are not')

  const title = '\x1b]0;some terminal title\x07done\n'
  if (decodePty(title) !== 'done\n') fail(`OSC sequence survived: ${JSON.stringify(decodePty(title))}`)
  else ok('OSC sequences (terminal titles) are removed')

  // A progress bar repaints one line; only the last paint was ever standing.
  const progress = 'Installing  10%\rInstalling  60%\rInstalling 100%\ndone\n'
  const decoded = decodePty(progress)
  if (decoded !== 'Installing 100%\ndone\n') fail(`carriage returns not resolved: ${JSON.stringify(decoded)}`)
  else ok('a line repainted with carriage returns keeps what was left standing')

  // And the thing that must NOT happen: ordinary text is untouched.
  const plain = 'error: cannot find module "@fabric/journal"\n  at line 42\n'
  if (decodePty(plain) !== plain) fail('plain text was altered by the decode')
  else ok('plain text passes through byte for byte')

  if (decodePty('a\r\nb\r\n') !== 'a\nb\n') fail('CRLF not normalised')
  else ok('CRLF is normalised to LF')
}

// --- the capture -------------------------------------------------------
const root = mkdtempSync(path.join(tmpdir(), 'fabric-transcript-'))
const store = createTranscriptStore({ root })
const meta = (exitCode = 0) => ({
  optionId: 'claude-code',
  startedAt: new Date(Date.UTC(2026, 7, 31, 12, 0, 0)).toISOString(),
  endedAt: new Date(Date.UTC(2026, 7, 31, 12, 7, 0)).toISOString(),
  exitCode
})

{
  const id = randomUUID()
  store.open(id)
  store.write(id, '\x1b[1mreading the repository\x1b[0m\n')
  store.write(id, 'found 12 files\n')
  store.write(id, 'error: the token is missing\n')
  const t = store.close(id, meta(1))

  if (!t) fail('a session that produced output returned no record')
  else {
    const expected = 'reading the repository\nfound 12 files\nerror: the token is missing\n'
    if (t.body !== expected) fail(`body is not the decoded stream: ${JSON.stringify(t.body)}`)
    else ok('the body is the decoded session, in order, complete')
    if (t.sha256 !== createHash('sha256').update(expected).digest('hex'))
      fail('sha256 does not address the stored body')
    else ok('sha256 addresses exactly what is stored')
    if (t.lines !== 4) fail(`lines counted ${t.lines}`)
    else ok('lines are counted')
    if (!t.annotation.includes('claude-code') || !t.annotation.includes('exit 1') || !t.annotation.includes('7 min'))
      fail(`L0 does not carry the facts: ${t.annotation}`)
    else ok(`L0 is composed from facts, not judgement: "${t.annotation}"`)
    if (t.excerpt !== expected) fail('L1 should be the whole thing when it is short')
    else ok('L1 is the whole text when the text is short')
  }
  // THIS ASSERTION USED TO ENCODE THE DEFECT (IMP-12). It required the spool to
  // be gone the moment `close` returned — which is precisely why a failed
  // append destroyed the only copy. Having the record "in hand" is not having
  // it durably, and the difference is a crash's width.
  if (readdirSync(path.join(root, 'transcripts')).length === 0)
    fail('the spool was removed by close, before anything was made durable')
  else ok('the spool outlives close — having the record in hand is not having it saved')
  store.settle(id)
  if (readdirSync(path.join(root, 'transcripts')).length !== 0)
    fail('settle left the spool behind')
  else ok('and settle removes it, which is what the caller does after the journal accepts it')
}

// --- nothing worth keeping --------------------------------------------
{
  const id = randomUUID()
  store.open(id)
  store.write(id, '\x1b[?25l\x1b[?25h')
  if (store.close(id, meta()) !== null) fail('an empty session produced a record')
  else ok('a session that produced nothing produces no record')
}

// --- the excerpt is an excerpt, and says what it skipped ---------------
{
  const id = randomUUID()
  const store2 = createTranscriptStore({ root, excerptHead: 20, excerptTail: 20 })
  store2.open(id)
  const long = 'START' + 'x'.repeat(500) + 'END\n'
  store2.write(id, long)
  const t = store2.close(id, meta())
  if (!t.body.includes('START') || !t.body.includes('END')) fail('L2 lost content')
  else ok('L2 keeps everything')
  if (!t.excerpt.startsWith('START') || !t.excerpt.trimEnd().endsWith('END'))
    fail(`L1 is not head+tail: ${JSON.stringify(t.excerpt.slice(0, 60))}`)
  else ok('L1 is head and tail of the real text')
  if (!/…\[\d+ characters\]…/.test(t.excerpt))
    fail('L1 does not say how much it skipped')
  else ok('L1 states how much it skipped, so it cannot be mistaken for the whole')
}

// --- the ceiling -------------------------------------------------------
{
  const id = randomUUID()
  const small = createTranscriptStore({ root, maxBytes: 2000 })
  small.open(id)
  small.write(id, 'HEAD-MARKER\n')
  for (let i = 0; i < 500; i++) small.write(id, `line ${i} of a runaway session\n`)
  const t = small.close(id, meta())
  if (!t.truncated) fail('a session past the ceiling was not marked truncated')
  else ok('a session past the ceiling is marked truncated, not silently shortened')
  if (!t.body.includes('HEAD-MARKER')) fail('truncation dropped the beginning')
  else ok('truncation keeps the HEAD — the start is what explains a runaway')
  if (!t.annotation.includes('truncated')) fail('L0 does not mention truncation')
  else ok('L0 says it was truncated, so a reader is not misled by a short record')
}

// --- discard -----------------------------------------------------------
{
  const id = randomUUID()
  store.open(id)
  store.write(id, 'something\n')
  store.discard(id)
  if (existsSync(path.join(root, 'transcripts', `${id}.log`))) fail('discard left the working file')
  else ok('discard removes the working file and produces nothing')
  if (store.close(id, meta()) !== null) fail('a discarded capture still produced a record')
  else ok('a discarded capture cannot be closed into a record')
}

console.log('\nall green: the record is what the operator saw, whole, and says when it is not')
// ── IMP-12: the record survives a failed append and a crash ─────────────────
//
// The defect: `close()` deleted the spool and THEN the caller appended. A
// failed append — or a crash in the milliseconds between — destroyed the only
// copy, and the caller's own comment admitted the loss while swallowing it.
{
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-imp12-'))
  const store = createTranscriptStore({ root })
  const sessionId = 'aaaaaaaa-0000-0000-0000-000000000001'
  const context = {
    projectId: 'pppppppp-0000-0000-0000-000000000001',
    optionId: 'claude-code',
    startedAt: new Date().toISOString(),
    taskId: null
  }
  store.open(sessionId, context)
  store.write(sessionId, 'the release script needs a signed tag\n')

  const record = store.close(sessionId, {
    optionId: 'claude-code',
    startedAt: context.startedAt,
    endedAt: new Date().toISOString(),
    exitCode: 0
  })
  record?.body.includes('signed tag')
    ? ok('close still produces the record')
    : fail('close produced nothing')

  const spool = path.join(root, 'transcripts', `${sessionId}.log`)
  existsSync(spool)
    ? ok('and the spool is STILL ON DISK — the append has not happened yet')
    : fail('the spool was deleted before anything was made durable')

  // The append fails. Nothing settles. The next startup finds it.
  const recovered = createTranscriptStore({ root }).recover()
  recovered.length === 1 && recovered[0].sessionId === sessionId
    ? ok('a spool nobody settled is recovered on the next start')
    : fail(`recovery found ${recovered.length} spool(s)`)
  recovered[0]?.record.body.includes('signed tag')
    ? ok('and it carries what the session actually printed')
    : fail('the recovered record lost the body')
  recovered[0]?.context?.projectId === context.projectId &&
  recovered[0]?.context?.optionId === 'claude-code'
    ? ok('with the project and agent it belonged to — a log alone cannot say that')
    : fail('the recovered context is missing: ' + JSON.stringify(recovered[0]?.context))

  // Settling is what removes it, and only that.
  const after = createTranscriptStore({ root })
  after.settle(sessionId)
  existsSync(spool) ? fail('settle left the spool behind') : ok('settle removes the spool')
  existsSync(path.join(root, 'transcripts', `${sessionId}.meta.json`))
    ? fail('settle left the sidecar behind, so the next recovery would report a session with no output')
    : ok('and the sidecar with it')
  after.recover().length === 0
    ? ok('a settled session is not recovered twice')
    : fail('a settled session came back from recovery')

  rmSync(root, { recursive: true, force: true })
}

// ── M95: the secret never reaches the disk ─────────────────────────────────
//
// Redaction on the way IN, and the spool is the proof. Cleaning at read time
// would leave the raw file on disk, readable by an agent session — which runs
// as the operator and is the actor being defended against.
{
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-m95-'))
  const store = createTranscriptStore({ root })
  const id = randomUUID()
  store.open(id, { projectId: randomUUID(), optionId: 'claude-code', startedAt: new Date().toISOString(), taskId: null })

  store.write(id, 'reading the repository\n')
  store.write(id, 'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLE\n')
  // Split across two chunks on purpose — a PTY hands over arbitrary byte
  // boundaries, and this is the case that no pattern matches in either half.
  store.write(id, 'the key is sk-ant-api0')
  store.write(id, '3-abcdefghijklmnopqrs and that is all\n')
  store.write(id, 'exit 0\n')

  const record = store.close(id, {
    optionId: 'claude-code',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    exitCode: 0
  })

  const onDisk = readFileSync(path.join(root, 'transcripts', `${id}.log`), 'utf8')
  onDisk.includes('wJalrXUtnFEMI')
    ? fail('THE SECRET IS ON DISK — redaction is happening too late to matter')
    : ok('an assignment never reaches the spool file')
  onDisk.includes('sk-ant-api03-abcdefghijklmnopqrs')
    ? fail('a key split across two writes reached the disk whole')
    : ok('a key SPLIT ACROSS TWO CHUNKS is still caught — the line buffer earns its keep')
  record?.body.includes('wJalrXUtnFEMI') || record?.body.includes('sk-ant-api03-abcde')
    ? fail('the record carries a secret')
    : ok('and neither reaches the record')

  record?.body.includes('reading the repository') && record?.body.includes('exit 0')
    ? ok('ordinary output survives untouched, including the last line with no newline after it')
    : fail('redaction ate real output: ' + JSON.stringify(record?.body))
  record?.annotation.includes('redacted')
    ? ok('the annotation SAYS it was redacted — a removal nobody can see is one nobody can audit')
    : fail('the record does not say anything was removed: ' + record?.annotation)

  store.settle(id)
  rmSync(root, { recursive: true, force: true })
}

// Private-key bodies must never reach even an unsettled spool. Exercise the
// real disk sink at every possible two-chunk split, not just a pure regex.
{
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-pem-'))
  const store = createTranscriptStore({ root })
  const pem = '-----BEGIN RSA PRIVATE KEY-----\nsynthetic-private-body\n-----END RSA PRIVATE KEY-----'
  const stream = `ordinary before\n${pem}\nordinary after\n`
  for (let split = 0; split <= stream.length; split++) {
    const id = randomUUID()
    store.open(id)
    store.write(id, stream.slice(0, split))
    const disk = readFileSync(path.join(root, 'transcripts', `${id}.log`), 'utf8')
    if (disk.includes('synthetic-private-body')) fail(`private key reached spool at split ${split}`)
    store.write(id, stream.slice(split))
    const record = store.close(id, meta())
    if (record?.body !== 'ordinary before\n[redacted: private-key]\nordinary after\n')
      fail(`private-key stream changed ordinary output or leaked at split ${split}`)
    store.settle(id)
  }
  for (const tail of ['synthetic-private-body\n', 'synthetic-private-body', 'x'.repeat(70_000)]) {
    const id = randomUUID()
    store.open(id)
    for (const character of `ordinary\n-----BEGIN PRIVATE KEY-----\n${tail}`) store.write(id, character)
    const disk = readFileSync(path.join(root, 'transcripts', `${id}.log`), 'utf8')
    if (disk.includes('synthetic-private-body') || disk.includes('x'.repeat(100))) fail('unfinished private key reached disk')
    const record = store.close(id, meta())
    if (record?.body.includes('synthetic-private-body') || record?.body.includes('x'.repeat(100))) fail('unfinished private key survived EOF/cap')
    store.settle(id)
  }
  const id = randomUUID()
  store.open(id)
  // Overflow must not flush a partial credential and let its tail bypass the matcher.
  store.write(id, 'ordinary'.repeat(9000) + '-----BE')
  store.write(id, 'GIN PRIVATE KEY-----\nsynthetic-private-body\n-----END PRIVATE KEY-----\n')
  const record = store.close(id, meta())
  if (record?.body.includes('synthetic-private-body')) fail('overflow split a sensitive marker')
  if (!record?.truncated || !record.body.includes('truncated')) fail('overflow without earlier output hid its capture gap')
  store.settle(id)
  rmSync(root, { recursive: true, force: true })
  ok('PEM bodies stay off disk across every split, partial EOF, and overflow')
}

// Terminal decoration is transport, not a way to split a credential's shape.
{
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-controls-'))
  const store = createTranscriptStore({ root })
  const marker = 'synthetic-decorated-body'
  const streams = [
    `before\n-----BEGIN \x1b[31mPRIVATE KEY\x1b[0m-----\n${marker}\n-----END PRIVATE KEY-----\nafter\n`,
    `before\nAuthor\x1b[32mization: Bearer\x1b[0m ${marker}\nafter\n`,
    `before\nsk-ant-api03-ABCD\x1b[0m${'E'.repeat(24)}\nafter\n`,
    `before\n-----BEGIN \x1b]0;title\x07PRIVATE KEY-----\n${marker}\n-----END PRIVATE KEY-----\nafter\n`,
    `before\n-----BEGIN \x1b]0;title\x1b\\PRIVATE KEY-----\n${marker}\n-----END PRIVATE KEY-----\nafter\n`
  ]
  for (const stream of streams) for (let split = 0; split <= stream.length; split++) {
    const id = randomUUID()
    store.open(id)
    store.write(id, stream.slice(0, split))
    const first = readFileSync(path.join(root, 'transcripts', `${id}.log`), 'utf8')
    if (first.includes(marker) || first.includes('E'.repeat(24))) fail(`decorated credential reached spool at split ${split}`)
    store.write(id, stream.slice(split))
    const record = store.close(id, meta())
    const disk = readFileSync(path.join(root, 'transcripts', `${id}.log`), 'utf8')
    if (disk.includes(marker) || disk.includes('E'.repeat(24))) fail(`decorated credential survived split ${split}`)
    if (!record?.body.startsWith('before\n') || !record.body.endsWith('\nafter\n')) fail('control normalization changed ordinary text')
    store.settle(id)
  }
  rmSync(root, { recursive: true, force: true })
  ok('split CSI/OSC decoration is removed before PEM/header/token detection and before disk')
}

// THE SUMMARY BELONGS AT THE END, and it was in the middle — everything
// appended after it ran with its failures counted by nobody, so the file
// exited 0 while printing FAIL. Found by planting a defect and checking the
// EXIT CODE rather than the output, which is the habit an earlier run in
// this repository had to learn the hard way.
if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED — the session record is not trustworthy`)
  process.exit(1)
}
