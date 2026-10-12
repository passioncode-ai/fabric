// Claims through the agent surface (REQ-38, REQ-08, CO-256; the session hooks' D4/D5), probed the way agents reach
// them: real MCP clients over Streamable HTTP, two enrolled sessions in one project, the real journal and projectors
// of a DISPOSABLE stack (`node scripts/test-stack.mjs run -- node --experimental-strip-types <this file>`).
//
// What it must show:
//   1. the second agent is warned of related work and refused only the same task, naming the holder;
//   2. a backlog row links (and resolves part by part), and a claim by that row finds its task;
//   3. enrolled sessions are listed to each other with a sign of life (CO-256);
//   4. releases: handed over (waiting for the asker), by the operator (the agent told), at session end, a whole
//      session at once (D5); an observation per turn and at the end, idempotent (D4);
//   5. agent-sync's leases are shown read-only through fabric_leases_list and fabric_work_list.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { probeEnv } from '../../../scripts/lib/test-stack.mjs'
import { AgentSurface } from '../src/main/agentSurface.ts'
import { createDesktopJournal } from '../src/main/desktopIngress.ts'
import { createJournal } from '../../../packages/journal/src/index.ts'
import { createScopedStore } from '../src/main/scopedStore.ts'
import { resolveBacklogSource } from '../src/main/backlogSource.ts'
import { createLeaseRefReader } from '../src/main/agentSyncLeases.ts'
import { releaseByOperator, releaseSessionClaims } from '../src/main/workRelease.ts'
import { readProjectWork, readWhereWork } from '../src/main/workRead.ts'

const env = probeEnv()
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const raw = createJournal(db)
const journal = createDesktopJournal(raw)

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const check = (cond, m, detail) => (cond ? ok(m) : fail(m + (detail === undefined ? '' : ' — ' + JSON.stringify(detail))))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ESTATE = randomUUID()
const projectId = randomUUID()
const otherProject = randomUUID()
const actor = { kind: 'system', id: 'work-claims-probe' }

// A repository with a backlog file and an origin remote — the address a row is linked by.
const repo = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-work-claims-')))
mkdirSync(path.join(repo, 'docs'))
writeFileSync(path.join(repo, 'docs/backlog.md'), '| ID | Milestone |\n|---|---|\n| CO-901 | claims |\n| CO-902 | more |\n')
execFileSync('git', ['init', '-q', repo])
execFileSync('git', ['-C', repo, 'remote', 'add', 'origin', 'git@github.com:example/claims-repo.git'])

await raw.append({ estateId: ESTATE, type: 'estate.created@1', actor, payload: { name: 'work claims probe' } })
await raw.append({ estateId: ESTATE, type: 'project.created@1', actor, projectId, payload: { id: projectId, name: 'claims probe' } })
await raw.append({ estateId: ESTATE, type: 'project.created@1', actor, projectId: otherProject, payload: { id: otherProject, name: 'other probe' } })
await raw.append({ estateId: ESTATE, type: 'project.repo.attached@1', actor, projectId, payload: { id: randomUUID(), path: repo, label: 'claims-repo' } })

const store = createScopedStore(db, { kind: 'estate', estateId: ESTATE })
const leaseCalls = []
const leaseReader = createLeaseRefReader({
  remoteOf: async () => 'git@github.com:example/claims-repo.git',
  lsRemote: async (url) => {
    leaseCalls.push(url)
    return 'ca5ef24199653c4b651b350ba29097c6f9e13b32\trefs/agent-sync/leases/docs%2Fevidence%2Fbacklog.md\n'
  }
})
const repos = async (pid) => {
  const { data, error } = await store.select('project_repos', 'path,is_primary').eq('project_id', pid)
  if (error) throw new Error(error.message)
  return data
}
const surface = new AgentSurface({
  db, journal, ptys: () => undefined, estateId: ESTATE,
  work: {
    resolveSource: async (pid, source) =>
      resolveBacklogSource(source, { repos: async () => (await repos(pid)).map((r) => ({ path: r.path, remote: 'git@github.com:example/claims-repo.git' })) }),
    leaseRefs: async (pid) => {
      const r = (await repos(pid)).find((x) => x.is_primary)
      return r ? { ...(await leaseReader.read(r.path)), repository: r.path } : null
    }
  },
  onSessionEnded: async (sessionId, why) => {
    await releaseSessionClaims(store, (e) => journal.append({ estateId: ESTATE, ...e }), sessionId, why)
  }
})
await surface.start()

const A = randomUUID()
const B = randomUUID()
const connect = async (projectFor, session, origin) => {
  const scope = surface.mint(projectFor, session, null, origin)
  const client = new Client({ name: 'probe', version: '0.0.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL(surface.endpoint), { requestInit: { headers: { Authorization: 'Bearer ' + scope.token } } }))
  return {
    client,
    call: async (name, args = {}) => {
      const r = await client.callTool({ name, arguments: args })
      if (r.isError) return { error: r.content?.[0]?.text ?? 'error' }
      return JSON.parse(r.content[0].text)
    }
  }
}
const a = await connect(projectId, A, { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-A' })
const b = await connect(projectId, B, { cameIn: 'enrolled', agent: 'codex', runtimeSessionId: 'rt-B' })

const tools = (await a.client.listTools()).tools.map((t) => t.name)
check(['fabric_work_list', 'fabric_work_claim', 'fabric_work_release', 'fabric_session_observe'].every((t) => tools.includes(t)),
  'an enrolled session is given the claim tools and the observation tool')

// ── 3 · enrolled sessions see each other, with a sign of life (CO-256)
const first = await b.call('fabric_work_list')
const seenA = first.sessions?.find((s) => s.session_id === A)
check(Array.isArray(first.claims) && first.claims.length === 0, 'an empty project reads no claims — from a read list', first)
check(seenA && seenA.came_in === 'enrolled' && seenA.agent === 'claude-code' && seenA.last_sign_at && seenA.reads === 'active',
  "another enrolled session is listed with its runner, how it came in and its last call", first.sessions)
check(first.agent_sync_leases?.read === true && first.agent_sync_leases.leases[0]?.key === 'docs/evidence/backlog.md',
  "agent-sync's leases are listed read-only, decoded", first.agent_sync_leases)

// ── 2 · a backlog row links, part by part
const bad = [
  [{ repository: 'example/nope', path: 'docs/backlog.md', id: 'CO-901' }, 'repository'],
  [{ repository: 'example/claims-repo', path: 'docs/missing.md', id: 'CO-901' }, 'path'],
  [{ repository: 'example/claims-repo', path: 'docs/backlog.md', id: 'CO-999' }, 'id']
]
for (const [source, part] of bad) {
  const r = await a.call('fabric_task_create', { title: 'linked work', origin: { kind: 'document', ref: 'docs/backlog.md' }, source })
  check(r.created === false && r.code === 'source-unresolved' && r.part === part, `a row whose ${part} does not resolve files nothing and names the ${part}`, r)
}
const created = await a.call('fabric_task_create', {
  title: 'claims for CO-901', origin: { kind: 'document', ref: 'docs/backlog.md' },
  source: { repository: 'https://github.com/example/claims-repo', path: 'docs/backlog.md', id: 'CO-901' }
})
const T1 = created.id
const { data: link } = await db.from('task_sources').select('*').eq('task_id', T1).maybeSingle()
check(created.created === true && created.source?.id_checked === true && link?.row_id === 'CO-901' && link?.repo_path === repo,
  'fabric_task_create links the task to its backlog row by address (task_sources), resolved by the remote', { created, link })

// ── 1 · claim, warn, refuse the same task only
const claimA = await a.call('fabric_work_claim', { taskId: T1, touches: ['src/auth'], minutes: 30 })
check(claimA.claimed === true && claimA.claim_id && claimA.warning === null, 'the first agent claims its task, with no warning', claimA)
const heldB = await b.call('fabric_work_claim', { taskId: T1, askHandover: true, note: 'may I?' })
check(heldB.claimed === false && heldB.code === 'held' && heldB.held_by?.session_id === A && heldB.held_by?.agent === 'claude-code' && heldB.handover_requested === true,
  'the same task is refused to the second agent, naming the holder, and a handover is asked', heldB)
const byRow = await b.call('fabric_work_claim', { source: { repository: 'example/claims-repo', path: 'docs/backlog.md', id: 'CO-901' } })
check(byRow.claimed === false && byRow.code === 'held' && byRow.task_id === T1, 'a claim by the backlog row finds the task linked to it — held, so refused', byRow)
const claimB = await b.call('fabric_work_claim', { title: 'login form', origin: { kind: 'observation', ref: 'src/auth/login.ts:1' }, touches: ['src/auth/login.ts'], idempotencyKey: 'probe-key-0001' })
check(claimB.claimed === true && claimB.filed === true && claimB.related?.length === 1 && claimB.related[0].task_id === T1 && typeof claimB.warning === 'string',
  'related work held by another agent is a warning, not a refusal — the overlap named', claimB)
const again = await b.call('fabric_work_claim', { title: 'login form', origin: { kind: 'observation', ref: 'src/auth/login.ts:1' }, idempotencyKey: 'probe-key-0001' })
check(again.claim_id === claimB.claim_id && again.same_claim === true, 'the same idempotency key is the same claim, never a second', again)
const other = await a.call('fabric_work_claim', { taskId: randomUUID() })
check(other.claimed === false && other.code === 'not-in-project', 'a task that is not of this project is refused', other)

const listA = await a.call('fabric_work_list')
const mine = listA.claims.find((c) => c.claim_id === claimA.claim_id)
check(listA.claims.length === 2 && mine?.related?.length === 1 && mine.task.source?.id === 'CO-901' && mine.reads === 'working',
  "the holder's list shows both claims, its own marked related and linked to its row", listA.claims)
check(listA.handover_requests?.length === 1 && listA.handover_requests[0].by === B, 'the holder sees the handover request', listA.handover_requests)

// The operator's screens read the same projection.
const proj = await readProjectWork(createScopedStore(db, { kind: 'project', estateId: ESTATE, projectId }), {
  now: Date.now(), session: (id) => surface.sessionSign(id), sessions: [], leases: async () => null
})
check(proj.claims.length === 2 && proj.claims.every((c) => c.life === 'live') && proj.claims.every((c) => c.related.length === 1),
  'SCR-31 reads two live claims, both marked related', proj.claims)
const where = await readWhereWork(store, { now: Date.now(), session: (id) => surface.sessionSign(id), sessions: [] })
check(where.rows.length === 1 && where.rows[0].projectId === projectId && where.rows[0].claims.length === 2 && where.idle === 1 && where.unowned.length === 0,
  'SCR-78 reads one project in flight, the other counted idle, no unowned session', where)

// ── 4 · releases
const handed = await a.call('fabric_work_release', { taskId: T1, how: 'handed-over', note: 'the form is next' })
check(handed.released === true && handed.handed_to === B, 'a handover goes to the agent that asked', handed)
const waitingB = await b.call('fabric_work_list')
check(waitingB.waiting_for_you?.some((w) => w.task_id === T1 && w.note === 'the form is next'), 'the next agent reads the handed-over task as waiting for it', waitingB.waiting_for_you)

const op = await releaseByOperator(store, (e) => journal.append({ estateId: ESTATE, ...e }), { kind: 'system', id: 'operator-probe' }, claimB.claim_id)
const toldB = await b.call('fabric_work_list')
const releasedB = await b.call('fabric_work_release', { claimId: claimB.claim_id, how: 'done' })
check(op.released === true && toldB.released_by_operator?.some((r) => r.claim_id === claimB.claim_id) && releasedB.code === 'released-by-operator',
  'the operator releases a claim and the agent is told on its next calls', { op, told: toldB.released_by_operator, releasedB })

// A session's claims end with it.
const T2 = (await b.call('fabric_task_create', { title: 'second piece', origin: { kind: 'observation', ref: 'x' } })).id
const claimB2 = await b.call('fabric_work_claim', { taskId: T2 })
surface.revokeSession(B)
let endRow = null
for (let i = 0; i < 40 && !endRow?.released_at; i++) {
  await sleep(100)
  endRow = (await db.from('work_claims').select('released_at,released_how').eq('id', claimB2.claim_id).maybeSingle()).data
}
check(claimB2.claimed === true && endRow?.released_how === 'session-ended', "a session's claims are released when it ends", endRow)

// D5: a whole session at once.
const T3 = (await a.call('fabric_task_create', { title: 'third', origin: { kind: 'observation', ref: 'y' } })).id
const T4 = (await a.call('fabric_task_create', { title: 'fourth', origin: { kind: 'observation', ref: 'z' } })).id
await a.call('fabric_work_claim', { taskId: T3 })
await a.call('fabric_work_claim', { taskId: T4 })
const all = await a.call('fabric_work_release', { claims: 'session', outcome: 'let-go', reason: 'session end', idempotencyKey: 'end-0001' })
const { data: liveA } = await db.from('work_claims').select('id').eq('owner_session', A).is('released_at', null)
check(all.released === true && all.claims?.length === 2 && (liveA ?? []).length === 0, 'claims: "session" releases every claim of the session', { all, liveA })
const allAgain = await a.call('fabric_work_release', { claims: 'session', outcome: 'let-go', reason: 'session end', idempotencyKey: 'end-0001' })
check(allAgain.released === true && allAgain.claims.length === 0, 'releasing a session again releases nothing more', allAgain)

// D4: observations, idempotent, this session's runtime only.
const turn = { event: 'turn', runtime: 'claude-code', runtimeSessionId: 'rt-A', observedAt: new Date().toISOString(), head: 'a'.repeat(40), filesChanged: 3, linesAdded: 10, linesRemoved: 2, idempotencyKey: 'turn-0000001' }
const t1 = await a.call('fabric_session_observe', turn)
const t2 = await a.call('fabric_session_observe', turn)
const wrong = await a.call('fabric_session_observe', { ...turn, runtimeSessionId: 'rt-B', idempotencyKey: 'turn-0000002' })
const { data: turns } = await db.from('journal').select('seq,payload').eq('estate_id', ESTATE).eq('type', 'session.turn.observed@1')
check(t1.recorded === true && t2.repeated === true && t2.seq === t1.seq && (turns ?? []).length === 1 && turns[0].payload.files_changed === 3,
  'a turn is journalled once, however often it is sent', { t1, t2, turns })
check(wrong.recorded === false && wrong.code === 'not-this-session', "another session's runtime id is refused", wrong)
const end = await a.call('fabric_session_observe', { ...turn, event: 'end', reason: 'prompt_input_exit', idempotencyKey: 'end-0000001' })
const { data: ends } = await db.from('journal').select('payload').eq('estate_id', ESTATE).eq('type', 'session.ended@1')
check(end.recorded === true && (ends ?? []).length === 1 && ends[0].payload.observed_by === 'hook' && ends[0].payload.reason === 'prompt_input_exit' && !('path' in ends[0].payload),
  'an end is journalled as session.ended@1 from the hook, with its reason and no path', ends)
await sleep(1500)
check(surface.sessionSign(A) === null, 'an end ends the session in Fabric once its answer has gone')

// ── 5 · fabric_leases_list shows agent-sync's leases (a fresh session; the reader kept its answer)
const c = await connect(projectId, randomUUID(), { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-C' })
const leases = await c.call('fabric_leases_list')
check(leases.agent_sync_leases?.read === true && leases.agent_sync_leases.leases.length === 1 && leaseCalls.length === 1,
  'fabric_leases_list shows the agent-sync leases, read once and kept', { leases: leases.agent_sync_leases, calls: leaseCalls.length })

await surface.stop()
rmSync(repo, { recursive: true, force: true })
process.exit(failures ? 1 : 0)
