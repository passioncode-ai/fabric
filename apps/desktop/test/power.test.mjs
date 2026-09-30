// Keep-awake policy (M73).
//
// The blocker is injected, so this measures the POLICY rather than Electron.
// What must hold, and the last two are where a naive implementation leaks:
//
//   1. each policy blocks when it should and only then
//   2. the blocker follows the session count without being told twice
//   3. it is IDEMPOTENT — reconciling repeatedly must not start a second
//      blocker, because a leaked blocker holds the machine awake forever and
//      nothing in the interface would ever say so
//   4. quitting releases it

import { createPowerKeeper, DEFAULT_KEEP_AWAKE } from '../src/main/power.ts'

let failures = 0
const ok = (m) => console.log(`  ok   ${m}`)
const fail = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}

console.log('power: the machine stays awake while agents work, and not otherwise')

/** A fake powerSaveBlocker that records every start and stop. */
function fakeBlocker() {
  const live = new Set()
  let next = 1
  let started = 0
  return {
    started: () => started,
    live: () => live.size,
    start: (type) => {
      if (type !== 'prevent-app-suspension')
        fail(`the wrong blocker was used: ${type} — this would hold the DISPLAY awake too`)
      started++
      const id = next++
      live.add(id)
      return id
    },
    stop: (id) => void live.delete(id),
    isStarted: (id) => live.has(id)
  }
}

// --- the default -------------------------------------------------------
if (DEFAULT_KEEP_AWAKE !== 'while-working')
  fail(`the default is ${DEFAULT_KEEP_AWAKE}; 'always' turns a laptop into a server and 'never' loses long sessions`)
else ok("the default is 'while-working' — the only value that chooses nothing for the operator")

// --- while-working -----------------------------------------------------
{
  const b = fakeBlocker()
  const k = createPowerKeeper(b)
  k.setPolicy('while-working')
  if (k.state().blocking) fail('while-working held the machine awake with no session running')
  else ok('while-working: idle machine sleeps normally')

  k.setActiveSessions(1)
  if (!k.state().blocking) fail('while-working did not hold the machine awake for a running session')
  else ok('while-working: a running session holds it awake')

  k.setActiveSessions(3)
  if (b.started() !== 1) fail(`more sessions started ${b.started()} blockers — one leaks per session`)
  else ok('more sessions do not start more blockers')

  k.setActiveSessions(0)
  if (k.state().blocking) fail('the blocker outlived the last session')
  else ok('the last session ending releases it')
  if (b.live() !== 0) fail(`${b.live()} blocker(s) still live after release`)
  else ok('nothing is left holding the machine awake')
}

// --- always and never --------------------------------------------------
{
  const b = fakeBlocker()
  const k = createPowerKeeper(b)
  k.setPolicy('always')
  if (!k.state().blocking) fail("'always' did not hold the machine awake")
  else ok("'always' holds it awake with nothing running")

  k.setPolicy('never')
  if (k.state().blocking) fail("'never' still held the machine awake")
  else ok("'never' releases immediately, even mid-session")
  k.setActiveSessions(5)
  if (k.state().blocking) fail("'never' started blocking when sessions appeared")
  else ok("'never' stays out of the way while five sessions run")
}

// --- idempotence, which is where this leaks ----------------------------
{
  const b = fakeBlocker()
  const k = createPowerKeeper(b)
  k.setPolicy('always')
  for (let i = 0; i < 10; i++) k.setPolicy('always')
  for (let i = 0; i < 10; i++) k.setActiveSessions(2)
  if (b.started() !== 1) fail(`repeated reconciliation started ${b.started()} blockers`)
  else ok('repeated reconciliation starts exactly one blocker')
  if (b.live() !== 1) fail(`${b.live()} blockers live; a leaked one holds the machine awake forever, silently`)
  else ok('exactly one blocker is live')

  k.stop()
  if (b.live() !== 0) fail('quitting left a blocker running')
  else ok('quitting releases it')
}

// --- the state the interface reads -------------------------------------
{
  const k = createPowerKeeper(fakeBlocker())
  k.setPolicy('while-working')
  k.setActiveSessions(2)
  const s = k.state()
  if (s.policy !== 'while-working' || s.activeSessions !== 2 || !s.blocking)
    fail(`state() is wrong: ${JSON.stringify(s)}`)
  else ok('state() reports the policy, the count and whether it is actually blocking')
}

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED — the machine sleeps when it should not, or never sleeps`)
  process.exit(1)
}
console.log('\nall green: awake while agents work, asleep otherwise, and exactly one blocker')
