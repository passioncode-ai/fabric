# Proposed next local packet: selected input and cooperative lease binding

Status: DESIGN ONLY, no implementation or authority. Source base Fabric 1b63e81c11e3327c26f930e93656ac7a2b11fcb6 plus current wave working files. No database/native/global policy change. Composition hazards below are prerequisites for future resource enforcement, not demonstrated defects in the current ordinary launch path. This is a proposed packet for parent interface review, not another canonical task register.

## Existing producers and ordering

- [admitExisting.ts](https://github.com/passioncode-ai/fabric/blob/f2576c109f1de55179e07c7398aa2c4564e12087/apps/desktop/src/main/admitExisting.ts#L20) accepts estate/task/session plus subject revision. [managedLaunch.ts](https://github.com/passioncode-ai/fabric/blob/f2576c109f1de55179e07c7398aa2c4564e12087/apps/desktop/src/main/managedLaunch.ts#L40) mints or adopts the exact session, receives task_run_id/run_ordinal from SQL, and validates task/session equality. These are distinct from an agent-sync run.
- [index.ts](https://github.com/passioncode-ai/fabric/blob/f2576c109f1de55179e07c7398aa2c4564e12087/apps/desktop/src/main/index.ts#L1061), [contextPack.ts](https://github.com/passioncode-ai/fabric/blob/f2576c109f1de55179e07c7398aa2c4564e12087/apps/desktop/src/main/contextPack.ts#L40) compile source-owned context with compiler revision, source receipts and content hash. [sessionBundle.ts](https://github.com/passioncode-ai/fabric/blob/f2576c109f1de55179e07c7398aa2c4564e12087/apps/desktop/src/main/sessionBundle.ts#L196) materializes/verifies the actual context part under session/project/task. This is selected compiler input, not the complete mutable worktree.
- [managedLaunch.ts](https://github.com/passioncode-ai/fabric/blob/f2576c109f1de55179e07c7398aa2c4564e12087/apps/desktop/src/main/managedLaunch.ts#L73) and [pty.ts](https://github.com/passioncode-ai/fabric/blob/f2576c109f1de55179e07c7398aa2c4564e12087/apps/desktop/src/main/pty.ts#L452) prepare the bundle after admission, then refresh resource currentness before final SQL guard/spawn. [managedLaunch.ts](https://github.com/passioncode-ai/fabric/blob/f2576c109f1de55179e07c7398aa2c4564e12087/apps/desktop/src/main/managedLaunch.ts#L132) sends `input.instruction ?? receipt.instruction`; a chain override must be bound separately. Hashing only receipt.instruction misses actual delivered input.
- [workTools.ts](https://github.com/passioncode-ai/fabric/blob/f2576c109f1de55179e07c7398aa2c4564e12087/apps/desktop/src/main/workTools.ts#L314) receives task-authored touches and journals warning-only write scopes. [backlogSource.ts](https://github.com/passioncode-ai/fabric/blob/f2576c109f1de55179e07c7398aa2c4564e12087/apps/desktop/src/main/backlogSource.ts#L30) establishes repository membership/path/row appearance, with an explicitly unchecked oversized-file case. Neither establishes exclusive writable ownership or a full dependency closure.
- [gitLeaseSnapshot.ts](https://github.com/passioncode-ai/fabric/blob/f2576c109f1de55179e07c7398aa2c4564e12087/apps/desktop/src/main/gitLeaseSnapshot.ts#L18) verifies configured exact remote/key/run/repository/tip and freshness. The payload has no paths, Fabric task/session, durable numerical fence, or enforcement against writers. Fresh matching remote observations are not continuous ownership.
- Fabric source search of apps/scripts found no AGENT_SYNC_RUN_ID producer. [sessionEnv.ts](https://github.com/passioncode-ai/fabric/blob/f2576c109f1de55179e07c7398aa2c4564e12087/apps/desktop/src/main/sessionEnv.ts#L64) retains inherited variables except its named exclusions. This is an integration hazard for the future supported path, not a claim of an observed collision.
- Installed agent-sync1.22.2 script SHA256 fba3e2d99cad3982b3d81cab9c2ae7a255265ddddcd249aee81dca866e457ee1: `_session_key:868-870`, `run_id:933,948-949`, `_rid_from:832-848` transform the explicit environment key into a run ID. The raw environment value is not the lease payload owner. Long keys use only six hex digest characters; identity is cooperative/self-reported, not authentication.

## Smallest useful implementation

One new internal source module plus focused real-filesystem/Git tests: `resourceInputSnapshot.ts`, `resource-input-snapshot.test.mjs`, and a uniquely owned contract document. Implement an actual selected-file reader, not a boolean callback or rehash of a caller's expected digest. No index wiring in this packet.

Constructor accepts a fixed kernel assignment, never renderer/task payload:

```
assignment = {
  estateId, projectId, taskId, sessionId, attemptId,
  repository: { approvedRoot, approvedRemoteDigest, expectedHead },
  selectedInputs: [exact repository-relative regular-file paths],
  mutableScope: [exact repository-relative paths, explicit missing paths allowed],
  lease: { configuredKey, expectedRunId, expectedTip, scopeMappingRevision },
  bounds: { maxPaths, maxDepth, maxPathBytes, maxFileBytes, maxTotalBytes, timeoutMs }
}
reader.capture() -> observed | refused | unknown
reader.current(previous) -> same | changed | unknown
```

The assignment's *selection* comes from reviewed source-owned policy/task manifest; a caller cannot invent it by submitting touches. Initially support one explicitly configured repository/task lane, exact paths only, no globs or directory expansion. Fixed bounds are mandatory. Canonical domain-versioned digests include identity, reviewed selection revision, expected HEAD, sorted paths/type/bytes or explicit absence, actual compiled context/brief/instruction digests when available, and selected mutable scope. Exclude credentials/generated MCP bearer files from input manifests and output only bounded reason codes/digests.

Reader uses no shell, no clean/reset/fetch of the working repository. Refuse absolute/dot-dot/NUL/duplicate aliases, escapes, symlinks in every path component, special files, submodule roots unless explicitly supported, unexpected selected untracked/ignored paths and over-budget reads. Use opened-file identity/stat checks before/after reading and revalidate parent/root identities plus HEAD/index view; concurrent rename/replacement or undecidable change becomes unknown/refused. Path and byte budgets bound real reads. Retain unsettled I/O occupancy after timeout, consume ordinary accidental native-Promise clock rejection, and do not publish a late success. Do not claim arbitrary hostile filesystem race immunity; this is a cooperative local snapshot and cannot prevent later writes.

N023 exact lease read is a separate evidence component of the result. The configured key-to-path mapping must be named/revisioned by the kernel assignment. This establishes which local policy selected a scope; it does NOT magically make agent-sync enforce those paths. Return `executionAuthorized:false` and no R1 `held` verdict until the actual run mapping is supplied by trusted composition. An injected transport is infrastructure, not a task-supplied verdict.

## Actual run-to-lease binding, next composition change

Fabric must own a mapping created before admission: estate/task/session/attempt -> repository identity, fixed selected scope revision, explicit agent-sync environment key, resulting actual run ID, observed exact lease tip. Do not infer it from a folder's shared `.agent-sync/run-id`, a inherited process environment, a work.claimed warning, or a task-request run string.

The supported composition can use agent-sync's existing explicit AGENT_SYNC_RUN_ID interface, assign a kernel-generated session-specific key, read back the actual tool result, and independently inspect the remote lease through N023. This requires no foreign protocol edit or COM approval. Acquiring a missing lease uses the existing authorized agent-sync command/remote write authority; this research does not acquire one. Clear the inherited run ID and pass the specific assignment only to that child. Never reuse the parent session's lease to assert a distinct child owns it. Environment propagation is identity correlation, not a sandbox or credential.

SQL run ID exists only after admission. Final binding must attach exact returned task_run_id/run_ordinal to the prior assignment and reject foreign/reused receipts. Crash recovery with no trusted persisted mapping remains unknown; do not reconstruct authority from journal marker text. Internal resource attempt fence must have its own explicit owner/allocation semantics; it cannot be synthesized from the Git hash, timestamp or external run string. N023's tip is its external currentness token only.

To bind actual input, either prepare the one immutable compiler packet before resource admission and pass it unchanged through existing bundle/dispatch, or use a two-stage preparation contract that finalizes all instruction/context digests before the reservation is accepted. Do not compile again from moving DB state and claim the earlier digest still covers it. Chain resolved brief/dispatch receipt needs the same treatment; until implemented, refuse unsupported chain path explicitly in resource-required composition. Preserve existing ordinary non-resource behavior.

## Negative acceptance

1. Real owned files: changed selected bytes, HEAD/index change, newly created selected absent path, selected untracked/ignored input, symlink or parent substitution, path alias/escape, submodule, special file, oversize all refuse or unknown. An unrelated file does not silently widen a selected closure claim.
2. Caller-supplied digest/touches/run ID cannot override constructor assignment; foreign project/task/session/attempt or conflicting same-session mapping refuses.
3. Real owned agent-sync-shaped Git fixture: foreign run, same-owner expired lease, exact-tip renewal/loss, changed key/repo, failure during read and expiry during snapshot never produce current. Missing key-to-scope mapping refuses.
4. Repeat hung I/O calls do not increase outstanding operation count; late success does not approve prior caller. Synchronous clock, native rejected Promise clocks, rollback and malformed time covered.
5. Composition acceptance later: actual prepared context/instruction mutation and chain override change invalidate the bound input before SQL validation/spawn; final guard ordering survives async preparation; stale/foreign receipt and replayed mapping cannot dispatch.

## Real remaining limits

Local producer implementation and composition tests can proceed now. Active pending DDL ordering, explicit policy configuration, trusted transport credentials if a private remote requires them, a real supported lease, and native operational acceptance remain prerequisites to enabling the supported path. No global worker inventory is fabricated. Git coordination cannot provide continuous exclusive file enforcement/numeric fencing; either state the supported guarantee as cooperative snapshot+existing SQL run fence in a local ADR or use an actually isolated/enforced execution mechanism. That semantic decision is Fabric-owned local design, not an invented universal COM blocker. A purely mathematical adapter returning held without these producers is not acceptable.
