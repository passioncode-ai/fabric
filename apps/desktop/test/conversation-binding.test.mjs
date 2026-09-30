// Changing where new work goes is not moving work already running (M199.binding).
//
// The card's four failure cases are the whole of this file:
//
//   1. Setting default B does not change live conversations A and C, and the
//      NEXT admission gets B.
//   2. Account-revision drift between the read and the spawn stops the dispatch.
//   3. A foreign project, workspace or runtime — and a late callback from a
//      replaced session — does not change the binding.
//   4. One native conversation does not have two admitted writers.
//
// And one thing M199.probe measured decides what a binding may PROMISE: an
// account is pinned only where the credential follows the config home. On
// Claude Code it is one keychain item per operating-system user, so the login
// can change under a running conversation and no record here can stop it. The
// design says to show the drift instead of promising pinning, so `PinStrength`
// has two values and the weaker one carries its reason.
//
// Pure and local: a temp directory, an injected runtime and an injected auth
// revision. No provider is executed, no credential is read, nothing is written
// to the estate journal.

import { createConversationRegistry } from '../src/main/conversationRegistry.ts'
import {
  driftOf,
  mayWrite,
  pinStrength,
  resolveAccount
} from '../src/shared/conversationBinding.ts'
// Deterministic regression fixture: the measured 2026-09-10 builds.
// Current-build invalidation is covered by provider-capability-upgrade.test.mjs.
import { HISTORICAL_CAPABILITY_MATRIX as CAPABILITY_MATRIX, HISTORICAL_PINNED_BUILDS as PINNED_BUILDS } from '../src/shared/providerCapabilityMatrix.ts'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const HOST = 'darwin-arm64 host'
const WORKSPACE = 'sha256:workspace-one'

const registry = (over = {}) =>
  createConversationRegistry({
    dir: mkdtempSync(path.join(tmpdir(), 'fabric-bindings-')),
    matrix: CAPABILITY_MATRIX,
    builds: { ...PINNED_BUILDS },
    runtime: HOST,
    authRevisionOf: () => 1,
    ...over
  })

const admit = (r, conversationId, over = {}) =>
  r.admit({
    conversationId,
    projectId: 'p1',
    provider: 'codex-cli',
    nativeRef: `native-${conversationId}`,
    workspaceFingerprint: WORKSPACE,
    expectedRevision: r.revision(),
    ...over
  })

// ── the resolution order, once ──────────────────────────────────────────────
{
  eq(resolveAccount({ explicit: 'x', projectBinding: 'y', providerDefault: 'z' }).source, 'explicit', 'an explicit choice wins')
  eq(resolveAccount({ projectBinding: 'y', providerDefault: 'z' }).source, 'project', 'then the project binding')
  eq(resolveAccount({ providerDefault: 'z' }).source, 'default', 'then the provider default')
  const system = resolveAccount({})
  system.source === 'system' && system.accountId === null
    ? ok('and the system login last — which is a valid state, not a failure')
    : fail('the fallback was ' + JSON.stringify(system))
}

// ── FAILURE CASE 1: a default change leaves live conversations alone ────────
{
  const r = registry()
  const a = admit(r, 'conv-A')
  const c = admit(r, 'conv-C')
  a.ok && c.ok ? ok('two conversations are admitted') : fail('admission failed: ' + JSON.stringify([a, c]))
  eq(a.resolved.source, 'system', 'both resolved to the system login, because nothing was set')

  const set = r.setProjectBinding({ projectId: 'p1', provider: 'codex-cli', accountId: 'acct-B', expectedRevision: r.revision() })
  set.ok ? ok('the project binding is set to account B') : fail('setProjectBinding: ' + set.reason)
  ;/live conversation\(s\) keep the account/.test(set.reason)
    ? ok('and the answer SAYS what it did not do — changing where new work goes is a different act')
    : fail('the answer does not say what was left alone: ' + set.reason)

  const liveA = r.binding('conv-A')
  const liveC = r.binding('conv-C')
  liveA.accountId === null && liveC.accountId === null
    ? ok('A and C still run on the account they were admitted with')
    : fail('a live conversation moved: ' + JSON.stringify([liveA.accountId, liveC.accountId]))
  eq(liveA.bindingRevision, 1, 'and their binding revisions did not move either')

  const next = admit(r, 'conv-D')
  next.ok && next.binding.accountId === 'acct-B' && next.resolved.source === 'project'
    ? ok('while the NEXT admission gets B, from the project binding')
    : fail('the next admission resolved ' + JSON.stringify(next.resolved ?? next))
}

// ── FAILURE CASE 4: one native conversation, one writer ────────────────────
{
  const r = registry()
  const first = admit(r, 'conv-A')
  first.ok ? ok('the first admission succeeds') : fail('first: ' + first.reason)
  const again = admit(r, 'conv-A')
  again.ok === false && /two writers/.test(again.reason)
    ? ok('a second admission of the same conversation is refused')
    : fail('a conversation was admitted twice: ' + JSON.stringify(again))
  const sameNative = admit(r, 'conv-B', { nativeRef: 'native-conv-A' })
  sameNative.ok === false && /already bound/.test(sameNative.reason)
    ? ok('and so is a different conversation claiming the same provider history')
    : fail('two writers on one native history: ' + JSON.stringify(sameNative))
}

// ── FAILURE CASE 3: foreign project, workspace, runtime, and a late callback ─
{
  const r = registry()
  const a = admit(r, 'conv-A')
  const base = {
    conversationId: 'conv-A',
    expectedRevision: a.binding.bindingRevision,
    sessionGeneration: a.binding.sessionGeneration,
    projectId: 'p1',
    workspaceFingerprint: WORKSPACE,
    patch: { nativeRef: 'native-moved' }
  }

  const foreignProject = r.write({ ...base, projectId: 'p2', fileRevision: r.revision() })
  foreignProject.allowed === false && foreignProject.refusal === 'foreign-project'
    ? ok('a caller naming another project cannot write')
    : fail('foreign project: ' + JSON.stringify(foreignProject))

  const foreignWorkspace = r.write({ ...base, workspaceFingerprint: 'sha256:other', fileRevision: r.revision() })
  foreignWorkspace.allowed === false && foreignWorkspace.refusal === 'foreign-workspace'
    ? ok('nor one whose workspace has changed — the saved conversation refers to other files')
    : fail('foreign workspace: ' + JSON.stringify(foreignWorkspace))

  const foreignRuntime = registry({ runtime: 'wsl:ubuntu' })
  const elsewhere = admit(foreignRuntime, 'conv-E')
  const wrongHost = registry({
    dir: undefined,
    runtime: HOST
  })
  elsewhere.ok && elsewhere.binding.runtime === 'wsl:ubuntu'
    ? ok('a conversation admitted on another runtime records that runtime')
    : fail('runtime not recorded: ' + JSON.stringify(elsewhere))
  const crossRuntime = mayWrite(elsewhere.binding, {
    expectedRevision: 1,
    sessionGeneration: 1,
    projectId: 'p1',
    workspaceFingerprint: WORKSPACE,
    runtime: HOST
  })
  crossRuntime.allowed === false && crossRuntime.refusal === 'foreign-runtime'
    ? ok('and a caller on a different runtime cannot write to it')
    : fail('cross runtime: ' + JSON.stringify(crossRuntime))
  void wrongHost

  // The generation check, and it is the one easiest to leave out: a replaced
  // session still has callbacks in flight, and a late one carries a true
  // statement about a process nobody is watching any more.
  // BOTH FIELDS, because `patch` REPLACES rather than merges and the first
  // version of this passed only the generation — then asserted the nativeRef
  // had moved, which nothing had asked it to do. A restart carries both: a new
  // session, and whatever the provider now calls the conversation.
  const bumped = r.write({
    ...base,
    patch: { sessionGeneration: 2, nativeRef: 'native-moved' },
    fileRevision: r.revision()
  })
  bumped.allowed ? ok('a restart bumps the session generation') : fail('bump: ' + JSON.stringify(bumped))
  eq(r.binding('conv-A').sessionGeneration, 2, 'and the generation is what the write said')
  const late = r.write({
    ...base,
    expectedRevision: bumped.binding.bindingRevision,
    sessionGeneration: 1,
    fileRevision: r.revision()
  })
  late.allowed === false && late.refusal === 'old-generation'
    ? ok('and a callback from the session it replaced is refused')
    : fail('a late callback was applied: ' + JSON.stringify(late))
  eq(r.binding('conv-A').nativeRef, 'native-moved', 'the binding still holds what the accepted write left')
}

// ── the stale revision, which is a different refusal from a late generation ─
{
  const r = registry()
  const a = admit(r, 'conv-A')
  const first = r.write({
    conversationId: 'conv-A',
    expectedRevision: 1,
    sessionGeneration: 1,
    projectId: 'p1',
    workspaceFingerprint: WORKSPACE,
    patch: { nativeRef: 'one' },
    fileRevision: r.revision()
  })
  first.allowed ? ok('a write at the revision it read is accepted') : fail('first write: ' + JSON.stringify(first))
  const stale = r.write({
    conversationId: 'conv-A',
    expectedRevision: 1,
    sessionGeneration: 1,
    projectId: 'p1',
    workspaceFingerprint: WORKSPACE,
    patch: { nativeRef: 'two' },
    fileRevision: r.revision()
  })
  stale.allowed === false && stale.refusal === 'stale-revision'
    ? ok('and a second write at the same revision is refused — one writer, at the revision it read')
    : fail('stale revision: ' + JSON.stringify(stale))
  eq(r.binding('conv-A').nativeRef, 'one', 'the first write stands')
  void a
}

// ── FAILURE CASE 2: drift between the read and the spawn stops the dispatch ─
{
  let revision = 1
  const r = registry({ authRevisionOf: () => revision })
  admit(r, 'conv-A')
  const before = r.mayDispatch('conv-A')
  before.allowed ? ok('a dispatch at the admitted revision is allowed') : fail('before: ' + JSON.stringify(before))

  revision = 2
  const after = r.mayDispatch('conv-A')
  after.allowed === false && /replaced under this conversation/.test(after.reason)
    ? ok('and once the credential is replaced underneath, the dispatch STOPS')
    : fail('drift did not stop the dispatch: ' + JSON.stringify(after))
  ;/plan, the organisation or the subject may all differ/.test(after.reason)
    ? ok('with the reason saying what may have changed, not just that a number moved')
    : fail('the reason is thin: ' + after.reason)

  const unreadable = registry({ authRevisionOf: () => null })
  const admitted = admit(unreadable, 'conv-B')
  admitted.ok === false && /not something to freeze/.test(admitted.reason)
    ? ok('an account with no readable revision is not admitted at all')
    : fail('an unreadable revision was admitted: ' + JSON.stringify(admitted))
}

// ── an unreadable revision AFTER admission is not permission either ────────
{
  let readable = true
  const r = registry({ authRevisionOf: () => (readable ? 1 : null) })
  admit(r, 'conv-A')
  readable = false
  const verdict = r.mayDispatch('conv-A')
  verdict.allowed === false && /unknown is not permission/.test(verdict.reason)
    ? ok('a revision that cannot be read stops the dispatch — unknown is not permission')
    : fail('an unreadable revision allowed a dispatch: ' + JSON.stringify(verdict))
  // And it is NOT reported as drift, which would be a claim that it changed.
  const drift = driftOf(r.binding('conv-A'), null)
  drift.drifted === false && /not the same as it having changed/.test(drift.reason)
    ? ok('and it is not reported as drift — a reading that failed is not a change')
    : fail('an unreadable revision was called drift: ' + JSON.stringify(drift))
}

// ── what a binding may PROMISE, from what was measured ─────────────────────
{
  const codex = pinStrength({
    matrix: CAPABILITY_MATRIX,
    provider: 'codex-cli',
    cliBuild: PINNED_BUILDS['codex-cli'],
    accountId: 'acct-1'
  })
  codex.strength === 'pinned' && /follows the home/.test(codex.reason)
    ? ok('a Codex account is PINNED, because its credential follows the home')
    : fail('codex pin: ' + JSON.stringify(codex))

  const claude = pinStrength({
    matrix: CAPABILITY_MATRIX,
    provider: 'claude-code',
    cliBuild: PINNED_BUILDS['claude-code'],
    accountId: 'acct-1'
  })
  claude.strength === 'drifting' && /it is not pinned/.test(claude.reason)
    ? ok('and a Claude Code account is DRIFTING, because one keychain item per OS user is not ours to own')
    : fail('claude pin: ' + JSON.stringify(claude))

  const system = pinStrength({
    matrix: CAPABILITY_MATRIX,
    provider: 'codex-cli',
    cliBuild: PINNED_BUILDS['codex-cli'],
    accountId: null
  })
  system.strength === 'drifting' && /Nothing here owns it/.test(system.reason)
    ? ok('and the system login is drifting on EVERY provider — nothing here owns it')
    : fail('system pin: ' + JSON.stringify(system))

  const r = registry()
  admit(r, 'conv-A')
  const shown = r.pinOf('conv-A')
  shown.strength === 'drifting'
    ? ok('so a conversation on the system login is shown as drifting rather than promised as pinned')
    : fail('pinOf: ' + JSON.stringify(shown))
}

// ── the register is a file, and a conflicting write does not land ───────────
{
  const r = registry()
  const a = admit(r, 'conv-A')
  a.ok ? ok('the binding is written to a device-local file') : fail('admit: ' + a.reason)
  const conflicted = r.setProjectBinding({
    projectId: 'p1',
    provider: 'codex-cli',
    accountId: 'acct-B',
    expectedRevision: 'not-the-revision'
  })
  conflicted.ok === false && /nothing was written/.test(conflicted.reason)
    ? ok('and a write at a revision that has moved conflicts rather than overwriting')
    : fail('a stale write landed: ' + JSON.stringify(conflicted))
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log('\nall green: a default change moves nothing live, drift stops a dispatch, and pinning is only promised where it was measured')
