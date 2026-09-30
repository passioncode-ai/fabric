// The floor, probed by ATTEMPTING the thing it forbids — R-003, which this
// repository learned after every gate it owns was green over two open doors.
//
// What this must prove:
//   1. An action below the floor is allowed, and the decision is still written
//      down. An authority plane that only records its refusals is as blind as
//      one that only records its yeses.
//   2. A floored action with NO grant is refused. This is ADR-0023's uncertainty
//      clause and it is the reason the module exists.
//   3. Every way a grant can fail to authorise is refused SEPARATELY and by its
//      own name: another estate, another class, another target, expired, spent.
//      One catch-all "invalid grant" would hide which door was open.
//   4. A valid grant allows exactly once: the effect is recorded, the receipt
//      points at the real journal row, and the grant is spent.
//   5. The SCHEMA refuses independently of this module. A floored intent with no
//      grant must be rejected by the database even when the caller skips policy
//      altogether — otherwise the floor is a convention, not a floor.
//
// There is deliberately NO skip when the stack is down. Six suites in this
// repository `process.exit(0)` in that case and print success having asserted
// nothing (M110); this one says what it needs and fails.

import { execFileSync } from 'node:child_process'
import path from 'node:path'

const HERE = import.meta.dirname
const script = `
import { Policy } from ${JSON.stringify(path.join(HERE, '../src/main/policy.ts'))}
import { createJournal } from ${JSON.stringify(path.join(HERE, '../../../packages/journal/src/index.ts'))}
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const journal = createJournal(db)

// The test estate, never the operator's — the same rule the other suites learned.
const ESTATE = randomUUID()
const ACTOR = { kind: 'person', id: 'policy-probe' }
const projectId = randomUUID()
const target = 'urn:fabric:project:' + projectId

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

// REAL time, not a pinned date (S03.boundary). Expiry is now checked by the
// DATABASE's clock, and that is the point rather than an inconvenience: a floor
// whose expiry the caller can move by injecting a clock is the same defect one
// level up. The injected clock still drives what Policy itself times.
let clock = new Date()
const policy = new Policy({ db, journal, now: () => clock })

// A request NAMES ITS RUNNER (FA-09). The surface fills this from the live
// session; a request that names none is uncontained by construction, because the
// question the floor asks is whether Fabric can be SURE the asker could be held
// to it. These cases were written before that question existed and stated no
// runner at all — a shape the surface would never build.
const req = (over = {}) => ({
  estateId: ESTATE, projectId, actionClass: 'project.delete',
  floorClass: 'deletion', actor: ACTOR, target,
  runner: 'claude-code', permissionMode: 'ask', ...over
})

// ── 1. below the floor ────────────────────────────────────────────────────────
const below = await policy.decide(req({ floorClass: null, actionClass: 'project.rename' }))
below.verdict === 'allow'
  ? ok('an action below the floor is allowed')
  : fail('an action below the floor was refused: ' + below.reason)

// and the decision was written down either way
const { data: decisions } = await db.from('journal').select('type,payload')
  .eq('estate_id', ESTATE).eq('type', 'policy.decided@1').order('seq', { ascending: false }).limit(1)
decisions?.[0]?.payload?.action_class === 'project.rename'
  ? ok('the decision is journalled even when nothing was at stake')
  : fail('a decision below the floor left no record')

// ── 2. floored, no authority presented ───────────────────────────────────────
const bare = await policy.decide(req())
// The REASON is asserted, not only the verdict. Watched failing on 2026-09-03:
// with the uncertainty clause disabled the code fell through to a lookup of an
// undefined id, refused with 'no such grant', and a verdict-only assertion
// stayed green over the removed branch. A refusal for the wrong reason is a
// different system that happens to say no today.
bare.verdict === 'refuse' && bare.needs === 'deletion' && bare.reason.includes('no grant was presented')
  ? ok('a floored action with no grant is refused, BY THAT NAME, and says what it needs')
  : fail('THE FLOOR DID NOT HOLD: ' + JSON.stringify(bare))

// ── 3. every way a grant fails, by its own name ──────────────────────────────
const good = await policy.issueGrant({
  estateId: ESTATE, projectId, floorClass: 'deletion', target, actor: ACTOR, ttlMs: 600000
})

const cases = [
  ['no such grant', req({ grantId: randomUUID() }), 'no such grant'],
  ['another target', req({ grantId: good.grantId, target: 'urn:fabric:project:other' }), 'different target'],
  ['another class', req({ grantId: good.grantId, floorClass: 'publication' }), 'authorises deletion']
]
for (const [name, request, expect] of cases) {
  const d = await policy.decide(request)
  d.verdict === 'refuse' && d.reason.includes(expect)
    ? ok('refused — ' + name)
    : fail('NOT refused for ' + name + ': ' + JSON.stringify(d))
}

// Expiry, against the database's clock. Advancing the injected one no longer
// expires anything, which is exactly the property S03.boundary added: the check
// moved out of the caller. So the grant is issued already past its life.
const shortLived = await policy.issueGrant({
  estateId: ESTATE, projectId, floorClass: 'deletion', target, actor: ACTOR, ttlMs: 1000
})
await db.from('grants').update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
  .eq('id', shortLived.grantId)
const stale = await policy.decide(req({ grantId: shortLived.grantId }))
stale.verdict === 'refuse' && /expired|no live grant/.test(stale.reason)
  ? ok('refused — an expired grant, by the database clock rather than the one the caller injects')
  : fail('an expired grant still authorised: ' + JSON.stringify(stale))

// ── 4. the valid passage, and it is one-shot ─────────────────────────────────
const allowed = await policy.decide(req({ grantId: good.grantId }))
allowed.verdict === 'allow'
  ? ok('a valid grant authorises')
  : fail('a valid grant was refused: ' + allowed.reason)

// ADR-0050 — PERMISSION IS NOT EXECUTION. The card's own acceptance check,
// "permission-not-execution", and it FAILED before this change: the agent path
// called recordEffect straight after decide, appending effect.executed@1 with
// nothing between the two lines.
const { data: afterAllow } = await db.from('effect_intents').select('command_id,state,provenance')
  .eq('estate_id', ESTATE).eq('command_id', allowed.commandId).maybeSingle()
afterAllow?.state === 'reserved'
  ? ok('permission alone leaves the effect RESERVED — nothing is recorded as done')
  : fail('a permission produced state ' + JSON.stringify(afterAllow))

const { data: succeeded } = await db.from('effect_intents')
  .select('command_id').eq('estate_id', ESTATE).eq('state', 'succeeded')
const { data: observedAttempts } = await db.from('effect_attempts')
  .select('command_id').eq('estate_id', ESTATE).not('observation_ref', 'is', null)
const withEvidence = new Set((observedAttempts ?? []).map((a) => a.command_id))
const unevidenced = (succeeded ?? []).filter((i) => !withEvidence.has(i.command_id))
unevidenced.length === 0
  ? ok('and no succeeded effect in the estate lacks an attempt carrying an observation')
  : fail(unevidenced.length + ' effect(s) succeeded with no evidence behind them')

// The fence: the grant is spent HERE, because past this line the estate may
// never learn what happened.
const dispatch = await policy.beginDispatch(req({ grantId: good.grantId }), allowed)
const { data: dispatching } = await db.from('effect_intents').select('state')
  .eq('estate_id', ESTATE).eq('command_id', allowed.commandId).maybeSingle()
dispatching?.state === 'dispatching'
  ? ok('the dispatch fence moves it to DISPATCHING — started, outcome not yet known')
  : fail('after beginDispatch the state is ' + JSON.stringify(dispatching))

const { data: attempt } = await db.from('effect_attempts').select('attempt_no,idempotency_key,observation_ref,status')
  .eq('estate_id', ESTATE).eq('command_id', allowed.commandId).maybeSingle()
attempt && attempt.observation_ref === null && attempt.status === 'dispatched'
  ? ok('an attempt exists carrying no observation yet — the difference between started and done')
  : fail('no attempt row, or it already claims an observation: ' + JSON.stringify(attempt))

// THE FLOOR, attempted rather than assumed (R-003): write the success directly,
// bypassing every command, and watch the database refuse it.
const forged = await db.from('effect_intents').update({ state: 'succeeded' })
  .eq('estate_id', ESTATE).eq('command_id', allowed.commandId)
forged.error && /observ/i.test(forged.error.message)
  ? ok('a success written directly, with no observation on any attempt, is REFUSED by the schema')
  : fail('the database accepted a success with no evidence: ' + JSON.stringify(forged.error))

const receipt = await policy.observeEffect(req({ grantId: good.grantId }), dispatch, {
  outcome: 'succeeded', evidence: 'probe observed the act itself'
})
const { data: intent } = await db.from('effect_intents').select('receipt_seq,grant_id,floor_class,state,provenance')
  .eq('estate_id', ESTATE).eq('command_id', allowed.commandId).maybeSingle()
intent && intent.grant_id === good.grantId && intent.state === 'succeeded' && intent.provenance === 'observed'
  ? ok('the effect is recorded against the grant that allowed it, and only once OBSERVED')
  : fail('no observed receipt row: ' + JSON.stringify(intent))

const { data: ev } = await db.from('journal').select('type,payload')
  .eq('estate_id', ESTATE).eq('seq', receipt.seq).maybeSingle()
ev?.type === 'effect.observed@1' && ev.payload?.outcome === 'succeeded'
  ? ok('the receipt points at the journal row that IS the record')
  : fail('receipt_seq does not resolve to the observation event: ' + JSON.stringify(ev))

const spent = await policy.decide(req({ grantId: good.grantId }))
spent.verdict === 'refuse' && spent.reason.includes('already been spent')
  ? ok('the grant is spent — a second attempt is refused')
  : fail('a spent grant authorised again: ' + JSON.stringify(spent))

// ── 5. the shape M139 wires into the product ─────────────────────────────────
// A grant names ONE file. The editor asks for it when the operator chooses to
// overwrite, so a grant taken for one file must not authorise another — which is
// how a single confirmation would otherwise become standing permission.
const fileA = '/tmp/fabric-probe-a.txt'
const fileB = '/tmp/fabric-probe-b.txt'
const overwrite = await policy.issueGrant({
  estateId: ESTATE, projectId: null, floorClass: 'deletion', target: fileA, actor: ACTOR, ttlMs: 60000
})
const wrongFile = await policy.decide({
  estateId: ESTATE, projectId: null, actionClass: 'file.overwrite',
  floorClass: 'deletion', actor: ACTOR, target: fileB, grantId: overwrite.grantId
})
wrongFile.verdict === 'refuse' && wrongFile.reason.includes('different target')
  ? ok('an overwrite grant for one file does not authorise another')
  : fail('a grant for ' + fileA + ' authorised ' + fileB + ': ' + JSON.stringify(wrongFile))

const rightFile = await policy.decide({
  estateId: ESTATE, projectId: null, actionClass: 'file.overwrite',
  floorClass: 'deletion', actor: ACTOR, target: fileA, grantId: overwrite.grantId
})
rightFile.verdict === 'allow'
  ? ok('the file it names is authorised')
  : fail('the named file was refused: ' + rightFile.reason)

// ── 6. the schema refuses on its own ─────────────────────────────────────────
const { error: floorError } = await db.from('effect_intents').insert({
  estate_id: ESTATE, action_class: 'project.delete', floor_class: 'deletion',
  grant_id: null, receipt_seq: 1
})
floorError
  ? ok('the database refuses a floored effect with no grant, with policy bypassed entirely')
  : fail('THE SCHEMA FLOOR IS OPEN: a floored intent inserted with no grant')

// ── M140: the agent asks, the operator grants, the agent proceeds ──────────
//
// The whole loop, and the part worth watching is that THE AGENT NEVER HOLDS
// AUTHORITY. It presents nothing; the surface looks up whether the operator has
// authorised this exact act. A grant id carried in a language model's context
// would be quotable, copyable, and easy to present for the wrong target.
{
  const target = 'https://passioncode.ai/blog/' + randomUUID().slice(0, 8)
  const ask = {
    estateId: ESTATE,
    projectId,
    actionClass: 'publish.page',
    floorClass: 'publication',
    actor: { kind: 'agent', id: randomUUID() },
    // The runner, as the surface fills it (FA-09). Written before the floor
    // asked who was asking.
    runner: 'claude-code',
    permissionMode: 'ask',
    target,
    reason: 'the landing page copy is approved and ready'
  }

  const none = await policy.findGrantFor({ estateId: ESTATE, floorClass: 'publication', target })
  none === null ? ok('with nothing granted, the surface finds no authority') : fail('found a grant that was never issued')
  const refused = await policy.decide({ ...ask, grantId: none })
  refused.verdict === 'refuse'
    ? ok('and the agent is refused — the operator has not been asked yet')
    : fail('an ungranted publication was allowed')

  await policy.issueGrant({
    estateId: ESTATE, projectId, floorClass: 'publication', target,
    actor: { kind: 'person', id: 'operator' }, ttlMs: 60 * 60 * 1000
  })

  const found = await policy.findGrantFor({ estateId: ESTATE, floorClass: 'publication', target })
  found !== null ? ok('after the operator grants, the surface finds it without the agent holding anything') : fail('the grant was not found')
  const allowed = await policy.decide({ ...ask, grantId: found })
  allowed.verdict === 'allow' ? ok('and the act is allowed') : fail('the granted act was refused: ' + allowed.reason)
  // ADR-0050 — the agent's own path, end to end. It gets a PERMIT; the estate
  // records nothing as done, and what the agent then says is a CLAIM.
  const dispatch = await policy.beginDispatch({ ...ask, grantId: found }, allowed)
  const claim = await policy.claimEffect({ ...ask, grantId: found }, dispatch, { says: 'published, I think' })
  const { data: claimed } = await db.from('effect_intents').select('state,provenance')
    .eq('estate_id', ESTATE).eq('command_id', allowed.commandId).maybeSingle()
  claimed?.provenance === 'claimed' && claimed.state === 'outcome_unknown'
    ? ok('an agent reporting an act it performed OUTSIDE Fabric leaves the outcome unknown, with the report attributed')
    : fail('an agent claim resolved the effect: ' + JSON.stringify(claimed))

  const promoted = await db.from('effect_intents').update({ state: 'succeeded' })
    .eq('estate_id', ESTATE).eq('command_id', allowed.commandId)
  promoted.error
    ? ok('and a claim cannot be promoted to success even by writing the row directly')
    : fail('THE CLAIM FLOOR IS OPEN: an agent report became a verified success')

  const receipt = claim
  receipt.seq > 0 ? ok('with a receipt in the journal') : fail('no receipt')

  const again = await policy.findGrantFor({ estateId: ESTATE, floorClass: 'publication', target })
  again === null
    ? ok('and it is SPENT: the same authorisation does not cover a second act')
    : fail('a consumed grant was found again')

  await policy.issueGrant({
    estateId: ESTATE, projectId, floorClass: 'publication', target,
    actor: { kind: 'person', id: 'operator' }, ttlMs: 60 * 60 * 1000
  })
  const otherTarget = await policy.findGrantFor({
    estateId: ESTATE, floorClass: 'publication', target: target + '/other'
  })
  otherTarget === null ? ok('a grant names ONE target and reaches no other') : fail('a grant leaked to another target')
  const otherClass = await policy.findGrantFor({ estateId: ESTATE, floorClass: 'deletion', target })
  otherClass === null ? ok('and one class, not the next one along') : fail('a grant leaked across floor classes')
  const otherEstate = await policy.findGrantFor({
    estateId: '00000000-0000-0000-0000-000000000001', floorClass: 'publication', target
  })
  otherEstate === null ? ok('and one estate') : fail('a grant leaked across estates')
}

// ── FA-09 · the floor asks whether the asker could be held to it ────────────
//
// The floor is VOLUNTARY: the effect-request tool is one an agent may call,
// and every runner has native tools Fabric cannot see. So an allow on a floored
// effect authorises the asking, and the doing was available all along. The card
// permits two answers — intercept the bypass, or refuse the profile the action —
// and interception would mean sitting inside another program's tool loop.
{
  // Its own target: the grants above are spent by design, and reusing one would
  // make this case pass for the wrong reason.
  const mine = 'project:' + randomUUID()
  await policy.issueGrant({
    estateId: ESTATE, projectId, floorClass: 'deletion', target: mine,
    actor: { kind: 'person', id: 'operator' }, ttlMs: 600000
  })
  const grantId = await policy.findGrantFor({ estateId: ESTATE, floorClass: 'deletion', target: mine })
  grantId ? ok('a grant exists for the containment cases, so a refusal below is about containment') : fail('no grant for the containment cases')
  // An AGENT asks. The probe's default actor is the operator, and the rule is
  // about a runner whose native tools Fabric cannot see — a person has none to
  // hide, which is the case asserted last in this block.
  const asAgent = { kind: 'agent', id: randomUUID() }
  const bypass = await policy.decide(req({ grantId, target: mine, actor: asAgent, permissionMode: 'bypass' }))
  bypass.verdict === 'refuse' && /without a grant the whole time/.test(bypass.reason ?? '')
    ? ok('a floored effect is refused for a session started with the runner gate removed, grant or no grant')
    : fail('bypass mode was allowed a floored effect: ' + JSON.stringify(bypass))

  const unnamed = await policy.decide(req({ grantId, target: mine, actor: asAgent, runner: null, permissionMode: null }))
  unnamed.verdict === 'refuse'
    ? ok('and so is a request that does not say who is asking — uncertainty is not permission')
    : fail('an unnamed runner was allowed: ' + JSON.stringify(unnamed))

  const belowFloor = await policy.decide(
    req({ floorClass: null, actionClass: 'project.rename', actor: asAgent, permissionMode: 'bypass' })
  )
  belowFloor.verdict === 'allow'
    ? ok('below the floor nothing changes — gating those would stop an agent reading a file because it could read the file')
    : fail('a below-floor act was refused for containment: ' + JSON.stringify(belowFloor))

  const operator = await policy.decide(
    req({ grantId, target: mine, permissionMode: 'bypass', actor: { kind: 'person', id: 'operator' } })
  )
  operator.verdict === 'allow'
    ? ok('a person acting with their own hands is not bypassing a floor — they are the floor')
    : fail('the operator was refused for containment: ' + JSON.stringify(operator))
}

if (failures > 0) { console.log('\\n' + failures + ' policy failure(s)'); process.exit(1) }
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
  console.log('  FAIL the local stack is not running — this probe asserts nothing without it.')
  console.log('       Start it with `supabase start`. There is no skip here on purpose (M110).')
  process.exit(1)
}

try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    encoding: 'utf8', env, cwd: path.resolve(HERE, '..')
  })
  process.stdout.write(out.split('\n').filter((l) => /^\s+(ok|FAIL)/.test(l)).join('\n') + '\n')
} catch (e) {
  process.stdout.write((e.stdout ?? '') + (e.stderr ?? ''))
  process.exit(1)
}
