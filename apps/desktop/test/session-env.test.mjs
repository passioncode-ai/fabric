// IMP-07 — a session does not inherit the keys to Fabric's own database.
//
// Probed at the seam that matters and NOT through a real PTY: the branch under
// test is "the key was present in the parent and is absent in the child", and
// proving it through a spawn would mean putting a live service-role key into a
// test process and hoping it never reached a log.
//
// The last assertion is the one that would have caught the original defect and
// is the reason this file is not just a filter test: it asserts against the
// REAL environment this machine is running, so a key that is genuinely set here
// is genuinely gone from what a session would receive.

import { sessionEnvironment, WITHHELD_FROM_SESSIONS } from '../src/main/sessionEnv.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => {
  failures++
  console.log('  FAIL ' + m)
}

const parent = {
  PATH: '/usr/bin:/bin',
  HOME: '/Users/someone',
  ANTHROPIC_API_KEY: 'sk-ant-the-agent-needs-this',
  LANG: 'en_US.UTF-8',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  EMPTY: undefined,
  // EVERY withheld name is set from the list itself rather than typed out. The
  // first version of this fixture listed four of the six by hand, so two
  // entries on the denylist had their stripping asserted by nothing — found by
  // predicting seven failures from a planted defect and getting five.
  ...Object.fromEntries(WITHHELD_FROM_SESSIONS.map((name) => [name, `secret-value-of-${name}`]))
}

const child = sessionEnvironment(parent)

for (const name of WITHHELD_FROM_SESSIONS) {
  if (child[name] === undefined) ok(`${name} does not reach a session`)
  else fail(`${name} REACHED A SESSION — the surface is one variable wide again`)
}

// The other half, and it is not decoration: an over-broad filter breaks the
// product silently, and a session with no PATH fails in a way nobody connects
// to a security change made weeks earlier.
for (const name of ['PATH', 'HOME', 'ANTHROPIC_API_KEY', 'LANG'])
  if (child[name] === parent[name]) ok(`${name} still reaches the session`)
  else fail(`${name} was stripped — an agent needs it to do its job`)

child.SUPABASE_URL === parent.SUPABASE_URL
  ? ok('SUPABASE_URL survives on purpose: a loopback address is not a secret, and with every key gone it opens nothing')
  : fail('SUPABASE_URL was stripped — stripping non-secrets is how a denylist grows without a reason')

'EMPTY' in child
  ? fail('an unset variable was materialised as a value')
  : ok('an unset variable stays unset rather than becoming an empty string')

// Against the REAL environment of this process — the one the app actually runs
// in. On a machine where the key is set, this is the assertion that matters.
const real = sessionEnvironment(process.env)
const leaked = WITHHELD_FROM_SESSIONS.filter((name) => real[name] !== undefined)
if (leaked.length === 0)
  ok(
    process.env.SUPABASE_SERVICE_ROLE_KEY
      ? 'the service-role key IS set in this process, and no session would receive it'
      : 'no withheld variable survives the real environment (none were set here to begin with)'
  )
else fail(`these survived the real environment: ${leaked.join(', ')}`)

if (failures > 0) {
  console.log(`\n${failures} session-environment failure(s)`)
  process.exit(1)
}
