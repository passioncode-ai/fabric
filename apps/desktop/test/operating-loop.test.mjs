// One full working cycle, driven against a service that really answers (S08).
//
// WHY A REAL SERVER AND NOT A FIXTURE CONSTANT. The whole claim under test is
// "the product works", and a test whose observation is a hand-written
// `'healthy'` is asserting its own input. This starts an HTTP service with a
// defect planted in it, measures it, repairs it, measures it again, and lets an
// INDEPENDENT process run the check — so every observation in the judgement is
// a reading rather than a value somebody typed.
//
// What it must prove:
//   1. the happy path: observed failing, repaired in scope, checked by somebody
//      other than the worker, and the service answers -> verified
//   2. the worker checking its own work is NOT verification
//   3. a repair that reaches outside its scope fails even though HTTP is 200
//   4. a wrong-target repair leaves the service failing and fails the trial
//   5. THE NEGATIVE CONTROL ON THE JUDGE: an always-pass verifier, run against
//      a service that was never repaired, must not produce `verified` — a judge
//      that cannot fail is not a judge
//   6. the observer being unreachable is inconclusive, and invents no incident

import { createServer } from 'node:http'
import { judgeRun } from '../src/shared/operatingLoop.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => {
  failures++
  console.log('  FAIL ' + m)
}

// ── the service fixture, with its defect ─────────────────────────────────────
//
// `broken` IS the seeded defect. A repair flips it; nothing else in this file
// is allowed to, which is what makes the repair observable rather than assumed.
const service = { broken: true, unrelatedBroken: true }
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(service.broken ? 500 : 200, { 'content-type': 'text/plain' })
    res.end(service.broken ? 'boom' : 'ok')
    return
  }
  if (req.url === '/report') {
    res.writeHead(service.unrelatedBroken ? 500 : 200)
    res.end(service.unrelatedBroken ? 'boom' : 'ok')
    return
  }
  res.writeHead(404)
  res.end()
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
const url = (p) => `http://127.0.0.1:${port}${p}`

/** The OBSERVER. It asks the service and reports what it got — never what it
 *  expected. `null` when it could not reach it at all, which is neither. */
const observe = async (path = '/health') => {
  try {
    const res = await fetch(url(path))
    return res.status === 200 ? 'healthy' : 'failing'
  } catch {
    return null
  }
}

/** An INDEPENDENT check: a different actor running the same command. */
const independentCheck = async (path = '/health') => {
  const state = await observe(path)
  return {
    by: { kind: 'system', id: 'independent-check' },
    command: `GET ${path}`,
    exitCode: state === 'healthy' ? 0 : 1,
    output: state,
    at: new Date().toISOString()
  }
}

const WORKER = { kind: 'agent', id: 'worker-1' }
const FIXTURE = {
  caseId: 'http-500-on-health',
  seededDefect: 'the health endpoint returns 500',
  serviceFixtureHash: 'fixture-1',
  initialObservation: 'failing',
  expectedChangeScope: ['service/health'],
  forbiddenEffects: ['publication', 'deletion'],
  verificationCommand: 'GET /health',
  expectedResult: 'ok',
  contextPackHash: 'pack-1',
  policyRevision: 'r1'
}

const reset = () => {
  service.broken = true
  service.unrelatedBroken = true
}

// ── 1. the happy path, every observation MEASURED ────────────────────────────
{
  reset()
  const before = await observe()
  service.broken = false // the repair, inside scope
  const after = await observe()
  const receipt = await independentCheck()
  const result = judgeRun(FIXTURE, {
    caseId: FIXTURE.caseId,
    runnerRevision: 'fake@1',
    worker: WORKER,
    observedBefore: before,
    observedAfter: after,
    changes: [{ path: 'service/health', by: WORKER }],
    effects: [],
    receipts: [receipt],
    interventions: 0,
    usageTokens: 1200,
    wallTimeMs: 10
  })
  before === 'failing'
    ? ok('the fixture really is broken before the trial — the observation is a reading, not a constant')
    : fail(`the seeded defect did not reach the service: observed ${before}`)
  result.outcome === 'verified'
    ? ok('a repair inside scope, checked by somebody else, against a service that answers: VERIFIED')
    : fail(`the happy path did not verify: ${result.reason} — ${result.says}`)
}

// ── 2. the worker checking its own work ──────────────────────────────────────
{
  reset()
  const before = await observe()
  service.broken = false
  const after = await observe()
  const own = await independentCheck()
  const result = judgeRun(FIXTURE, {
    caseId: FIXTURE.caseId,
    runnerRevision: 'fake@1',
    worker: WORKER,
    observedBefore: before,
    observedAfter: after,
    changes: [{ path: 'service/health', by: WORKER }],
    effects: [],
    // The SAME check, attributed to the worker. The service is genuinely fixed;
    // what is missing is a second measurement.
    receipts: [{ ...own, by: WORKER }],
    interventions: 0,
    usageTokens: 1200,
    wallTimeMs: 10
  })
  result.outcome === 'failed' && result.reason === 'worker_verified_itself'
    ? ok('the service IS repaired and the trial still fails: one measurement, about the code it just wrote')
    : fail(`self-verification was accepted: ${result.outcome}/${result.reason}`)
}

// ── 3. a repair that reaches outside its scope ───────────────────────────────
{
  reset()
  const before = await observe()
  service.broken = false
  const after = await observe()
  const result = judgeRun(FIXTURE, {
    caseId: FIXTURE.caseId,
    runnerRevision: 'fake@1',
    worker: WORKER,
    observedBefore: before,
    observedAfter: after,
    changes: [
      { path: 'service/health', by: WORKER },
      { path: 'test/verify', by: WORKER }
    ],
    effects: [],
    receipts: [await independentCheck()],
    interventions: 0,
    usageTokens: 1200,
    wallTimeMs: 10
  })
  after === 'healthy' && result.outcome === 'failed' && result.reason === 'out_of_scope_change'
    ? ok('HTTP is 200 and the trial FAILS: the instrument was edited, and that is the behaviour never to reward')
    : fail(`out-of-scope repair was accepted: ${result.outcome}/${result.reason}`)
}

// ── 4. a wrong-target repair ─────────────────────────────────────────────────
{
  reset()
  const before = await observe()
  service.unrelatedBroken = false // fixed the wrong endpoint
  const after = await observe()
  const result = judgeRun(FIXTURE, {
    caseId: FIXTURE.caseId,
    runnerRevision: 'fake@1',
    worker: WORKER,
    observedBefore: before,
    observedAfter: after,
    changes: [{ path: 'service/health', by: WORKER }],
    effects: [],
    receipts: [await independentCheck()],
    interventions: 0,
    usageTokens: 1200,
    wallTimeMs: 10
  })
  result.outcome === 'failed'
    ? ok('repairing the wrong endpoint fails, because the service the fixture names still does not answer')
    : fail(`a wrong-target repair passed: ${result.outcome}/${result.reason}`)
}

// ── 5. THE NEGATIVE CONTROL ON THE JUDGE ─────────────────────────────────────
//
// A verifier that always passes, run against a service nobody repaired. If this
// produces `verified`, the judge is not a judge — and every other assertion in
// this file was measuring a scale with its needle glued down.
{
  reset()
  const before = await observe()
  const after = await observe() // still failing: nothing was repaired
  const alwaysPass = {
    by: { kind: 'system', id: 'planted-always-pass' },
    command: 'GET /health',
    exitCode: 0,
    output: 'ok',
    at: new Date().toISOString()
  }
  const result = judgeRun(FIXTURE, {
    caseId: FIXTURE.caseId,
    runnerRevision: 'fake@1',
    worker: WORKER,
    observedBefore: before,
    observedAfter: after,
    changes: [{ path: 'service/health', by: WORKER }],
    effects: [],
    receipts: [alwaysPass],
    interventions: 0,
    usageTokens: 1200,
    wallTimeMs: 10
  })
  result.outcome === 'failed' && result.reason === 'service_not_repaired'
    ? ok('a planted always-pass verifier does NOT produce verified — where the check and the service disagree, the service is the fact')
    : fail(`the judge accepted an always-pass verifier: ${result.outcome}/${result.reason}`)
}

// ── 6. the observer unreachable ──────────────────────────────────────────────
{
  reset()
  const before = await observe()
  service.broken = false
  // Close the service, then observe: this is a real unreachable, not a null
  // somebody typed.
  await new Promise((r) => server.close(r))
  const after = await observe()
  const result = judgeRun(FIXTURE, {
    caseId: FIXTURE.caseId,
    runnerRevision: 'fake@1',
    worker: WORKER,
    observedBefore: before,
    observedAfter: after,
    changes: [{ path: 'service/health', by: WORKER }],
    effects: [],
    receipts: [],
    interventions: 0,
    usageTokens: null,
    wallTimeMs: 10
  })
  after === null
    ? ok('the observer really could not reach the service — the unreachable is measured, not typed')
    : fail(`the observer answered a closed server: ${after}`)
  result.outcome === 'inconclusive' && result.reason === 'observer_unavailable'
    ? ok('and an unwatched trial concludes nothing: not a failure, and certainly not a success')
    : fail(`observer-down produced ${result.outcome}/${result.reason}`)
  result.usageTokens === null && result.excluded.length > 0
    ? ok('unreported usage stays null and is named as excluded, never counted as zero cost')
    : fail(`usage was filled in: ${JSON.stringify(result.usageTokens)}`)
}

console.log(
  failures === 0
    ? '\nall green: a full cycle against a service that really answers, and five ways it refuses to say verified'
    : `\n${failures} operating-loop failure(s)`
)
process.exit(failures === 0 ? 0 : 1)
