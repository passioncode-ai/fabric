// A restore, on a disposable database, because that is the only place it can happen (FA-06).
//
// WHY NOT BESIDE THE SOURCE. Projection rows are keyed by the ENTITY'S OWN id,
// globally rather than per estate, so a copy standing beside its original
// collides with it row for row — and nothing the product exposes can clear the
// original's projections: `rebuild_estate_projections` is an upsert-replay whose
// own comment says orphan removal is out of scope, and the projection tables
// grant DELETE to nobody, correctly, because only the projector writes them.
//
// Measured 2026-09-10, before `restore_estate` checked for it: a restore beside
// its source answered `restored: true, events: 2` and produced an estate holding
// nothing at all. The collision is now a refusal that rolls back. This probe is
// the other half — proof that when the ids ARE free, the replay reproduces the
// record exactly, including the four categories the declared mirror never
// carried: goals, questions, routines and the tasks themselves.
//
// The card says to run it on a disposable database and NOT to reset the working
// one. So: a database created here, migrated here, and dropped here. The source
// estate lives in the working database and is removed at the end; nothing else
// is touched.

import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { probeEnv } from '../../../scripts/lib/test-stack.mjs'

// Read from the scope map rather than listed here: a table added tomorrow joins
// the comparison without anyone remembering to add it (the same rule
// `declaredCoverage` and `check-scope.mjs` already run on).
const TABLES = Object.keys(
  (await import(path.resolve(import.meta.dirname, '../../../apps/desktop/src/shared/scope.ts'))).TABLE_SCOPE
).filter((t) => t !== 'journal')

let SCOPED = []

// The disposable stack the tier started; probeEnv() refuses the live one (54322) before connecting.
const ADMIN = probeEnv().DATABASE_URL
const MIGRATIONS = path.resolve(import.meta.dirname, '../../../supabase/migrations')
const nameFor = () => 'fabric_restore_probe_' + randomUUID().replace(/-/g, '').slice(0, 12)
const DISPOSABLE = nameFor()
const SECOND = nameFor()

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.error('  FAIL ' + m) }

const admin = new pg.Client({ connectionString: ADMIN })
await admin.connect()

// A database of its own. `create database` cannot run inside a transaction, and
// the client is not in one here.
const urlFor = (db) => ADMIN.replace(/\/[^/]*$/, '/' + db)
await admin.query(`create database ${DISPOSABLE}`)
const targetUrl = urlFor(DISPOSABLE)

// The ONE thing the platform provides that a bare database does not: `auth.uid()`,
// which the RLS policies call. Stubbed to null rather than faked to a person —
// a restore target has no authenticated user, which is exactly what null means,
// and a shim returning an id would grant the policies to somebody who is not there.
const AUTH_SHIM = [
  'create schema if not exists auth',
  'create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$',
  // And the migration LEDGER the platform keeps. `schema_version()` reads it to
  // answer which schema an estate is at, so a database without it cannot be
  // asked the question every build asks before it opens a writer.
  'create schema if not exists supabase_migrations',
  'create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)'
]

let target
let twin
try {
  const migrate = (url) => {
    for (const stmt of AUTH_SHIM)
      execFileSync('psql', [url, '-q', '-v', 'ON_ERROR_STOP=1', '-c', stmt],
        { stdio: ['ignore', 'ignore', 'pipe'] })
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
      execFileSync('psql', [url, '-q', '-v', 'ON_ERROR_STOP=1', '-f', path.join(MIGRATIONS, file)],
        { stdio: ['ignore', 'ignore', 'pipe'] })
      // Recorded as applied, exactly as the platform would: a restore target
      // whose ledger is empty would report schema 0 and refuse every writer.
      execFileSync('psql', [url, '-q', '-v', 'ON_ERROR_STOP=1', '-c',
        `insert into supabase_migrations.schema_migrations (version, name) values ('${file.split('_')[0]}', '${file}') on conflict do nothing`],
        { stdio: ['ignore', 'ignore', 'pipe'] })
    }
  }
  migrate(targetUrl)
  ok('a disposable database is created and every migration applies to it in order')

  target = new pg.Client({ connectionString: targetUrl })
  await target.connect()

  // Which of them actually carry an estate_id, MEASURED rather than assumed —
  // `persons` and `event_types` are scoped by the auth plane and by the schema,
  // not by an estate, and asking them narrows nothing.
  const { rows: scoped } = await admin.query(
    `select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'estate_id' and table_name = any($1)`,
    [TABLES]
  )
  SCOPED = scoped.map((r) => r.table_name).sort()

  // ── the source, in the WORKING database, with what the mirror cannot carry ──
  const SOURCE = randomUUID()
  const project = randomUUID(), taskA = randomUUID(), goal = randomUUID(), question = randomUUID()
  // `agent` rather than `system`: the questions projection takes `asked_by_kind`
  // from the actor and the column only accepts agent or person.
  const actor = JSON.stringify({ kind: 'agent', id: 'restore-probe' })
  const ev = (type, payload, proj) =>
    admin.query("select append_event($1,$2,$3::jsonb,$4::jsonb,'1',$5)",
      [SOURCE, type, actor, JSON.stringify(payload), proj ?? null])

  await ev('project.created@1', { id: project, name: 'the estate being archived' }, project)
  await ev('task.created@1',
    { id: taskA, title: 'a task the mirror would lose', instruction: 'do it',
      origin: { kind: 'person', ref: 'probe' } }, project)
  await ev('task.note.added@1', { note_id: randomUUID(), task_id: taskA, body_md: 'a note' }, project)
  await ev('goal.defined@1', { id: goal, title: 'a goal', autonomy: 'safe' }, project)
  await ev('question.asked@1',
    { id: question, project_id: project, task_id: taskA, text: 'which way',
      why_blocked: 'nothing can proceed', kind: 'decision', blocks: [] }, project)

  const shapeOf = async (client, estate) => {
    const out = {}
    // EVERY table the replay writes, not a chosen five. The one difference this
    // probe found was a single column on a single table — `goals.created_at`
    // fell back to `default now()` and dated a restored goal at the moment of
    // the restore — and a fixed list is how the next one of those goes unseen.
    for (const t of SCOPED) {
      const { rows } = await client.query(
        `select * from ${t} where estate_id = $1 order by 1`, [estate])
      out[t] = rows.map((r) => JSON.stringify(Object.entries(r)
        .filter(([k]) => k !== 'estate_id').sort()))
    }
    return out
  }
  const sourceShape = await shapeOf(admin, SOURCE)
  const carried = ['project_tasks', 'goals', 'questions'].every((t) => sourceShape[t].length === 1)
  carried
    ? ok('the source holds a task, a goal and a question — three categories the declared mirror does NOT carry')
    : fail('the source fixture is incomplete: ' + JSON.stringify(Object.entries(sourceShape).map(([k, v]) => [k, v.length])))

  // ── the archive, in the same shape backup.ts writes ─────────────────────────
  const { rows: events } = await admin.query(
    `select seq, type, schema_rev, actor, project_id, run_id, node_id, payload, occurred_at
       from journal where estate_id = $1 order by seq`, [SOURCE])

  // ── restore into the clean database, where the ids are free ─────────────────
  const RESTORED = randomUUID()
  const { rows: [receipt] } = await target.query(
    'select restore_estate($1,$2,$3,$4::jsonb) as r',
    [RESTORED, SOURCE, 'restored', JSON.stringify(events)])
  receipt.r.restored === true && receipt.r.events === events.length
    ? ok('the archive replays into a clean database, every event of it')
    : fail('restore: ' + JSON.stringify(receipt.r))

  const restoredShape = await shapeOf(target, RESTORED)
  JSON.stringify(restoredShape) === JSON.stringify(sourceShape)
    ? ok('and the projections it rebuilt are identical to the source — tasks, notes, goals and questions')
    : fail('the restore differs: ' + (() => {
        for (const t of Object.keys(sourceShape)) {
          if (sourceShape[t].length !== restoredShape[t].length)
            return t + ' has ' + sourceShape[t].length + ' rows at the source and ' + restoredShape[t].length + ' restored'
          for (let i = 0; i < sourceShape[t].length; i++)
            if (sourceShape[t][i] !== restoredShape[t][i]) {
              const a = JSON.parse(sourceShape[t][i]), b = JSON.parse(restoredShape[t][i])
              const cols = a.filter(([k, v], n) => JSON.stringify(v) !== JSON.stringify(b[n]?.[1]))
                .map(([k, v], n) => k + ': ' + JSON.stringify(v) + ' -> ' + JSON.stringify(b.find((x) => x[0] === k)?.[1]))
              return t + ' row ' + i + ': ' + cols.join('; ')
            }
        }
        return 'no difference found, which means the comparison is wrong'
      })())

  // ── twice, and the identities do not move ──────────────────────────────────
  const AGAIN = randomUUID()
  const second = new pg.Client({ connectionString: targetUrl })
  await second.connect()
  // The SECOND restore into the SAME database collides, and says so: one
  // database holds one copy of an estate's entities, because projection rows are
  // keyed by the entity id globally.
  let collided = null
  try {
    const { rows: [r2] } = await second.query(
      'select restore_estate($1,$2,$3,$4::jsonb) as r',
      [AGAIN, SOURCE, 'restored again', JSON.stringify(events)])
    collided = r2.r
  } catch (e) {
    collided = { raised: String(e.message ?? e) }
  }
  collided?.raised?.includes('collided') || collided?.restored === false
    ? ok('a second restore into the same database is refused rather than half-applied')
    : fail('a second restore into one database succeeded: ' + JSON.stringify(collided))

  const { rows: [left] } = await target.query(
    'select count(*)::int as n from journal where estate_id = $1', [AGAIN])
  left.n === 0
    ? ok('and the refusal rolled back — the target estate holds nothing at all')
    : fail('a refused restore left ' + left.n + ' events behind')
  await second.end().catch(() => {})

  // AND THE ACCEPTANCE ITSELF: restore the same archive a second time, into a
  // second clean database, and the identities and revisions must be the same.
  // One database cannot answer this — the ids are taken after the first restore
  // — so the question is asked where it can be.
  await admin.query(`create database ${SECOND}`)
  migrate(urlFor(SECOND))
  twin = new pg.Client({ connectionString: urlFor(SECOND) })
  await twin.connect()
  const TWIN_ESTATE = randomUUID()
  const { rows: [r3] } = await twin.query(
    'select restore_estate($1,$2,$3,$4::jsonb) as r',
    [TWIN_ESTATE, SOURCE, 'restored elsewhere', JSON.stringify(events)])
  const twinShape = await shapeOf(twin, TWIN_ESTATE)
  // Estate ids differ by construction and are excluded from the shape; what must
  // match is every identity, every revision and every recorded moment.
  r3.r.restored === true && JSON.stringify(twinShape) === JSON.stringify(restoredShape)
    ? ok('restored twice, into two clean databases, the identities and revisions are identical')
    : fail('two restores differ: ' + JSON.stringify(r3.r))

  // ── nothing that could act travels ─────────────────────────────────────────
  for (const t of ['grants', 'memberships', 'leases']) {
    const { rows } = await target.query(`select count(*)::int as n from ${t} where estate_id = $1`, [RESTORED])
    if (rows[0].n !== 0) fail(`${t} reached the restored estate: ${rows[0].n} row(s)`)
  }
  ok('the restored estate holds no grant, no membership and no lease')

  await admin.query('delete from journal where estate_id = $1', [SOURCE])
} finally {
  if (target) await target.end().catch(() => {})
  if (twin) await twin.end().catch(() => {})
  for (const db of [DISPOSABLE, SECOND])
    await admin.query(`drop database if exists ${db} with (force)`)
  await admin.end().catch(() => {})
}

console.log(failures ? `\n  FAIL ${failures} failure(s)` : '\nall green')
process.exit(failures ? 1 : 0)
