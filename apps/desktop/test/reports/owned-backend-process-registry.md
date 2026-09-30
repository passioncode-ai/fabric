<sub>ssheleg skills — task-pipeline · agent-orchestrator · evidence-docs</sub>

# Owned backend physical registry — bounded handoff

Status: **physical process/stdio seam implemented; provider NOT_BOUND; not activated**. Measured 2026-09-27 on Darwin arm64, Node 26.8.2. This packet changes one main-only module and its actual disposable-process tests. It makes no provider, production UI, SQL, release or deployment claim.

## Objective and accepted boundary

Separate actual backend process ownership from a native view and from a provider's execution proof. Consume the existing Fabric admitted Run plus its existing before-spawn validation; do not create another admission policy or turn an asserted PID/session into ownership.

Entry points:

- [Implementation](../../src/main/ownedBackendProcessRegistry.ts): `createOwnedBackendProcessRegistry`.
- [Actual owned-process checks](../owned-backend-process-registry.test.mjs).
- Baseline launch contract: [managedLaunch.ts at 6efe3ce](https://github.com/passioncode-ai/fabric/blob/6efe3ce14180350f59310c993201bb2ad8ad5543/apps/desktop/src/main/managedLaunch.ts#L64).
- Existing process observations: [processBoundary.ts at 6efe3ce](https://github.com/passioncode-ai/fabric/blob/6efe3ce14180350f59310c993201bb2ad8ad5543/apps/desktop/src/main/processBoundary.ts).
- Open topology proposal, not acceptance: [provider-topology-proposal.md at 6efe3ce](https://github.com/passioncode-ai/fabric/blob/6efe3ce14180350f59310c993201bb2ad8ad5543/docs/launch/harness-r0/provider-topology-proposal.md).

## Contract

Bootstrap constructs one registry per Estate/private root using an allowlisted executable with SHA-256, fixed copied arguments/cwd/complete explicit environment, and fresh synchronous existing authority reader. This recipe is privileged main configuration, never renderer input. It is not a sandbox: the allowlisted executable can perform its configured work. The optional system seam is privileged offline fault injection only.

`start(admittedReceipt, sessionId, beforeSpawn)` validates exact Run/session/ordinal, reserves the identity once, persists an exclusive intent marker, awaits the existing final launch guard under one total deadline, then owns the actual detached `ChildProcess`. Its PID must be confirmed as a separate process group through the existing observer. The result is `owned`, `refused`, or `outcome_unknown`; it is never provider execution proof. A synchronous spawn throw can follow native materialization and therefore stays unknown.

`OwnedBackendHandle` is an immutable object-identity capability, with fresh owner ID and channel epoch. A JSON copy, handle from another registry, changed admitted scope or old consumed Run cannot claim/recreate its pipes. Concurrent calls for one exact pending Run share one promise/spawn. The disk record does not restore a capability.

`claimStdio(handle)` is available once and returns the actual child stdout, a restricted owned Writable, and a current physical owner guard. The focused positive test joins these to the **actual existing** `createProviderJsonlTransport` and receives a response from an owned fixture process. No provider identity/profile/thread/turn is invented. Main must compose transport `onClosed` with `connectionLost`.

The output adapter is deliberately pinned to **Darwin Node 26.8.2** and private `ChildProcess.stdin._handle.fd`. A real native pipe/socket descriptor is validated with bigint `fstat`. After all authority/handle callbacks, the final check contains only private entry state and a closed-over builtin physical descriptor check. It makes one synchronous `writeSync`; it never calls asynchronous `child.stdin.write`. Partial writes/EAGAIN/errors become sticky unknown; bytes are not retried. Corking and `end(chunk)` are unsupported. Input is bounded before enqueue/conversion and again at the syscall edge (1 MiB). The actual backpressure fixture fills a non-reading child's pipe with one write and proves no queued replay after revocation.

The measured Node executable SHA-256 was `902b6a6984d5d825829ea9064ab73b734548df37bc0683990dca31c8dc2a9253`. Node's private fd ABI, platform and synchronous nonblocking behavior require a new measured adapter when the runtime changes. **Electron, Linux and Windows are not supported by this adapter and were NOT_RUN.** Do not loosen the guard based on a matching semantic version alone in an unmeasured runtime.

Authority change, explicit connection loss, stream error/end/closure, ambiguous input and retirement irreversibly veto admission/write for that owner. Restoring the old authority value does not reconnect the epoch. A fresh provider handshake or a live snapshot is not a recovery mechanism supplied by this module.

`inspect` reports root exit, group observation, exact process identity reference, and `allDescendants: unknown`. A view process has no entry or exit hook here. Root exit does not prove provider quiescence or that no descendant escaped. A captured group remains available for cleanup if the root exits before the asynchronous capture continuation. Late capture after deadline can improve cleanup evidence, never revive write authority.

`signalOwned` only signals the captured group after the caller's literal synchronous cleanup/Stop grant and the existing fresh process observation. It has no automatic TERM, automatic Force, Run/Task mutation, lease release or Stop receipt. Its returned `sent` is not a settled backend. There is no atomic kernel pidfd guarantee in the reused `ps`/process-group observer; it can conservatively refuse cleanup if identity continuity was not captured.

## Capacity, durable intent and recovery prerequisites

The registry retains at most 128 lifetime Run markers and 128 in-memory identities, with at most eight unresolved entries. These are safety bounds, not an automatic history rotation policy. Before-spawn refusal still consumes its reserved Run marker; conservatively unresolved/refused entries can also exhaust the current registry's eight-entry limit. Reconstructing a registry does not erase the marker limit or permit that old Run/session again.

Markers contain only Estate/project/task/Run/session/ordinal plus owner/epoch IDs. They are exclusive-created, fully written with short-write handling, fsynced with their directory, regular owner-only files. Corrupt/incomplete/excess marker history refuses construction. A second main process is not supported as a parallel writer to this namespace; shared cross-process/machine admission remains SQL's responsibility. This is not a malicious same-user filesystem isolation boundary or power-loss acceptance test.

**At 128 markers, admission is refused.** No pruning/deletion API or unattended reset exists. Before production activation a separately reviewed canonical reconciliation/archive protocol must prove old intents terminal/non-replayable, retain durable replay denial, and define namespace/epoch rollover. Manual removal or a new empty directory is not an approved workaround. Restart never adopts a live backend from a marker; unknown processes require explicit existing recovery investigation and a new canonical Run only after that outcome permits it.

## Remaining composition work — exact next task

1. Establish a backend-specific launch receipt seam in `managedLaunch`: its current `PtyLaunchFailure`/`get(sessionId)` compensation classification is terminal-oriented. Map this registry's known pre-spawn refusal versus unknown materialization explicitly; do not let the mere reserved marker make `get` report a process. Test actual guard→spawn→bind failure and canonical compensation before wiring.
2. Join the owned pipes to one accepted provider transport and exact initialize/thread/turn evidence. The physical registry remains `NOT_BOUND` until the existing ProviderExecution validator accepts the actual pinned profile. A transport's per-RPC command/deadline fence is separate from the registry's physical-owner fence: the final production join must carry that command fence to its actual synchronous write edge, not just infer it from a preceding `stillOwned()` check. This packet does not certify that future join's request-scoped authority.
3. Add a backend-exit receipt accepted by canonical Stop with exact owner/epoch/process/transcript/provider facts. Existing [Stop SQL at 6efe3ce](https://github.com/passioncode-ai/fabric/blob/6efe3ce14180350f59310c993201bb2ad8ad5543/supabase/migrations/20260927000062_managed_stop.sql#L134) requires `terminal.closed@1`; never fabricate that event from a view or from this registry to bypass the contract.
4. Compose the actual backend owner into native view lifecycle/host only after that receipt exists. Preserve view detach versus execution Stop; then test activation in Electron's real runtime with a measured pipe adapter and approved provider topology.

These dependencies are deliberately outside this three-file packet. No `index.ts`, existing PTY, migration, renderer IPC, runtime profile, global configuration or shared map file is changed here. Root owns integration/ADR/maps/full-fast/workspace publication under the delegated task boundary.

## Evidence actually run

From repository root:

```sh
node --experimental-strip-types apps/desktop/test/owned-backend-process-registry.test.mjs
```

Result: **17 groups PASS**, followed by `PASS cleanup: owned groups empty; fixture removed`. Cases cover actual JSONL child exchange; concurrent/reentrant admission; stale and copied handles; guard refusal/deadline; authority reentrancy; old Run/session restart rejection; physical fd accessor/closure races; actual pipe backpressure; partial/EAGAIN; queue/size refusal; view versus backend exit; root exit with a surviving child during delayed capture; late capture; recipe immutability; exact signal guard; lifetime capacity. All processes and files are disposable and owned by this fixture. No model, provider, network, real account or DB was invoked.

From `apps/desktop`:

```sh
./node_modules/.bin/tsc --noEmit --strict --target ES2022 \
  --module NodeNext --moduleResolution NodeNext \
  --allowImportingTsExtensions --skipLibCheck --types node \
  src/main/ownedBackendProcessRegistry.ts
```

Result: exit 0. `git diff --check` is checked before the bounded commit. Full repository fast checks, SQL admission/Stop integration, actual provider conformance and production activation are **NOT_RUN** in this member packet.

Review corrections: replaced queued Node writes with a measured synchronous fd edge; retained late captured identity for surviving children; moved all handle accessors before the final owner fence; added post-authority spawn state checks and refused recursive authority lookup. Independent root review is tracked in the parent integration, not represented here as production acceptance.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded implementation and handoff
- [`agent-orchestrator`](https://github.com/ssheleg/agent-stack) — physical owner versus provider separation
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — actual owned-process checks and explicit limits

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>

## Addendum · Electron main measured · 2026-09-28 (first-slice plan E0)

The pin above is replaced by a list of **measured runtime tuples**
([`runtimeAdmission.ts`](../../src/main/runtimeAdmission.ts), `MEASURED_RUNTIMES`): runtime kind,
Electron, embedded Node, libuv, ABI, platform, arch and the SHA-256 of the binary holding the
runtime's code. The 50 KB Homebrew `node` launcher hashed above is not that binary; the tuple
hashes `libnode.147.dylib` (`88ff1063…`) instead, and Electron main hashes
`Electron Framework` (`3e7bf674…`).

Measured, all groups passing, via `electron test/electron-main-runner.mjs <suite>` in a real
Electron 44.0.0 main process (`process.type` `browser`, Node 24.18.1, libuv 1.52.1, ABI 149,
darwin arm64): this registry's 17 groups — private `stdin._handle.fd`, bigint
`fstat().isSocket()`, one-syscall backpressure, short writes and EAGAIN never retried — and
the native view host's 14 groups with node-pty 1.1.0, whose N-API prebuild loads on ABI 149
without a rebuild. No descriptor behaviour differed, so the separate-supervisor alternative
was not needed.

Refused: Electron with `ELECTRON_RUN_AS_NODE` (not the main process), any other version, any
changed binary. NOT_RUN: the packaged, hardened app, whose re-signed framework is a different
binary and needs its own tuple (N1); Linux and Windows.
