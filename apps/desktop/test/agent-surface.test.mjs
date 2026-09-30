// The agent surface, probed the way an agent actually reaches it: a real MCP
// client over Streamable HTTP, a real handshake, real tool calls.
//
// What this must prove, because the whole seam rests on it:
//   1. A credential that Fabric did not mint gets nothing (401), and neither does
//      no credential at all.
//   2. A minted credential can list tools and call them.
//   3. `fabric_stage_report` lands in the journal as a CLAIM by the agent — and
//      the projection keeps it apart from anything Fabric observed.
//   4. Revoking a session's credential closes the door immediately.
//
// Runs against the local stack, on a surface started in-process (no Electron):
// the AgentSurface class takes its dependencies, which is why it can be tested
// without a window.

import { execFileSync } from 'node:child_process'
import path from 'node:path'

const HERE = import.meta.dirname
// EVERYTHING BELOW IS A TEMPLATE LITERAL. A backtick or a ${...} inside it
// belongs to THIS file, not to the script being written — three separate edits
// in one run were broken by forgetting that. Build strings with + here.
const script = `
import { AgentSurface } from ${JSON.stringify(path.join(HERE, '../src/main/agentSurface.ts'))}
import { createDesktopJournal } from ${JSON.stringify(path.join(HERE, '../src/main/desktopIngress.ts'))}
import { Policy } from ${JSON.stringify(path.join(HERE, '../src/main/policy.ts'))}
import { createJournal } from ${JSON.stringify(path.join(HERE, '../../../packages/journal/src/index.ts'))}
import { createClient } from '@supabase/supabase-js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { randomUUID } from 'node:crypto'
import { createOps } from ${JSON.stringify(path.join(HERE, '../src/main/ops.ts'))}
import { useOps, ops as sink } from ${JSON.stringify(path.join(HERE, '../src/main/opsSink.ts'))}
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import nodePath from 'node:path'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const journal = createJournal(db)

// S05 — the surface writes its call trace into the real sink, so this probe
// reads what an operator would read rather than a stand-in built for the test.
const opsDir = mkdtempSync(nodePath.join(tmpdir(), 'fabric-trace-'))
useOps(createOps({ dir: opsDir }))

// The estate this suite writes into. NOT org #1 — that is the OPERATOR'S estate,
// and every suite that used it left its fixtures in the real project list, on the
// real home screen, recreated on every test run. A test that pollutes the
// product it is testing has to be cleaned up by hand forever.
const ESTATE = randomUUID()
const projectId = randomUUID()
const sessionId = randomUUID()

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

// A project to be scoped to.
await journal.append({
  estateId: ESTATE, type: 'project.created@1',
  actor: { kind: 'system', id: 'surface-probe' }, projectId,
  payload: { id: projectId, name: 'surface probe' }
})

// A session manager stub. It answers BOTH questions the surface asks it —
// what is running, and which session this is — because a stub that answers
// only one of them makes the other path crash in the probe and pass in
// production, which is the wrong way round for a fake to be wrong.
const liveSession = () => ({
  sessionId, projectId, cwd: '/tmp', program: 'claude', optionId: 'claude-code',
  permissionMode: 'ask',
  excerpt: '', written: 0, running: true, state: 'running',
  startedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(),
  tail: '', exitCode: null
})
const ptys = () => ({
  list: () => [liveSession()],
  get: (id) => (id === sessionId ? liveSession() : null)
})

// The policy port is REAL here. It used to be absent, so the effect-request
// tool was listed to agents and never once called by anything.
const policy = new Policy({ db, journal })
const surface = new AgentSurface({ db, journal: createDesktopJournal(journal), ptys, policy, estateId: ESTATE })
await surface.start()

// 1 — an unminted credential, and none at all
for (const [label, headers] of [
  ['an invented credential', { authorization: 'Bearer nope' }],
  ['no credential', {}]
]) {
  const r = await fetch(surface.endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}'
  })
  if (r.status === 401) ok('the surface refuses ' + label)
  else fail('the surface answered ' + r.status + ' to ' + label)
}

// 2 — a minted credential reaches the tools
const scope = surface.mint(projectId, sessionId, null)
const connect = async () => {
  const client = new Client({ name: 'probe', version: '0.0.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL2(surface.endpoint), {
    requestInit: { headers: { Authorization: 'Bearer ' + scope.token } }
  }))
  return client
}
const URL2 = globalThis.URL
const client = await connect()
const tools = (await client.listTools()).tools.map((t) => t.name).sort()
// WRITTEN DOWN ON PURPOSE, and it is the third place this list appears — the
// surface, the manifest, and here. The other two are checked against each other
// below; this one is friction: adding a tool to a credentialed security surface
// should require acknowledging it somewhere a reviewer looks, and two copies
// that drift together would pass a check comparing only those two.
const expected = ['fabric_agents_list','fabric_effect_report','fabric_effect_request','fabric_heartbeat','fabric_leases_list','fabric_memory_remember','fabric_memory_search','fabric_question_ask','fabric_question_check','fabric_stage_report','fabric_task_accept','fabric_task_brief','fabric_task_claim','fabric_task_create','fabric_task_handoff','fabric_task_link','fabric_task_move','fabric_task_note','fabric_task_release','fabric_tasks_list','fabric_transcripts_search','fabric_whoami']
// The count is COMPUTED from the list. Written beside it as a word, it is one
// more number that can disagree with the thing it counts.
if (JSON.stringify(tools) === JSON.stringify(expected))
  ok('a minted credential lists exactly the ' + expected.length + ' tools this probe expects')
else fail('tool list was ' + JSON.stringify(tools))

// The harness screen reads a MANIFEST rather than running a client against the
// main process. That duplication is gated here: a tool registered without a row
// in the manifest, or a row describing a tool that no longer exists, fails.
const manifest = (await import(${JSON.stringify(path.join(HERE, '../src/shared/surfaceTools.ts'))})).SURFACE_TOOLS.map((t) => t.name).sort()
if (JSON.stringify(manifest) === JSON.stringify(tools))
  ok('and the harness manifest names exactly those tools — it cannot drift from what is registered')
else
  fail('the manifest and the surface disagree: manifest=' + JSON.stringify(manifest))

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args })
  return JSON.parse(r.content[0].text)
}

const me = await call('fabric_whoami')
if (me.project?.id === projectId && me.session_id === sessionId && me.rules?.length)
  ok('fabric_whoami answers with this session and the rules that apply')
else fail('whoami returned ' + JSON.stringify(me))

// M177 — what the session is told, and whether it can be told what it was told.
const today = new Date().toISOString().slice(0, 10)
me.rules.some((r) => r.includes(today))
  ? ok('the session is told what today is, from this machine clock')
  : fail('no rule carries the current date: ' + JSON.stringify(me.rules?.[0]))

me.protocol?.vocabulary?.taskStates?.length === 5 &&
me.protocol.vocabulary.taskStates.includes('review')
  ? ok('and the task vocabulary is enumerated rather than learned by refusal')
  : fail('the protocol carries no task states: ' + JSON.stringify(me.protocol))

// The agent may not close a task, and the ladder is what says so — the offered
// moves are computed from it rather than restated beside it.
Object.values(me.protocol.vocabulary.agentMoves).every((to) => !to.includes('done'))
  ? ok('and no offered move closes a task, because the ladder refuses one')
  : fail('the protocol offers a move the ladder would refuse')

me.protocol?.hash && me.protocol?.version
  ? ok('and the protocol names itself, so which rules a session got is answerable')
  : fail('the protocol carries no version or hash')

// M123 — the call is OBSERVED, not only served. Fabric launches a connecting
// session with a preamble telling it to make this call; a preamble is an
// instruction, and an instruction is a claim until something records the
// result. A session with no session.oriented@1 row worked without the rules it
// was bound by, and this row is the only way anyone would know.
{
  const { data: rows } = await db
    .from('journal').select('seq,payload')
    .eq('type', 'session.oriented@1')
    .eq('payload->>session_id', sessionId)
  if (rows?.length === 1) ok('reading the rules is journalled, so a session that never read them is visible')
  else fail('session.oriented@1 rows for this session: ' + JSON.stringify(rows))

  // Twice asked, once recorded. An agent re-reading its rules mid-run is good
  // practice, and it must not turn the journal into a counter of curiosity.
  await call('fabric_whoami')
  const { data: again } = await db
    .from('journal').select('seq')
    .eq('type', 'session.oriented@1')
    .eq('payload->>session_id', sessionId)
  if (again?.length === 1) ok('and asking a second time does not record a second orientation')
  else fail('a second whoami produced ' + (again?.length ?? 0) + ' rows')
}

// 3 — a stage report is recorded as a claim and kept apart from observation
await call('fabric_stage_report', { stage: 'reading the repository', step: 2, ofSteps: 5 })
const { data: claimRow } = await db
  .from('agent_stages').select('stage,step,of_steps').eq('session_id', sessionId).maybeSingle()
const claim = claimRow ? { stage: claimRow.stage, step: claimRow.step, of_steps: claimRow.of_steps } : null
if (claim?.stage === 'reading the repository' && claim.step === 2)
  ok('fabric_stage_report lands in the claim projection')
else fail('claim row was ' + JSON.stringify(claim))

const { data: evtRows } = await db
  .from('journal').select('actor')
  .eq('estate_id', ESTATE).eq('type', 'agent.stage.reported@1')
  .order('seq', { ascending: false }).limit(1)
const evt = evtRows?.[0]?.actor
if (evt?.kind === 'agent' && evt.id === sessionId)
  ok('the journal records the report as the AGENT speaking, not the operator')
else fail('actor was ' + JSON.stringify(evt))

const listed = await call('fabric_agents_list')
const mine = listed.sessions.find((s) => s.session_id === sessionId)
if (mine?.observed?.state === 'running' && mine.claimed?.stage === 'reading the repository' && mine.claimed.caveat)
  ok('fabric_agents_list keeps observation and claim in separate fields, and captions the claim')
else fail('agents_list shape was ' + JSON.stringify(mine))

await call('fabric_memory_remember', { claim: 'the surface is reached over loopback only', sourceRef: 'agentSurface.ts' })
const facts = await call('fabric_memory_search', { query: 'loopback' })
if (facts.facts.length === 1) ok('an agent can write and find project memory')
else fail('memory search returned ' + facts.facts.length)

// 3b — an agent can read what PAST sessions actually did (M45). This is the
// point of storing transcripts verbatim: the next agent asks the record, not
// the agent that did the work.
{
  const pastSession = randomUUID()
  await journal.append({
    estateId: ESTATE, type: 'transcript.captured@1',
    actor: { kind: 'system', id: 'session-capture' }, projectId,
    payload: {
      session_id: pastSession, option_id: 'claude-code',
      sha256: 'c'.repeat(64), bytes: 120, lines: 3, truncated: false,
      started_at: new Date(Date.now() - 600000).toISOString(),
      ended_at: new Date().toISOString(), exit_code: 1,
      annotation: 'claude-code · 10 min · 3 lines · 120 chars · exit 1',
      excerpt: 'npm run build\\nerror: postcss plugin missing\\n',
      body: 'npm run build\\nerror: postcss plugin missing\\nthe build cannot complete\\n'
    }
  })
  const found = await call('fabric_transcripts_search', { query: 'postcss plugin' })
  if (found.sessions?.length === 1 && found.sessions[0].session_id === pastSession)
    ok('an agent can find a past session by what it printed')
  else fail('transcript search returned ' + JSON.stringify(found).slice(0, 160))
  if (found.tier === 'excerpt') ok('the search answers at the excerpt tier, not the whole body')
  else fail('search tier was ' + found.tier)

  // No query needed to read one session whole — an agent should not have to
  // invent search words to open a record it already has the id for.
  const whole = await call('fabric_transcripts_search', { sessionId: pastSession })
  if (whole.found && whole.body?.includes('the build cannot complete'))
    ok('asking for one session by id returns it whole')
  else fail('full read returned ' + JSON.stringify(whole).slice(0, 160))

  const neither = await call('fabric_transcripts_search', {})
  if (neither.found === false && /either a query/.test(neither.reason ?? ''))
    ok('called with neither a query nor an id, it says what it needs')
  else fail('empty call returned ' + JSON.stringify(neither).slice(0, 120))

  const empty = await call('fabric_transcripts_search', { query: 'kubernetes helm chart' })
  if (empty.sessions?.length === 0 && /not that the work was not done/.test(empty.note ?? ''))
    ok('an empty result says it found nothing, rather than implying nothing happened')
  else fail('empty search note was ' + JSON.stringify(empty.note))

  // M68 — a hand-off chain reaches its bound and the next result is a PROPOSAL.
  //
  // Built the way it happens: each hand-off is a NEW session scoped to the task
  // the previous one produced, because that is what an agent working a task and
  // filing the next one looks like. A probe that reused one session would never
  // build a chain at all, and the bound would look like one nobody has hit.
  {
    const onTask = async (taskId) => {
      const sc = surface.mint(projectId, randomUUID(), taskId)
      const c = new Client({ name: 'hop', version: '0.0.0' })
      await c.connect(new StreamableHTTPClientTransport(new URL2(surface.endpoint), {
        requestInit: { headers: { Authorization: 'Bearer ' + sc.token } }
      }))
      return c
    }
    const first = JSON.parse((await client.callTool({
      name: 'fabric_task_create',
      arguments: { title: 'chain origin', origin: { kind: 'person', ref: 'probe' } }
    })).content[0].text)

    let at = first.id
    const results = []
    for (let hop = 1; hop <= 4; hop++) {
      const c = await onTask(at)
      const r = JSON.parse((await c.callTool({
        name: 'fabric_task_create',
        arguments: { title: 'hop ' + hop, origin: { kind: 'task', ref: at } }
      })).content[0].text)
      results.push(r)
      if (r.id) at = r.id
      await c.close()
    }

    const created = results.filter((r) => r.created).length
    const proposed = results.find((r) => r.proposed)
    created === 3 && proposed
      ? ok('three hand-offs are created and the fourth becomes a proposal, not a task')
      : fail('chain produced: ' + JSON.stringify(results.map((r) => (r.created ? 'task' : 'proposal'))))

    proposed && proposed.reason?.includes('not a failure')
      ? ok('and the agent is told it is the bound working, so it reports instead of routing around')
      : fail('the refusal said: ' + JSON.stringify(proposed?.reason))

    // The proposal is NOT on the board. If it were, the bound would have renamed
    // the thing it was meant to stop.
    const { data: strayed } = await db
      .from('project_tasks').select('id').eq('project_id', projectId).eq('title', 'hop 4')
    strayed?.length === 0
      ? ok('and the proposal is nowhere on the board')
      : fail('a proposal reached the board: ' + JSON.stringify(strayed))
  }

  // M104 — the door's own failure modes, which are the ones that HANG an agent
  // rather than failing it.
  {
    const scopeB = surface.mint(projectId, randomUUID(), null)
    const endpoint = surface.endpoint

    // A body past the cap is REFUSED by name, not truncated: a truncated body
    // parses to undefined and the agent is told its call was malformed, which
    // sends it to fix a message that was fine.
    const big = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + scopeB.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pad: 'x'.repeat(1_100_000) })
    })
    big.status === 413
      ? ok('a request body past the cap is refused as too large, not read')
      : fail('an oversized body answered ' + big.status)

    // And the credential survives it: a refusal on size must not spend a
    // handshake that never happened.
    const scopeC = surface.mint(projectId, randomUUID(), null)
    const c = new Client({ name: 'after-413', version: '0.0.0' })
    await c.connect(new StreamableHTTPClientTransport(new URL2(endpoint), {
      requestInit: { headers: { Authorization: 'Bearer ' + scopeC.token } }
    }))
    const who = JSON.parse((await c.callTool({ name: 'fabric_whoami', arguments: {} })).content[0].text)
    who.session_id ? ok('and a fresh credential still initialises normally afterwards')
      : fail('a credential could not initialise after an oversized request')
    await c.close()
  }

  // Isolation: the transcript belongs to this project and no other.
  const otherProject = randomUUID()
  await journal.append({
    estateId: ESTATE, type: 'project.created@1',
    actor: { kind: 'system', id: 'surface-probe' }, projectId: otherProject,
    payload: { id: otherProject, name: 'a different project' }
  })
  const otherScope = surface.mint(otherProject, randomUUID(), null)
  const otherClient = new Client({ name: 'other', version: '0.0.0' })
  await otherClient.connect(new StreamableHTTPClientTransport(new URL2(surface.endpoint), {
    requestInit: { headers: { Authorization: 'Bearer ' + otherScope.token } }
  }))
  const leaked = JSON.parse((await otherClient.callTool({
    name: 'fabric_transcripts_search', arguments: { query: 'postcss plugin' }
  })).content[0].text)
  if (leaked.sessions?.length === 0) ok('a transcript is invisible to a credential scoped to another project')
  else fail('a transcript LEAKED across projects: ' + JSON.stringify(leaked.sessions))
  await db.from('session_transcripts').delete().eq('session_id', pastSession)
  await db.from('projects').delete().eq('id', otherProject)
}

// 3b2 — an agent correcting itself closes the old fact rather than contradicting
// it beside the new one (M48). This is the path that decides whether project
// memory accumulates conflicts or a history.
{
  const first = await call('fabric_memory_remember', {
    claim: 'the build runs on Node 22', sourceRef: 'package.json'
  })
  const second = await call('fabric_memory_remember', {
    claim: 'the build runs on Node 24', sourceRef: 'package.json', supersedes: first.id
  })
  // M182 — the OUTCOME, not the request. This asserted that "superseded" came
  // back equal to first.id, which is the id the caller had just passed in: the tool echoed
  // it back whatever the projector had done, so the assertion held even when
  // the correction was refused. It now reads what happened.
  if (second.correction?.status !== 'superseded')
    fail('the correction did not report what actually happened: ' + JSON.stringify(second.correction))
  if (second.correction?.previousRef !== first.id)
    fail('the correction did not name what it replaced')
  else ok('an agent can record a correction that names what it replaces')

  const current = await call('fabric_memory_search', { query: 'build runs on Node' })
  const claims = (current.facts ?? []).map((f) => f.claim)
  if (claims.includes('the build runs on Node 22'))
    fail('a corrected fact still answers as though nothing had changed')
  else if (!claims.includes('the build runs on Node 24'))
    fail('the correction itself is not returned: ' + JSON.stringify(claims))
  else ok('search returns what is true now, not what was true before')

  const all = await call('fabric_memory_search', { query: 'build runs on Node', includeSuperseded: true })
  const old22 = (all.facts ?? []).find((f) => f.claim === 'the build runs on Node 22')
  if (!old22) fail('the corrected fact was DELETED — the correction is not reversible')
  else if (old22.superseded !== true) fail('the corrected fact is not marked as such')
  else ok('the corrected fact is still there, still readable, and marked corrected')

  await db.from('memory_facts').delete().in('id', [first.id, second.id])
}

// 3c — every retrieval is recorded, and the MISS is the row that matters (M46).
{
  // Earlier sections of this suite have already searched, so scope to the rows
  // THESE three calls add. Counting every row in the project would fold in the
  // earlier misses and measure the suite rather than the feature.
  const before = await db.from('memory_retrievals').select('id').eq('project_id', projectId)
  const seenIds = new Set((before.data ?? []).map((r) => r.id))
  await call('fabric_memory_search', { query: 'loopback' })
  await call('fabric_memory_search', { query: 'nothing here matches this at all' })
  await call('fabric_transcripts_search', { query: 'helm chart rotation' })
  const { data: all } = await db
    .from('memory_retrievals')
    .select('id,store,query,hits,actor_kind,session_id')
    .eq('project_id', projectId)
  const rows = (all ?? []).filter((r) => !seenIds.has(r.id))
  if (rows.length !== 3) fail('three searches produced ' + rows.length + ' retrieval rows')
  else ok('every retrieval is recorded, hits and misses alike')

  const misses = rows.filter((r) => r.hits === 0)
  if (misses.length !== 2) fail('expected 2 misses, recorded ' + misses.length)
  else ok('a search that found nothing leaves a row saying so — the row that earns the table')

  const byStore = new Set(rows.map((r) => r.store))
  if (!byStore.has('facts') || !byStore.has('transcripts'))
    fail('a miss cannot be attributed to the store that missed: ' + [...byStore])
  else ok('a miss names which store missed, not "memory" in general')

  const mine = rows.find((r) => r.query === 'loopback')
  if (mine?.actor_kind !== 'agent' || mine?.session_id !== sessionId)
    fail('the retrieval was not attributed to the asking session: ' + JSON.stringify(mine))
  else ok('a retrieval is attributed to the session that asked')
  await db.from('memory_retrievals').delete().eq('project_id', projectId)
}

// 4 — the credential is a handshake, not a password (SEC-REQ-010).
// A second initialize on the same bearer is what a thief who read mcp.json
// would have to do, and it must not work.
{
  const stolen = new Client({ name: 'thief', version: '0.0.0' })
  let opened = false
  try {
    await stolen.connect(new StreamableHTTPClientTransport(new URL2(surface.endpoint), {
      requestInit: { headers: { Authorization: 'Bearer ' + scope.token } }
    }))
    opened = true
  } catch { /* refused, which is the point */ }
  if (opened) fail('a second MCP session opened on an already-claimed credential')
  else ok('a credential already spent on one session cannot open a second')
}

// And the bearer alone, without the session id the transport handed the real
// client, reaches nothing — the half that is never written to disk.
{
  const r = await fetch(surface.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer ' + scope.token
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
  })
  if (r.status === 401) ok('the bearer without the session id is refused (401)')
  else fail('a bearer with no session id got ' + r.status)
}

// 5 — an unclaimed credential expires (SEC-REQ-011). The clock is injected, so
// this measures the rule rather than waiting two minutes for it.
{
  let clock = 1_000_000
  const timed = new AgentSurface({
    db, journal: createDesktopJournal(journal), ptys, estateId: ESTATE,
    now: () => clock,
    limits: { claimWindowMs: 5_000 }
  })
  await timed.start()
  const stale = timed.mint(projectId, randomUUID(), null)
  clock += 5_001
  const r = await fetch(timed.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + stale.token },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  })
  if (r.status !== 401) fail('an unclaimed credential still worked after its window: ' + r.status)
  else if (timed.credentialCount() !== 0) fail('the expired credential was refused but not dropped')
  else ok('an unclaimed credential expires and is dropped, not merely refused')
  await timed.stop()
}

// 6 — the call budget (SEC-REQ-013). A loop must hit a wall it can read.
{
  let clock = 2_000_000
  const capped = new AgentSurface({
    db, journal: createDesktopJournal(journal), ptys, estateId: ESTATE,
    now: () => clock,
    limits: { budgetCalls: 3, budgetWindowMs: 60_000 }
  })
  await capped.start()
  const s2 = capped.mint(projectId, randomUUID(), null)
  const hit = async () => (await fetch(capped.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer ' + s2.token
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: {} })
  }))
  const codes = []
  for (let i = 0; i < 4; i++) codes.push((await hit()).status)
  const last = await hit()
  if (last.status !== 429) fail('the 5th call past a budget of 3 got ' + last.status)
  else if (!last.headers.get('retry-after')) fail('the refusal carries no Retry-After')
  else {
    const body = await last.json()
    if (!/budget/i.test(body.error ?? '')) fail('the refusal does not say what happened: ' + body.error)
    else ok('a credential over budget is refused 429 with Retry-After and a readable reason')
  }
  // The window must reopen, or a long-running agent is dead after one burst.
  clock += 60_001
  const after = await hit()
  // 401 is the RIGHT answer here and proves the point: this credential never
  // initialised, so the handshake gate refuses it. What matters is that the
  // request got PAST the budget gate to reach that one — the counter reset.
  if (after.status === 429) fail('the budget window never reopened')
  else if (after.status !== 401) fail('unexpected status past the window: ' + after.status)
  else ok('the budget window reopens: the next call passes the budget gate and is stopped by the handshake gate instead')
  await capped.stop()
}

// 6b — the board from the agent's side (M146 step 3)
//
// The rule under test is the product's thesis in one move: AN AGENT DOES NOT
// CLOSE ITS OWN TASK. It is enforced twice over — the ladder refuses it, and
// the tool's own schema cannot even express it, which is the stronger of the
// two because a refusal an agent cannot phrase is one it cannot retry.
{
  const made = await call('fabric_task_create', {
    title: 'the stat is declared twice in the stylesheet',
    origin: { kind: 'observation', ref: 'styles.css:212' }
  })
  made.created && made.status === 'backlog'
    ? ok('an agent files a task and it lands in backlog')
    : fail('create returned ' + JSON.stringify(made))

  // The SDK does not THROW on a schema violation — it answers with isError and
  // the reason, which is the more useful shape: the agent reads why. Asserting
  // a throw would have passed on a surface that silently accepted the call.
  let refusedWithoutOrigin = false
  try {
    const r = await client.callTool({ name: 'fabric_task_create', arguments: { title: 'no evidence at all' } })
    refusedWithoutOrigin = r.isError === true
  } catch { refusedWithoutOrigin = true }
  refusedWithoutOrigin
    ? ok('a task with no origin is refused — a card with no evidence is noise on a board someone else has to read')
    : fail('a task was filed with no origin')

  const taskId = made.id

  // M149 — the one thing an agent authors that reaches a PERSON.
  {
    const cmd = randomUUID()
    const asked = await call('fabric_question_ask', {
      commandId: cmd,
      text: 'Which database version do we target?',
      about: 'db.version',
      options: [{ label: 'postgres 17' }, { label: 'postgres 15' }],
      blocks: [taskId]
    })
    asked.asked === true && asked.question_id
      ? ok('an agent can ask the owner a question, and it blocks what it named')
      : fail('the ask was refused: ' + JSON.stringify(asked))

    // A retry of ONE ask is that ask. Without this a dropped response puts the
    // same question in front of a person twice.
    const again = await call('fabric_question_ask', { commandId: cmd, text: 'Which database version do we target?' })
    again.question_id === asked.question_id && again.repeated === true
      ? ok('and a retry of one ask returns the same question, not a second one')
      : fail('a retry created ' + JSON.stringify(again))

    const checked = await call('fabric_question_check', { questionId: asked.question_id })
    checked.found === true && checked.status === 'open' && checked.blocks.includes(taskId)
      ? ok('checking it returns the current state and what it blocks')
      : fail('check returned ' + JSON.stringify(checked))

    // A foreign task is refused BEFORE the append: the projector would drop the
    // block silently and leave a question that blocks nothing.
    const foreign = await call('fabric_question_ask', {
      commandId: randomUUID(), text: 'reaching across', blocks: [randomUUID()]
    })
    foreign.asked === false && /not in this project/.test(foreign.reason)
      ? ok('a question cannot block a task in another project, and says so before appending')
      : fail('a cross-project block was accepted: ' + JSON.stringify(foreign))

    // A question that is not here and one this credential may not see must read
    // the same, or the refusal itself discloses that the other exists.
    const absent = await call('fabric_question_check', { questionId: randomUUID() })
    absent.found === false
      ? ok('and a question this credential may not see reads exactly like one that is not there')
      : fail('check disclosed a foreign question: ' + JSON.stringify(absent))
  }
  const claimed = await call('fabric_task_claim', { taskId, minutes: 30, writeScopes: ['styles.css'] })
  claimed.claimed ? ok('the agent claims the task it filed') : fail('claim: ' + JSON.stringify(claimed))

  // a second session in the SAME project, contending for the same task
  const rivalSession = randomUUID()
  const rival = surface.mint(projectId, rivalSession, null)
  const rivalClient = new Client({ name: 'rival', version: '0.0.0' })
  await rivalClient.connect(new StreamableHTTPClientTransport(new URL2(surface.endpoint), {
    requestInit: { headers: { Authorization: 'Bearer ' + rival.token } }
  }))
  const rivalCall = async (name, args = {}) => {
    const r = await rivalClient.callTool({ name, arguments: args })
    return JSON.parse(r.content[0].text)
  }
  const stolen = await rivalCall('fabric_task_claim', { taskId })
  !stolen.claimed && stolen.held_by === sessionId
    ? ok('a second agent is refused the task and told who holds it and until when')
    : fail('the lease was stolen: ' + JSON.stringify(stolen))

  const seen = await rivalCall('fabric_leases_list')
  const row = (seen.held ?? []).find((l) => l.task_id === taskId)
  row && row.is_you === false && row.owner_session === sessionId
    ? ok('a neighbour can SEE the claim — which is the only reason to take one')
    : fail('leases_list: ' + JSON.stringify(seen))

  const moved = await call('fabric_task_move', { taskId, to: 'running' })
  moved.moved && moved.to === 'running' ? ok('the agent moves its task to running') : fail('move: ' + JSON.stringify(moved))
  const toReview = await call('fabric_task_move', { taskId, to: 'review' })
  toReview.moved ? ok('and to review, where it says what it concluded') : fail('review: ' + JSON.stringify(toReview))

  let cannotSayDone = false
  try {
    const r = await client.callTool({ name: 'fabric_task_move', arguments: { taskId, to: 'done' } })
    // The refusal names the only three moves that exist for an agent, so the
    // rule is not merely enforced — it is legible from the error alone.
    cannotSayDone =
      r.isError === true && String(r.content?.[0]?.text ?? '').includes('backlog')
  } catch { cannotSayDone = true }
  cannotSayDone
    ? ok('AN AGENT CANNOT EVEN PHRASE "done" — the schema has no such move, so there is nothing to retry')
    : fail('an agent marked its own work done')

  // The brief has two writers and keeps both (M130's rule applied to prose).
  const drafted = await call('fabric_task_brief', { taskId, section: 'what', body: 'remove one of the two declarations' })
  drafted.written ? ok('an agent drafts the brief of the task it holds') : fail('brief: ' + JSON.stringify(drafted))
  const { data: briefed } = await db.from('project_tasks').select('brief_what,brief_draft,brief_author').eq('id', taskId).single()
  briefed?.brief_what?.includes('declarations') && briefed.brief_draft !== null && briefed.brief_author?.startsWith('agent:')
    ? ok('the draft is kept beside the live text, so an operator override never erases what the agent proposed')
    : fail('brief projection: ' + JSON.stringify(briefed))

  const noted = await call('fabric_task_note', { taskId, body: 'ruled out the cascade; it is two declarations' })
  noted.noted ? ok('a working note lands on the task') : fail('note: ' + JSON.stringify(noted))

  // links, and the cycle refused at the WRITE boundary (operating-surfaces §4.1)
  const b = await call('fabric_task_create', { title: 'second card', origin: { kind: 'task', ref: taskId } })
  const linked = await call('fabric_task_link', { taskId, rel: 'blocks', targetTaskId: b.id })
  linked.linked ? ok('one task can block another') : fail('link: ' + JSON.stringify(linked))
  const cyclic = await call('fabric_task_link', { taskId: b.id, rel: 'blocks', targetTaskId: taskId })
  !cyclic.linked && String(cyclic.reason).includes('cycle')
    ? ok('the cycle is refused BEFORE the event exists, and the loop is named')
    : fail('a cycle was accepted: ' + JSON.stringify(cyclic))

  // the door does not admit the other project exists
  const elsewhere = randomUUID()
  await journal.append({
    estateId: ESTATE, type: 'project.created@1',
    actor: { kind: 'system', id: 'surface-probe' }, projectId: elsewhere,
    payload: { id: elsewhere, name: 'a project this session cannot see' }
  })
  const foreign = surface.mint(elsewhere, randomUUID(), null)
  const foreignClient = new Client({ name: 'foreign', version: '0.0.0' })
  await foreignClient.connect(new StreamableHTTPClientTransport(new URL2(surface.endpoint), {
    requestInit: { headers: { Authorization: 'Bearer ' + foreign.token } }
  }))
  const across = JSON.parse((await foreignClient.callTool({
    name: 'fabric_task_move', arguments: { taskId, to: 'running' }
  })).content[0].text)
  !across.moved && across.reason === 'no such task in this project'
    ? ok('a task in another project reads as absent, not as forbidden')
    : fail('cross-project reach: ' + JSON.stringify(across))
  await foreignClient.close()
  await db.from('projects').delete().eq('id', elsewhere)

  const released = await call('fabric_task_release', { taskId, outcome: 'succeeded' })
  released.released ? ok('the holder releases the task') : fail('release: ' + JSON.stringify(released))
  const nowFree = await rivalCall('fabric_task_claim', { taskId })
  nowFree.claimed
    ? ok('and the neighbour can take it the moment it is free')
    : fail('the task stayed locked after release: ' + JSON.stringify(nowFree))
  await rivalClient.close()

  await db.from('task_notes').delete().eq('project_id', projectId)
  await db.from('task_links').delete().eq('project_id', projectId)
  await db.from('leases').delete().eq('project_id', projectId)
  await db.from('project_tasks').delete().eq('project_id', projectId)
}

// 6c — a read that FAILED is not a read that found nothing (IMP-04)
//
// Proven by making the read actually fail: SELECT is revoked from the role the
// surface uses, the tool is called, and the answer must be a refusal rather
// than an empty result. Restored in a finally, because a probe that leaves the
// database less readable than it found it is worse than no probe.
{
  const pg = await import('node:child_process')
  const sql = (statement) =>
    pg.execFileSync('psql', ['-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-d', 'postgres', '-q', '-c', statement],
      { env: { ...process.env, PGPASSWORD: 'postgres' }, encoding: 'utf8' })

  try {
    sql('revoke select on memory_facts from service_role;')
    const answer = await client.callTool({ name: 'fabric_memory_search', arguments: { query: 'anything' } })
    const text = String(answer.content?.[0]?.text ?? '')
    answer.isError === true && /could not be read/.test(text)
      ? ok('a memory read that FAILS answers "could not be read", not "nothing recorded here matches"')
      : fail('a failed read was reported as an empty memory: ' + text.slice(0, 200))

    // And the false miss it used to write: the retrieval log must not gain a
    // row for a lookup that never happened.
    const { count: misses } = await db
      .from('memory_retrievals')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('query', 'anything')
    misses === 0
      ? ok('and no retrieval is logged — a miss that never happened would pollute the eval M46 built')
      : fail('a failed read logged ' + misses + ' retrieval(s)')
  } finally {
    sql('grant select on memory_facts to service_role;')
  }
}

// 6d — the floor, at the door the agent actually uses (M140)
//
// The policy probe proves this loop through the Policy class. This proves it
// through the MCP TOOL, which is what an agent touches.
{
  const target = 'https://example.test/' + randomUUID().slice(0, 8)
  const ask = {
    actionClass: 'publish.page',
    floorClass: 'publication',
    target,
    why: 'the page is approved and ready to go out'
  }

  const refused = await call('fabric_effect_request', ask)
  refused.allowed === false && String(refused.reason).includes('no grant')
    ? ok('an agent asking to cross the floor is refused, and told what it needs')
    : fail('the floor let an agent through: ' + JSON.stringify(refused))
  String(refused.next ?? '').includes('asking again')
    ? ok('and told what happens next — a refusal read as a dead end is one an agent invents a way around')
    : fail('the refusal gives the agent nowhere to go: ' + JSON.stringify(refused))

  const { data: decided } = await db
    .from('journal')
    .select('payload')
    .eq('type', 'policy.decided@1')
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle()
  decided?.payload?.asked_because === ask.why
    ? ok('carrying the reason the AGENT gave, which is what the operator decides on')
    : fail('the asker reason did not reach the journal: ' + JSON.stringify(decided?.payload))

  await policy.issueGrant({
    estateId: ESTATE, projectId, floorClass: 'publication', target,
    actor: { kind: 'person', id: 'operator' }, ttlMs: 60 * 60 * 1000
  })

  const allowed = await call('fabric_effect_request', ask)
  allowed.allowed === true && typeof allowed.receipt_seq === 'number'
    ? ok('the agent asks AGAIN, presenting nothing, and the surface finds the authority')
    : fail('the granted act was refused at the tool: ' + JSON.stringify(allowed))

  // ADR-0050 — THE MEASURED DEFECT LIVED HERE, at this exact tool. It used to
  // answer with a receipt for an act nobody had performed: decide, then
  // recordEffect, with nothing in between.
  const { data: afterPermit } = await db.from('effect_intents')
    .select('state,provenance').eq('estate_id', ESTATE).eq('command_id', allowed.effect_id).maybeSingle()
  afterPermit?.state === 'dispatching' && afterPermit.provenance === 'observed'
    ? ok('the tool answers with a PERMIT, and the effect stands at dispatching — nothing is recorded as done')
    : fail('the permit produced state ' + JSON.stringify(afterPermit))

  const permitText = JSON.stringify(allowed)
  const claimsSuccess = permitText.includes('succeeded') || permitText.includes('carried out')
  claimsSuccess
    ? fail('the permit still tells the agent the act was carried out: ' + permitText)
    : ok('and the answer never tells the agent its act succeeded — it was permitted, not observed')

  const reported = await call('fabric_effect_report', { effectId: allowed.effect_id, says: 'published it' })
  const { data: afterReport } = await db.from('effect_intents')
    .select('state,provenance').eq('estate_id', ESTATE).eq('command_id', allowed.effect_id).maybeSingle()
  reported.recorded === true && reported.outcome === 'unknown' &&
  afterReport?.provenance === 'claimed' && afterReport.state === 'outcome_unknown'
    ? ok('the agent reports, the report is kept and attributed, and the outcome stays UNKNOWN to Fabric')
    : fail('the agent report resolved the effect: ' + JSON.stringify({ reported, afterReport }))

  const invented = await call('fabric_effect_report', { effectId: randomUUID(), says: 'trust me' })
  invented.recorded === false
    ? ok('and a report against an effect_id nobody issued is refused rather than filed')
    : fail('a report against an invented effect was accepted')

  const spent = await call('fabric_effect_request', ask)
  spent.allowed === false
    ? ok('and once is once — the same permission does not cover a second act')
    : fail('a spent grant allowed a second act')
}

// 6b — FA-09: the window in which the surface is listening and the terminal
// manager does not exist yet. The surface starts listening one line after it is
// built and the manager is constructed three database round-trips later, so this
// is a real state of the running program, not a hypothetical one.
{
  const blind = new AgentSurface({ db, journal: createDesktopJournal(journal), ptys: () => undefined, policy, estateId: ESTATE })
  await blind.start()
  const blindScope = blind.mint(projectId, sessionId, null)
  const blindClient = new Client({ name: 'blind', version: '0.0.0' })
  await blindClient.connect(new StreamableHTTPClientTransport(new URL2(blind.endpoint), {
    requestInit: { headers: { Authorization: 'Bearer ' + blindScope.token } }
  }))
  const blindCall = async (name, args = {}) =>
    JSON.parse((await blindClient.callTool({ name, arguments: args })).content[0].text)

  const target = 'https://example.test/' + randomUUID().slice(0, 8)
  await policy.issueGrant({
    estateId: ESTATE, projectId, floorClass: 'publication', target,
    actor: { kind: 'person', id: 'operator' }, ttlMs: 60 * 60 * 1000
  })
  // WITH the grant in hand, so what is measured is the containment floor and
  // not the absence of authority.
  const asked = await blindCall('fabric_effect_request', {
    actionClass: 'publish.page',
    floorClass: 'publication',
    target,
    why: 'the page is approved and ready to go out'
  })
  asked.allowed === false && /unnamed runner/i.test(String(asked.reason))
    ? ok('an effect whose asker Fabric cannot identify is refused WITH a valid grant — an unreadable runner is an uncontained one')
    : fail('an unidentifiable asker crossed the floor: ' + JSON.stringify(asked))

  const roster = await blindCall('fabric_agents_list')
  roster.sessions === null && String(roster.unreadable ?? '').length > 20
    ? ok('and asking who else is here answers NO REPORT rather than an empty project')
    : fail('a manager that could not answer produced a roster: ' + JSON.stringify(roster))

  await blindClient.close()
  await blind.stop()
}

// 6a — M103: an instruction is written; being accepted is the agent's word.
{
  // A task of this project to deliver against. The suite has no task in scope
  // at this point, so the fixture makes one rather than borrowing an id from a
  // section above and coupling the two.
  const taskId = randomUUID()
  await journal.append({
    estateId: ESTATE, type: 'task.started@1', actor: { kind: 'person', id: 'operator' },
    projectId, payload: { id: taskId, instruction: 'deliver me', option_id: 'claude-code' }
  })
  const deliveryId = randomUUID()
  const digest = 'abcdef0123456789abcdef0123456789'
  await journal.append({
    estateId: ESTATE, type: 'delivery.queued@1', actor: { kind: 'person', id: 'operator' },
    projectId, payload: { delivery_id: deliveryId, task_id: taskId, session_id: sessionId, input_digest: digest }
  })

  // Before anything is written, an ack is refused: there is nothing to receive.
  const early = await call('fabric_task_accept', { deliveryId, inputDigest: digest })
  early.accepted === false && early.reason_code === 'not_written'
    ? ok('an acknowledgement for something never written is refused')
    : fail('an unwritten delivery was accepted: ' + JSON.stringify(early))

  await journal.append({
    estateId: ESTATE, type: 'delivery.written@1', actor: { kind: 'person', id: 'operator' },
    projectId, payload: { delivery_id: deliveryId, task_id: taskId, session_id: sessionId }
  })
  const { data: written } = await db.from('deliveries').select('state').eq('delivery_id', deliveryId).maybeSingle()
  written?.state === 'written_unconfirmed'
    ? ok('and the written instruction sits at WRITTEN_UNCONFIRMED — bytes out, nobody has said they arrived')
    : fail('delivery state after write: ' + JSON.stringify(written))

  // THE DIGEST IS WHAT MAKES AN ACK MEAN ANYTHING. Without it an agent could
  // acknowledge a delivery it never saw and the task would read running on a
  // confirmation about something else.
  const wrong = await call('fabric_task_accept', { deliveryId, inputDigest: 'ffffffffffffffffffffffffffffffff' })
  wrong.accepted === false && wrong.reason_code === 'digest_mismatch'
    ? ok('an acknowledgement quoting the wrong content is REFUSED')
    : fail('a mismatched digest was accepted: ' + JSON.stringify(wrong))

  const accepted = await call('fabric_task_accept', { deliveryId, inputDigest: digest })
  const { data: after } = await db.from('deliveries')
    .select('state,ack_source').eq('delivery_id', deliveryId).maybeSingle()
  accepted.accepted === true && after?.state === 'accepted' && after.ack_source === 'agent'
    ? ok('and the agent quoting the right digest moves it to accepted, with the source recorded')
    : fail('the ack did not land: ' + JSON.stringify({ accepted, after }))

  // A repeat is idempotent rather than a second, conflicting acknowledgement.
  const repeat = await call('fabric_task_accept', { deliveryId, inputDigest: digest })
  repeat.accepted === true
    ? ok('and a repeat of the same acknowledgement is idempotent')
    : fail('a retry of the same ack was refused: ' + JSON.stringify(repeat))

  // The floor: an ADAPTER acceptance never makes a task running, with the tool
  // bypassed entirely.
  const adapterOnly = randomUUID()
  await journal.append({
    estateId: ESTATE, type: 'delivery.queued@1', actor: { kind: 'person', id: 'operator' },
    projectId, payload: { delivery_id: adapterOnly, task_id: taskId, session_id: sessionId, input_digest: digest }
  })
  await journal.append({
    estateId: ESTATE, type: 'delivery.written@1', actor: { kind: 'person', id: 'operator' },
    projectId, payload: { delivery_id: adapterOnly, task_id: taskId }
  })
  const forged = await db.from('deliveries')
    .update({ state: 'accepted', ack_source: 'adapter' }).eq('delivery_id', adapterOnly)
  forged.error
    ? ok('and the SCHEMA refuses an accepted delivery whose only acknowledgement was an adapter')
    : fail('an adapter acknowledgement made a delivery accepted')

  // THE PROJECTOR'S OWN CHECK, reached by BYPASSING the tool. The tool refuses a
  // mismatched digest before appending anything, so a planted defect in the
  // projector went unnoticed until this was written: the comment claimed the
  // projection also compares, and nothing proved it.
  await journal.append({
    estateId: ESTATE, type: 'delivery.accepted@1', actor: { kind: 'agent', id: sessionId },
    projectId, payload: { delivery_id: adapterOnly, input_digest: 'ffffffffffffffffffffffffffffffff', source: 'agent' }
  })
  const { data: bypassed } = await db.from('deliveries')
    .select('state').eq('delivery_id', adapterOnly).maybeSingle()
  bypassed?.state === 'written_unconfirmed'
    ? ok('and the PROJECTION refuses an acceptance whose digest is not the one that was sent, with the tool bypassed')
    : fail('a direct event with the wrong digest was projected as accepted: ' + JSON.stringify(bypassed))
}

// 6b — M178: the heartbeat, and what it refuses.
{
  const beat = await call('fabric_heartbeat', { beatSeq: 1, phase: 'working', note: 'reading the brief' })
  beat.accepted === true
    ? ok('an agent can say what it is doing, and the surface records it')
    : fail('the heartbeat was refused: ' + JSON.stringify(beat))

  const { data: row } = await db.from('session_heartbeats')
    .select('beat_seq,phase,last_received_at,waiting_kind').eq('session_id', sessionId).maybeSingle()
  row?.beat_seq === 1 && row.phase === 'working'
    ? ok('and the projection carries the beat, timed by the DATABASE rather than by the client')
    : fail('no heartbeat row: ' + JSON.stringify(row))

  const firstAt = row.last_received_at

  // A RETRY MUST NOT REVIVE. A transport that keeps resending the last message
  // it managed to send would otherwise keep a stalled agent looking alive for
  // as long as it retries.
  await new Promise((r) => setTimeout(r, 1100))
  await call('fabric_heartbeat', { beatSeq: 1, phase: 'working' })
  const { data: same } = await db.from('session_heartbeats')
    .select('last_received_at,beat_seq').eq('session_id', sessionId).maybeSingle()
  same.last_received_at === firstAt
    ? ok('a repeated beat changes nothing — a retry cannot make a stalled agent look alive')
    : fail('a duplicate beat refreshed the clock: ' + firstAt + ' -> ' + same.last_received_at)

  // A LOWER sequence is a late message from a delivery nobody can order.
  await call('fabric_heartbeat', { beatSeq: 5, phase: 'verifying' })
  await call('fabric_heartbeat', { beatSeq: 2, phase: 'reading' })
  const { data: latest } = await db.from('session_heartbeats')
    .select('beat_seq,phase').eq('session_id', sessionId).maybeSingle()
  latest.beat_seq === 5 && latest.phase === 'verifying'
    ? ok('and a late, lower-numbered beat does not revive an older state')
    : fail('a stale beat won: ' + JSON.stringify(latest))

  // Only a waiting or blocked agent may name a blocker. Refused rather than
  // dropped: an agent whose blocker is silently discarded believes it reported
  // one, and the surface would explain a silence with something nobody claimed.
  const wrong = await call('fabric_heartbeat', {
    beatSeq: 6, phase: 'working', waitingOn: { kind: 'question', id: randomUUID() }
  })
  wrong.accepted === false && /waiting or blocked/.test(wrong.reason)
    ? ok('a working agent naming a blocker is REFUSED, not silently stripped of it')
    : fail('a working beat carried a blocker: ' + JSON.stringify(wrong))

  const blockedOn = randomUUID()
  const blocked = await call('fabric_heartbeat', {
    beatSeq: 7, phase: 'blocked', waitingOn: { kind: 'question', id: blockedOn }
  })
  const { data: waiting } = await db.from('session_heartbeats')
    .select('phase,waiting_kind,waiting_id').eq('session_id', sessionId).maybeSingle()
  blocked.accepted === true && waiting.waiting_kind === 'question'
    ? ok('and a blocked agent names what it waits on — the field that turns a silence into a fact')
    : fail('the blocker did not land: ' + JSON.stringify(waiting))

  // The floor, attempted rather than assumed: the constraint, not the tool.
  const forged = await db.from('session_heartbeats')
    .update({ phase: 'working' }).eq('session_id', sessionId)
  forged.error
    ? ok('and the SCHEMA refuses a working row that still names a blocker, with the tool bypassed')
    : fail('a working heartbeat kept its blocker in the database')
}

// 7 — S05: every call left ONE attempt, whatever ended it.
//
// BEFORE revocation, deliberately: a revoked credential is refused at the door,
// so a schema refusal could never be reached and the section would pass on the
// wrong evidence — which is exactly how it first ran.
//
// The refusal by SCHEMA is the case this whole design turns on: the MCP SDK
// validates arguments before dispatching, so that call never reaches a handler.
// A trace wrapped around the tool functions is blind to it — which is the
// blindness an agent hits precisely when it is getting the arguments wrong.
let schemaRefusalText = ''
try {
  const r = await client.callTool({ name: 'fabric_task_move', arguments: { task_id: 'not-a-uuid', to: 'no-such-state' } })
  schemaRefusalText = r?.content?.[0]?.text ?? ''
} catch (e) {
  schemaRefusalText = String(e?.message ?? e)
}

// PINNING A DEPENDENCY'S STRING. The classifier tells a refused argument from a
// crashed tool by the code the SDK renders into its own message, because the
// envelope carries nothing else — an SDK that changes this wording must fail
// HERE rather than quietly re-label every schema refusal as a crash.
/^MCP error -32602:/.test(schemaRefusalText)
  ? ok('the SDK still renders a validation refusal as "MCP error -32602:" — the one string contract the classifier rests on holds')
  : fail('the SDK error rendering changed; the schema/crash distinction is now guesswork: ' + JSON.stringify(schemaRefusalText.slice(0, 120)))
// A tool that does not exist at all — refused one layer further out again.
try { await client.callTool({ name: 'fabric_not_a_tool', arguments: {} }) } catch {}

const trace = sink.read({ level: 'debug', limit: 500 })
const traced = (op) => trace.filter((r) => r.op === op)

traced('tool.fabric_whoami').length > 0
  ? ok('a tool that answered left a trace naming the tool, not the transport')
  : fail('no trace for fabric_whoami; ops has ' + trace.length + ' record(s)')

const returned = traced('tool.fabric_whoami')[0]
returned?.detail?.trace_outcome === 'returned' && typeof returned.ms === 'number'
  ? ok('and it carries the outcome and a measured duration, not a guess')
  : fail('the trace lost its outcome or duration: ' + JSON.stringify(returned?.detail))

const refusedBySchema = traced('tool.fabric_task_move').filter((r) => r.detail?.trace_outcome === 'schema_error')
refusedBySchema.length > 0
  ? ok('a call REFUSED BY THE SCHEMA is traced — the SDK never ran a handler for it')
  : fail('a schema refusal left no trace: ' + JSON.stringify(traced('tool.fabric_task_move').map((r) => r.detail?.trace_outcome)))

trace.some((r) => r.detail?.trace_outcome === 'schema_error' && r.op === 'tool.fabric_not_a_tool')
  ? ok('and so is a call to a tool that does not exist')
  : fail('an unknown tool left no schema_error trace')

// The refusals BEFORE any body was read — a 401 for an unminted credential —
// are the other half of the nine exits, and their reason must survive.
const bearerRefusals = trace.filter((r) => r.detail?.trace_outcome === 'refused')
bearerRefusals.length > 0 && bearerRefusals.every((r) => typeof r.detail?.refused === 'string')
  ? ok('every refusal carries WHY, not just 401')
  : fail('a refusal lost its reason: ' + JSON.stringify(bearerRefusals.map((r) => r.detail)))

// The EARLIEST exit by name. "Some refusal carries a reason" is satisfied by the
// budget and session-mismatch refusals, which happen after the credential has
// already resolved — so it passed with the trace installed halfway down, and a
// planted defect that moved it there went unnoticed. This one is only reachable
// if the tap sits above the first credential check.
trace.some((r) => r.detail?.refused === 'unknown or revoked credential')
  ? ok('and a request refused for an UNKNOWN CREDENTIAL is traced — the earliest exit of the nine')
  : fail('the first exit leaves no trace: the tap is installed below it')

// Every attempt is one attempt. A response that both finished and closed must
// not produce two records, or a rate of failure computed from this log is wrong.
const ids = trace.filter((r) => r.detail?.attempt_id).map((r) => r.detail.attempt_id)
ids.length === new Set(ids).size
  ? ok('and each attempt appears exactly once — finish and close do not both record'
      + ' (' + ids.length + ' attempts)')
  : fail('an attempt was recorded twice: ' + ids.length + ' records, ' + new Set(ids).size + ' ids')

// Nothing an agent sent is in the log. The arguments carried a made-up state
// and a bad uuid; a trace that keeps arguments keeps whatever secret is in one.
JSON.stringify(trace).includes('no-such-state')
  ? fail('the trace kept the call arguments')
  : ok('and no argument an agent sent reached the log — the trace holds the SUBJECT, never the payload')

sink.lost() === 0
  ? ok('and the sink lost nothing, so this corpus is complete rather than assumed complete')
  : fail('the trace corpus is missing ' + sink.lost() + ' record(s)')

// 8 — revocation closes the door
surface.revokeSession(sessionId)
const after = await fetch(surface.endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + scope.token },
  body: '{}'
})
if (after.status === 401) ok('revoking the session closes its credential immediately')
else fail('a revoked credential still got ' + after.status)

// cleanup
await db.from('agent_stages').delete().eq('session_id', sessionId)
await db.from('memory_facts').delete().eq('project_id', projectId)
await db.from('projects').delete().eq('id', projectId)
await surface.stop()
process.exit(failures ? 1 : 0)
`

// The stack's own env, so no key is written down here.
const env = { ...process.env }
try {
  const out = execFileSync('supabase', ['status', '-o', 'env'], {
    cwd: path.resolve(HERE, '../../..'),
    encoding: 'utf8'
  })
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/)
    if (!m) continue
    if (m[1] === 'API_URL') env.SUPABASE_URL = m[2]
    if (m[1] === 'SERVICE_ROLE_KEY') env.SUPABASE_SERVICE_ROLE_KEY = m[2]
    if (m[1] === 'DB_URL') env.DATABASE_URL = m[2]
  }
} catch {
  console.log('  skip agent surface probe: the local stack is not running')
  process.exit(0)
}

try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    encoding: 'utf8',
    env,
    cwd: path.resolve(HERE, '..')
  })
  process.stdout.write(out.split('\n').filter((l) => /^\s+(ok|FAIL)/.test(l)).join('\n') + '\n')
} catch (e) {
  const out = (e.stdout ?? '') + (e.stderr ?? '')
  process.stdout.write(out)
  process.exit(1)
}
