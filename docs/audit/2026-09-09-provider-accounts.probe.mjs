// Dated characterization probe, not a claim of provider-account acceptance.
// No real home, Keychain, provider login, CLI process or network is accessed.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'
import { sessionEnvironment } from '../../apps/desktop/src/main/sessionEnv.ts'
import { createQuotaReader } from '../../apps/desktop/src/main/quota.ts'

const selectedProfile = '/synthetic/account-B'
assert.equal(sessionEnvironment({ CLAUDE_CONFIG_DIR: selectedProfile }).CLAUDE_CONFIG_DIR, selectedProfile)
console.log('PASS: session environment preserves the selected Claude profile')

// Execute the actual readToken function with every external dependency replaced.
// This deliberately excludes OS Keychain behavior and the provider's own CLI.
const source = readFileSync(new URL('../../apps/desktop/src/main/quota.ts', import.meta.url), 'utf8')
const start = source.indexOf('async function readToken(')
const end = source.indexOf('\nasync function realFetch(', start)
assert.ok(start >= 0 && end > start, 'quota source seam changed; review this dated probe')
const functionSource = stripTypeScriptTypes(source.slice(start, end))
for (const platform of ['linux', 'darwin']) {
  const pathsRead = []
  const servicesRead = []
  const syntheticCredentials = JSON.stringify({ claudeAiOauth: { accessToken: 'synthetic-account-A' } })
  const context = vm.createContext({
    process: { platform, env: { HOME: '/synthetic/default', CLAUDE_CONFIG_DIR: selectedProfile } },
    path, JSON, KEYCHAIN_SERVICE: 'Claude Code-credentials',
    existsSync: () => true,
    readFileSync: (file) => { pathsRead.push(file); return syntheticCredentials },
    run: async (_program, args) => { servicesRead.push(args[2]); return { stdout: syntheticCredentials } },
    ops: { failed: () => assert.fail('unexpected read failure') }
  })
  const bearer = await vm.runInContext(`${functionSource}\nreadToken()`, context)
  assert.equal(bearer, 'synthetic-account-A')
  // FIXED 2026-09-10 by M199.usage, and this probe now asserts the fix. What it
  // reproduced on 2026-09-09 is kept in words because the assertion can no
  // longer show it: the file branch read `/synthetic/default/.claude/.credentials.json`
  // whatever CLAUDE_CONFIG_DIR said, so Fabric read the system default while
  // the CLI — measured in M199.auth — followed the variable. The two could
  // disagree about which credential was in play.
  if (platform === 'linux') {
    assert.deepEqual(pathsRead, ['/synthetic/account-B/.credentials.json'])
    console.log(`FIXED: ${platform} quota credential lookup follows the selected Claude profile`)
  } else {
    // STILL TRUE on macOS, and not a defect that can be fixed here: M199.probe
    // measured one keychain item per operating-system user with no credential
    // file under the config home, which is why the capability row for
    // isolation-by-home reads `unsupported` rather than fixed. The keychain
    // branch wins before the file branch is reached.
    assert.deepEqual(servicesRead, ['Claude Code-credentials'])
    console.log(`STILL TRUE: ${platform} reads one keychain item per OS user, whatever the profile says`)
  }
}

let identity = 'A'
let instant = 1_000_000
let fetches = 0
const reader = createQuotaReader({
  token: async () => identity,
  fetchUsage: async (token) => {
    fetches++
    return { status: 200, body: { five_hour: { utilization: token === 'A' ? 15 : 85 } } }
  },
  now: () => instant,
  ttlMs: 120_000
})
// The NO-ACCOUNT path, unchanged on purpose: with nobody having chosen an
// account there is one credential, so one cache entry is correct. What this
// reproduced on 2026-09-09 is that the SAME thing happened with two accounts.
assert.equal((await reader.read()).fiveHour.utilization, 15)
identity = 'B'
instant += 1_000
assert.equal((await reader.read()).fiveHour.utilization, 15)
assert.equal(fetches, 1)
instant += 120_001
assert.equal((await reader.read()).fiveHour.utilization, 85)
assert.equal(fetches, 2)
console.log('STILL TRUE: with no account chosen there is one cache entry, which is correct for one credential')

// FIXED 2026-09-10 by M199.usage: with accounts NAMED, the two readings are two
// questions and neither is served for the other. This is the assertion the
// original could not make, because there was nowhere to put the account.
const keyA = { provider: 'claude-code', subject: 'sub-A', org: null, accountId: 'acct-A', runtime: 'host', authRevision: 1 }
const keyB = { ...keyA, subject: 'sub-B', accountId: 'acct-B' }
let perAccountFetches = 0
const keyed = createQuotaReader({
  tokenFor: async (key) => (key.accountId === 'acct-A' ? 'A' : 'B'),
  fetchUsage: async (token) => {
    perAccountFetches++
    return { status: 200, body: { five_hour: { utilization: token === 'A' ? 15 : 85 } } }
  },
  now: () => instant,
  ttlMs: 120_000
})
assert.equal((await keyed.read(keyA)).fiveHour.utilization, 15)
assert.equal((await keyed.read(keyB)).fiveHour.utilization, 85, 'B must not be answered from A inside the TTL')
assert.equal(perAccountFetches, 2, 'each account is asked for itself')
assert.equal((await keyed.read(keyA)).fiveHour.utilization, 15, 'and A is still A afterwards')
assert.equal(perAccountFetches, 2, 'served from its own cache entry')
keyed.stop()
reader.stop()
console.log('FIXED: a reading is keyed by provider, subject, org, account, runtime and auth revision')
console.log('Scope: real Fabric environment/reader logic with synthetic I/O; no live swap or session-resume verification')
