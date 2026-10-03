// M45's acceptance criterion, live: "transcripts land without manual export".
//
// Everything else about transcripts is probed on its own — the decode, the
// tiers, the schema, the search. This is the one that proves the WIRING: a real
// session, spawned through the real `PtyManager` with the real transcript store,
// exits and leaves a `transcript.captured@1` in the journal without anybody
// asking for it.
//
// It uses the plain-shell launch option deliberately. An agent session would
// prove the same thing more slowly and would need a logged-in CLI; what is under
// test is the capture path, and that path does not care which program ran.

import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { probeEnv } from '../../../scripts/lib/test-stack.mjs'

const HERE = import.meta.dirname
const ROOT = path.resolve(HERE, '../../..')

console.log('transcript capture, live: a session ends and its record appears')

// The disposable stack the tier started — never `supabase status` at the root, which is the
// operator's live stack. probeEnv() refuses (FAIL, exit 1) before anything connects otherwise.
const { SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = probeEnv()

const { createClient } = await import('@supabase/supabase-js')
const { createJournal } = await import('../../../packages/journal/src/index.ts')
const { PtyManager } = await import('../src/main/pty.ts')
const { createTranscriptStore } = await import('../src/main/transcripts.ts')

const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const journal = createJournal(db)
// The estate this suite writes into. NOT org #1 — that is the OPERATOR'S estate,
// and every suite that used it left its fixtures in the real project list, on the
// real home screen, recreated on every test run. A test that pollutes the
// product it is testing has to be cleaned up by hand forever.
const ESTATE = randomUUID()
const projectId = randomUUID()
const MARKER = `TRANSCRIPT-LIVE-${randomUUID().slice(0, 8)}`

let failures = 0
const ok = (m) => console.log(`  ok   ${m}`)
const fail = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}

await journal.append({
  estateId: ESTATE,
  type: 'project.created@1',
  actor: { kind: 'system', id: 'transcript-live' },
  projectId,
  payload: { id: projectId, name: 'transcript live probe' }
})

const root = mkdtempSync(path.join(tmpdir(), 'fabric-live-'))
const transcripts = createTranscriptStore({ root })

// The exact wiring index.ts uses: capture on exit, then journal it.
let captured = null
const ptys = new PtyManager(
  journal,
  ESTATE,
  {
    onData: () => {},
    onExit: (sessionId, exitCode) => {
      const session = ptys.get(sessionId)
      const record = ptys.captureTranscript(
        sessionId,
        session?.optionId ?? 'shell',
        new Date(session?.startedAt ?? Date.now()).toISOString(),
        exitCode
      )
      captured = { sessionId, exitCode, record }
    }
  },
  undefined,
  undefined,
  transcripts,
  // FA-07 — the actor comes from the identity port in the product; the default
  // throws, because a terminal journalled before a subject is established is a
  // write nobody can attribute.
  () => ({ kind: 'person', id: 'operator' })
)

const session = await ptys.open(projectId, ROOT, 'shell')
ptys.write(session.sessionId, `echo ${MARKER}\nexit\n`)

const deadline = Date.now() + 20_000
while (captured === null && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200))

if (captured === null) fail('the session never exited within 20s')
else if (!captured.record) fail('the session exited and produced no record')
else if (!captured.record.body.includes(MARKER))
  fail(`the record does not contain what the session printed: ${JSON.stringify(captured.record.body.slice(0, 160))}`)
else {
  ok('a real session produced a record containing what it printed')
  ok(`L0 was composed without anyone asking: "${captured.record.annotation}"`)

  await journal.append({
    estateId: ESTATE,
    type: 'transcript.captured@1',
    actor: { kind: 'system', id: 'session-capture' },
    projectId,
    payload: {
      session_id: captured.sessionId,
      option_id: 'shell',
      sha256: captured.record.sha256,
      bytes: captured.record.bytes,
      lines: captured.record.lines,
      truncated: captured.record.truncated,
      started_at: new Date(session.startedAt).toISOString(),
      ended_at: new Date().toISOString(),
      exit_code: captured.exitCode,
      annotation: captured.record.annotation,
      excerpt: captured.record.excerpt,
      body: captured.record.body
    }
  })

  const { data } = await db
    .from('session_transcripts')
    .select('session_id,body,annotation')
    .eq('session_id', captured.sessionId)
    .maybeSingle()
  if (!data) fail('the event was journalled and nothing projected')
  else if (!data.body.includes(MARKER)) fail('the projection lost what the session printed')
  else ok('the record reached the projection through the journal, verbatim')

  // And it is findable by what the session actually said — the reason for
  // storing it at all.
  const { data: found } = await db
    .from('session_transcripts')
    .select('session_id')
    .eq('project_id', projectId)
    .textSearch('search', MARKER.toLowerCase(), { type: 'plain', config: 'english' })
  if ((found ?? []).length !== 1) fail(`search for the session's own output found ${(found ?? []).length}`)
  else ok('the finished session is findable by a word it printed')
}

await ptys.closeAll()
await db.from('session_transcripts').delete().eq('project_id', projectId)
await db.from('projects').delete().eq('id', projectId)

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED — a session can end without leaving a record`)
  process.exit(1)
}
console.log('\nall green: a session that ends leaves its record, and nobody had to export it')
process.exit(0)
