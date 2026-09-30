// Continuing allowed work without asking again — and why it cannot, here.
//
// M199.auto, ADR-0052. The card's seven failure cases are this file, and one of
// them decides everything else: **an unverified resume never becomes a
// candidate**, and M199.probe measured `native-resume-ack` as `unverified` on
// Claude Code 2.1.236 and Codex 0.152.1. So on this machine no account is
// eligible and every decision is `hold`. The engine is exercised with
// `resumeVerified: true` in most cases below, which is a HYPOTHETICAL: it says
// what the rules would do on a build that acknowledges a resume, and one case
// asserts what actually happens on this one.
//
// This is the sharpest instance of the operator's standing priority — data
// preservation and a reliable launch before expanding autonomy — because
// everything here runs while nobody is watching.
//
// Pure and local: a temp directory, an injected clock, an injected survey and an
// injected coordinator. No provider is executed, no credential is read, nothing
// is stopped or spawned.

import { createAutoLoop } from '../src/main/autoLoop.ts'
import { AUTO_DEFAULTS, decide, policyProblems } from '../src/shared/autoPolicy.ts'
import { CAPABILITY_MATRIX } from '../src/shared/providerCapabilityMatrix.ts'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const NOW = 1_757_000_000_000

const policy = (over = {}) => ({
  policyId: 'pol-1',
  revision: 1,
  enabled: true,
  scope: { provider: 'codex-cli', runtime: 'host', projectId: null },
  accountAllowlist: ['acct-B', 'acct-C'],
  strategy: AUTO_DEFAULTS.strategy,
  thresholdPct: AUTO_DEFAULTS.thresholdPct,
  modelWindows: [],
  cooldownSeconds: AUTO_DEFAULTS.cooldownSeconds,
  hysteresisPct: AUTO_DEFAULTS.hysteresisPct,
  maxSwitchesPerHour: AUTO_DEFAULTS.maxSwitchesPerHour,
  enclosingBudgetRef: 'work-1',
  ...over
})

const reading = (usedPct, over = {}) => ({
  contextIdentity: {
    provider: 'codex-cli',
    subject: null,
    org: 'org-1',
    accountId: 'acct-x',
    runtime: 'host',
    authRevision: 1
  },
  authRevision: 1,
  windows: [{ id: 'five-hour', kind: 'five-hour', usedPct, resetAt: null }],
  sampledAt: `2026-09-10T00:00:${String(usedPct).padStart(2, '0')}.000Z`,
  source: 'oauth usage endpoint',
  status: 'fresh',
  reason: 'read',
  nextProbeAt: '2026-09-10T00:02:00.000Z',
  ...over
})

const candidate = (accountId, usedPct, over = {}) => ({
  accountId,
  observation: usedPct === null ? null : reading(usedPct),
  windowId: 'five-hour',
  resumeVerified: true,
  requiresExplicitAdmission: false,
  quarantined: false,
  manuallyPinned: false,
  sameScope: true,
  weeklyResetAt: null,
  ...over
})

const decision = (over = {}) =>
  decide({
    policy: policy(),
    from: 'acct-A',
    current: reading(95),
    candidates: [candidate('acct-B', 20)],
    switchesThisHour: 0,
    lastSwitchAt: null,
    enrolled: true,
    now: NOW,
    ...over
  })

// ── WHAT ACTUALLY HAPPENS ON THIS MACHINE ──────────────────────────────────
{
  const acked = CAPABILITY_MATRIX.filter((r) => r.capability === 'native-resume-ack')
  acked.every((r) => r.status !== 'supported')
    ? ok('native-resume-ack is not supported on either pinned build — measured, not assumed')
    : fail('the matrix says ' + JSON.stringify(acked.map((r) => [r.provider, r.status])))

  const real = decision({ candidates: [candidate('acct-B', 20, { resumeVerified: false })] })
  real.kind === 'hold' && real.excluded.some((e) => e.why === 'resume-unverified')
    ? ok('so with 95% used and a fresh 20% account available, the answer is HOLD — the account is excluded')
    : fail('an unverifiable account was used: ' + JSON.stringify(real))
  ;/Dispatch pauses/.test(real.reason)
    ? ok('and dispatch pauses rather than continuing on an account that cannot serve it')
    : fail('the reason does not say what happens to the work: ' + real.reason)
}

// ── FAILURE CASE 1: 95% A, fresh 20% B, enrolled — one commit, no second ask ─
{
  const v = decision()
  v.kind === 'queue_switch' && v.to === 'acct-B'
    ? ok('on a build that acknowledges a resume, 95% used with a fresh 20% account queues a switch')
    : fail('the switch was not queued: ' + JSON.stringify(v))
  ;/over the 90% threshold/.test(v.reason)
    ? ok('and the reason names the threshold it crossed and the headroom it found')
    : fail('thin reason: ' + v.reason)
  eq(v.policyRevision, 1, 'the decision carries the policy revision it was made under')
  v.observationRefs.length >= 2 ? ok('and the readings it was made on') : fail('no observation refs')
  JSON.stringify(v).includes('sk-') === false ? ok('and no secret anywhere in it') : fail('a secret reached the decision')
}

// ── FAILURE CASE 2: the five ways an account is never a candidate ───────────
{
  for (const [why, over] of [
    ['not-allowlisted', { accountId: 'acct-Z' }],
    ['foreign-scope', { sameScope: false }],
    ['usage-unknown', { observation: null }],
    ['usage-stale', { observation: reading(10, { status: 'stale' }) }],
    ['resume-unverified', { resumeVerified: false }],
    ['quarantined', { quarantined: true }],
    ['requires-explicit-admission', { requiresExplicitAdmission: true }],
    ['manually-pinned', { manuallyPinned: true }],
    ['exhausted', { observation: reading(100) }]
  ]) {
    const v = decision({ candidates: [candidate('acct-B', 20, over)] })
    const excluded = v.excluded.find((e) => e.why === why)
    v.kind === 'hold' && excluded
      ? ok(`an account that is ${why} never becomes a candidate`)
      : fail(`${why}: ` + JSON.stringify({ kind: v.kind, excluded: v.excluded }))
  }
  const current = decision({ candidates: [candidate('acct-A', 20)] })
  current.excluded.some((e) => e.why === 'is-current')
    ? ok('and the account already in use is excluded as current rather than considered')
    : fail('the current account was a candidate: ' + JSON.stringify(current.excluded))
}

// ── FAILURE CASE 3: 89/91 alternating readings cannot ping-pong ─────────────
{
  // Below the threshold: stay. Above it, but with a candidate only marginally
  // better: hold. Without hysteresis the pair would move the work back and forth.
  const below = decision({ current: reading(89), candidates: [candidate('acct-B', 80)] })
  eq(below.kind, 'stay', '89% used is below the threshold and stays')
  const marginal = decision({ current: reading(91), candidates: [candidate('acct-B', 85)] })
  marginal.kind === 'hold' && /under the 10-point margin/.test(marginal.reason)
    ? ok('91% used with a candidate 6 points better HOLDS — under the hysteresis margin')
    : fail('a marginal candidate was taken: ' + JSON.stringify(marginal))
  const worthIt = decision({ current: reading(91), candidates: [candidate('acct-B', 50)] })
  worthIt.kind === 'queue_switch'
    ? ok('and one 41 points better is taken, so the margin is a margin rather than a wall')
    : fail('a clearly better candidate was refused: ' + JSON.stringify(worthIt))
}

// ── FAILURE CASE 4: all exhausted pauses; a reset does not mean free ───────
{
  const v = decision({ current: reading(100), candidates: [candidate('acct-B', 100)] })
  v.kind === 'hold' && v.excluded.some((e) => e.why === 'exhausted')
    ? ok('every account exhausted pauses dispatch')
    : fail('exhausted: ' + JSON.stringify(v))
  // A reset TIME is not a reading. `headroomOf` refuses an absent window, and a
  // window whose reset has passed is still whatever was last read.
  const unread = decision({
    current: reading(95),
    candidates: [candidate('acct-B', 20, { observation: reading(20, { status: 'unknown' }) })]
  })
  unread.kind === 'hold' && unread.excluded.some((e) => e.why === 'usage-unknown')
    ? ok('and a clock reaching a reset does not stand in for a reading nobody took')
    : fail('an unread account was used: ' + JSON.stringify(unread))
}

// ── unknown CURRENT usage is not a reason to move ──────────────────────────
{
  const v = decision({ current: null })
  v.kind === 'hold' && /Unknown is not a reason to move/.test(v.reason)
    ? ok('an unknown reading for the CURRENT account holds — a blind fallback is not permitted')
    : fail('unknown current: ' + JSON.stringify(v))
  const stale = decision({ current: reading(95, { status: 'stale' }) })
  stale.kind === 'hold' ? ok('and so does a stale one') : fail('a stale current reading moved work')
}

// ── FAILURE CASE 6: the cap, and it binds at 100% too ─────────────────────
{
  const capped = decision({ switchesThisHour: 12 })
  capped.kind === 'hold' && /the cap is 12/.test(capped.reason)
    ? ok('twelve switches in the trailing hour exhaust the cap')
    : fail('the cap did not bind: ' + JSON.stringify(capped))
  const desperate = decision({ switchesThisHour: 12, current: reading(100) })
  desperate.kind === 'hold' && /holds at 100% used/.test(desperate.reason)
    ? ok('and it still binds at 100% used — a limit that gives way when it matters is not one')
    : fail('the cap yielded at 100%: ' + JSON.stringify(desperate))
  const eleven = decision({ switchesThisHour: 11 })
  eleven.kind === 'queue_switch' ? ok('while eleven still allows one') : fail('the cap was off by one')
}

// ── the cooldown ───────────────────────────────────────────────────────────
{
  const hot = decision({ lastSwitchAt: NOW - 60_000 })
  hot.kind === 'hold' && /the cooldown is 300s/.test(hot.reason)
    ? ok('60s after a switch is inside the 300s cooldown and holds')
    : fail('cooldown: ' + JSON.stringify(hot))
  const cool = decision({ lastSwitchAt: NOW - 300_001 })
  cool.kind === 'queue_switch' ? ok('and past it the next switch is allowed') : fail('the cooldown never expired')
  // NOT the year: `NOW` is 2025-09-04 and the first version of this asserted
  // 2026, checking a fact about my own constant rather than about the code.
  Number.isFinite(Date.parse(hot.nextCheckAt)) && Date.parse(hot.nextCheckAt) > NOW
    ? ok('a hold says when to look again, and it is in the future')
    : fail('nextCheckAt is not a future instant: ' + hot.nextCheckAt)
}

// ── enrolment is per conversation, and the switch is off by default ────────
{
  const notEnrolled = decision({ enrolled: false })
  notEnrolled.kind === 'stay' && /does not enrol one/.test(notEnrolled.reason)
    ? ok('turning the policy on does not enrol a conversation')
    : fail('enrolment: ' + JSON.stringify(notEnrolled))
  const off = decision({ policy: policy({ enabled: false }) })
  eq(off.kind, 'stay', 'and a disabled policy stays without reading anything')
}

// ── FAILURE CASE 7: consume-first needs a CONFIRMED reset ─────────────────
{
  const p = policy({ strategy: 'consume-first' })
  // Nobody is over the threshold, and B resets sooner: consume-first moves, best stays.
  const early = decide({
    policy: p,
    from: 'acct-A',
    current: reading(40),
    candidates: [candidate('acct-B', 30, { weeklyResetAt: '2026-09-11T00:00:00.000Z' })],
    switchesThisHour: 0,
    lastSwitchAt: null,
    enrolled: true,
    now: NOW
  })
  early.kind === 'queue_switch' && early.to === 'acct-B'
    ? ok('consume-first moves BEFORE the threshold to the account that resets sooner')
    : fail('consume-first did not move early: ' + JSON.stringify(early))

  const bestStays = decide({
    policy: policy({ strategy: 'best' }),
    from: 'acct-A',
    current: reading(40),
    candidates: [candidate('acct-B', 30, { weeklyResetAt: '2026-09-11T00:00:00.000Z' })],
    switchesThisHour: 0,
    lastSwitchAt: null,
    enrolled: true,
    now: NOW
  })
  eq(bestStays.kind, 'stay', 'and best stays on the same readings — the strategies differ about whether to act')

  const noReset = decide({
    policy: p,
    from: 'acct-A',
    current: reading(40),
    candidates: [candidate('acct-B', 30, { weeklyResetAt: null })],
    switchesThisHour: 0,
    lastSwitchAt: null,
    enrolled: true,
    now: NOW
  })
  noReset.kind === 'stay' && /does not permit moving early/.test(noReset.reason)
    ? ok('a MISSING reset timestamp does not permit moving early — there is nothing to be early about')
    : fail('a missing reset moved work: ' + JSON.stringify(noReset))

  const thin = decide({
    policy: p,
    from: 'acct-A',
    current: reading(40),
    candidates: [candidate('acct-B', 95, { weeklyResetAt: '2026-09-11T00:00:00.000Z' })],
    switchesThisHour: 0,
    lastSwitchAt: null,
    enrolled: true,
    now: NOW
  })
  thin.kind === 'stay'
    ? ok('and neither does a sooner reset with too little headroom left to be worth it')
    : fail('consume-first moved to a nearly-full account: ' + JSON.stringify(thin))
}

// ── the policy itself must be usable ──────────────────────────────────────
{
  eq(policyProblems(policy()).length, 0, 'the defaults are a usable policy')
  // The arithmetic the defaults state: 12/hour is 3600/300 exactly.
  eq(AUTO_DEFAULTS.maxSwitchesPerHour, 3600 / AUTO_DEFAULTS.cooldownSeconds, 'the cap is the cooldown, from the other side')
  const loose = policyProblems(policy({ maxSwitchesPerHour: 30 }))
  loose.some((p) => /can never be reached/.test(p))
    ? ok('a cap looser than the cooldown allows is refused — it is not a limit')
    : fail('a decorative cap was accepted: ' + JSON.stringify(loose))
  policyProblems(policy({ enabled: true, accountAllowlist: [] })).some((p) => /authorises nothing/.test(p))
    ? ok('and an enabled policy with an empty allowlist is refused rather than silently meaning every account')
    : fail('an empty allowlist was accepted')
  const broken = decision({ policy: policy({ thresholdPct: 0 }) })
  broken.kind === 'hold' && /not usable/.test(broken.reason)
    ? ok('an unusable policy holds and says so, rather than being applied with a guess')
    : fail('a broken policy was applied: ' + JSON.stringify(broken))
}

// ── the loop: one intent per observation, one holder per scope, state survives
{
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-auto-'))
  const asked = []
  const make = (over = {}) =>
    createAutoLoop({
      dir,
      survey: () => ({
        from: 'acct-A',
        current: reading(95),
        candidates: [candidate('acct-B', 20)]
      }),
      beginSwitch: (input) => {
        asked.push(input)
        return { ok: true, reason: 'queued' }
      },
      now: () => NOW,
      ...over
    })

  const loop = make()
  const first = loop.tick({ policy: policy(), conversationId: 'conv-A' })
  eq(first.decision.kind, 'stay', 'a conversation nobody enrolled stays')
  eq(asked.length, 0, 'and nothing is asked for it')

  loop.enrol('conv-A')
  const second = loop.tick({ policy: policy(), conversationId: 'conv-A' })
  second.queued && asked.length === 1
    ? ok('once enrolled, the tick asks the coordinator — no second confirmation')
    : fail('the tick did not ask: ' + JSON.stringify(second))
  ;/^auto:conv-A:/.test(asked[0].idempotencyKey)
    ? ok('with an idempotency key derived from the readings, so a retry resumes that operation')
    : fail('key: ' + asked[0].idempotencyKey)

  // PAST THE COOLDOWN, on the SAME readings. The first version of this ticked
  // again immediately, which the COOLDOWN suppressed — so the assertion said
  // "one intent per observation" while the run proved "one per cooldown". The
  // dedup branch was unreachable and the case proved nothing.
  const later = make({ now: () => NOW + 300_001 })
  const repeat = later.tick({ policy: policy(), conversationId: 'conv-A' })
  repeat.queued === false && /already queued/.test(repeat.suppressed ?? '')
    ? ok('past the cooldown, a tick on the SAME readings queues nothing — one intent per observation')
    : fail('a second intent was queued: ' + JSON.stringify(repeat))
  eq(asked.length, 1, 'the coordinator was asked once')

  // A FRESH PROCESS. The cooldown and the count must outlive it, or a restart
  // resets the cap — which the card forbids in its own words.
  const restarted = make()
  eq(restarted.switchesInTrailingHour(policy()), 1, 'the switch count survives a restart')
  const afterRestart = restarted.tick({ policy: policy(), conversationId: 'conv-A' })
  afterRestart.decision.kind === 'hold' && /cooldown/.test(afterRestart.decision.reason)
    ? ok('and so does the cooldown — a restart cannot shorten it')
    : fail('the cooldown was lost across a restart: ' + JSON.stringify(afterRestart.decision))
  eq(restarted.state().enrolled.length, 1, 'and the enrolment survives too')
}

// ── withdrawal cancels a queued intent; app-off stops the loop ─────────────
{
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-auto-'))
  const asked = []
  let up = true
  const loop = createAutoLoop({
    dir,
    survey: () => ({ from: 'acct-A', current: reading(95), candidates: [candidate('acct-B', 20)] }),
    beginSwitch: (i) => {
      asked.push(i)
      return { ok: true, reason: 'queued' }
    },
    now: () => NOW,
    running: () => up
  })
  loop.enrol('conv-A')
  loop.tick({ policy: policy(), conversationId: 'conv-A' })
  eq(asked.length, 1, 'one intent is queued')
  const withdrawn = loop.withdraw('conv-A')
  withdrawn.ok && /queued intent is dropped/.test(withdrawn.reason)
    ? ok('withdrawing before the stop drops the queued intent')
    : fail('withdrawal: ' + JSON.stringify(withdrawn))
  eq(loop.state().enrolled.length, 0, 'and the conversation is no longer enrolled')

  up = false
  const off = loop.tick({ policy: policy(), conversationId: 'conv-A' })
  off.decision.kind === 'hold' && /not running/.test(off.decision.reason)
    ? ok('and with the application off the loop does nothing at all')
    : fail('the loop ran with the app off: ' + JSON.stringify(off.decision))
}

// ── the preview runs the same selector and asks for nothing ────────────────
{
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-auto-'))
  const asked = []
  const loop = createAutoLoop({
    dir,
    survey: () => ({ from: 'acct-A', current: reading(95), candidates: [candidate('acct-B', 20)] }),
    beginSwitch: (i) => {
      asked.push(i)
      return { ok: true, reason: 'queued' }
    },
    now: () => NOW
  })
  loop.enrol('conv-A')
  const preview = loop.preview({ policy: policy(), conversationId: 'conv-A' })
  preview.kind === 'queue_switch' && preview.to === 'acct-B'
    ? ok('the preview reaches the same decision as the tick would')
    : fail('preview: ' + JSON.stringify(preview))
  eq(asked.length, 0, 'and asks for nothing — no credential and no process is touched')
  eq(loop.switchesInTrailingHour(policy()), 0, 'and it does not count against the cap')
}

// ── a quarantined account stays out across a restart ──────────────────────
{
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-auto-'))
  const make = () =>
    createAutoLoop({
      dir,
      survey: () => ({ from: 'acct-A', current: reading(95), candidates: [candidate('acct-B', 20)] }),
      beginSwitch: () => ({ ok: true, reason: 'queued' }),
      now: () => NOW
    })
  const loop = make()
  loop.enrol('conv-A')
  loop.quarantine('acct-B', 'its refresh came back invalid')
  const held = loop.preview({ policy: policy(), conversationId: 'conv-A' })
  held.kind === 'hold' && held.excluded.some((e) => e.why === 'quarantined')
    ? ok('a quarantined account is excluded')
    : fail('quarantine: ' + JSON.stringify(held))
  const restarted = make()
  restarted.quarantinedAccounts()['acct-B']
    ? ok('and the quarantine survives a restart, with the reason it was given')
    : fail('the quarantine was lost across a restart')
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log('\nall green: nothing is eligible on this machine, the cap holds at 100%, and a restart shortens nothing')
