// Two writers, one queue: the lock under FA-04, probed by ATTEMPTING the race.
//
// WHY THIS FILE EXISTS AND THE OTHER PROBE WAS NOT ENOUGH. The behavioural
// probe fires two link calls with Promise.all over HTTP and asserts that one
// refuses. Measured 2026-09-10: with the estate lock REMOVED from the command,
// that probe stayed green — two PostgREST requests are not obliged to overlap,
// so the assertion never reached the condition it was written for. A green that
// cannot fail is not evidence (R-004: the harness failed to reach the subject,
// which is a fact about the harness and not about the product).
//
// So the interleaving is CONSTRUCTED here, over two real connections with
// explicit transactions, and the block itself is MEASURED in `pg_locks` rather
// than inferred from timing. Without the lock the second writer does not wait;
// it asks its question while the first transaction is still open, gets a stale
// answer, and appends an event the projector then drops with a warning —
// leaving the journal holding something the board does not contain.
import pg from 'pg'
import { probeEnv } from '../../../scripts/lib/test-stack.mjs'
import { randomUUID } from 'node:crypto'

// The disposable stack the tier started; probeEnv() refuses the live one (54322) before connecting.
const DB_URL = probeEnv().DATABASE_URL
const ESTATE = randomUUID()
const ACTOR = JSON.stringify({ kind: 'system', id: 'link-race' })

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.error('  FAIL ' + m) }

const one = new pg.Client({ connectionString: DB_URL })
const two = new pg.Client({ connectionString: DB_URL })
const watch = new pg.Client({ connectionString: DB_URL })
await Promise.all([one.connect(), two.connect(), watch.connect()])

const project = randomUUID(), A = randomUUID(), B = randomUUID()
await watch.query(
  "select append_event($1,'project.created@1',$2::jsonb, jsonb_build_object('id',$3::uuid,'name','race'),'1',$3::uuid)",
  [ESTATE, ACTOR, project]
)
for (const [id, title] of [[A, 'task A'], [B, 'task B']])
  await watch.query(
    `select append_event($1,'task.created@1',$2::jsonb,
       jsonb_build_object('id',$3::uuid,'title',$4::text,'task_type','development','section','core',
                          'origin', jsonb_build_object('kind','task','ref','race')),'1',$5::uuid)`,
    [ESTATE, ACTOR, id, title, project]
  )

const link = (client, from, to) =>
  client.query("select link_tasks($1,$2,'blocks',$3,$4::jsonb,$5) as r", [ESTATE, from, to, ACTOR, project])

// ── writer one takes the estate and holds it open ────────────────────────────
await one.query('begin')
const first = (await link(one, A, B)).rows[0].r
if (first.linked === true) ok('the first writer links A -> B inside an open transaction')
else fail('the first writer was refused: ' + JSON.stringify(first))

// ── writer two attempts the opposite edge while that transaction is open ─────
await two.query('begin')
const second = link(two, B, A)

// MEASURED, not assumed: is writer two actually waiting on writer one?
const waiting = async () => {
  const { rows } = await watch.query(
    `select count(*)::int as n from pg_locks
      where locktype = 'advisory' and not granted`
  )
  return rows[0].n
}
let blocked = 0
for (let i = 0; i < 40 && blocked === 0; i++) {
  blocked = await waiting()
  if (blocked === 0) await watch.query('select pg_sleep(0.05)')
}
if (blocked > 0) ok('the second writer WAITS on the estate lock rather than reading a stale answer')
else fail('the second writer never blocked: the check and the append are not one act')

await one.query('commit')
const result = (await second).rows[0].r
await two.query('commit')

if (result.linked === false && result.reason_code === 'cycle')
  ok('and once it proceeds it sees the committed edge and refuses the loop')
else fail('the opposite edge was accepted: ' + JSON.stringify(result))

// ── the journal and the board agree ──────────────────────────────────────────
const { rows: ev } = await watch.query(
  "select count(*)::int as n from journal where estate_id = $1 and type = 'task.linked@1'", [ESTATE])
const { rows: rowsN } = await watch.query(
  'select count(*)::int as n from task_links where estate_id = $1', [ESTATE])
if (ev[0].n === 1 && rowsN[0].n === 1)
  ok('one event, one edge: nothing was recorded that the board does not contain')
else fail('journal holds ' + ev[0].n + ' link event(s) and the board holds ' + rowsN[0].n + ' edge(s)')

await watch.query('delete from journal where estate_id = $1', [ESTATE])
await Promise.all([one.end(), two.end(), watch.end()])
console.log(failures ? '  FAIL ' + failures + ' failure(s)' : '\nall green')
process.exit(failures ? 1 : 0)
