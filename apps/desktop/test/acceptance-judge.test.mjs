// Proving an account changed and the conversation continued — or refusing to.
//
// M199.acceptance. The card is blunt about its own outcome and the sentence is
// the design: "without test accounts or capability evidence the status stays
// not executed, not passed", and "fixture tests alone cannot pass acceptance".
//
// There are no authorised test accounts here. M199.probe reserved them for a
// separately granted certification, for a concrete reason: a second Claude Code
// login overwrites the one keychain item per operating-system user and logs the
// operator out of their live session. So the verdict on this machine is
// `not-executed`, and that is CORRECT rather than a shortfall — the first case
// below asserts exactly that.
//
// What IS testable without accounts is the judge. Four of the card's failure
// cases are judgements: a wrong-account acknowledgement must fail, reading a
// transcript must not pass as an independent observation, a repeated tool effect
// must fail, and a second conversation moving must fail. All four are here.
//
// Pure: no provider, no credential, no network, no filesystem.

import {
  ACCEPTANCE_PLAN,
  INDEPENDENT_METHODS,
  REQUIRED_CONTROLS,
  judge,
  maySupport,
  notExecuted
} from '../src/shared/acceptanceReceipt.ts'
import { CAPABILITY_MATRIX, PINNED_BUILDS } from '../src/shared/providerCapabilityMatrix.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const AT = '2026-09-10T00:00:00.000Z'
const HOST = 'darwin-arm64 host'

const control = (name, refused = true) => ({ name, refused, says: `${name} was ${refused ? 'refused' : 'accepted'}` })

const passing = (over = {}) => ({
  provider: 'codex-cli',
  cliBuild: '0.152.1',
  runtime: HOST,
  capabilityRevision: '2026-09-10',
  subjectRefs: ['subject-a', 'subject-b'],
  nativeRef: 'native-1',
  checkpointDigests: ['sha256:aa'],
  switchReceipts: [{ from: 'acct-A', to: 'acct-B', phase: 'committed', reason: 'both acknowledged' }],
  independentObservations: [
    { method: 'pre-placed-marker', says: 'the marker placed before the switch was found after it', confirmed: true },
    { method: 'provider-identity-reader', says: 'the provider reports account B', confirmed: true },
    { method: 'provider-native-ref', says: 'the provider echoed native-1', confirmed: true }
  ],
  negativeControls: REQUIRED_CONTROLS.map((n) => control(n)),
  outcome: 'passed',
  at: AT,
  ...over
})

// ── WHAT IS TRUE ON THIS MACHINE ───────────────────────────────────────────
{
  const receipt = notExecuted({
    provider: 'claude-code',
    cliBuild: PINNED_BUILDS['claude-code'],
    runtime: HOST,
    capabilityRevision: '2026-09-10',
    at: AT,
    why: 'no authorised test accounts'
  })
  const verdict = judge(receipt)
  eq(verdict.outcome, 'not-executed', 'with nothing run, the verdict is NOT-EXECUTED')
  ;/is not a failure/.test(verdict.blockers.join(' '))
    ? ok('and it says so — calling it failed would invent a defect, calling it passed would invent a capability')
    : fail('the blocker does not distinguish not-executed from failed: ' + verdict.blockers.join(' '))
  ;/fixture tests alone cannot pass it/.test(verdict.says)
    ? ok('and names why: live tests need scoped authorised accounts')
    : fail('the verdict does not say what is missing: ' + verdict.says)

  // And the capability matrix agrees, which is what makes this consistent
  // rather than merely stated twice.
  const acked = CAPABILITY_MATRIX.filter((r) => r.capability === 'native-resume-ack')
  acked.every((r) => r.status !== 'supported')
    ? ok('the capability matrix says the same thing for both pinned builds')
    : fail('the matrix disagrees: ' + JSON.stringify(acked.map((r) => [r.provider, r.status])))
}

// ── the one receipt that DOES pass, so the refusals mean something ─────────
{
  const verdict = judge(passing())
  eq(verdict.outcome, 'passed', 'a run with independent observations and every control refused passes')
  eq(verdict.blockers.length, 0, 'with no blockers')
  ;/3 independent observation\(s\) confirmed/.test(verdict.says)
    ? ok('and the verdict counts what it relied on')
    : fail('says: ' + verdict.says)
}

// ── FAILURE CASE 1: a deliberately wrong acknowledgement must FAIL ─────────
{
  for (const name of ['wrong-account-ack', 'wrong-native-ref-ack']) {
    const receipt = passing({
      negativeControls: REQUIRED_CONTROLS.map((n) => control(n, n !== name))
    })
    const verdict = judge(receipt)
    verdict.outcome === 'failed' && verdict.blockers.some((b) => b.includes(name))
      ? ok(`${name} getting through FAILS acceptance — a control that passed is a control that failed`)
      : fail(`${name}: ` + JSON.stringify(verdict))
  }
}

// ── FAILURE CASE 2: a transcript read is not an independent observation ────
{
  const receipt = passing({
    independentObservations: [
      { method: 'transcript-read', says: 'the saved terminal output shows the earlier turns', confirmed: true }
    ]
  })
  const verdict = judge(receipt)
  verdict.outcome === 'inconclusive' && verdict.blockers.some((b) => /Fabric recorded/.test(b))
    ? ok('reading Fabric’s own transcript does NOT pass as an independent observation')
    : fail('a transcript read was accepted: ' + JSON.stringify(verdict))
  INDEPENDENT_METHODS.includes('transcript-read') === false
    ? ok('and the method is excluded by name, not by a judgement call at the call site')
    : fail('transcript-read is listed as independent')
}

// ── FAILURE CASE 3: a repeated tool effect must FAIL ──────────────────────
{
  const receipt = passing({
    negativeControls: REQUIRED_CONTROLS.map((n) => control(n, n !== 'repeated-tool-effect'))
  })
  const verdict = judge(receipt)
  verdict.outcome === 'failed' && verdict.blockers.some((b) => b.includes('repeated-tool-effect'))
    ? ok('a tool effect run twice FAILS acceptance')
    : fail('a repeated effect passed: ' + JSON.stringify(verdict))
}

// ── FAILURE CASE 3b: a second conversation moving must FAIL ───────────────
{
  const receipt = passing({
    negativeControls: REQUIRED_CONTROLS.map((n) => control(n, n !== 'second-conversation-moved'))
  })
  const verdict = judge(receipt)
  verdict.outcome === 'failed'
    ? ok('and so does a switch that moved a second conversation')
    : fail('a second conversation moved and it passed: ' + JSON.stringify(verdict))
}

// ── a missing control is inconclusive, not a pass and not a failure ───────
{
  const receipt = passing({ negativeControls: [control('wrong-account-ack')] })
  const verdict = judge(receipt)
  verdict.outcome === 'inconclusive' && verdict.blockers.filter((b) => /was not run/.test(b)).length === 4
    ? ok('four controls not run leaves it INCONCLUSIVE — nothing was accepted, and nothing was shown refused either')
    : fail('missing controls: ' + JSON.stringify(verdict))
}

// ── one account subject is not two ────────────────────────────────────────
{
  const verdict = judge(passing({ subjectRefs: ['only-one'] }))
  verdict.outcome !== 'passed' && verdict.blockers.some((b) => /two account subjects/.test(b))
    ? ok('a run with one subject cannot prove a switch between two')
    : fail('one subject passed: ' + JSON.stringify(verdict))
}

// ── an observation that did not come back as expected ────────────────────
{
  const receipt = passing({
    independentObservations: [
      { method: 'pre-placed-marker', says: 'the marker was NOT found', confirmed: false },
      { method: 'provider-identity-reader', says: 'the provider reports account B', confirmed: true }
    ]
  })
  const verdict = judge(receipt)
  verdict.outcome !== 'passed' && verdict.blockers.some((b) => /did not come back as expected/.test(b))
    ? ok('an unconfirmed observation blocks the pass rather than being outvoted by the confirmed ones')
    : fail('an unconfirmed observation passed: ' + JSON.stringify(verdict))
}

// ── FAILURE CASE 4: `supported` is reachable only from a pass, per build ──
{
  const claim = { provider: 'codex-cli', cliBuild: '0.152.1', runtime: HOST }
  maySupport(passing(), claim).allowed
    ? ok('a passing receipt may mark its own build supported')
    : fail('a pass could not support its own build')

  const notRun = notExecuted({
    provider: 'codex-cli',
    cliBuild: '0.152.1',
    runtime: HOST,
    capabilityRevision: '2026-09-10',
    at: AT,
    why: 'no accounts'
  })
  const refused = maySupport(notRun, claim)
  refused.allowed === false && /not-executed/.test(refused.reason)
    ? ok('and a run that did not happen may not — the status stays not executed, not passed')
    : fail('a not-executed receipt supported a capability: ' + JSON.stringify(refused))

  const otherBuild = maySupport(passing(), { ...claim, cliBuild: '0.153.0' })
  otherBuild.allowed === false && /property of its version/.test(otherBuild.reason)
    ? ok('a pass on one build says nothing about the next one')
    : fail('a pass leaked across builds: ' + JSON.stringify(otherBuild))

  const otherRuntime = maySupport(passing(), { ...claim, runtime: 'wsl:ubuntu' })
  otherRuntime.allowed === false
    ? ok('and nothing about another runtime')
    : fail('a pass leaked across runtimes')
}

// ── the plan is data, so a granted certification is one command ───────────
{
  ACCEPTANCE_PLAN.length >= 8
    ? ok(`the plan has ${ACCEPTANCE_PLAN.length} steps written down rather than described`)
    : fail('the plan is too short to be a plan: ' + ACCEPTANCE_PLAN.length)
  ACCEPTANCE_PLAN.every((s) => s.step && s.needs && s.proves)
    ? ok('and every step says what it needs and what it proves')
    : fail('a step is missing a field')
  ACCEPTANCE_PLAN.some((s) => /marker/.test(s.step))
    ? ok('including the pre-placed marker, which is what makes an observation independent')
    : fail('the plan has no independent observation step')
  ACCEPTANCE_PLAN.at(-1)?.proves.includes('CO-112')
    ? ok('and the last step names the boundary CO-112 may be closed by, and nothing wider')
    : fail('the plan does not tie its end to CO-112')
}

// ── the judge carries no credential, whatever it is given ────────────────
{
  const text = JSON.stringify(judge(passing()))
  ;/sk-ant-|access_?token|BEGIN [A-Z ]*PRIVATE KEY/i.test(text)
    ? fail('the verdict carried something shaped like a credential')
    : ok('a verdict carries no credential')
  // And the check is shown able to see one, so the assertion above is not
  // passing by being blind.
  ;/sk-ant-/i.test(JSON.stringify({ says: 'sk-ant-not-real' }))
    ? ok('and the detector is shown catching one when it is there')
    : fail('the credential detector cannot see a credential')
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log('\nall green: nothing run is NOT-EXECUTED, a transcript is not evidence, and a pass is per build')
