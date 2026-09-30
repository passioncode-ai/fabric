// Several logins on one device, and the ones this build cannot give (M199.accounts).
//
// The card's failure cases are the interesting part, and two of them are true
// only because M199.probe measured the providers rather than reading about them:
//
//   * A second login on Claude Code 2.1.236 is REFUSED. Its credential is one
//     keychain item per operating-system user, so running the login again writes
//     over the login already there — the operator's live session. Codex keeps
//     auth.json inside CODEX_HOME, so the same request is allowed.
//   * A login whose identity cannot be told apart from an existing account is
//     refused. Neither provider returns a stable per-user subject (CO-141), so
//     "cannot be told apart" is the normal case rather than an edge one, and
//     completing would risk replacing an account rather than adding one.
//
// Pure and local: a temp directory, an injected clock, no keychain, no login
// flow, no network. Nothing here reads or writes a real provider home.

import { createProviderAccounts } from '../src/main/providerAccounts.ts'
import { accountView, compareIdentity, viewLeaks } from '../src/shared/providerAccounts.ts'
// Deterministic regression fixture: the measured 2026-09-10 builds.
// Current-build invalidation is covered by provider-capability-upgrade.test.mjs.
import { HISTORICAL_CAPABILITY_MATRIX as CAPABILITY_MATRIX, HISTORICAL_PINNED_BUILDS as PINNED_BUILDS } from '../src/shared/providerCapabilityMatrix.ts'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const BUILDS = { ...PINNED_BUILDS }
const RUNTIME = 'darwin-arm64 host'
const PRINCIPAL = 'operator'

const store = (over = {}) =>
  createProviderAccounts({
    dir: mkdtempSync(path.join(tmpdir(), 'fabric-accounts-')),
    matrix: CAPABILITY_MATRIX,
    builds: BUILDS,
    now: () => 1_757_000_000_000,
    ...over
  })

const identity = (over = {}) => ({
  provider: 'codex-cli',
  subject: 'sub-1',
  org: 'org-1',
  email: 'someone@example.com',
  runtime: RUNTIME,
  principal: PRINCIPAL,
  ...over
})

// ── the first login, and what a window is allowed to see ─────────────────────
{
  const s = store()
  const begun = s.beginLogin({ provider: 'codex-cli', runtime: RUNTIME, principal: PRINCIPAL })
  begun.ok ? ok('a first login is staged, and the browser consent stays the provider’s') : fail('the first login was refused: ' + begun.reason)
  String(begun.says ?? '').includes(RUNTIME)
    ? ok('and the operator is told which device the credential will land on')
    : fail('the staging message does not name the runtime: ' + begun.says)

  const done = s.completeLogin({ attemptId: begun.attemptId, identity: identity(), label: 'work' })
  done.ok && done.existing === false
    ? ok('a verified identity completes the login and the account is added')
    : fail('completing failed: ' + JSON.stringify(done))

  eq(s.stagingCount(), 0, 'and the staging context is gone once it resolved')

  const leaks = viewLeaks(done.account)
  leaks.length === 0
    ? ok('the view a window gets carries no secret reference and no provider subject')
    : fail('the view leaked: ' + leaks.join('; '))

  const listed = s.listAccounts('codex-cli')
  eq(listed.length, 1, 'and the account is listed')
  eq(listed[0].confidence, 'subject', 'with what the provider actually confirmed, named')
}

// ── the same attempt twice makes ONE record ─────────────────────────────────
{
  const s = store()
  const begun = s.beginLogin({ provider: 'codex-cli', runtime: RUNTIME, principal: PRINCIPAL })
  const first = s.completeLogin({ attemptId: begun.attemptId, identity: identity(), label: 'work' })
  const again = s.completeLogin({ attemptId: begun.attemptId, identity: identity(), label: 'work' })
  first.ok && again.ok && again.existing === true && again.account.accountId === first.account.accountId
    ? ok('a repeated completeLogin answers with the record it already made, not a second one')
    : fail('the retry produced ' + JSON.stringify(again))
  eq(s.listAccounts().length, 1, 'and the register holds one account')
}

// ── cancel, and it touches nothing else ─────────────────────────────────────
{
  const s = store()
  const a = s.beginLogin({ provider: 'codex-cli', runtime: RUNTIME, principal: PRINCIPAL })
  s.completeLogin({ attemptId: a.attemptId, identity: identity({ subject: 'sub-a' }), label: 'first' })
  const b = s.beginLogin({ provider: 'codex-cli', runtime: RUNTIME, principal: PRINCIPAL })
  b.ok ? ok('a second Codex login is staged, because its credential follows the home') : fail('the second Codex login was refused: ' + b.reason)
  const cancelled = s.cancelLogin(b.attemptId)
  cancelled.ok ? ok('and cancelling it succeeds') : fail('cancel failed: ' + cancelled.reason)
  eq(s.listAccounts().length, 1, 'the login that was already there is untouched')
  eq(s.stagingCount(), 0, 'and nothing is left staged')

  const stale = s.completeLogin({ attemptId: b.attemptId, identity: identity({ subject: 'sub-b' }), label: 'late' })
  stale.ok === false
    ? ok('completing a cancelled attempt is refused rather than reviving it')
    : fail('a cancelled attempt still completed')
}

// ── the refusal M199.probe earned ───────────────────────────────────────────
{
  const s = store()
  const first = s.beginLogin({ provider: 'claude-code', runtime: RUNTIME, principal: PRINCIPAL })
  first.ok
    ? ok('a FIRST Claude Code login is allowed — there is nothing there to overwrite')
    : fail('the first Claude Code login was refused: ' + first.reason)
  s.completeLogin({ attemptId: first.attemptId, identity: identity({ provider: 'claude-code', subject: null, org: 'org-1' }), label: 'one' })

  const second = s.beginLogin({ provider: 'claude-code', runtime: RUNTIME, principal: PRINCIPAL })
  second.ok === false && /write over the login already there/.test(second.reason)
    ? ok('a SECOND Claude Code login is refused, because its credential is one keychain item per OS user')
    : fail('a second Claude Code login was allowed: ' + JSON.stringify(second))
  ;/unsupported|unverified/.test(String(second.reason))
    ? ok('and the refusal quotes the measurement rather than a rule of thumb')
    : fail('the refusal cites no measurement: ' + second.reason)
}

// ── an identity nobody can tell apart does not complete ─────────────────────
{
  const s = store()
  const a = s.beginLogin({ provider: 'codex-cli', runtime: RUNTIME, principal: PRINCIPAL })
  s.completeLogin({ attemptId: a.attemptId, identity: identity({ subject: null, org: 'org-1' }), label: 'first' })
  const b = s.beginLogin({ provider: 'codex-cli', runtime: RUNTIME, principal: PRINCIPAL })
  const clash = s.completeLogin({ attemptId: b.attemptId, identity: identity({ subject: null, org: 'org-1', email: 'other@example.com' }), label: 'second' })
  clash.ok === false && /cannot be told apart/.test(clash.reason)
    ? ok('two org-only identities in one organisation are refused rather than merged or duplicated')
    : fail('an indistinguishable identity completed: ' + JSON.stringify(clash))
  ;/CO-141/.test(String(clash.reason))
    ? ok('and the refusal names why no subject is available')
    : fail('the refusal does not name the measurement: ' + clash.reason)
  eq(s.listAccounts().length, 1, 'the register still holds one account')
}

// ── an unconfirmed identity cannot complete at all ──────────────────────────
{
  const s = store()
  const a = s.beginLogin({ provider: 'codex-cli', runtime: RUNTIME, principal: PRINCIPAL })
  const nothing = s.completeLogin({
    attemptId: a.attemptId,
    identity: identity({ subject: null, org: null }),
    label: 'labelled by hand'
  })
  nothing.ok === false && /nothing machine-readable/.test(nothing.reason)
    ? ok('a label and an email cannot complete a login — the design forbids the email as identity')
    : fail('an unconfirmed identity completed: ' + JSON.stringify(nothing))
}

// ── the default, and what changing it does NOT do ───────────────────────────
{
  const s = store()
  const a = s.beginLogin({ provider: 'codex-cli', runtime: RUNTIME, principal: PRINCIPAL })
  const first = s.completeLogin({ attemptId: a.attemptId, identity: identity({ subject: 'sub-a' }), label: 'a' })
  const b = s.beginLogin({ provider: 'codex-cli', runtime: RUNTIME, principal: PRINCIPAL })
  const second = s.completeLogin({ attemptId: b.attemptId, identity: identity({ subject: 'sub-b' }), label: 'b' })

  const set = s.setDefault({ provider: 'codex-cli', accountId: second.account.accountId, expectedRevision: s.revision() })
  set.status === 'committed' ? ok('a default is set at the revision that was read') : fail('setDefault: ' + JSON.stringify(set))

  const marked = s.listAccounts('codex-cli').filter((v) => v.isDefault)
  marked.length === 1 && marked[0].accountId === second.account.accountId
    ? ok('and exactly one account is marked as the default')
    : fail('the default is ' + JSON.stringify(marked))

  const stale = s.setDefault({ provider: 'codex-cli', accountId: first.account.accountId, expectedRevision: 'not-the-revision' })
  stale.status === 'conflict'
    ? ok('a default set at a revision that has moved conflicts rather than overwriting')
    : fail('a stale setDefault was accepted: ' + JSON.stringify(stale))
}

// ── removal is not a sign-out, and it refuses to orphan work ────────────────
{
  const s = store()
  const a = s.beginLogin({ provider: 'codex-cli', runtime: RUNTIME, principal: PRINCIPAL })
  const first = s.completeLogin({ attemptId: a.attemptId, identity: identity({ subject: 'sub-a' }), label: 'a' })
  const b = s.beginLogin({ provider: 'codex-cli', runtime: RUNTIME, principal: PRINCIPAL })
  const second = s.completeLogin({ attemptId: b.attemptId, identity: identity({ subject: 'sub-b' }), label: 'b' })
  s.setDefault({ provider: 'codex-cli', accountId: second.account.accountId, expectedRevision: s.revision() })

  const inUse = s.removeLocal({ accountId: first.account.accountId, expectedRevision: s.revision(), boundConversations: ['conv-1'] })
  inUse.ok === false && /conversation/.test(inUse.reason)
    ? ok('an account a conversation is bound to is not removed')
    : fail('an account in use was removed: ' + JSON.stringify(inUse))

  const isDefault = s.removeLocal({ accountId: second.account.accountId, expectedRevision: s.revision(), boundConversations: [] })
  isDefault.ok === false && /default/.test(isDefault.reason)
    ? ok('and neither is the default, while there is another account to move it to')
    : fail('the default was removed: ' + JSON.stringify(isDefault))

  const gone = s.removeLocal({ accountId: first.account.accountId, expectedRevision: s.revision(), boundConversations: [] })
  gone.status === 'committed' && /provider login and the saved conversations are untouched/.test(gone.says)
    ? ok('a free account is forgotten locally, and the answer says the provider login survives it')
    : fail('removal: ' + JSON.stringify(gone))
  eq(s.listAccounts().length, 1, 'and one account remains')
}

// ── the last account may be removed even though it is the default ───────────
{
  const s = store()
  const a = s.beginLogin({ provider: 'codex-cli', runtime: RUNTIME, principal: PRINCIPAL })
  const only = s.completeLogin({ attemptId: a.attemptId, identity: identity({ subject: 'sub-only' }), label: 'only' })
  s.setDefault({ provider: 'codex-cli', accountId: only.account.accountId, expectedRevision: s.revision() })
  const gone = s.removeLocal({ accountId: only.account.accountId, expectedRevision: s.revision(), boundConversations: [] })
  gone.status === 'committed'
    ? ok('the last account is removable although it is the default — otherwise it would be unremovable forever')
    : fail('the last account could not be removed: ' + JSON.stringify(gone))
  eq(s.listAccounts().length, 0, 'and the register is empty again')
}

// ── the register is a FILE, and a corrupt one is not overwritten ────────────
{
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-accounts-'))
  const s = store({ dir })
  const a = s.beginLogin({ provider: 'codex-cli', runtime: RUNTIME, principal: PRINCIPAL })
  s.completeLogin({ attemptId: a.attemptId, identity: identity({ subject: 'sub-a' }), label: 'a' })
  const file = path.join(dir, 'provider-accounts.json')
  const saved = readFileSync(file, 'utf8')
  saved.includes('sub-a') === false
    ? fail('the file does not hold the identity it was given')
    : ok('the register is a file on this device, not a row in the estate journal')
  ;/sk-ant-|BEGIN [A-Z ]*PRIVATE KEY|access_token/i.test(saved)
    ? fail('the register file holds something shaped like a credential')
    : ok('and it holds a reference to where the secret is, never the secret')

  // Corrupt the live file. `localState` QUARANTINES it and answers from the
  // last-good copy — the assertion here first said "reads as empty", which was
  // wrong about the design rather than about the code: an empty register would
  // silently lose the operator's accounts, which is the exact data loss S14
  // exists to refuse.
  writeFileSync(file, '{ not json at all')
  const after = store({ dir })
  eq(after.listAccounts().length, 1, 'a register that will not parse answers from the last good copy, not empty')
  const quarantined = readdirSync(dir).filter((f) => f.includes('quarantined'))
  quarantined.length === 1
    ? ok('and the unusable bytes are moved aside rather than overwritten — they are the operator’s only copy')
    : fail('the corrupt file was not quarantined: ' + readdirSync(dir).join(', '))
}

// ── the comparison itself, three answers ───────────────────────────────────
{
  const base = identity()
  eq(compareIdentity(base, { ...base }), 'same', 'two subjects that match are the same account')
  eq(compareIdentity(base, { ...base, subject: 'other' }), 'different', 'two subjects that differ are different accounts')
  eq(compareIdentity(base, { ...base, provider: 'claude-code' }), 'different', 'a different provider is a different account')
  eq(compareIdentity(base, { ...base, runtime: 'wsl' }), 'different', 'a login on another runtime is another account')
  eq(
    compareIdentity({ ...base, subject: null }, { ...base, subject: null }),
    'indistinguishable',
    'and two identities with no subject are INDISTINGUISHABLE, which is not the same as being the same'
  )
  eq(
    compareIdentity({ ...base, subject: null, org: 'a' }, { ...base, subject: null, org: 'b' }),
    'different',
    'unless their organisations differ, which the provider did verify'
  )
}

// ── the view is the only way out, and it is checked ─────────────────────────
{
  const raw = {
    accountId: 'acct-1',
    identity: identity(),
    confidence: 'subject',
    secretRef: 'codex-cli:/Users/example/.codex',
    label: 'work',
    addedAt: '2026-09-10T00:00:00.000Z'
  }
  viewLeaks(raw).length > 0
    ? ok('the RAW account is refused by the leak check — which is what makes the check worth having')
    : fail('the leak check passed a raw account carrying a secret reference')
  viewLeaks(accountView(raw, false)).length === 0
    ? ok('and the redacted view passes it')
    : fail('the redacted view leaked: ' + viewLeaks(accountView(raw, false)).join('; '))
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log('\nall green: several logins where the provider allows it, one refusal where it does not, and no secret in any view')
