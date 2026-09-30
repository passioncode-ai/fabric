// A switch that cannot be confirmed is not a switch that worked (M199.resume).
//
// The card's four failure cases are this file:
//
//   1. A crash after the stop or after the spawn does not start a second
//      process on retry.
//   2. A tool effect already performed is not repeated by the recovery.
//   3. A wrong identity or a missing native-reference acknowledgement does not
//      commit success.
//   4. A revoked right, an unknown stop and a missing old login leave an honest
//      hold.
//
// Historical M199.probe receipts left `native-resume-ack` unverified for
// Claude Code 2.1.236 and Codex 0.152.1. Current pinned rows are checked below;
// a matrix pin is not a live observation of an installed host. Feasibility
// refuses without confirmed capability. The commit rule is exercised with
// injected evidence, not a real provider resume.
//
// Pure and local: a temp directory, an injected survey, an injected
// acknowledgement, an injected clock. No provider is executed, nothing is
// stopped, nothing is spawned.

import { createSwitchCoordinator } from '../src/main/switchCoordinator.ts'
import {
  budgetWasReset,
  carryBudget,
  feasibility,
  isTerminal,
  manifestProblems,
  mayAdvance,
  mayCommit,
  oldRunOutcome,
  SWITCH_PHASES
} from '../src/shared/switchOperation.ts'
import { CAPABILITY_MATRIX, PINNED_BUILDS } from '../src/shared/providerCapabilityMatrix.ts'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

/** Everything feasible, so each case can spoil exactly one thing. */
const FEASIBLE = {
  targetIdentityKnown: true,
  sameProvider: true,
  sameDataScope: true,
  nativeAckSupported: true,
  checkpointEntries: ['sessions/2026/09/rollout.jsonl'],
  pendingInput: false,
  unresolvedEffects: []
}

const coordinator = (over = {}) =>
  createSwitchCoordinator({
    dir: mkdtempSync(path.join(tmpdir(), 'fabric-switch-')),
    survey: () => ({ ...FEASIBLE }),
    acknowledge: () => ({ identity: 'org-1', nativeRef: 'native-1' }),
    now: () => 1_757_000_000_000,
    ...over
  })

const begin = (c, over = {}) =>
  c.begin({
    idempotencyKey: 'key-1',
    conversationId: 'conv-A',
    from: null,
    to: 'acct-B',
    expectedBinding: 1,
    oldGeneration: 1,
    ...over
  })

// ── the measurement decides whether this is attemptable at all ─────────────
{
  // The ack row for both pinned builds is `unverified`, so a coordinator told
  // the truth about this machine refuses before anything stops.
  const acked = CAPABILITY_MATRIX.filter((r) =>
    r.capability === 'native-resume-ack' && r.cliBuild === PINNED_BUILDS[r.provider])
  acked.length === Object.keys(PINNED_BUILDS).length &&
    new Set(acked.map((r) => r.provider)).size === Object.keys(PINNED_BUILDS).length &&
    acked.every((r) => r.status === 'unverified')
    ? ok('native-resume-ack remains unverified for each current pinned build; history is not current evidence')
    : fail('the matrix says ' + JSON.stringify(acked.map((r) => [r.provider, r.status])))

  const c = coordinator({ survey: () => ({ ...FEASIBLE, nativeAckSupported: false }) })
  const refused = begin(c)
  refused.ok === false && /never reported as continuation/.test(refused.reason + refused.feasibility.blockers.join(' '))
    ? ok('so a switch on this machine is refused BEFORE anything stops, and the reviewed handoff is named instead')
    : fail('a switch was begun on a build that cannot acknowledge: ' + JSON.stringify(refused))
  eq(c.operations().length, 0, 'and nothing is recorded — a blocked operation is not a row to dismiss')
  void PINNED_BUILDS
}

// ── every blocker at once, not one at a time ───────────────────────────────
{
  const verdict = feasibility({
    ...FEASIBLE,
    sameProvider: false,
    sameDataScope: false,
    pendingInput: true,
    unresolvedEffects: ['eff-1', 'eff-2']
  })
  verdict.feasible === false && verdict.blockers.length === 4
    ? ok('four blockers are reported together — being shown one, fixing it, and being shown the next is a lie about the shape')
    : fail('blockers: ' + JSON.stringify(verdict.blockers))
  ;/cross-provider handoff/.test(verdict.blockers.join(' '))
    ? ok('and a different provider is named as a different operation, not a failure')
    : fail('the provider blocker is missing')
}

// ── FAILURE CASE 2: an effect already performed is not repeated ────────────
{
  const verdict = feasibility({ ...FEASIBLE, unresolvedEffects: ['eff-1'] })
  verdict.feasible === false && /re-run them/.test(verdict.blockers.join(' '))
    ? ok('an effect reserved or dispatching with no observed outcome blocks the switch')
    : fail('unresolved effects did not block: ' + JSON.stringify(verdict.blockers))
  ;/no receipt can undo/.test(verdict.blockers.join(' '))
    ? ok('and the reason says why this one is different from the others')
    : fail('the reason does not say what is at stake')
}

// ── the checkpoint manifest cannot escape its root ─────────────────────────
{
  eq(manifestProblems(['a/b.jsonl']).length, 0, 'a relative entry is fine')
  manifestProblems(['/etc/passwd']).length === 1 ? ok('an absolute path is refused') : fail('absolute path allowed')
  manifestProblems(['../../secrets']).length === 1 ? ok('a traversal is refused') : fail('traversal allowed')
  manifestProblems(['a/../../b']).length === 1 ? ok('and one hidden in the middle of a path too') : fail('mid-path traversal allowed')
  manifestProblems(['C:\\Windows\\system32']).length === 1 ? ok('a drive-letter path is refused') : fail('drive path allowed')
  const blocked = feasibility({ ...FEASIBLE, checkpointEntries: ['../escape'] })
  blocked.feasible === false ? ok('and a bad manifest blocks the switch, not just the copy') : fail('a bad manifest did not block')
}

// ── FAILURE CASE 3: the four ways a commit must refuse ─────────────────────
{
  const expected = { expectedIdentity: 'org-1', expectedNativeRef: 'native-1' }
  mayCommit({ ...expected, ack: { identity: 'org-1', nativeRef: 'native-1' } }).allowed
    ? ok('both acknowledgements matching commits')
    : fail('a correct acknowledgement was refused')

  const nothing = mayCommit({ ...expected, ack: null })
  nothing.allowed === false && /wearing an old name/.test(nothing.reason)
    ? ok('no acknowledgement at all refuses — an unacknowledged resume is a new conversation wearing an old name')
    : fail('null ack: ' + JSON.stringify(nothing))

  const wrongWho = mayCommit({ ...expected, ack: { identity: 'org-2', nativeRef: 'native-1' } })
  wrongWho.allowed === false && /run as somebody else/.test(wrongWho.reason)
    ? ok('the right conversation as the wrong account refuses')
    : fail('wrong identity: ' + JSON.stringify(wrongWho))

  const wrongWhat = mayCommit({ ...expected, ack: { identity: 'org-1', nativeRef: 'native-9' } })
  wrongWhat.allowed === false && /not a partial success/.test(wrongWhat.reason)
    ? ok('and the right account on the wrong conversation refuses too — a different thing happened')
    : fail('wrong nativeRef: ' + JSON.stringify(wrongWhat))

  const noHistory = mayCommit({ expectedIdentity: 'org-1', expectedNativeRef: null, ack: { identity: 'org-1', nativeRef: null } })
  noHistory.allowed === false && /different operation/.test(noHistory.reason)
    ? ok('a conversation with no saved history cannot be resumed at all — that is the handoff path')
    : fail('no history: ' + JSON.stringify(noHistory))
}

// ── the phase ladder, and what may not skip ────────────────────────────────
{
  eq(SWITCH_PHASES.length, 8, 'eight phases, as the card names them')
  mayAdvance('preparing', 'waiting_boundary').ok ? ok('preparing leads to waiting_boundary') : fail('ladder start')
  mayAdvance('preparing', 'stopping').ok === false ? ok('and not straight to stopping') : fail('preparing skipped a phase')
  mayAdvance('stopping', 'preparing').ok === false
    ? ok('nothing goes back to preparing — feasibility is decided before anything stops')
    : fail('a stopped switch went back to preparing')
  mayAdvance('resuming', 'committed').ok ? ok('committed is reachable only from resuming') : fail('commit path')
  mayAdvance('stopping', 'committed').ok === false ? ok('and not from stopping') : fail('stopping committed')
  isTerminal('committed') && isTerminal('restored') ? ok('committed and restored are terminal') : fail('terminality')
  isTerminal('needs_reconciliation') === false
    ? ok('and a hold is NOT terminal — recovery can still be attempted')
    : fail('a hold was terminal, so nothing could ever recover it')
}

// ── FAILURE CASE 1: a crash does not start a second operation ──────────────
{
  const c = coordinator()
  const first = begin(c)
  first.ok && first.resumed === false ? ok('the first begin creates the operation') : fail('first: ' + JSON.stringify(first))
  eq(c.operation('key-1').phase, 'preparing', 'recorded at preparing')

  const moved = c.advance({ idempotencyKey: 'key-1', to: 'waiting_boundary' })
  const stopped = c.advance({ idempotencyKey: 'key-1', to: 'stopping', says: 'the adapter reported a safe boundary' })
  moved.ok && stopped.ok ? ok('it advances to stopping') : fail('advance: ' + JSON.stringify([moved, stopped]))

  // THE CRASH. A retry with the same key must find this operation rather than
  // make another, and must not repeat the phase that already happened.
  const retry = begin(c)
  retry.ok && retry.resumed === true && retry.operation.phase === 'stopping'
    ? ok('a retry after a crash RESUMES the same operation at the phase it reached')
    : fail('the retry produced ' + JSON.stringify(retry))
  eq(c.operations().length, 1, 'and there is one operation, not two')
  eq(c.operation('key-1').switchId, first.operation.switchId, 'with the same switch id')

  const other = c.begin({
    idempotencyKey: 'key-2',
    conversationId: 'conv-A',
    from: null,
    to: 'acct-C',
    expectedBinding: 1,
    oldGeneration: 1
  })
  other.ok === false && /already has an outstanding switch/.test(other.reason)
    ? ok('and a second switch of the same conversation is refused while one is outstanding')
    : fail('two switches raced: ' + JSON.stringify(other))
}

// ── a commit cannot be reached by advancing into it ────────────────────────
{
  const c = coordinator()
  begin(c)
  c.advance({ idempotencyKey: 'key-1', to: 'waiting_boundary' })
  c.advance({ idempotencyKey: 'key-1', to: 'stopping' })
  c.advance({ idempotencyKey: 'key-1', to: 'resuming' })
  const sneaked = c.advance({ idempotencyKey: 'key-1', to: 'committed' })
  sneaked.ok === false && /requires both acknowledgements/.test(sneaked.reason)
    ? ok('advancing straight into committed is refused — that is how a receipt gets written for nothing')
    : fail('a commit was advanced into: ' + JSON.stringify(sneaked))
}

// ── FAILURE CASE 4: an unconfirmed resume leaves an honest hold ────────────
{
  const c = coordinator({ acknowledge: () => null })
  begin(c)
  c.advance({ idempotencyKey: 'key-1', to: 'waiting_boundary' })
  c.advance({ idempotencyKey: 'key-1', to: 'stopping' })
  c.advance({ idempotencyKey: 'key-1', to: 'resuming' })
  const held = c.commit({ idempotencyKey: 'key-1', expectedIdentity: 'org-1', expectedNativeRef: 'native-1' })
  held.ok === false && held.operation.phase === 'needs_reconciliation'
    ? ok('an unacknowledged resume becomes an honest hold, not a success and not a silent failure')
    : fail('the hold was ' + JSON.stringify(held))
  ;/wearing an old name/.test(c.operation('key-1').receipt)
    ? ok('and the receipt carries why it was held, in the phase log')
    : fail('the receipt says nothing about the hold: ' + c.operation('key-1').receipt)

  const wrong = coordinator({ acknowledge: () => ({ identity: 'org-9', nativeRef: 'native-1' }) })
  begin(wrong)
  wrong.advance({ idempotencyKey: 'key-1', to: 'waiting_boundary' })
  wrong.advance({ idempotencyKey: 'key-1', to: 'stopping' })
  wrong.advance({ idempotencyKey: 'key-1', to: 'resuming' })
  const mismatched = wrong.commit({ idempotencyKey: 'key-1', expectedIdentity: 'org-1', expectedNativeRef: 'native-1' })
  mismatched.ok === false && mismatched.operation.phase === 'needs_reconciliation'
    ? ok('and so does a resume that came back as somebody else')
    : fail('a wrong identity committed: ' + JSON.stringify(mismatched))
}

// ── the one case that DOES commit, so the refusals above mean something ────
{
  const c = coordinator()
  begin(c)
  c.advance({ idempotencyKey: 'key-1', to: 'waiting_boundary' })
  c.advance({ idempotencyKey: 'key-1', to: 'stopping' })
  c.advance({ idempotencyKey: 'key-1', to: 'resuming' })
  const done = c.commit({ idempotencyKey: 'key-1', expectedIdentity: 'org-1', expectedNativeRef: 'native-1' })
  done.ok && done.operation.phase === 'committed'
    ? ok('a resume acknowledged as the right account on the right conversation commits')
    : fail('a correct switch did not commit: ' + JSON.stringify(done))
  ;/both acknowledged/.test(c.operation('key-1').receipt)
    ? ok('and its receipt says what was acknowledged')
    : fail('the receipt is thin: ' + c.operation('key-1').receipt)
}

// ── the old run's outcome, and the budget that does not reset ──────────────
{
  eq(oldRunOutcome(true), 'cancelled', 'a stop that was OBSERVED makes the old run cancelled')
  eq(oldRunOutcome(false), 'outcome_unknown', 'and one that was not is outcome_unknown, never cancelled')

  const before = { attemptsUsed: 3, msSpent: 90_000, spend: 1.25 }
  const after = carryBudget(before)
  budgetWasReset(before, after) === false
    ? ok('a new session carries the enclosing budget rather than resetting it')
    : fail('the budget was reset')
  budgetWasReset(before, { attemptsUsed: 0, msSpent: 0, spend: 0 })
    ? ok('and a reset is detectable, which is what makes that assertion worth making')
    : fail('a reset was not detected — the check cannot see the thing it forbids')
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log('\nall green: nothing stops before feasibility, a crash resumes one operation, and an unconfirmed resume holds')
