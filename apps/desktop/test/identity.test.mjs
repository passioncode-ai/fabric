// A subject is established, and a revoked one stops at the next write (FA-07 · S09).
//
// MEASURED at d28c321: the operator's identity had THREE definitions — the
// constant in `index.ts` and the same object written out twice in `pty.ts` — and
// membership was never consulted by the application at all, which connects as
// the service role. `check-actor.mjs` already refused an actor RECEIVED from a
// caller; nothing refused one INVENTED at a call site, and nothing checked that
// the person acting was still allowed to.
//
// THE GUARD IS AT THE WRITE. Retro-fitting a membership check into a hundred IPC
// handlers is a hundred places to forget one. Every person-actored event goes
// through the journal, so that is where it belongs — and a revoked membership
// then stops the NEXT write rather than the next restart.
//
// Fresh estates and fresh persons, cleaned up at the end. The working database
// is never reset.
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const HERE = import.meta.dirname
const script = `
import { createClient } from '@supabase/supabase-js'
import { createJournal } from ${JSON.stringify(path.join(HERE, '../../../packages/journal/src/index.ts'))}
import { createIdentity } from ${JSON.stringify(path.join(HERE, '../src/main/identity.ts'))}
import { randomUUID } from 'node:crypto'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const journal = createJournal(db)

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

const ESTATE = randomUUID(), OTHER = randomUUID()
const OWNER = randomUUID(), MEMBER = randomUUID(), OUTSIDER = randomUUID()
const project = randomUUID()

for (const [e, name] of [[ESTATE, 'the estate'], [OTHER, 'somewhere else']])
  await journal.append({ estateId: e, type: 'estate.created@1',
    actor: { kind: 'system', id: 'identity-probe' }, payload: { name } })
await journal.append({ estateId: ESTATE, type: 'project.created@1',
  actor: { kind: 'system', id: 'identity-probe' }, projectId: project,
  payload: { id: project, name: 'work' } })
const TASK = randomUUID()
await journal.append({ estateId: ESTATE, type: 'task.created@1',
  actor: { kind: 'system', id: 'identity-probe' }, projectId: project,
  payload: { id: TASK, title: 'a real task', instruction: 'a real task',
             origin: { kind: 'person', ref: 'probe' } } })

for (const [id, who] of [[OWNER, 'the owner'], [MEMBER, 'a member'], [OUTSIDER, 'a stranger']])
  await db.from('persons').insert({ id, display_name: who })
await db.from('memberships').insert([
  { person_id: OWNER, estate_id: ESTATE, role: 'owner', changed_by: 'probe' },
  { person_id: MEMBER, estate_id: ESTATE, role: 'member', changed_by: 'probe' },
  { person_id: OUTSIDER, estate_id: OTHER, role: 'owner', changed_by: 'probe' }
])

const identityFor = (person, estate) =>
  createIdentity({ db, estateId: estate ?? ESTATE, personId: person })

// ── 1 · a member of this estate is established; a stranger is not ───────────
{
  const owner = await identityFor(OWNER).establish()
  const member = await identityFor(MEMBER).establish()
  owner.ok && owner.subject.role === 'owner' && member.ok && member.subject.role === 'member'
    ? ok('an owner and a member are established, each with the role the estate records')
    : fail('roles: ' + JSON.stringify(owner) + ' / ' + JSON.stringify(member))

  const stranger = await identityFor(OUTSIDER).establish()
  !stranger.ok && stranger.why === 'not_a_member'
    ? ok('somebody who belongs to another estate is refused here')
    : fail('the outsider was established: ' + JSON.stringify(stranger))

  const ghost = await identityFor(randomUUID()).establish()
  !ghost.ok && ghost.why === 'no_such_person'
    ? ok('and a person who does not exist is refused as that, not as a member')
    : fail('a non-existent person: ' + JSON.stringify(ghost))
}

// ── 2 · what a stranger is told is what a revoked member is told ────────────
{
  const gone = randomUUID()
  await db.from('persons').insert({ id: gone, display_name: 'was here' })
  await db.from('memberships').insert({ person_id: gone, estate_id: ESTATE, role: 'member', changed_by: 'probe' })
  const before = await identityFor(gone).establish()
  await db.from('memberships').delete().eq('person_id', gone).eq('estate_id', ESTATE)
  const after = await identityFor(gone).establish()
  const stranger = await identityFor(OUTSIDER).establish()
  before.ok && !after.ok && after.says === stranger.says
    ? ok('a revoked member is told exactly what a stranger is told — a refusal that differed would map the roster')
    : fail('revoked vs stranger: ' + JSON.stringify(after) + ' / ' + JSON.stringify(stranger))
}

// ── 3 · a revoked membership stops the NEXT write ──────────────────────────
{
  const who = randomUUID()
  await db.from('persons').insert({ id: who, display_name: 'briefly here' })
  await db.from('memberships').insert({ person_id: who, estate_id: ESTATE, role: 'member', changed_by: 'probe' })
  const id = identityFor(who)
  const established = await id.establish()
  const guarded = id.guarded(journal)

  let wroteWhileAllowed = false
  let firstError = null
  try {
    await guarded.append({ estateId: ESTATE, type: 'task.note.added@1', actor: id.actor(),
      projectId: project, payload: { note_id: randomUUID(), task_id: TASK, body_md: 'while allowed' } })
    wroteWhileAllowed = true
  } catch (e) {
    // READ, not swallowed. A bare catch here reported the symptom of a defect in
    // this probe as a defect in the product.
    firstError = String(e.message ?? e)
  }

  await db.from('memberships').delete().eq('person_id', who).eq('estate_id', ESTATE)

  let refused = null
  try {
    await guarded.append({ estateId: ESTATE, type: 'task.note.added@1', actor: id.actor(),
      projectId: project, payload: { note_id: randomUUID(), task_id: TASK, body_md: 'after revoke' } })
  } catch (e) { refused = String(e.message ?? e) }

  established.ok && wroteWhileAllowed && refused && refused.includes('identity boundary')
    ? ok('a person writes while a member and is refused at the very next write once revoked')
    : fail('revocation: established=' + established.ok + ' firstWrite=' + (firstError ?? 'ok') + ' afterRevoke=' + refused)
}

// ── 4 · authority that MOVED is refused, even when it did not disappear ─────
{
  const who = randomUUID()
  await db.from('persons').insert({ id: who, display_name: 'promoted' })
  await db.from('memberships').insert({ person_id: who, estate_id: ESTATE, role: 'member', changed_by: 'probe' })
  const id = identityFor(who)
  await id.establish()
  // Still a member, and a different one: the revision is what catches this.
  await db.from('memberships').update({ role: 'owner', changed_by: 'probe' })
    .eq('person_id', who).eq('estate_id', ESTATE)
  const guard = await id.guard()
  !guard.ok && guard.says.includes('authority moved')
    ? ok('a role changed under a live session is refused, not silently honoured')
    : fail('authority move: ' + JSON.stringify(guard))
}

// ── 5 · a system actor is not a person and is not checked ──────────────────
{
  const id = identityFor(OWNER)
  await id.establish()
  const guarded = id.guarded(journal)
  let wrote = false
  try {
    await guarded.append({ estateId: ESTATE, type: 'routine.paused@1',
      actor: { kind: 'system', id: 'routine-tick' }, projectId: project,
      payload: { id: randomUUID(), reason: 'nothing due', window: null } })
    wrote = true
  } catch { /* recorded below */ }
  wrote
    ? ok('a system actor writes without a membership, because it has none to revoke')
    : fail('a system write was refused at the identity boundary')
}

// ── 6 · nothing acts before a subject is established ───────────────────────
{
  const id = identityFor(OWNER)
  let threw = null
  try { id.actor() } catch (e) { threw = String(e.message ?? e) }
  threw && threw.includes('unidentified')
    ? ok('asking for an actor before one is established throws rather than inventing one')
    : fail('an actor was produced with nothing established: ' + threw)
}

// ── 7 · a brand new estate is created WITH an owner ────────────────────────
//
// MEASURED 2026-09-10, and it would have shipped: an estate created by the
// bootstrap got no membership at all, so the identity port could not establish a
// subject and a FRESH INSTALL WOULD NOT START. The full tier could not see it,
// because nothing there creates an estate through the path the application
// takes.
//
// A fixed id, because an estate keeps its last owner by design and a new estate
// per run would leak one for ever.
{
  const FRESH = '00000000-0000-0000-0000-0000000f0107'
  const founder = '00000000-0000-0000-0000-00000000000a'
  const existing = (await db.from('journal').select('seq', { count: 'exact', head: true })
    .eq('estate_id', FRESH).eq('type', 'estate.created@1')).count ?? 0
  if (existing === 0)
    await journal.append({ estateId: FRESH, type: 'estate.created@1',
      actor: { kind: 'system', id: 'identity-probe' },
      payload: { name: 'a fresh install', owner_person_id: founder } })
  const fresh = await createIdentity({ db, estateId: FRESH, personId: founder }).establish()
  fresh.ok && fresh.subject.role === 'owner'
    ? ok('an estate created with a founding owner resolves it — a fresh install starts')
    : fail('a fresh estate: ' + JSON.stringify(fresh))

  // And a legacy event that names nobody leaves it without one, VISIBLY, rather
  // than inventing an owner nobody appointed.
  //
  // A FRESH id for this one, unlike the case above. Migration 58 seeds the
  // operator into every estate that exists WHEN IT RUNS — correct for a database
  // where it runs once, and it means a fixed id here acquires a membership the
  // moment somebody re-applies the migration during development. The case then
  // reports the product inventing an owner when what happened is that the seed
  // caught a probe fixture. Measured 2026-09-10, in exactly that way.
  const LEGACY = randomUUID()
  await journal.append({ estateId: LEGACY, type: 'estate.created@1',
    actor: { kind: 'system', id: 'identity-probe' }, payload: { name: 'named nobody' } })
  const orphan = await createIdentity({ db, estateId: LEGACY, personId: founder }).establish()
  !orphan.ok && orphan.why === 'not_a_member'
    ? ok('and an estate whose creation named nobody says so at the boundary, rather than inventing an owner')
    : fail('a legacy estate invented an owner: ' + JSON.stringify(orphan))
  await db.from('journal').delete().eq('estate_id', LEGACY)
  await db.from('estates').delete().eq('id', LEGACY)
}

for (const e of [ESTATE, OTHER]) await db.from('journal').delete().eq('estate_id', e)
for (const p of [OWNER, MEMBER, OUTSIDER]) await db.from('persons').delete().eq('id', p)
console.log(failures ? '  FAIL ' + failures + ' failure(s)' : '\\nall green')
process.exit(failures ? 1 : 0)
`

const env = { ...process.env }
try {
  const out = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8', cwd: path.resolve(HERE, '../../..') })
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/)
    if (!m) continue
    if (m[1] === 'API_URL') env.SUPABASE_URL = m[2]
    if (m[1] === 'SERVICE_ROLE_KEY') env.SUPABASE_SERVICE_ROLE_KEY = m[2]
  }
} catch {
  console.log('  FAIL the local stack is not running — this probe asserts nothing without it (no skip, M110).')
  process.exit(1)
}
try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script],
    { encoding: 'utf8', env, cwd: path.resolve(HERE, '..') })
  process.stdout.write(out.split('\n').filter((l) => /^\s+(ok|FAIL)/.test(l)).join('\n') + '\n')
} catch (e) {
  process.stdout.write((e.stdout ?? '') + (e.stderr ?? ''))
  process.exit(1)
}
