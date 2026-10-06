// The boundary a reading may acknowledge (UX28-03).
//
// `digest.seen(projectId)` used to read the journal's CURRENT head in the main
// process. The panel re-reads whenever the journal mark moves, so an arriving
// event re-ran its effect and the cleanup of the previous run acknowledged the
// head those very events had just moved: THE REFRESH ACKNOWLEDGED THE NEWS IT
// WAS REFRESHING FOR. The operator was shown "nothing new" and the events were
// gone for good, with every step behaving as designed.
//
// The renderer half is probed by rendering (`DigestSection.test.tsx`). This is
// the half the renderer cannot see, because it stubs the IPC: that a reading
// carries the head it was TAKEN AT, that a head which cannot be read is not a
// boundary, and that the acknowledgement no longer asks the journal anything.
//
// The FAKE IS THE DATABASE, not the store: `createScopedStore` is the real one
// (R-007 — a check carrying its own copy of the mechanism proves the model).
// Only the `db` underneath answers from a literal, which is what makes the
// error branch reachable at all: with the fix in place a head read never fails
// against the live stack, and an unreachable branch and a covered one look
// identical in a report.
//
// Pure: no database, no network.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { boundaryOf, digestFor } from '../src/main/digestRead.ts'
import { createScopedStore } from '../src/main/scopedStore.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const ESTATE = 'estate-1'
const PROJECT = 'project-1'

/**
 * A db shaped like PostgREST's client, answering per table from a literal.
 *
 * `answers` maps a table name to `{ data }` or `{ error }`. Every builder
 * method returns the same thenable, which is how the real client chains.
 */
function fakeDb(answers, calls = []) {
  return {
    from: (table) => ({
      select: () => {
        const answer = answers[table] ?? { data: [], error: null }
        const q = {
          eq: () => q,
          gt: () => q,
          not: () => q,
          in: () => q,
          order: () => q,
          limit: () => q,
          // The gateway's cap: at most 1000 rows per answer however many match, with the exact count.
          range: (from, to) => {
            calls.push(table)
            if (answer.error) return Promise.resolve({ data: null, error: answer.error, count: null })
            const all = answer.data ?? []
            return Promise.resolve({ data: all.slice(from, Math.min(to + 1, from + 1000)), error: null, count: all.length })
          },
          maybeSingle: () => {
            calls.push(table)
            return Promise.resolve(answer)
          },
          then: (resolve) => {
            calls.push(table)
            // An unpaged read is capped the same way, silently.
            const capped = Array.isArray(answer.data) ? { ...answer, data: answer.data.slice(0, 1000) } : answer
            return Promise.resolve(capped).then(resolve)
          }
        }
        return q
      }
    })
  }
}

const storeOf = (answers, calls) =>
  createScopedStore(fakeDb(answers, calls), { estateId: ESTATE, projectIds: [PROJECT] })

// ── the boundary IS the head, and it is read ────────────────────────────────
{
  const store = storeOf({ journal: { data: { seq: 904 }, error: null } })
  const { boundary, problem } = await boundaryOf(store, ESTATE)
  eq(boundary, 904, 'the boundary is the journal head the reading was taken at')
  eq(problem, null, 'and there is no problem to report')
}

// ── a head that cannot be read is NOT a boundary of zero ───────────────────
{
  const store = storeOf({ journal: { data: null, error: { message: 'the journal refused' } } })
  const { boundary, problem } = await boundaryOf(store, ESTATE)
  eq(boundary, null, 'a refused head gives a NULL boundary')
  ;/refused/.test(problem ?? '')
    ? ok('and the refusal is carried rather than swallowed')
    : fail('the problem was lost: ' + JSON.stringify(problem))
  // Zero would be a CLAIM — "this operator has seen nothing" — and marking it
  // would make everything ever recorded reappear as unread. Null is the
  // absence of a claim, and the renderer acknowledges nothing for it.
  boundary !== 0 ? ok('and it is not zero, which would be a claim about a person') : fail('a refused head became 0')
}

// ── an empty journal is also not a boundary ────────────────────────────────
{
  const store = storeOf({ journal: { data: null, error: null } })
  const { boundary } = await boundaryOf(store, ESTATE)
  eq(boundary, null, 'an estate with no events yet has no boundary to acknowledge')
}

// ── the whole reading carries it, on every state ───────────────────────────
{
  const store = storeOf({ journal: { data: { seq: 51 }, error: null } })
  const first = await digestFor(store, ESTATE, PROJECT, null)
  eq(first.state, 'first-visit', 'a project never left reads as FIRST VISIT')
  eq(first.boundary, 51, 'and it still carries a boundary — that is what makes a SECOND visit mean anything')

  const nothing = await digestFor(store, ESTATE, PROJECT, 40)
  eq(nothing.state, 'nothing-new', 'a project with nothing since the mark reads as nothing-new')
  eq(nothing.boundary, 51, 'and carries the boundary, so unshown KINDS cannot pile up forever')
}

// ── lines, and the boundary ABOVE the highest of them ──────────────────────
{
  const store = storeOf({
    journal: { data: { seq: 900 }, error: null },
    memory_facts: { data: [{ id: 'f1', claim: 'we chose Postgres', recorded_at: 'x', seq: 101 }], error: null }
  })
  const digest = await digestFor(store, ESTATE, PROJECT, 100)
  eq(digest.state, 'lines', 'news since the mark reads as lines')
  eq(digest.lines.at(-1).seq, 101, 'the last line is the last thing that happened of a kind this digest shows')
  eq(digest.boundary, 900, 'and the boundary is the HEAD — the 799 events in between are swept, not accumulated')
}

// ── a content read that refuses THROWS rather than composing three of four ─
{
  const store = storeOf({
    journal: { data: { seq: 900 }, error: null },
    project_tasks: { data: null, error: { message: 'tasks refused' } }
  })
  let threw = null
  try {
    await digestFor(store, ESTATE, PROJECT, 100)
  } catch (e) {
    threw = String(e)
  }
  ;/could not be read/.test(threw ?? '')
    ? ok('a refused content read throws — three stores of four would assert nothing happened in the fourth')
    : fail('a partial digest was composed: ' + JSON.stringify(threw))
}

// ── and a refused HEAD does not throw: the digest is still true ────────────
{
  const store = storeOf({
    journal: { data: null, error: { message: 'the journal refused' } },
    memory_facts: { data: [{ id: 'f1', claim: 'a decision', recorded_at: 'x', seq: 101 }], error: null }
  })
  const digest = await digestFor(store, ESTATE, PROJECT, 100)
  eq(digest.state, 'lines', 'a head that could not be read still leaves the digest showable')
  eq(digest.boundary, null, 'it simply cannot be acknowledged')
}

// ── THE ACKNOWLEDGEMENT ASKS THE JOURNAL NOTHING ───────────────────────────
//
// Structural, and it is the defect stated directly: the handler used to read
// the head here, which is a different question from "what did the operator
// see". Asserted against the source because the property is the ABSENCE of a
// read, and an absence cannot be observed by running the thing.
{
  const source = readFileSync(path.join(import.meta.dirname, '../src/main/index.ts'), 'utf8')
  const start = source.indexOf('IPC.digestSeen')
  const body = start === -1 ? '' : source.slice(start, source.indexOf('\n  )', start))
  start === -1 ? fail('the digestSeen handler could not be found — this probe has lost its subject') : null
  !/select\(\s*'journal'/.test(body)
    ? ok('the seen handler reads no journal: it writes the boundary its caller was shown')
    : fail('the seen handler asks the journal for a head again — that is the defect')
  ;/setMark\(projectId, boundary\)/.test(body)
    ? ok('and it writes exactly the boundary it was given')
    : fail('the seen handler does not write the boundary it was passed: ' + JSON.stringify(body.slice(0, 200)))
  // And the check is shown able to see the defect it forbids, so a green here
  // is not a green from being blind (R-006).
  ;/select\(\s*'journal'/.test("const x = store.select('journal', 'seq')")
    ? ok('and the detector is shown catching a journal read when there is one')
    : fail('the journal-read detector cannot see a journal read')
}

// ── audit 2026-10-05 A4-003: every matching row is read, past the gateway's cap ─────────────
{
  const many = Array.from({ length: 2500 }, (_, i) => ({ id: `f${i}`, claim: `decision ${i}`, recorded_at: '2026-10-05T10:00:00Z', seq: 101 + i }))
  const store = storeOf({ journal: { data: { seq: 3000 }, error: null }, memory_facts: { data: many, error: null } })
  const digest = await digestFor(store, ESTATE, PROJECT, 100)
  const decisions = JSON.stringify(digest).match(/decision \d+/g) ?? []
  eq(new Set(decisions).has('decision 2499'), true, 'every decision since the mark is read, 2500 past a 1000-row gateway cap (A4-003)')
  eq(digest.boundary, 3000, 'and the boundary is the head that was read')
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log(
  '\nall green: a reading carries the head it was taken at, a refused head is not a boundary, and acknowledging asks nothing'
)
