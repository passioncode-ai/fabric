// Which credential a session will use, and the two races that substitute another.
//
// M199.auth. MEASURED on Claude Code 2.1.236 against the provider's own reader,
// one variable at a time: ANTHROPIC_API_KEY makes `apiKeySource` appear and
// drops email, org and subscription to NULL; ANTHROPIC_AUTH_TOKEN turns
// `authMethod` into oauth_token with apiKeySource still null;
// CLAUDE_CODE_USE_BEDROCK=1 and CLAUDE_CODE_USE_VERTEX=1 turn it into
// third_party. An EMPTY ANTHROPIC_API_KEY changes nothing. ANTHROPIC_BASE_URL
// and ANTHROPIC_CUSTOM_HEADERS leave the identity alone.
//
// Four override, three do not, and the two detector fields catch different
// subsets — so a resolver watching only the obvious one misses
// ANTHROPIC_AUTH_TOKEN entirely. That asymmetry is what these cases are about.
//
// Codex 0.152.1 has no detector at all: `codex login status` answers the same
// line with the key set and unset. Its contexts are cleaned and NEVER verified.
//
// Pure: the identity reader is injected, no provider is executed, no credential
// is read, nothing reaches the network.

import { createAuthContexts } from '../src/main/authContext.ts'
import {
  AUTH_OVERRIDES,
  authVerdict,
  identityAgrees,
  mayLaunch,
  overridesPresent,
  withoutOverrides
} from '../src/shared/authResolution.ts'
import { sessionEnvironment } from '../src/main/sessionEnv.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const HOST = 'darwin-arm64 host'
const ACCOUNT = {
  accountId: 'acct-1',
  provider: 'claude-code',
  subject: null,
  org: 'org-1',
  runtime: HOST,
  lineage: 'claude-code/org-1'
}

/** A reader shaped like the one measured: it reports the overrides it can see. */
const reader = (over = {}) => (provider, env) => {
  if (provider === 'codex-cli') return null
  const key = env.ANTHROPIC_API_KEY
  const token = env.ANTHROPIC_AUTH_TOKEN
  const thirdParty = env.CLAUDE_CODE_USE_BEDROCK || env.CLAUDE_CODE_USE_VERTEX
  if (key)
    return { loggedIn: true, authMethod: 'claude.ai', apiKeySource: 'ANTHROPIC_API_KEY', subject: null, org: null, ...over }
  if (token) return { loggedIn: true, authMethod: 'oauth_token', apiKeySource: null, subject: null, org: null, ...over }
  if (thirdParty) return { loggedIn: true, authMethod: 'third_party', apiKeySource: null, subject: null, org: null, ...over }
  return { loggedIn: true, authMethod: 'claude.ai', apiKeySource: null, subject: null, org: 'org-1', ...over }
}

const contexts = (over = {}) =>
  createAuthContexts({ readIdentity: reader(), runtime: HOST, ...over })

// ── the clean environment resolves, and it is verified ──────────────────────
{
  const c = contexts()
  const r = c.resolveAuthContext({ account: ACCOUNT, env: { PATH: '/usr/bin' } })
  r.contextRef && r.verdict.status === 'verified'
    ? ok('a clean environment resolves and the provider’s own reader confirms the chosen identity')
    : fail('a clean resolution failed: ' + JSON.stringify(r.verdict))
  mayLaunch(r.verdict) ? ok('and work may be launched under it') : fail('a verified verdict refused a launch')
  eq(r.env.PATH, '/usr/bin', 'the child keeps the operator’s own environment')
}

// ── each of the four measured overrides is removed, and then verified gone ──
{
  const c = contexts()
  for (const variable of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX']) {
    const r = c.resolveAuthContext({ account: ACCOUNT, env: { PATH: '/usr/bin', [variable]: '1' } })
    const removed = r.verdict.removed.includes(variable)
    const clean = r.contextRef !== null && r.env[variable] === undefined && r.verdict.status === 'verified'
    removed && clean
      ? ok(`${variable} is removed, and the readback then confirms the chosen identity`)
      : fail(`${variable}: ` + JSON.stringify({ removed: r.verdict.removed, status: r.verdict.status, left: r.env?.[variable] }))
  }
}

// ── the asymmetry: the obvious detector catches ONE of the four ─────────────
{
  // A resolver watching only `apiKeySource` would pass three of these four.
  const byField = {}
  for (const o of AUTH_OVERRIDES['claude-code']) byField[o.detector] = (byField[o.detector] ?? 0) + 1
  eq(byField.apiKeySource, 1, 'exactly one measured override is visible through apiKeySource')
  eq(byField.authMethod, 3, 'and three are visible only through authMethod')
}

// ── an empty value is not an override ──────────────────────────────────────
{
  // Measured: `ANTHROPIC_API_KEY=` changed nothing. Treating it as an override
  // would block a session over a variable the provider ignores.
  const present = overridesPresent('claude-code', { ANTHROPIC_API_KEY: '' })
  eq(present.length, 0, 'an empty ANTHROPIC_API_KEY is not treated as an override')
  const set = overridesPresent('claude-code', { ANTHROPIC_API_KEY: 'x' })
  eq(set.length, 1, 'and a set one is')
}

// ── a variable that changes routing but not identity is left alone ──────────
{
  // Measured: neither changes the resolved identity. Stripping them would be a
  // denylist growing without a reason, which sessionEnv.ts warns about itself.
  const kept = withoutOverrides('claude-code', {
    ANTHROPIC_BASE_URL: 'https://example.test',
    ANTHROPIC_CUSTOM_HEADERS: 'x: y'
  })
  kept.ANTHROPIC_BASE_URL && kept.ANTHROPIC_CUSTOM_HEADERS
    ? ok('a base URL and custom headers survive: they change where requests go, not who they are from')
    : fail('a non-identity variable was stripped: ' + JSON.stringify(kept))
}

// ── an override that SURVIVES a clean blocks, rather than being retried ─────
{
  // Something outside this process is writing it. The card's rule: an
  // incompatible external writer blocks a managed operation.
  const c = createAuthContexts({
    readIdentity: () => ({ loggedIn: true, authMethod: 'claude.ai', apiKeySource: 'ANTHROPIC_API_KEY', subject: null, org: null }),
    runtime: HOST
  })
  const r = c.resolveAuthContext({ account: ACCOUNT, env: { ANTHROPIC_API_KEY: 'x' } })
  r.contextRef === null && r.verdict.status === 'blocked'
    ? ok('an identity the reader reports as somebody else’s blocks the launch rather than being retried')
    : fail('a substituted identity resolved: ' + JSON.stringify(r.verdict))
  const names = String(r.verdict.reason)
  names.includes('ANTHROPIC_API_KEY') || names.includes('different identity')
    ? ok('and the refusal names what is in force')
    : fail('the refusal says nothing useful: ' + names)
  mayLaunch(r.verdict) === false ? ok('and nothing may be launched under it') : fail('a blocked verdict allowed a launch')
}

// ── an account from another runtime is refused ──────────────────────────────
{
  const c = contexts()
  const r = c.resolveAuthContext({ account: { ...ACCOUNT, runtime: 'wsl:ubuntu' }, env: {} })
  r.contextRef === null && /does not travel/.test(r.verdict.reason)
    ? ok('an account authorised on another runtime is refused — auth is acquired on a runtime')
    : fail('a foreign runtime resolved: ' + JSON.stringify(r.verdict))
}

// ── a provider with NO detector is cleaned and never verified ──────────────
{
  const c = contexts()
  const codex = {
    accountId: 'acct-2',
    provider: 'codex-cli',
    subject: 'sub-1',
    org: null,
    runtime: HOST,
    lineage: 'codex-cli/sub-1'
  }
  const r = c.resolveAuthContext({ account: codex, env: { OPENAI_API_KEY: 'sk-x', PATH: '/usr/bin' } })
  r.verdict.status === 'cleaned-unverified'
    ? ok('Codex resolves as CLEANED-UNVERIFIED: there is no reader to confirm what a session will use')
    : fail('Codex resolved as ' + JSON.stringify(r.verdict))
  r.verdict.removed.includes('OPENAI_API_KEY')
    ? ok('and the inherited key is removed anyway, because cleaning is cheap and certainty is not available')
    : fail('the key was not removed: ' + JSON.stringify(r.verdict.removed))
  mayLaunch(r.verdict) === false
    ? ok('and it may NOT be launched — an unverified capability is never reported as success')
    : fail('an unverified context allowed a launch')
  eq(c.verifiable('codex-cli'), false, 'the caller can ask in advance whether this provider is verifiable at all')
  eq(c.verifiable('claude-code'), true, 'and the other one is')
}

// ── the identity comparison, three answers ─────────────────────────────────
{
  const observed = (over = {}) => ({ loggedIn: true, authMethod: 'claude.ai', apiKeySource: null, subject: null, org: 'org-1', ...over })
  eq(identityAgrees({ provider: 'p', subject: null, org: 'org-1' }, observed()), 'agrees', 'an organisation that matches agrees')
  eq(identityAgrees({ provider: 'p', subject: null, org: 'org-2' }, observed()), 'disagrees', 'one that differs disagrees')
  eq(
    identityAgrees({ provider: 'p', subject: 's1', org: null }, observed({ subject: 's1' })),
    'agrees',
    'and a subject is preferred over an organisation when both sides have one'
  )
  eq(
    identityAgrees({ provider: 'p', subject: 's1', org: null }, observed({ subject: 's2' })),
    'disagrees',
    'a subject that differs disagrees even inside one organisation'
  )
  eq(
    identityAgrees({ provider: 'p', subject: null, org: null }, observed({ org: null })),
    'unknowable',
    'and nothing comparable is UNKNOWABLE rather than agreement'
  )
  eq(
    identityAgrees({ provider: 'p', subject: null, org: 'org-1' }, observed({ loggedIn: false })),
    'disagrees',
    'a reader that says nobody is logged in disagrees with any chosen account'
  )
}

// ── two refreshes at once make one revision ────────────────────────────────
{
  let calls = 0
  const c = createAuthContexts({
    readIdentity: reader(),
    runtime: HOST,
    refresh: async () => {
      calls++
      await new Promise((r) => setTimeout(r, 20))
      return 2
    }
  })
  const [a, b] = await Promise.all([
    c.coordinatedRefresh({ lineage: 'l1', at: 1, expectedAuthRevision: 1 }),
    c.coordinatedRefresh({ lineage: 'l1', at: 1, expectedAuthRevision: 1 })
  ])
  eq(calls, 1, 'two concurrent refreshes call the provider ONCE')
  const one = [a, b].filter((r) => r.status === 'refreshed').length
  const joined = [a, b].filter((r) => r.status === 'joined').length
  one === 1 && joined === 1
    ? ok('one caller refreshed and the other joined it, so there is one live token rather than two')
    : fail('the outcomes were ' + JSON.stringify([a.status, b.status]))
  eq(c.revisionOf('l1'), 2, 'and the store holds one new revision')
}

// ── an old attempt does not overwrite a newer revision ─────────────────────
{
  const c = createAuthContexts({ readIdentity: reader(), runtime: HOST, refresh: async () => 9 })
  c.noteRevision('l2', 5)
  const stale = await c.coordinatedRefresh({ lineage: 'l2', at: 1, expectedAuthRevision: 3 })
  stale.status === 'stale' && c.revisionOf('l2') === 5
    ? ok('a refresh made against an older revision is refused, and the newer one stands')
    : fail('a stale refresh landed: ' + JSON.stringify({ stale, now: c.revisionOf('l2') }))
  ;/rotated/.test(stale.reason)
    ? ok('and the reason says what writing over it would restore')
    : fail('the reason is unhelpful: ' + stale.reason)
}

// ── a revision going backwards is dropped at the write, not at the caller ──
{
  const c = createAuthContexts({ readIdentity: reader(), runtime: HOST })
  c.noteRevision('l3', 4)
  c.noteRevision('l3', 2)
  eq(c.revisionOf('l3'), 4, 'noting an older revision does not move the store backwards')
  c.noteRevision('l3', 7)
  eq(c.revisionOf('l3'), 7, 'and a newer one does')
}

// ── resolving against a revision that has moved is refused ─────────────────
{
  const c = contexts()
  c.noteRevision(ACCOUNT.lineage, 3)
  const r = c.resolveAuthContext({ account: ACCOUNT, env: {}, expectedAuthRevision: 1 })
  r.contextRef === null && /already replaced/.test(r.verdict.reason)
    ? ok('a context resolved against a revision the store has passed is refused')
    : fail('a stale expectation resolved: ' + JSON.stringify(r.verdict))
  const fresh = c.resolveAuthContext({ account: ACCOUNT, env: {}, expectedAuthRevision: 3 })
  fresh.contextRef !== null ? ok('and the current revision resolves') : fail('the current revision was refused')
}

// ── a refresh with nothing wired invents nothing ───────────────────────────
{
  const c = createAuthContexts({ readIdentity: reader(), runtime: HOST })
  const out = await c.coordinatedRefresh({ lineage: 'l4', at: 1, expectedAuthRevision: 1 })
  out.status === 'failed' && /inventing one would write a credential nobody issued/.test(out.reason)
    ? ok('a provider with no refresh wired FAILS honestly rather than reporting a refresh it did not do')
    : fail('an unwired refresh answered ' + JSON.stringify(out))
  eq(c.revisionOf('l4'), 1, 'and the revision did not move')
}

// ── and the session environment only strips the overrides when an account is chosen
{
  const parent = { PATH: '/usr/bin', ANTHROPIC_API_KEY: 'sk-x', SUPABASE_SERVICE_ROLE_KEY: 'srv' }
  const free = sessionEnvironment(parent)
  free.ANTHROPIC_API_KEY === 'sk-x' && free.SUPABASE_SERVICE_ROLE_KEY === undefined
    ? ok('with no account chosen, the operator’s own key survives and Fabric’s does not — unchanged behaviour')
    : fail('the free-terminal environment changed: ' + JSON.stringify(free))
  const bound = sessionEnvironment(parent, { provider: 'claude-code' })
  bound.ANTHROPIC_API_KEY === undefined && bound.PATH === '/usr/bin'
    ? ok('and with one chosen, the variable that would replace it is gone while the shell still works')
    : fail('the bound environment is wrong: ' + JSON.stringify(bound))
}

// ── the verdict never reports a launch it did not verify ───────────────────
{
  for (const status of ['blocked', 'cleaned-unverified'])
    mayLaunch({ status, reason: 'x', removed: [] }) === false
      ? ok(`${status} may not launch`)
      : fail(`${status} allowed a launch`)
  mayLaunch({ status: 'verified', reason: 'x', removed: [] }) === true
    ? ok('and only a verified verdict may')
    : fail('a verified verdict refused')
}

// ── a verdict is a value, so it can be asserted directly ───────────────────
{
  const v = authVerdict({
    chosen: { provider: 'claude-code', subject: null, org: 'org-1' },
    accountRuntime: HOST,
    thisRuntime: HOST,
    observed: { loggedIn: true, authMethod: 'third_party', apiKeySource: null, subject: null, org: null },
    removed: [],
    remaining: []
  })
  v.status === 'blocked' && /third_party/.test(v.reason)
    ? ok('a third-party route with no identity blocks, and the reason names the authMethod')
    : fail('a third-party route produced ' + JSON.stringify(v))
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log('\nall green: four measured overrides removed and verified gone, one refresh per burst, and no launch nobody confirmed')
