// M47 — the fixture that fails when memory is switched off.
//
// ADR-0032 decision 5 makes this a precondition for any further memory work,
// and the reason is in the doctrine: "memory that was never queried and empty
// memory score identically." A suite that only checks memory answers correctly
// proves nothing about whether memory is contributing — it might be answering
// questions the caller could answer anyway, or the queries might be so loose
// that anything matches.
//
// So this measures the DELTA, in three phases, through the same MCP tools an
// agent actually uses:
//
//   A  memory present   — every question must be answered, and the question
//                         nothing can answer must come back empty AND SAY SO
//   B  memory removed   — the same questions must now all fail. If any still
//                         "works", that answer never came from memory
//   C  memory rebuilt   — replayed from the journal, phase A must hold again.
//                         This is ADR-0014's claim ("every register is a
//                         projection") exercised on the register that matters
//                         most, and it makes the fixture repeatable
//
// The score line is the output. A number that does not move between A and B is
// the finding, whatever the individual assertions say.

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const HERE = import.meta.dirname
const ROOT = path.resolve(HERE, '../../..')

console.log('memory eval: what breaks when memory is switched off (M47)')

// The stack's own env, so no key is written down here.
let URL, KEY
try {
  const out = execFileSync('supabase', ['status', '-o', 'env'], { cwd: ROOT, encoding: 'utf8' })
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/)
    if (!m) continue
    if (m[1] === 'API_URL') URL = m[2]
    if (m[1] === 'SERVICE_ROLE_KEY') KEY = m[2]
  }
} catch {
  /* handled below */
}
if (!URL || !KEY) {
  console.log('  skipped — the local stack is not running')
  process.exit(0)
}

const { createClient } = await import('@supabase/supabase-js')
const { createJournal } = await import('../../../packages/journal/src/index.ts')
const { AgentSurface } = await import('../src/main/agentSurface.ts')
const { createDesktopJournal } = await import('../src/main/desktopIngress.ts')
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
const { StreamableHTTPClientTransport } = await import(
  '@modelcontextprotocol/sdk/client/streamableHttp.js'
)

const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const journal = createJournal(db)
// The estate this suite writes into. NOT org #1 — that is the OPERATOR'S estate,
// and every suite that used it left its fixtures in the real project list, on the
// real home screen, recreated on every test run. A test that pollutes the
// product it is testing has to be cleaned up by hand forever.
const ESTATE = randomUUID()
const projectId = randomUUID()
const sessionId = randomUUID()

let failures = 0
const ok = (m) => console.log(`  ok   ${m}`)
const fail = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}

// ————————————————————————————————————————————— the corpus
//
// Deliberately specific. Vague content would be matched by vague queries and the
// delta would measure the tokenizer rather than the memory.

await journal.append({
  estateId: ESTATE,
  type: 'project.created@1',
  actor: { kind: 'system', id: 'memory-eval' },
  projectId,
  payload: { id: projectId, name: 'memory eval corpus' }
})

const FACTS = [
  ['the spawn-helper binary ships without the executable bit and must be chmodded after install', 'pty.ts', 'trap'],
  ['projections are upserts so that replaying the journal converges instead of colliding', 'migration 1', 'decision'],
  ['the estate advisory lock is keyed by hashtextextended of the estate id', 'append_event', 'note']
]
for (const [claim, sourceRef, kind] of FACTS) {
  await journal.append({
    estateId: ESTATE,
    type: 'memory.project.recorded@1',
    actor: { kind: 'system', id: 'memory-eval' },
    projectId,
    payload: { id: randomUUID(), claim, source_ref: sourceRef, kind }
  })
}

const TRANSCRIPTS = [
  ['npm run build\nerror: postcss plugin missing\n', 1],
  ['pnpm test\nposix_spawnp failed for the pty helper\nsuite aborted\n', 1],
  ['supabase db reset\nApplied migration 20260831000007\nreset complete\n', 0]
]
for (const [body, exitCode] of TRANSCRIPTS) {
  await journal.append({
    estateId: ESTATE,
    type: 'transcript.captured@1',
    actor: { kind: 'system', id: 'memory-eval' },
    projectId,
    payload: {
      session_id: randomUUID(),
      option_id: 'claude-code',
      sha256: 'e'.repeat(64),
      bytes: body.length,
      lines: body.split('\n').length,
      started_at: new Date(Date.now() - 300000).toISOString(),
      ended_at: new Date().toISOString(),
      exit_code: exitCode,
      annotation: `claude-code · 5 min · exit ${exitCode}`,
      excerpt: body,
      body
    }
  })
}

// ————————————————————————————————————————————— the questions
//
// `where` names which tool must answer it, so a hit through the wrong store is
// not scored as a hit.

const QUESTIONS = [
  { q: 'executable bit spawn helper', where: 'facts', why: 'a trap recorded by an earlier session' },
  { q: 'upserts converge replay', where: 'facts', why: 'why projections are shaped that way' },
  { q: 'advisory lock estate', where: 'facts', why: 'how ordering is enforced' },
  { q: 'postcss plugin missing', where: 'transcripts', why: 'a build failure nobody wrote down' },
  { q: 'posix_spawnp failed', where: 'transcripts', why: 'the error text of a real run' },
  { q: 'Applied migration', where: 'transcripts', why: 'evidence a migration actually ran' }
]
// The control. Nothing in the corpus answers this, and the tools must say so
// rather than return the nearest thing — the failure the LoCoMo audit found
// benchmarks systematically drop by excluding unanswerable questions.
const UNANSWERABLE = { q: 'kubernetes ingress certificate rotation', where: 'both' }

const surface = new AgentSurface({
  db,
  journal: createDesktopJournal(journal),
  ptys: () => ({ list: () => [] }),
  estateId: ESTATE
})
await surface.start()
const scope = surface.mint(projectId, sessionId, null)
const client = new Client({ name: 'memory-eval', version: '0.0.0' })
await client.connect(
  new StreamableHTTPClientTransport(new globalThis.URL(surface.endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${scope.token}` } }
  })
)
const call = async (name, args) =>
  JSON.parse((await client.callTool({ name, arguments: args })).content[0].text)

async function answered(question) {
  if (question.where === 'facts') {
    const r = await call('fabric_memory_search', { query: question.q })
    return (r.facts ?? []).length > 0
  }
  const r = await call('fabric_transcripts_search', { query: question.q })
  return (r.sessions ?? []).length > 0
}

async function score(label) {
  let hits = 0
  for (const question of QUESTIONS) if (await answered(question)) hits++
  return { label, hits, of: QUESTIONS.length }
}

// ————————————————————————————————————————————— A: memory present
const a = await score('with memory')
if (a.hits !== a.of) {
  fail(`A retrieval is ${a.hits}/${a.of} with memory present — the corpus is not reachable`)
  for (const question of QUESTIONS)
    if (!(await answered(question))) console.log(`       missed: "${question.q}" (${question.why})`)
} else ok(`A every question is answered from memory (${a.hits}/${a.of})`)

{
  const facts = await call('fabric_memory_search', { query: UNANSWERABLE.q })
  const sessions = await call('fabric_transcripts_search', { query: UNANSWERABLE.q })
  if ((facts.facts ?? []).length || (sessions.sessions ?? []).length)
    fail('A the unanswerable question returned something — the queries are too loose to measure anything')
  else if (!/not that the work was not done/.test(sessions.note ?? ''))
    fail('A an empty transcript result does not say it found nothing')
  else ok('A a question nothing answers comes back empty AND says so')
}

// ————————————————————————————————————————————— B: memory switched off
await db.from('memory_facts').delete().eq('project_id', projectId)
await db.from('session_transcripts').delete().eq('project_id', projectId)

const b = await score('without memory')
if (b.hits !== 0) {
  fail(`B ${b.hits}/${b.of} questions still answered with memory removed — those answers were never memory's`)
  for (const question of QUESTIONS)
    if (await answered(question)) console.log(`       still answered: "${question.q}"`)
} else ok(`B every question fails with memory removed (${b.hits}/${b.of})`)

// ————————————————————————————————————————————— C: rebuilt from the journal
await db.rpc('rebuild_estate_projections', { p_estate_id: ESTATE })
const c = await score('rebuilt')
if (c.hits !== c.of)
  fail(`C after rebuild retrieval is ${c.hits}/${c.of} — the register is not a projection of the journal`)
else ok(`C memory rebuilt from the journal answers everything again (${c.hits}/${c.of})`)

// ————————————————————————————————————————————— the number that matters
const delta = a.hits - b.hits
console.log('')
console.log(`  score  with memory ${a.hits}/${a.of} · without ${b.hits}/${b.of} · rebuilt ${c.hits}/${c.of}`)
console.log(`  delta  memory contributes ${delta} of ${QUESTIONS.length} answers`)
if (delta <= 0) fail('the delta is zero — this fixture cannot tell whether memory does anything')
else ok(`the fixture can tell memory apart from its absence (delta ${delta})`)

// Cleanup, and the part of it that cannot happen. The projections go; the
// JOURNAL EVENTS STAY, because `service_role` has no delete on the journal and
// that is deliberate (probe P4). So repeated local runs leave replayable events
// behind — project-scoped, invisible to the app, and a small price for the
// property that nothing can quietly edit history. Saying it here beats a
// cleanup line that silently fails.
await db.from('session_transcripts').delete().eq('project_id', projectId)
await db.from('memory_facts').delete().eq('project_id', projectId)
await db.from('projects').delete().eq('id', projectId)
await surface.stop()

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED — memory's contribution is not measured`)
  process.exit(1)
}
console.log('\nall green: memory answers, its absence is detectable, and it rebuilds from the journal')
process.exit(0)
