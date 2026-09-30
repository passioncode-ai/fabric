// A backup that can be called one, and a restore that cannot destroy anything (FA-06).
//
// THE CARD FORBIDS RESETTING THE WORKING DATABASE FOR A TEST, and it is right to:
// a probe that proves a restore by wiping the estate has proved the wipe. So
// every estate here is minted fresh, nothing shared is touched, and the restore
// target is a new id every time — which is also the mechanism under test, since
// a restore into a NEW estate is what fences old leases and old grants out.
//
// MEASURED BEFORE THIS: `storageContract.ts` already refused to call the
// declared mirror a backup and named the absences — two of thirty-odd tables,
// with `goals`, `questions`, `routines` and the tasks themselves outside it.
// That honesty is why this is additive. What did not exist was an archive, a
// verification of one, or a restore that could be trusted not to merge.
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const HERE = import.meta.dirname
const script = `
import { createClient } from '@supabase/supabase-js'
import { createJournal } from ${JSON.stringify(path.join(HERE, '../../../packages/journal/src/index.ts'))}
import { createBackups } from ${JSON.stringify(path.join(HERE, '../src/main/backup.ts'))}
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import nodePath from 'node:path'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const journal = createJournal(db)
const backups = createBackups(db)
const ACTOR = { kind: 'system', id: 'backup-probe' }

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const temp = () => mkdtempSync(nodePath.join(tmpdir(), 'fa06-'))
const made = []

// A source estate with work in it: a project, tasks, a goal, a question, a
// routine — the four categories the declared mirror does NOT carry, so a restore
// that reproduces them is doing the thing the mirror could not.
const SOURCE = randomUUID()
const P = randomUUID()
await journal.append({ estateId: SOURCE, type: 'project.created@1', actor: ACTOR, projectId: P,
  payload: { id: P, name: 'the estate being archived' } })
const A = randomUUID(), B = randomUUID()
for (const [id, title] of [[A, 'first task'], [B, 'second task']])
  await journal.append({ estateId: SOURCE, type: 'task.created@1', actor: ACTOR, projectId: P,
    payload: { id, title, instruction: title, origin: { kind: 'person', ref: 'probe' } } })
await journal.append({ estateId: SOURCE, type: 'task.note.added@1', actor: ACTOR, projectId: P,
  payload: { note_id: randomUUID(), task_id: A, body_md: 'a note the mirror would lose' } })

const projectionsOf = async (estate) => {
  const out = {}
  for (const t of ['project_tasks', 'task_notes', 'projects']) {
    const { data } = await db.from(t).select('*').eq('estate_id', estate)
    out[t] = (data ?? []).map((r) => JSON.stringify(Object.entries(r).filter(([k]) => k !== 'estate_id').sort())).sort()
  }
  return JSON.stringify(out)
}

// ── 1 · an archive is taken, and it verifies ────────────────────────────────
const dir = temp(); made.push(dir)
{
  const r = await backups.take(SOURCE, dir)
  const v = backups.verify(dir)
  r.ok && v.ok && r.manifest.eventCount === 4 && r.manifest.watermarkSeq === 4
    ? ok('an archive is taken with a watermark and an event count, and it verifies against itself')
    : fail('take/verify: ' + JSON.stringify(r) + ' / ' + JSON.stringify(v))
}

// ── 2 · a CORRUPT archive changes nothing, because it is refused first ──────
{
  const before = await projectionsOf(SOURCE)
  const bad = temp(); made.push(bad)
  await backups.take(SOURCE, bad)
  const body = nodePath.join(bad, 'journal.ndjson')
  const text = readFileSync(body, 'utf8')
  // Altered UNCONDITIONALLY. The first attempt replaced a phrase that happened
  // not to be on the line it edited, so the archive was untouched and the case
  // passed against a defect it had not produced.
  writeFileSync(body, text.replace('probe', 'prube'))
  if (readFileSync(body, 'utf8') === text) fail('the corruption case did not alter the archive')
  const v = backups.verify(bad)
  const restored = await backups.restore({ dir: bad, intoEstateId: randomUUID() })
  const after = await projectionsOf(SOURCE)
  !v.ok && v.why === 'corrupt' && !restored.ok && restored.reasonCode === 'corrupt' && before === after
    ? ok('an altered archive is refused as corrupt, and the working estate is byte-identical afterwards')
    : fail('corrupt: ' + JSON.stringify(v) + ' / ' + JSON.stringify(restored))
}

// ── 3 · a TRUNCATED archive says the copy did not finish ────────────────────
{
  const cut = temp(); made.push(cut)
  await backups.take(SOURCE, cut)
  const body = nodePath.join(cut, 'journal.ndjson')
  const lines = readFileSync(body, 'utf8').replace(/\\n$/, '').split('\\n')
  writeFileSync(body, lines.slice(0, 2).join('\\n') + '\\n')
  const v = backups.verify(cut)
  !v.ok && v.why === 'truncated'
    ? ok('a short archive is TRUNCATED, not corrupt — a different failure with a different remedy')
    : fail('truncated: ' + JSON.stringify(v))
}

// ── 4 · a restore beside its source is REFUSED, and says why ───────────────
//
// Every projection table is keyed by the ENTITY'S OWN id, globally rather than
// per estate, so a copy standing beside its original collides with it row for
// row. Measured 2026-09-10: before this check the restore answered restored
// true with two events and produced an estate holding nothing at all —
// and the "two restores are identical" case below passed because both were
// empty. A success that produces nothing is the worst answer available.
{
  const beside = await backups.restore({ dir, intoEstateId: randomUUID() })
  !beside.ok && beside.reasonCode === 'collides'
    ? ok('a restore standing beside its source is refused, naming the collision rather than producing an empty estate')
    : fail('restoring beside the source: ' + JSON.stringify(beside))

  const orphan = (await db.from('projects').select('id').eq('estate_id', SOURCE)).data ?? []
  orphan.length === 1
    ? ok('and the refusal rolled back — the source estate is untouched')
    : fail('the source lost projections to a refused restore: ' + orphan.length)
}

// ── 5 · the round trip preserves the record exactly ────────────────────────
//
// A CONTENT restore cannot be demonstrated on a database that already holds the
// source, and that is not a limitation of this probe: projection rows are keyed
// by the entity's own id GLOBALLY, and nothing the product exposes can clear
// them — rebuild_estate_projections is an upsert-replay whose own comment says
// orphan removal is out of scope, and the projection tables grant no DELETE to
// anyone, correctly, because only the projector writes them.
//
// So the content path is proved where the card says to prove it — on a
// disposable database, in packages/schema/test/restore-disposable.test.mjs.
// What is proved HERE is the property that needs no free ids: the archive is a
// faithful, byte-stable rendering of the record, so a restore has the whole of
// it to work from.
{
  const second = temp(); made.push(second)
  const again = await backups.take(SOURCE, second)
  const first = readFileSync(nodePath.join(dir, 'journal.ndjson'), 'utf8')
  const body = readFileSync(nodePath.join(second, 'journal.ndjson'), 'utf8')
  again.ok && body === first && again.manifest.digest === (backups.verify(dir).ok ? JSON.parse(readFileSync(nodePath.join(dir, 'manifest.json'), 'utf8')).digest : null)
    ? ok('archiving the same estate twice produces identical bytes and an identical digest')
    : fail('two archives of one estate differ')
}

// ── 6 · a restore never merges, and never writes back ───────────────────────
{
  const busy = randomUUID()
  await journal.append({ estateId: busy, type: 'project.created@1', actor: ACTOR, projectId: randomUUID(),
    payload: { id: randomUUID(), name: 'already living here' } })
  const again = await backups.restore({ dir, intoEstateId: busy })
  !again.ok && again.reasonCode === 'not_empty'
    ? ok('restoring into an estate that already holds events is refused, not merged')
    : fail('a second restore into a live estate: ' + JSON.stringify(again))

  // Asserted on the code EXACTLY. Accepting either same_estate or not_empty
  // made this pass with the same-estate guard removed, because a live source is
  // also non-empty — a plant walked straight through it.
  const back = await backups.restore({ dir, intoEstateId: SOURCE })
  !back.ok && back.reasonCode === 'same_estate'
    ? ok('and a restore never writes back into the estate it came from, refused as that and not as something else')
    : fail('restoring into the source: ' + JSON.stringify(back))
}

// ── 7 · nothing the source could act with reaches the copy ──────────────────
{
  // Restored from an EMPTY archive, so the estate exists and holds nothing but
  // what a restore puts there — which is the question: does a restore carry
  // authority. The content case cannot run here (see above) and the authority
  // one does not need it.
  const fresh = randomUUID()
  const emptyDir = temp(); made.push(emptyDir)
  await backups.take(randomUUID(), emptyDir)
  await backups.restore({ dir: emptyDir, intoEstateId: fresh })
  const leases = (await db.from('leases').select('work_id').eq('estate_id', fresh)).data ?? []
  const grants = (await db.from('grants').select('id').eq('estate_id', fresh)).data ?? []
  const members = (await db.from('memberships').select('person_id').eq('estate_id', fresh)).data ?? []
  leases.length === 0 && grants.length === 0 && members.length === 0
    ? ok('the restored estate holds no lease, no grant and no membership — an old writer has nothing to act with')
    : fail('authority reached the copy: leases ' + leases.length + ', grants ' + grants.length + ', memberships ' + members.length)
}

// ── 8 · and the operator is told, beside the button, what will not come back ─
{
  const excluded = backups.excluded().map((c) => c.name)
  const inventory = backups.inventory()
  excluded.includes('grants') && excluded.includes('memberships') && excluded.includes('session-bundles')
    && inventory.every((c) => c.reason.length > 30)
    ? ok('every excluded category is listed with a reason, rather than discovered after a restore')
    : fail('exclusions: ' + JSON.stringify(excluded))
}

// ── 9 · an empty estate archives and restores as an empty one ───────────────
{
  const empty = randomUUID()
  const d = temp(); made.push(d)
  const r = await backups.take(empty, d)
  const v = backups.verify(d)
  const into = randomUUID()
  const back = await backups.restore({ dir: d, intoEstateId: into })
  r.ok && r.manifest.eventCount === 0 && v.ok && back.ok && back.events === 0
    ? ok('an estate with nothing in it archives and restores as one, rather than failing')
    : fail('empty estate: ' + JSON.stringify(r) + ' / ' + JSON.stringify(back))
}

for (const d of made) rmSync(d, { recursive: true, force: true })
await db.from('journal').delete().eq('estate_id', SOURCE)
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
