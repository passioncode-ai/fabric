// A refused read is not an empty table (M199.usage, and the fourth of a shape).
//
// MEASURED 2026-09-10 with nothing committed behind it. `chainAdvance` read
// every follows-link and then asked for the follower tasks with
// `.in('id', followerIds)`. At 294 ids that filter is 10 879 characters and the
// gateway answers **HTTP 414 URI too long** — reproduced with curl against the
// live stack. The advancer read `.data ?? []`, so the refusal became "no
// followers are waiting" and unattended chains stopped advancing in silence.
// `ci.sh full` was green that morning and red that afternoon: the id list grows
// with the data, so the URL crosses the limit on its own and the failure has no
// author and no date.
//
// The chain probe drives the fixed path against the real database, which proves
// the chunking. It CANNOT reach the error branch, because with chunking in place
// the error never happens — an unreachable branch and a covered one look
// identical in a report. So this probe injects the failure: a store whose list
// read refuses, and an advancer that must then start nothing and say so.
//
// Pure: no database, no network. The store is a fake and the clock is fixed.

import { createChainAdvance } from '../src/main/chainAdvance.ts'
import { createScopedStore } from '../src/main/scopedStore.ts'
import { ops } from '../src/main/opsSink.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

// ── the chunked read reports the refusal, rather than returning nothing ─────
{
  // A db shaped like PostgREST's client, whose `.in` refuses exactly as the
  // gateway did: code 414, "URI too long".
  const calls = []
  const refusing = {
    from: () => ({
      select: () => {
        const q = {
          eq: () => q,
          in: (column, values) => {
            calls.push(values.length)
            return Promise.resolve({ data: null, error: { code: '414', message: 'URI too long' } })
          }
        }
        return q
      }
    })
  }
  const store = createScopedStore(refusing, { kind: 'estate', estateId: 'e1' })
  const read = await store.selectIn('project_tasks', 'id,status', 'id', ['a', 'b', 'c'])
  read.failed !== null && /414/.test(read.failed) && /URI too long/.test(read.failed)
    ? ok('a refused list read answers with the refusal, carrying the code and the message')
    : fail('the refusal was swallowed: ' + JSON.stringify(read))
  eq(read.rows.length, 0, 'and it returns no rows, so a caller cannot mistake it for an empty table')
  eq(calls.length, 1, 'it stops at the first refusal rather than asking for every remaining chunk')
}

// ── the list is chunked, so the URL never grows with the data ───────────────
{
  const sizes = []
  const counting = {
    from: () => ({
      select: () => {
        const q = {
          eq: () => q,
          in: (column, values) => {
            sizes.push(values.length)
            return Promise.resolve({ data: values.map((v) => ({ id: v, status: 'backlog' })), error: null })
          }
        }
        return q
      }
    })
  }
  const store = createScopedStore(counting, { kind: 'estate', estateId: 'e1' })
  const ids = Array.from({ length: 294 }, (_, i) => `id-${i}`)
  const read = await store.selectIn('project_tasks', 'id,status', 'id', ids)
  eq(read.rows.length, 294, 'every row comes back across the chunks')
  eq(read.failed, null, 'and nothing failed')
  sizes.every((n) => n <= 100)
    ? ok(`the 294 ids went in ${sizes.length} requests of at most 100 — the size that produced the 414 was 294`)
    : fail('a chunk was too large: ' + sizes.join(','))
  eq(sizes.length, 3, 'three requests for 294 ids')
}

// ── an empty list asks nothing at all ──────────────────────────────────────
{
  let asked = 0
  const never = {
    from: () => ({
      select: () => {
        const q = { eq: () => q, in: () => { asked++; return Promise.resolve({ data: [], error: null }) } }
        return q
      }
    })
  }
  const store = createScopedStore(never, { kind: 'estate', estateId: 'e1' })
  const read = await store.selectIn('project_tasks', 'id', 'id', [])
  eq(asked, 0, 'an empty list makes no request')
  eq(read.failed, null, 'and it is not a failure — there was nothing to ask about')
  eq(read.rows.length, 0, 'with no rows')
}

// ── the advancer starts NOTHING when it could not read, and says so ─────────
{
  const spawned = []
  const reported = []
  // `chainAdvance` imports the ops sink directly rather than taking one, so the
  // probe watches the sink. Restored afterwards: a global left patched would
  // make the next case in this file lie.
  const realFailed = ops.failed
  ops.failed = (name, e) => reported.push({ name, message: String(e?.message ?? e) })
  // Enough of a store for the advancer's first two reads: the links resolve and
  // the follower read refuses, which is the exact 414 shape.
  const store = {
    scope: { kind: 'estate', estateId: 'e1' },
    select: () => {
      const q = {
        eq: () => q,
        in: () => q,
        then: (resolve) =>
          resolve({
            data: [{ task_id: 'b', target_id: 'a', needs: ['report'], rel: 'follows', target_kind: 'task' }],
            error: null
          })
      }
      return q
    },
    // The links answer through the paged read (release review 2026-10-03); the
    // follower read behind them still refuses, which is the case under test.
    selectAll: async () => ({
      rows: [{ task_id: 'b', target_id: 'a', needs: ['report'], rel: 'follows', target_kind: 'task' }],
      failed: null
    }),
    selectIn: async () => ({ rows: [], failed: 'project_tasks.id could not be read (414): URI too long' }),
    insert: () => ({ then: (r) => r({ data: null, error: null }) }),
    update: () => ({ then: (r) => r({ data: null, error: null }) })
  }
  // The FACTORY RETURNS THE TICK ITSELF — `createChainAdvance(deps)` is
  // `() => Promise<ChainTickResult>`. The first version of this block called
  // `advance.tick()`, which threw immediately, and the assertion passed anyway
  // because my own catch filled the list it was reading. The whole case proved
  // nothing until the assertion asked for the failure BY NAME.
  const advance = createChainAdvance({
    store,
    journal: { append: async () => ({ seq: 1 }) },
    startTask: async (input) => {
      spawned.push(input)
      return { task: { id: 'x', project_id: 'p', status: 'running' }, session: { sessionId: 's' } }
    },
    admission: { claim: () => ({ allowed: true, reason: 'probe' }) },
    admitExisting: async () => ({ ok: true }),
    bindRun: async () => {},
    endRun: async () => {},
    quota: async () => ({ fiveHour: { utilization: 10, resetsAt: null }, sevenDay: null, byModel: {}, readAt: '', ageSeconds: 0, problem: null, account: 'acct' }),
    estateId: 'e1'
  })

  let threw = null
  try {
    await advance()
  } catch (e) {
    // KEPT SEPARATE from `reported`. The first version of this pushed the throw
    // into `reported`, so "it SAYS so" passed whenever the tick threw for any
    // reason at all — and the plant that disabled the guard slipped through
    // because a later throw filled the list my assertion was reading.
    threw = String(e).slice(0, 120)
  }

  eq(spawned.length, 0, 'a tick that could not read the followers starts nothing')
  // The NAMED failure, not merely something. Anything else is the tick falling
  // over somewhere else, which is not the same as reporting what it could not
  // read.
  ops.failed = realFailed
  reported.some((r) => /unreadable/.test(r.name) && /414/.test(r.message))
    ? ok('and it SAYS so, by name and with the code — returning quietly is what made this invisible')
    : fail(
        'the tick did not report the unreadable follower list: ' +
          JSON.stringify({ reported, threw })
      )
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log('\nall green: a refused list read is a refusal, the URL never grows with the data, and a tick that cannot read starts nothing')
