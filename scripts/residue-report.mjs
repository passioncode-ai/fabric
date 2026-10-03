#!/usr/bin/env node
// #region residue-report — docs: README.md#test-residue-in-the-live-database
// What the database probes left in the operator's LIVE database before they were moved to a
// disposable stack (2026-10-03 release review, iteration 1, finding 2) — COUNTED, never removed.
//
//   node scripts/residue-report.mjs                 the live stack from supabase/config.toml
//   node scripts/residue-report.mjs --db-url <url>  another database
//   node scripts/residue-report.mjs --json          the same report, machine-readable
//
// READ-ONLY BY CONSTRUCTION, twice: the session runs with default_transaction_read_only=on, and
// the one statement runs inside `begin transaction read only … rollback`. Nothing here writes,
// and the script prints no DELETE: removing anything is the operator's decision, on their data.
//
// HOW A ROW IS RECOGNISED. Only by a marker a probe in this repository writes, each named with
// the file that writes it, so a row is never called residue because of a name a person might
// also choose. Three classes:
//   would_remove — the marker is certain: the estate was founded by a probe's system actor, or
//                  carries a probe's literal name and no journal at all; its projects; persons
//                  whose every membership is in such an estate, or who have none and carry a
//                  probe's literal name.
//   review       — made by a path a person also takes (the desktop bootstrap's "org #1", the
//                  launch fixture, a restore whose source still exists): listed, never counted
//                  as removable.
//   keep         — everything else, the seeded org #1 and the seeded operator included.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { liveStack } from './lib/test-stack.mjs'

// Actor ids written by `estate.created@1` / the first event of a probe estate, with their source.
export const PROBE_ACTORS = Object.freeze({
  'identity-probe': 'apps/desktop/test/identity.test.mjs',
  'planted-test': 'packages/schema/test/planted.test.mjs',
  'workspace-probe': 'apps/desktop/test/workspace.test.mjs',
  'backup-probe': 'apps/desktop/test/backup-restore.test.mjs',
  probe: 'apps/desktop/test/runtime-observer.test.mjs, task-link, insight-category, operating-surfaces'
})
// Estates inserted directly (no journal), by name.
export const PROBE_ESTATE_NAMES = Object.freeze({
  'membership probe': 'apps/desktop/test/membership.test.mjs',
  'roles probe': 'packages/schema/test/membership-roles.test.mjs'
})
// Persons the probes insert, by display name.
export const PROBE_PERSON_NAMES = Object.freeze({
  'a stranger': 'identity.test.mjs, membership-roles.test.mjs',
  'the owner': 'identity.test.mjs', 'a member': 'identity.test.mjs', promoted: 'identity.test.mjs',
  'briefly here': 'identity.test.mjs', 'was here': 'identity.test.mjs',
  A: 'planted.test.mjs', B: 'planted.test.mjs',
  Alice: 'membership.test.mjs', Bob: 'membership.test.mjs', Carol: 'membership.test.mjs',
  Dave: 'membership.test.mjs', Erin: 'membership.test.mjs',
  'owner a': 'membership-roles.test.mjs', 'owner b': 'membership-roles.test.mjs'
})
// Paths a person also takes; their rows are review, never removable.
export const REVIEW_ACTORS = Object.freeze({
  'desktop-bootstrap': 'apps/desktop/src/main/index.ts — the app founds "org #1" for a user-data folder with no estate (walks and the chat-activation native probe do this)',
  'launch-fixture': 'scripts/fixtures/launch-estate.sql — the screenshot fixture'
})
const SEED_ESTATE = '00000000-0000-0000-0000-000000000001'
const SEED_OPERATOR = '00000000-0000-0000-0000-000000000002'

const lit = v => `'${String(v).replace(/'/g, "''")}'`
const list = o => Object.keys(o).map(lit).join(', ')

export function reportSql() {
  return `
with first_event as (
  select distinct on (estate_id) estate_id, type, actor->>'id' as actor_id
  from journal order by estate_id, seq
),
classified as (
  select e.id, e.name, f.actor_id,
    case
      when e.id = '${SEED_ESTATE}' then 'keep'
      when f.actor_id in (${list(PROBE_ACTORS)}) then 'would_remove'
      when f.estate_id is null and e.name in (${list(PROBE_ESTATE_NAMES)}) then 'would_remove'
      when f.actor_id in (${list(REVIEW_ACTORS)}) then 'review'
      when f.estate_id is null and e.name ~ '^restored from [0-9a-f]{8}$' then 'review'
      when e.name ~ '^restored from [0-9a-f]{8}$' then 'review'
      when f.estate_id is null then 'review'
      else 'keep'
    end as class,
    case
      when e.id = '${SEED_ESTATE}' then 'the seeded org #1'
      when f.actor_id in (${list(PROBE_ACTORS)}) then 'founded by probe actor ' || f.actor_id
      when f.estate_id is null and e.name in (${list(PROBE_ESTATE_NAMES)}) then 'probe name, no journal: ' || e.name
      when f.actor_id in (${list(REVIEW_ACTORS)}) then 'founded by ' || f.actor_id
      when e.name ~ '^restored from [0-9a-f]{8}$' then 'a restore (made by backup-restore.test.mjs and by the app alike)'
      when f.estate_id is null then 'no journal and no probe name: ' || e.name
      else 'no probe marker'
    end as reason
  from estates e left join first_event f on f.estate_id = e.id
),
-- A restore is removable only when its source is itself removable or gone: the 8-hex prefix in
-- its name is the first 8 characters of the source estate id (apps/desktop/src/main/backup.ts).
restores as (
  select c.id,
    case when exists (
      select 1 from classified s where s.class <> 'would_remove' and s.id::text like substring(c.name from 15 for 8) || '%'
    ) then 'review' else 'would_remove' end as class
  from classified c where c.name ~ '^restored from [0-9a-f]{8}$' and c.id <> '${SEED_ESTATE}'
),
estate_class as (
  select c.id, c.name, coalesce(r.class, c.class) as class,
    case when r.class = 'would_remove' then 'a restore whose source estate is probe residue or gone' else c.reason end as reason
  from classified c left join restores r on r.id = c.id
),
person_class as (
  select p.id, p.display_name,
    case
      when p.id = '${SEED_OPERATOR}' then 'keep'
      when exists (select 1 from memberships m where m.person_id = p.id)
       and not exists (select 1 from memberships m join estate_class e on e.id = m.estate_id
                       where m.person_id = p.id and e.class <> 'would_remove') then 'would_remove'
      when not exists (select 1 from memberships m where m.person_id = p.id)
       and p.display_name in (${list(PROBE_PERSON_NAMES)}) then 'would_remove'
      when exists (select 1 from memberships m join estate_class e on e.id = m.estate_id
                   where m.person_id = p.id and e.class = 'keep') then 'keep'
      else 'review'
    end as class
  from persons p
)
select json_build_object(
  'estates', (select json_object_agg(class, n) from (select class, count(*) n from estate_class group by 1) x),
  'estate_reasons', (select json_agg(json_build_object('class', class, 'reason', reason, 'count', n) order by class, n desc)
                     from (select class, regexp_replace(reason, '[0-9a-f]{8}$', '<hex8>') reason, count(*) n from estate_class group by 1, 2) x),
  -- A project whose estate row is gone was left by a probe that deleted its estate and not the
  -- projects (the app never deletes an estate): would_remove, and counted on its own as well.
  'projects', (select json_object_agg(class, n) from (select coalesce(e.class, 'would_remove') class, count(*) n
               from projects p left join estate_class e on e.id = p.estate_id group by 1) x),
  'projects_without_estate', (select count(*) from projects p where not exists (select 1 from estates e where e.id = p.estate_id)),
  'project_names_without_estate', (select json_agg(json_build_object('name', name, 'count', n) order by n desc)
               from (select name, count(*) n from projects p where not exists (select 1 from estates e where e.id = p.estate_id) group by 1 order by 2 desc limit 15) x),
  'persons', (select json_object_agg(class, n) from (select class, count(*) n from person_class group by 1) x),
  'memberships_would_remove', (select count(*) from memberships m join estate_class e on e.id = m.estate_id where e.class = 'would_remove'),
  'journal_rows_would_remove', (select count(*) from journal j join estate_class e on e.id = j.estate_id where e.class = 'would_remove'),
  'review_estates', (select json_agg(json_build_object('id', id, 'name', name, 'reason', reason,
                       'projects', (select count(*) from projects p where p.estate_id = e.id),
                       'journal_rows', (select count(*) from journal j where j.estate_id = e.id)) order by name, id)
                     from estate_class e where class = 'review'),
  'kept_estates', (select json_agg(json_build_object('id', id, 'name', name, 'reason', reason) order by name) from estate_class where class = 'keep'),
  'totals', json_build_object('estates', (select count(*) from estates), 'projects', (select count(*) from projects), 'persons', (select count(*) from persons)),
  'as_of', now()
)`
}

function psqlBin() {
  const dir = process.env.FABRIC_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin'
  const p = path.join(dir, 'psql')
  return existsSync(p) ? p : 'psql'
}

export function readReport(dbUrl) {
  const sql = `begin transaction read only;\n${reportSql()};\nrollback;`
  const r = spawnSync(psqlBin(), [dbUrl, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], {
    input: sql, encoding: 'utf8', maxBuffer: 256_000_000,
    env: { ...process.env, PGOPTIONS: `${process.env.PGOPTIONS ?? ''} -c default_transaction_read_only=on`.trim() }
  })
  if (r.status !== 0) throw new Error(`psql failed (${r.status ?? r.error?.message}): ${(r.stderr || '').trim()}`)
  const line = r.stdout.split('\n').find(l => l.startsWith('{'))
  if (!line) throw new Error('psql returned no report')
  return JSON.parse(line)
}

function print(rep, target) {
  const n = (o, k) => (o ?? {})[k] ?? 0
  console.log(`Test residue in ${target} (read-only; nothing was changed) — as of ${rep.as_of}`)
  console.log(`Totals: ${rep.totals.estates} estates, ${rep.totals.projects} projects, ${rep.totals.persons} persons.\n`)
  console.log('                 would_remove   review     keep')
  for (const k of ['estates', 'projects', 'persons'])
    console.log(`  ${k.padEnd(14)} ${String(n(rep[k], 'would_remove')).padStart(12)} ${String(n(rep[k], 'review')).padStart(8)} ${String(n(rep[k], 'keep')).padStart(8)}`)
  console.log(`\n${rep.projects_without_estate} of the would_remove projects belong to an estate that no longer exists; most common names:`)
  console.log('  ' + (rep.project_names_without_estate ?? []).map(p => `${p.name} (${p.count})`).join(', '))
  console.log(`\nA cleanup of the would_remove class would also take ${rep.memberships_would_remove} memberships and ${rep.journal_rows_would_remove} journal rows`)
  console.log('(the journal is append-only by design: removing those rows is a separate decision, not a DELETE).\n')
  console.log('By reason:')
  for (const r of rep.estate_reasons ?? []) console.log(`  ${r.class.padEnd(12)} ${String(r.count).padStart(5)}  ${r.reason}`)
  console.log('\nReview — made by a path a person also takes; inspect before deciding:')
  for (const e of rep.review_estates ?? []) console.log(`  ${e.id}  ${e.name.padEnd(24)} projects ${String(e.projects).padStart(4)}  journal ${String(e.journal_rows).padStart(5)}  ${e.reason}`)
  console.log('\nKept:')
  for (const e of rep.kept_estates ?? []) console.log(`  ${e.id}  ${e.name}  (${e.reason})`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2)
  const at = args.indexOf('--db-url')
  const live = liveStack()
  const dbUrl = at >= 0 ? args[at + 1] : `postgresql://postgres:postgres@127.0.0.1:${live.dbPort}/postgres`
  const target = at >= 0 ? 'the given database' : `the live stack (project ${live.projectId}, DB ${live.dbPort})`
  try {
    const rep = readReport(dbUrl)
    if (args.includes('--json')) console.log(JSON.stringify(rep, null, 2))
    else print(rep, target)
  } catch (e) {
    console.error(`residue-report: ${e.message}`)
    process.exit(1)
  }
}
// #endregion residue-report
