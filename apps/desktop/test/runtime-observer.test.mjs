// The observer, against a real store (M179).
//
// What matters here and cannot be shown by the pure tests: that the derivation
// is actually CALLED, that a repeat of the same condition appends nothing, and
// that a blind observer suppresses blame rather than reporting a stall it could
// not have seen.

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { probeEnv } from '../../../scripts/lib/test-stack.mjs'

const HERE = import.meta.dirname
// EVERYTHING BELOW IS A TEMPLATE LITERAL — no backticks inside.
const script = `
import { createRuntimeObserver } from ${JSON.stringify(path.join(HERE, '../src/main/runtimeObserver.ts'))}
import { createScopedStore } from ${JSON.stringify(path.join(HERE, '../src/main/scopedStore.ts'))}
import { createJournal } from ${JSON.stringify(path.join(HERE, '../../../packages/journal/src/index.ts'))}
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } })
const journal = createJournal(db)
const ESTATE = randomUUID()
const projectId = randomUUID()
const sessionId = randomUUID()

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

await journal.append({ estateId: ESTATE, type: 'estate.created@1',
  actor: { kind: 'system', id: 'probe' }, payload: { name: 'observer probe' } })
await journal.append({ estateId: ESTATE, type: 'project.created@1',
  actor: { kind: 'system', id: 'probe' }, projectId, payload: { id: projectId, name: 'p' } })

const store = createScopedStore(db, { estateId: ESTATE, projectId: null })
let now = Date.parse('2026-09-09T12:00:00Z')
const startedAt = now - 3_600_000

const host = { watchingSince: startedAt - 1000, suspended: [], sourceHealthy: true }
const sessions = [{ sessionId, projectId, optionId: 'claude-code', processEnded: false, lastOutputAt: now - 60_000, startedAt }]

const observer = createRuntimeObserver({
  store, journal, estateId: ESTATE,
  sessions: () => sessions,
  host: () => host,
  now: () => now
})

// No heartbeat at all, past the stall threshold: the derivation IS reached.
await journal.append({ estateId: ESTATE, type: 'session.oriented@1',
  actor: { kind: 'system', id: 'probe' }, projectId, payload: { session_id: sessionId } })
const first = await observer.sample()
first[0]?.state === 'stalled' && first[0].appended === true
  ? ok('the observer reaches the derivation and records a transition into stalled')
  : fail('first sample: ' + JSON.stringify(first))

const { count: afterFirst } = await db.from('journal')
  .select('seq', { count: 'exact', head: true })
  .eq('estate_id', ESTATE).eq('type', 'session.observed@1')

// ONE FINDING PER CONDITION. The same state next pass appends nothing.
now += 60_000
const second = await observer.sample()
const { count: afterSecond } = await db.from('journal')
  .select('seq', { count: 'exact', head: true })
  .eq('estate_id', ESTATE).eq('type', 'session.observed@1')
second[0]?.appended === false && afterSecond === afterFirst
  ? ok('and the SAME condition next pass appends nothing — one obligation, not one per tick')
  : fail('a repeat appended: ' + afterFirst + ' -> ' + afterSecond)

// A blind observer suppresses blame rather than reporting a stall it could not
// have seen.
host.suspended = [{ from: now, to: now + 600_000 }]
now += 600_000
const asleep = await observer.sample()
asleep[0]?.state === 'quiet'
  ? ok('and an interval the machine slept through is not blamed on the agent')
  : fail('slept interval judged as: ' + JSON.stringify(asleep))

// An ended process is still reported across a gap: it is the one input that is
// not an inference.
host.suspended = []
sessions[0].processEnded = true
now += 60_000
const gone = await observer.sample()
gone[0]?.state === 'gone' && gone[0].appended === true
  ? ok('and an ended process is recorded whatever the observer missed')
  : fail('ended process: ' + JSON.stringify(gone))

// M181 — a runner with NO surface is never reported stalled. "beatsSupported"
// was a literal true here, and three of the four runners the product offers
// declare adapter 'none': every one of their sessions was called stalled
// fifteen minutes in, forever.
sessions[0].processEnded = false
sessions[0].optionId = 'codex'
now += 3_600_000
const bare = await observer.sample()
bare[0]?.state !== 'stalled'
  ? ok('a session on a runner that cannot beat is not reported stalled (' + bare[0]?.state + ')')
  : fail('a runner with no surface was judged by the heartbeat threshold')

// A runner the product does not know is treated as having NO surface. Assuming
// it behaves like Claude Code is the exact "recognised by name" inference the
// capability report refuses — and the first plant of this could not be caught,
// because nothing here ever named an unknown runner.
sessions[0].optionId = 'a-runner-nobody-declared'
now += 3_600_000
const unknownRunner = await observer.sample()
unknownRunner[0]?.state !== 'stalled'
  ? ok('and a runner the product has never heard of is not assumed capable either')
  : fail('an unknown runner was judged by the heartbeat threshold')

sessions[0].optionId = 'claude-code'
now += 3_600_000
const beating = await observer.sample()
beating[0]?.state === 'stalled'
  ? ok('and a runner that CAN beat and did not still is — the control that makes the line above mean something')
  : fail('the beat threshold stopped applying to a runner that supports it: ' + JSON.stringify(beating))

await db.from('journal').delete().eq('estate_id', ESTATE)
process.exit(failures ? 1 : 0)
`

// The disposable stack the tier started — never `supabase status` at the root, which is the
// operator's live stack. probeEnv() refuses (FAIL, exit 1) before anything connects otherwise.
const env = probeEnv()
try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script],
    { encoding: 'utf8', env, cwd: path.resolve(HERE, '..') })
  process.stdout.write(out.split('\n').filter((l) => /^\s+(ok|FAIL)/.test(l)).join('\n') + '\n')
  if (out.includes('FAIL')) process.exit(1)
} catch (e) {
  process.stdout.write((e.stdout ?? '') + (e.stderr ?? ''))
  process.exit(1)
}
