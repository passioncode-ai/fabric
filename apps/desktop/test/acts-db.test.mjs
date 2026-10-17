// Every operator act the database holds, done and undone, against a DISPOSABLE stack (0.3.7 wave 2, ADR-0160 §2,
// SCN-168, SCN-169):  node scripts/test-stack.mjs run -- node --experimental-strip-types apps/desktop/test/acts-db.test.mjs
//
// For each act the plan names — move a task, release a claim, detach a folder, answer a question, rename a project —
// and for the folder attach that is the inverse of detach: DO it, UNDO it, and both are in the journal with their actor,
// the second naming the first (`undoes`); the world is as before after the undo, and the undo itself can be undone.
// Then История's read: newest first, paged, filtered, with the undo state of every act.
import { mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { probeEnv } from '../../../scripts/lib/test-stack.mjs'
import { createDesktopJournal } from '../src/main/desktopIngress.ts'
import { createJournal } from '../../../packages/journal/src/index.ts'
import { createScopedStore } from '../src/main/scopedStore.ts'
import { createActs } from '../src/main/acts.ts'
import { createActLog } from '../src/main/actLog.ts'
import { createWorldExecutors } from '../src/main/actExecutors.ts'

const env = probeEnv()
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const raw = createJournal(db)
const journal = createDesktopJournal(raw)

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const check = (cond, m, detail) => (cond ? ok(m) : fail(m + (detail === undefined ? '' : ' — ' + JSON.stringify(detail))))

const ESTATE = randomUUID()
const P = randomUUID(), Q = randomUUID()
const system = { kind: 'system', id: 'acts-probe' }
const OPERATOR = { kind: 'person', id: 'operator' }
const ev = (type, payload, projectId = P, actor = system) => raw.append({ estateId: ESTATE, type, actor, projectId, payload })

await ev('estate.created@1', { name: 'acts probe' }, undefined)
await ev('project.created@1', { id: P, name: 'Проект' })
await ev('project.created@1', { id: Q, name: 'Другой' }, Q)

const store = createScopedStore(db, { kind: 'estate', estateId: ESTATE })
let live = true
const world = createWorldExecutors({
  store, journal, estateId: ESTATE, actor: OPERATOR, rpc: (name, args) => db.rpc(name, args),
  sessionLive: () => live, pathExists: () => true, newId: () => randomUUID(), now: () => Date.now()
})
const lost = []
const acts = createActs({ log: createActLog({ journal, store, estateId: ESTATE }), actor: OPERATOR, executors: world, onRecordFailed: (k, e) => lost.push([k, e.message]) })

const one = async (table, columns, col, id) => (await db.from(table).select(columns).eq(col, id).maybeSingle()).data
const journalCount = async (type) => (await db.from('journal').select('seq', { count: 'exact', head: true }).eq('estate_id', ESTATE).eq('type', type)).count
const recorded = async () => (await db.from('journal').select('seq,actor,payload,project_id').eq('estate_id', ESTATE).eq('type', 'act.recorded@1').order('seq')).data

// ── 1 · a task moved, and moved back ──────────────────────────────────────────────────────────────────────
const T = randomUUID(), T2 = randomUUID()
await ev('task.created@1', { id: T, title: 'Сборка на macOS', instruction: 'build it' })
await ev('task.created@1', { id: T2, title: 'Закрыть', instruction: 'close it' })
const t0 = (await one('project_tasks', 'status', 'id', T)).status
const moved = await acts.perform('task.move', { task_id: T, to: 'running' })
check(moved.ok && (await one('project_tasks', 'status', 'id', T)).status === 'running', 'the person moves a task: it is in the new column at once', moved)
const unmoved = await acts.undo(moved.seq)
check(unmoved.ok && (await one('project_tasks', 'status', 'id', T)).status === t0, 'undo moves it back to where it was', unmoved)
const removed = await acts.undo(unmoved.seq)
check(removed.ok && (await one('project_tasks', 'status', 'id', T)).status === 'running', 'the undo can be undone: the task is moved again', removed)
check((await journalCount('task.moved@1')) === 3, 'three task.moved@1 are in the journal: the move, its reversal and its redo', await journalCount('task.moved@1'))
{
  const rows = (await recorded()).filter((r) => r.payload.kind === 'task.move')
  check(rows.length === 3 && rows.every((r) => r.actor.kind === 'person' && r.project_id === P), 'three act records, each with the person as actor and the project')
  check(rows[1].payload.undoes === moved.seq && rows[2].payload.undoes === unmoved.seq && rows[0].payload.undoes === null, 'each reversal names the act it reverses')
}
const seqMove = (await acts.perform('task.move', { task_id: T, to: 'review' })).seq
await ev('task.moved@1', { task_id: T, from: 'review', to: 'running' }, P, { kind: 'agent', id: 'codex' })   // another agent moved it back since
{
  const view = (await acts.history({ category: 'tasks', limit: 1 })).rows[0]
  check(view.seq === seqMove && view.undo.state === 'cannot' && view.undo.why === 'already_there', 'the task is already where an undo would put it: nothing to undo, and it says so', view.undo)
}
await ev('task.moved@1', { task_id: T, from: 'running', to: 'backlog' }, P, { kind: 'agent', id: 'codex' })     // and then somewhere else
{
  const view = (await acts.history({ category: 'tasks', limit: 1 })).rows[0]
  check(view.seq === seqMove && view.undo.state === 'available' && view.undo.changedSince === 'backlog', 'moved elsewhere since: the undo says where the task is now', view.undo)
}
const closed = await acts.perform('task.move', { task_id: T2, to: 'done' })
const refusedClosed = await acts.undo(closed.seq)
check(closed.ok && refusedClosed.ok === false && refusedClosed.reason === 'task_closed', 'a move into done cannot be undone: a closed task does not reopen, and the act says why', refusedClosed)
const ladder = await acts.perform('task.move', { task_id: T2, to: 'running' })
check(ladder.ok === false && ladder.reason === 'ladder' && /closed/.test(ladder.says), 'the ladder refuses a move out of a closed state, with its own sentence', ladder)

// ── 2 · a folder detached, and attached again ─────────────────────────────────────────────────────────────
const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-acts-')))
const attached = await acts.perform('repo.attach', { project_id: P, path: dir, label: 'api' })
const R = attached.outcome.subject.id
check(attached.ok && (await one('project_repos', 'id,path,label', 'id', R))?.path === dir, 'the person attaches a folder', attached)
const clash = await acts.perform('repo.attach', { project_id: Q, path: dir })
check(clash.ok === false && clash.reason === 'held_by_other_project', 'another project holding the folder refuses a second attach (REQ-04)', clash)
const detached = await acts.perform('repo.detach', { repo_id: R })
check(detached.ok && (await one('project_repos', 'id', 'id', R)) === null, 'the person detaches it: gone at once', detached)
const back = await acts.undo(detached.seq)
const row = await one('project_repos', 'id,path,label,project_id', 'id', R)
check(back.ok && row?.path === dir && row?.label === 'api' && row?.project_id === P, 'undo attaches the same folder again, under the same id and name', { back, row })
const gone = await acts.undo(back.seq)
check(gone.ok && (await one('project_repos', 'id', 'id', R)) === null, 'the undo can be undone: detached again', gone)
{
  const rows = (await recorded()).filter((r) => r.payload.category === 'folders')
  check(rows.length === 4 && rows.map((r) => r.payload.kind).join() === 'repo.attach,repo.detach,repo.attach,repo.detach', 'attach, detach, attach again, detach again: four acts in the journal', rows.map((r) => r.payload.kind))
  check(rows[2].payload.undoes === detached.seq && rows[3].payload.undoes === back.seq, 'the second pair names the first')
}
const missing = await acts.undo(back.seq)
check(missing.ok === false && missing.reason === 'already_undone', 'an act already undone is not undone twice', missing)

// ── 3 · a claim released, and taken again ─────────────────────────────────────────────────────────────────
const SESSION = randomUUID(), CLAIM = randomUUID(), T3 = randomUUID()
await ev('task.created@1', { id: T3, title: 'Заявка', instruction: 'claim me' })
await ev('work.claimed@1', { work: T3, owner: SESSION, idempotency_key: `probe:${SESSION}`, expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  write_scopes: ['src/'], claim_id: CLAIM, agent: 'claude-code', came_in: 'enrolled' }, P, { kind: 'agent', id: SESSION })
check((await one('work_claims', 'released_at', 'id', CLAIM))?.released_at === null, 'the claim stands (the probe made it as the agent)')
const released = await acts.perform('claim.release', { claim_id: CLAIM })
const releasedRow = await one('work_claims', 'released_at,released_how,released_by', 'id', CLAIM)
check(released.ok && releasedRow.released_at && releasedRow.released_how === 'operator' && releasedRow.released_by.kind === 'person', 'the person releases the claim at once, as themselves', { released, releasedRow })
live = false
const noOwner = await acts.undo(released.seq)
check(noOwner.ok === false && noOwner.reason === 'owner_gone', 'taking it again needs its owner: a session that has ended says so and changes nothing', noOwner)
live = true
const taken = await acts.undo(released.seq)
const { data: heldNow } = await db.from('work_claims').select('id,owner_session,agent,touches,released_at').eq('estate_id', ESTATE).eq('work_id', T3).is('released_at', null)
check(taken.ok && heldNow.length === 1 && heldNow[0].owner_session === SESSION && heldNow[0].agent === 'claude-code' && heldNow[0].touches.join() === 'src/' && heldNow[0].id !== CLAIM,
  'undo takes the claim again for the same session, agent and files', { taken, heldNow })
const reReleased = await acts.undo(taken.seq)
check(reReleased.ok && (await one('work_claims', 'released_at', 'id', heldNow[0].id)).released_at, 'the undo can be undone: released again', reReleased)
// another agent takes the task meanwhile: the old claim cannot be taken again over it
const OTHER = randomUUID()
await ev('work.claimed@1', { work: T3, owner: OTHER, idempotency_key: `probe:${OTHER}`, expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  write_scopes: [], claim_id: randomUUID(), agent: 'codex', came_in: 'enrolled' }, P, { kind: 'agent', id: OTHER })
const held = await acts.undo(reReleased.seq)
check(held.ok === false && held.reason === 'held_by_other', 'a task another agent holds now is not taken over by an undo', held)

// ── 4 · a project renamed, and its name given back ────────────────────────────────────────────────────────
const renamed = await acts.perform('project.rename', { project_id: Q, name: 'Новое имя', purpose: 'про что' })
const afterRename = await one('projects', 'name,purpose', 'id', Q)
check(renamed.ok && afterRename.name === 'Новое имя' && afterRename.purpose === 'про что', 'the person renames a project and sets its purpose', afterRename)
const named = await acts.undo(renamed.seq)
const afterUndo = await one('projects', 'name,purpose', 'id', Q)
check(named.ok && afterUndo.name === 'Другой' && afterUndo.purpose === null, 'undo gives the old name and the old purpose back', afterUndo)
const renamedAgain = await acts.undo(named.seq)
check(renamedAgain.ok && (await one('projects', 'name', 'id', Q)).name === 'Новое имя', 'the undo can be undone: the new name again', renamedAgain)
await ev('project.updated@1', { id: Q, name: 'Третье' }, Q, { kind: 'agent', id: 'codex' })
{
  const view = (await acts.history({ projectId: Q, limit: 1 })).rows[0]
  check(view.undo.state === 'available' && view.undo.changedSince === 'Третье', 'renamed again since: the undo says what the name is now', view.undo)
}

// ── 5 · an answered question reopened ─────────────────────────────────────────────────────────────────────
const T4 = randomUUID(), QU = randomUUID()
await ev('task.created@1', { id: T4, title: 'Ждёт ответа', instruction: 'blocked' })
await ev('question.asked@1', { id: QU, project_id: P, text: 'Какой контекст?', kind: 'decision', options: [], blocks: [T4] }, P, { kind: 'agent', id: 'codex' })
check((await one('project_tasks', 'blocked_by', 'id', T4)).blocked_by === QU, 'the question blocks the task')
const answer = await db.rpc('answer_question', { p_estate_id: ESTATE, p_project_id: P, p_question_id: QU, p_command_id: randomUUID(), p_expected_revision: 1,
  p_answer: 'Первый', p_chosen_option: null, p_basis: null, p_actor: OPERATOR })
check(!answer.error && (await one('questions', 'status', 'id', QU)).status === 'answered' && (await one('project_tasks', 'blocked_by', 'id', T4)).blocked_by === null, 'the person answers: the question is settled and the task is free', answer.error)
const answered = await acts.note({ kind: 'question.answer', projectId: P, refSeq: answer.data.answered_seq, subject: { type: 'question', id: QU, label: 'Какой контекст?' },
  said: { key: 'act.question.answer', params: { question: 'Какой контекст?', answer: 'Первый' } }, inverse: { kind: 'question.reopen', args: { question_id: QU } } })
const reopened = await acts.undo(answered.seq)
const q = await one('questions', 'status,answer,answered_by,decision_id,revision', 'id', QU)
check(reopened.ok && q.status === 'open' && q.answer === null && q.answered_by === null && q.decision_id === null && q.revision === 2, 'undo takes the answer back: the question is open again under a new revision', { reopened, q })
check((await one('project_tasks', 'blocked_by', 'id', T4)).blocked_by === QU, 'and what it blocked is blocked again')
check((await journalCount('question.answered@1')) === 1 && (await journalCount('question.answer_withdrawn@1')) === 1, 'the answer and its withdrawal are both in the journal')
const stale = await db.rpc('answer_question', { p_estate_id: ESTATE, p_project_id: P, p_question_id: QU, p_command_id: randomUUID(), p_expected_revision: 1,
  p_answer: 'опоздал', p_chosen_option: null, p_basis: null, p_actor: OPERATOR })
check(stale.error && /revision/.test(stale.error.message), 'a screen that still holds the old revision cannot answer blind', stale.error?.message)
const second = await db.rpc('answer_question', { p_estate_id: ESTATE, p_project_id: P, p_question_id: QU, p_command_id: randomUUID(), p_expected_revision: 2,
  p_answer: 'Второй', p_chosen_option: null, p_basis: null, p_actor: OPERATOR })
check(!second.error && (await one('questions', 'answer', 'id', QU)).answer === 'Второй', 'a reopened question is answered again, with a new decision', second.error)
const noRedo = await acts.undo(reopened.seq)
check(noRedo.ok === false && noRedo.reason === 'answer_needs_person', 'the reopening is not redone by Fabric: an answer is the person\'s own words, and the act says so', noRedo)
const notAnswered = await acts.perform('question.reopen', { question_id: randomUUID() })
check(notAnswered.ok === false && notAnswered.reason === 'question_gone', 'a question that does not exist is refused')

// ── 6 · История's read ────────────────────────────────────────────────────────────────────────────────────
const all = await acts.history({ limit: 100 })
const kinds = new Set(all.rows.map((r) => r.record.kind))
check(['task.move', 'repo.attach', 'repo.detach', 'claim.release', 'claim.take', 'project.rename', 'question.answer', 'question.reopen'].every((k) => kinds.has(k)),
  'the read holds every kind of act, newest first', [...kinds])
check(all.rows.every((r, i) => i === 0 || r.seq < all.rows[i - 1].seq) && all.rows.every((r) => r.actor.kind === 'person'), 'newest first, each with its actor')
const page1 = await acts.history({ limit: 5 }), page2 = await acts.history({ limit: 5, before: page1.next })
check(page1.rows.length === 5 && page1.next !== null && page2.rows[0].seq < page1.rows.at(-1).seq, 'it is paged by a cursor, with nothing repeated', { next: page1.next })
check((await acts.history({ category: 'folders' })).rows.every((r) => r.record.category === 'folders'), 'filtered by what the act was about')
check((await acts.history({ projectId: Q })).rows.every((r) => r.projectId === Q), 'filtered by project')
check((await acts.history({ actorKind: 'agent' })).rows.length === 0 && (await acts.history({ actorKind: 'person' })).rows.length === all.rows.length, 'filtered by who did it')
check((await acts.history({ text: 'macOS' })).rows.length > 0 && (await acts.history({ text: 'нет-такого' })).rows.length === 0 && (await acts.history({ text: '%' })).rows.length === 0, 'filtered by words in the name, with % and _ meaning themselves')
const firstMove = all.rows.find((r) => r.seq === moved.seq)
check(all.rows.every((r) => ['available', 'undone', 'cannot'].includes(r.undo.state)) && firstMove.undo.state === 'cannot' && firstMove.undo.why === 'already_there', 'every act carries its undo state (the first move: the task is already back where an undo would put it)', firstMove.undo)
check(lost.length === 0, 'no act record failed to write', lost)

if (failures) { console.log(`\nFAIL ${failures} check(s)`); process.exit(1) }
console.log('\nPASS acts: every act done, undone and redone against the real journal, projectors and commands')
