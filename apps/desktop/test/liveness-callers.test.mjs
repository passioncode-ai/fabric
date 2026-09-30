// Two callers, one derivation, five different answers (AX-02).
//
// `deriveLiveness` is careful and correct. Its problem is that BOTH of its
// callers build its input as a literal, so each one decides for itself what it
// does not know — and they decided differently:
//
//                        watcher (runtimeObserver)   widget (runs.status)
//   gap                  classifyObservationGap      ABSENT
//   orientedAt           read from session.oriented  ALWAYS null
//   waitingOn            not selected at all         SELECTED AND DROPPED
//   beatsSupported       capabilitiesFor(optionId)   declaredCapabilities({…})
//   blockers on failure  n/a                         `?? 0` — zero blockers
//
// The card's own words: "reproduced pure-function divergence: same fresh
// working beat becomes stalled with handler input". Case 1 below is that
// reproduction, built from the two call sites verbatim.
//
// AND THE TYPE IS WHY. `classifyOrientation` takes `number | null | undefined`
// and treats null and undefined identically, so "no orientation was recorded"
// and "nobody read the orientation" are one value with two meanings. The widget
// could not say which it meant. That is the card's third negative acceptance —
// "unsupported reporter cannot be called broken solely for no orientation when
// no orientation capability exists" — and it needed a third answer, not a
// better caller.
//
// THE EXCLUSION IS OBEYED: "do not test only deriveLiveness; test its two
// callers." The watcher is driven through `createRuntimeObserver`, and the
// widget's half through the read service it now delegates to. Case 1 is the
// only one that builds an input literal, and it exists to record the defect
// rather than to cover the fix.
//
// Pure: no database, no network, an injected clock.

import { deriveLiveness } from '../src/shared/liveness.ts'
import { DEFAULT_THRESHOLDS } from '../src/main/runtimeObserver.ts'
import { livenessInputFrom } from '../src/shared/livenessInput.ts'
import { createRuntimeObserver } from '../src/main/runtimeObserver.ts'
import { livenessFor } from '../src/main/livenessRead.ts'
import { classifyObservationGap } from '../src/shared/harnessBreak.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const NOW = 1_757_500_000_000
const MINUTE = 60_000

/** One session's facts, as both callers see them: fresh, oriented, beating. */
const FACTS = {
  sessionId: 's-1',
  optionId: 'claude-code',
  processEnded: false,
  startedAt: NOW - 30 * MINUTE,
  lastOutputAt: NOW - 20 * MINUTE,
  orientedAt: NOW - 29 * MINUTE,
  beat: {
    beat_seq: 12,
    phase: 'working',
    last_received_at: new Date(NOW - MINUTE).toISOString(),
    waiting_kind: null,
    waiting_id: null,
    waiting_resolved_at: null
  }
}

// ── 1. THE DIVERGENCE, recorded from the two call sites verbatim ───────────
{
  // The watcher's literal: gap classified, orientation read, no wait target.
  const asWatcher = deriveLiveness({
    gap: classifyObservationGap({
      since: FACTS.startedAt,
      now: NOW,
      host: { watchingSince: NOW - 120 * MINUTE, suspended: [], sourceHealthy: true }
    }),
    heartbeat: {
      beatSeq: FACTS.beat.beat_seq,
      phase: FACTS.beat.phase,
      receivedAt: Date.parse(FACTS.beat.last_received_at)
    },
    beatsSupported: true,
    observation: {
      processEnded: FACTS.processEnded,
      lastOutputAt: FACTS.lastOutputAt,
      orientedAt: FACTS.orientedAt,
      startedAt: FACTS.startedAt
    },
    thresholds: DEFAULT_THRESHOLDS,
    now: NOW
  })

  // The widget's literal: no gap, `orientedAt: null` unconditionally.
  const asWidget = deriveLiveness({
    heartbeat: {
      beatSeq: FACTS.beat.beat_seq,
      phase: FACTS.beat.phase,
      receivedAt: Date.parse(FACTS.beat.last_received_at)
    },
    beatsSupported: true,
    observation: {
      processEnded: FACTS.processEnded,
      lastOutputAt: FACTS.lastOutputAt,
      orientedAt: null,
      startedAt: FACTS.startedAt
    },
    thresholds: DEFAULT_THRESHOLDS,
    now: NOW
  })

  eq(asWatcher.state, 'working', 'the watcher reads a fresh oriented beat as working')
  // The widget literal is KEPT as the record of what it used to send, and its
  // answer is the defect: `stalled` for a healthy agent, at complete coverage.
  eq(asWidget.state, 'stalled', 'and the literal the widget used to send said stalled — the defect, recorded')
  eq(asWidget.coverage, 'available', 'at COMPLETE coverage, so the false alarm arrived as a certainty')
}

// ── 2. one assembler, so neither caller can invent a null ──────────────────
{
  const shared = (over = {}) =>
    livenessInputFrom({
      session: {
        processEnded: FACTS.processEnded,
        lastOutputAt: FACTS.lastOutputAt,
        startedAt: FACTS.startedAt
      },
      beat: FACTS.beat,
      beatsSupported: true,
      orientation: { read: true, orientedAt: FACTS.orientedAt },
      gap: undefined,
      thresholds: DEFAULT_THRESHOLDS,
      now: NOW,
      ...over
    })

  eq(deriveLiveness(shared()).state, 'working', 'the assembled input reads a fresh oriented beat as working')

  // THE WAIT TARGET, which both callers omitted and one of them had in hand.
  // THE FIXTURE MUST BE THE CASE: a beat that names a wait target reports a
  // WAITING phase. The first version said `phase: 'working'` with a target set,
  // which the product cannot produce — branch 5 requires both, and rightly, or
  // a stale target would explain the silence of an agent that had moved on.
  const waiting = shared({
    beat: { ...FACTS.beat, phase: 'waiting', waiting_kind: 'question', waiting_id: 'q-1' }
  })
  eq(
    deriveLiveness(waiting).state,
    'waiting',
    'a session whose beat names an unresolved question reads as waiting, not as working'
  )
  waiting.heartbeat?.waitingOn?.id === 'q-1'
    ? ok('and the target travels with the claim, so the surface can name what it waits on')
    : fail('the wait target was dropped by the assembler: ' + JSON.stringify(waiting.heartbeat?.waitingOn))

  // RESOLVED: the grace runs from the resolution, and expires.
  const justResolved = shared({
    beat: { ...FACTS.beat, phase: 'waiting', waiting_kind: 'question', waiting_id: 'q-1' },
    wait: { resolved: 'at', when: NOW - 1000 }
  })
  eq(
    deriveLiveness(justResolved).state,
    'waiting',
    'a target resolved one second ago is still within its grace'
  )
  const longResolved = shared({
    beat: { ...FACTS.beat, phase: 'waiting', waiting_kind: 'question', waiting_id: 'q-1' },
    wait: { resolved: 'at', when: NOW - 60 * MINUTE }
  })
  deriveLiveness(longResolved).state !== 'waiting'
    ? ok('and a target resolved an hour ago no longer holds it waiting: ' + deriveLiveness(longResolved).state)
    : fail('a resolved target held the session waiting forever')
}

// ── 3. the third orientation answer: not read is not a suspicion ───────────
{
  const notRead = livenessInputFrom({
    session: { processEnded: false, lastOutputAt: NOW - 20 * MINUTE, startedAt: FACTS.startedAt },
    beat: FACTS.beat,
    beatsSupported: true,
    // The case the widget produced on every call, and the one the type could
    // not express: nobody looked.
    orientation: { read: false, why: 'this reader does not query session.oriented@1' },
    gap: undefined,
    thresholds: DEFAULT_THRESHOLDS,
    now: NOW
  })
  const reading = deriveLiveness(notRead)
  reading.state !== 'stalled'
    ? ok('an unread orientation is not a stall: ' + reading.state)
    : fail('THE THIRD ANSWER IS MISSING: an unread orientation was reported as a stall')
  reading.coverage !== 'available'
    ? ok('and the coverage says the answer is not complete: ' + reading.coverage)
    : fail('an unread orientation claimed complete coverage')
}

// ── 4. the WATCHER, driven as a caller ─────────────────────────────────────
{
  const rows = {
    session_heartbeats: [{
      session_id: 's-1', beat_seq: 12, phase: 'working',
      last_received_at: new Date(NOW - MINUTE).toISOString(),
      phase: 'waiting', waiting_kind: 'question', waiting_id: 'q-1'
    }],
    journal: [{ payload: { session_id: 's-1' } }],
    // The question it waits on, UNANSWERED — so `waiting` is the honest state
    // and the resolution lookup has a real subject rather than an empty table.
    questions: [{ id: 'q-1', answered_at: null }]
  }
  /**
   * THE FAKE HONOURS THE COLUMN LIST, and it took a plant to make it.
   *
   * The first version returned the whole row whatever the query asked for, so
   * removing `waiting_kind,waiting_id` from the watcher's SELECT changed
   * nothing and the case claiming to watch that select stayed green. A fake
   * more generous than the database cannot see a column nobody asked for —
   * which is precisely the defect this card is about.
   */
  const project = (row, columns) => {
    const wanted = columns.split(',').map((c) => c.trim())
    return Object.fromEntries(Object.entries(row).filter(([k]) => wanted.includes(k)))
  }
  const store = {
    // `selectIn` is part of the ScopedStore contract and the watcher now uses
    // it to resolve wait targets in one batch. A fake missing it does not fail
    // a case — it throws before any case runs, which is how the first version
    // of this fixture silently skipped the whole caller.
    selectIn: async (table, cols, _col, values) => ({
      rows: (rows[table] ?? [])
        .filter((r) => values.includes(String(r.id)))
        .map((r) => project(r, cols)),
      failed: null
    }),
    select: (table, columns) => {
      const q = {
        eq: () => q,
        order: () => q,
        limit: () => q,
        then: (resolve) =>
          Promise.resolve({
            data: (rows[table] ?? []).map((r) => project(r, columns)),
            error: null
          }).then(resolve)
      }
      return q
    }
  }
  const appended = []
  const observer = createRuntimeObserver({
    store,
    journal: { append: async (e) => { appended.push(e); return { seq: appended.length } } },
    sessions: () => [{
      sessionId: 's-1', optionId: 'claude-code', processEnded: false,
      startedAt: FACTS.startedAt, lastOutputAt: FACTS.lastOutputAt
    }],
    host: () => ({ watchingSince: NOW - 120 * MINUTE, suspended: [], sourceHealthy: true }),
    now: () => NOW,
    thresholds: DEFAULT_THRESHOLDS
  })
  const out = await observer.sample()
  eq(out.length, 1, 'the watcher answered for the one session')
  eq(
    out[0].state,
    'waiting',
    'and it reads the wait target it never used to select — an unresolved question is waiting, not working'
  )
}


// ── 5. the WIDGET, driven through the read service it now delegates to ─────
{
  const NOW2 = NOW
  const tables = {
    session_heartbeats: {
      beat_seq: 12,
      phase: 'working',
      last_received_at: new Date(NOW2 - MINUTE).toISOString(),
      waiting_kind: null,
      waiting_id: null
    },
    task_runs: [{ task_run_id: 'r-1', task_id: 't-1', run_ordinal: 1, state: 'running', outcome: null }],
    // The orientation record this reader never used to ask for.
    journal: [{ seq: 5 }],
    question_blocks: [{ question_id: 'q-9' }],
    project_tasks: { title: 'Ship the ledger', instruction: 'do it' }
  }
  const failFor = new Set()
  const store = {
    select: (table) => {
      const q = {
        eq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: () =>
          Promise.resolve(
            failFor.has(table)
              ? { data: null, error: { message: table + ' refused' } }
              : { data: tables[table] ?? null, error: null }
          ),
        then: (resolve) =>
          Promise.resolve(
            failFor.has(table)
              ? { data: null, error: { message: table + ' refused' } }
              : { data: tables[table] ?? [], error: null }
          ).then(resolve)
      }
      return q
    }
  }

  const session = { processEnded: false, lastOutputAt: NOW2 - 20 * MINUTE, startedAt: NOW2 - 30 * MINUTE }
  const snap = await livenessFor(store, {
    sessionId: 's-1',
    session,
    beatsSupported: true,
    host: { watchingSince: NOW2 - 120 * MINUTE, suspended: [], sourceHealthy: true },
    thresholds: DEFAULT_THRESHOLDS,
    now: NOW2
  })
  const widgetReading = deriveLiveness(snap.input)
  eq(
    widgetReading.state,
    'working',
    'THE DIVERGENCE IS CLOSED: the widget reader now reads the same fresh oriented beat as working'
  )
  eq(snap.blockers.known, true, 'and the blocking questions were read')
  eq(snap.blockers.count, 1, 'with the count it actually found')

  // A REFUSED BLOCKER READ IS NOT ZERO BLOCKERS.
  failFor.add('question_blocks')
  const refused = await livenessFor(store, {
    sessionId: 's-1', session, beatsSupported: true,
    host: { watchingSince: NOW2 - 120 * MINUTE, suspended: [], sourceHealthy: true },
    thresholds: DEFAULT_THRESHOLDS, now: NOW2
  })
  eq(refused.blockers.known, false, 'a refused blocker read is an explicit unknown, not a zero')
  refused.sources.some((r) => r.name === 'blockers' && r.status === 'error')
    ? ok('and the receipt names which source failed')
    : fail('the refusal left no receipt: ' + JSON.stringify(refused.sources))
  failFor.delete('question_blocks')

  // A REFUSED ORIENTATION READ IS NOT A STALL.
  failFor.add('journal')
  const blind = await livenessFor(store, {
    sessionId: 's-1', session, beatsSupported: true,
    host: { watchingSince: NOW2 - 120 * MINUTE, suspended: [], sourceHealthy: true },
    thresholds: DEFAULT_THRESHOLDS, now: NOW2
  })
  const blindReading = deriveLiveness(blind.input)
  blindReading.state !== 'stalled'
    ? ok('a refused orientation read is not a stall: ' + blindReading.state)
    : fail('a source outage was reported as an agent fault')
  eq(blindReading.coverage, 'unobserved', 'and the coverage says so')
  blind.unread.some((u) => u.startsWith('orientation'))
    ? ok('and the reading names the input nobody read')
    : fail('the unread input was not named: ' + JSON.stringify(blind.unread))
  failFor.delete('journal')
}

// ── 6. host sleep is the observer's silence, in BOTH readers ───────────────
{
  // The card's second negative acceptance: "host sleep/restart cannot become
  // agent fault". The watcher classified the gap and the widget passed none at
  // all, so a laptop that slept for eight hours made every agent look stalled
  // on the project page and quiet in the queue — the same machine, two verdicts.
  const slept = classifyObservationGap({
    since: NOW - 8 * 60 * MINUTE,
    now: NOW,
    host: {
      watchingSince: NOW - 9 * 60 * MINUTE,
      suspended: [{ from: NOW - 8 * 60 * MINUTE, to: NOW - 60_000 }],
      sourceHealthy: true
    }
  })
  slept.blameAgent === false
    ? ok('an eight-hour suspend is the host\'s silence, not the agent\'s')
    : fail('the gap classifier blamed the agent for a suspended host')

  const withGap = livenessInputFrom({
    session: { processEnded: false, lastOutputAt: NOW - 8 * 60 * MINUTE, startedAt: NOW - 9 * 60 * MINUTE },
    beat: { ...FACTS.beat, last_received_at: new Date(NOW - 8 * 60 * MINUTE).toISOString() },
    beatsSupported: true,
    orientation: { read: true, orientedAt: NOW - 9 * 60 * MINUTE },
    gap: slept,
    thresholds: DEFAULT_THRESHOLDS,
    now: NOW
  })
  const reading = deriveLiveness(withGap)
  reading.state !== 'stalled'
    ? ok('and a session across that suspend is not stalled: ' + reading.state)
    : fail('a suspended host became an agent fault')
  eq(reading.coverage, 'unobserved', 'with coverage saying nobody was watching')

  // WITHOUT the gap — what the widget used to send — the same facts accuse the
  // agent. This is the defect, recorded, not the fix.
  const noGap = livenessInputFrom({
    session: { processEnded: false, lastOutputAt: NOW - 8 * 60 * MINUTE, startedAt: NOW - 9 * 60 * MINUTE },
    beat: { ...FACTS.beat, last_received_at: new Date(NOW - 8 * 60 * MINUTE).toISOString() },
    beatsSupported: true,
    orientation: { read: true, orientedAt: NOW - 9 * 60 * MINUTE },
    gap: undefined,
    thresholds: DEFAULT_THRESHOLDS,
    now: NOW
  })
  eq(
    deriveLiveness(noGap).state,
    'stalled',
    'and with no gap passed the same facts accuse the agent — which is what the widget used to do'
  )
}

// ── 7. the widget's reader classifies its OWN gap, so nobody can omit it ───
{
  // A plant proved this necessary: while the gap was a PARAMETER, removing the
  // classification from the handler left every case green, because the omission
  // lived in the caller and this service only received what it was handed. It
  // takes a host window now and classifies the gap itself.
  const store = {
    select: () => {
      const q = {
        eq: () => q, order: () => q, limit: () => q,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve)
      }
      return q
    }
  }
  const slept = await livenessFor(store, {
    sessionId: 's-1',
    session: { processEnded: false, lastOutputAt: NOW - 8 * 60 * MINUTE, startedAt: NOW - 9 * 60 * MINUTE },
    beatsSupported: true,
    host: {
      watchingSince: NOW - 9 * 60 * MINUTE,
      suspended: [{ from: NOW - 8 * 60 * MINUTE, to: NOW - 60_000 }],
      sourceHealthy: true
    },
    thresholds: DEFAULT_THRESHOLDS,
    now: NOW
  })
  slept.input.gap !== undefined
    ? ok('the reader classified an observation gap without being handed one')
    : fail('the reader passed no gap, so host sleep can still become an agent fault')
  eq(slept.input.gap?.blameAgent, false, 'and it says the suspended host owns that silence')
  const reading = deriveLiveness(slept.input)
  reading.state !== 'stalled'
    ? ok('so a session across the suspend is not stalled by the widget reader either: ' + reading.state)
    : fail('the widget reader blamed the agent for a suspended host')
}

// THE SUMMARY IS LAST, and it has to be. Two cases were appended BELOW this
// block, so they ran after the verdict was printed: their failures were never
// counted, the process exited 0, and a third of this probe could not fail the
// run. A check that cannot fail is not one.
if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log('\nall green: both callers assemble one input, the wait target travels, and an unread orientation is not a stall')
