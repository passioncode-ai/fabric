# CO-282 — portable harness waves handoff

Start with [the execution plan](../evidence/plans/2026-10-13-harness-waves.md) and
[the 25-node graph](../execution/harness-waves/graph.json). **CO-282 is partial.**
First-wave repairs and bounded local resource implementations exist; active resource
enforcement, cross-owner acceptance and native acceptance remain open.

## Current source and bounded results

Integration branch: `agent/harness-integrated-20261013` in `passioncode-ai/fabric`;
accepted producer source `f2576c109f1de55179e07c7398aa2c4564e12087`; earlier recovery source
`ae197a1552231a9252754f9ee296736f94269471` is historical.
Merge `cc123baf67753d817282fdd686365051ae897d66` preserves main privacy changes through
`f4e21d18fd5b077291652b0508fde2ba43378b1a`. The producer source has its own verified branch-delivery receipt below; neither
checkpoint is a main merge, product installation or publication receipt.

| Unit | Source and evidence | Acceptance boundary |
|---|---|---|
| N-012 / R1 | Accepted `d984d98358b82824695e0636d8f3e0c50ec6eb82`, integrated as `c5bb122f`; [review receipt](../reports/2026-10-13-resource-admission-contract/raw/r1-review-receipt.json) | Advisory local eligibility only; 106 focused tests and independent arithmetic/binding checks. It cannot reserve capacity or authorize execution. |
| N-013 / R2 | Fixed and independently accepted `0b0ad6a9dd9e14a58762e0fc5aaf982bd5789af1`, integrated as `aba21213`; [reservation implementation and checks](../execution/harness-waves/resource-reservation.md#verification) | Pending SQL tested in an owned isolated database. Numeric fence normalization closes the review finding; the ledger is not active in the installed schema. |
| N-014 / R3 preparation | Fix `ae23efc24e4d83800aeb8b7d26e1074a7fcd2dab`, integrated as `981c5afc`; [adapter contract and checks](../execution/harness-waves/resource-launch-adapter.md) | 44 focused tests pass. Async currentness now precedes final SQL validation; ordinary and pre-admitted negative cases require zero spawns. No production composition or universal entry-path enforcement. |
| N-015 final PTY preparation | `9b83706ed61373c205113dc84518a8c3a371f889` | Independent production-manager regression passes fixed and fails on exact parent source; synthetic spawn only, no native/Windows claim. |

The [resource-wave review](../reports/2026-10-13-resource-admission-contract/README.md)
collects the continuation evidence. [ADR-0152](../adr/0152-resource-preflight-and-durable-reservation-are-distinct.md)
permits local injected code and isolated durable implementation before external board
admission. Source acceptance, active schema, configured policy and native behavior are
separate claims. N-007/N-008 must close against the expanded candidate, not inherit the
first-wave completion. Final graph reconciliation and delivery receipts follow integration.

**Verified recovery checkpoint:** full `bash scripts/ci.sh fast` PASS at
`ae197a1552231a9252754f9ee296736f94269471`, exact tree
`73f62899eceb74f60445f506ac1e950b03709aff`; [receipt](../reports/2026-10-13-resource-admission-contract/raw/recovery-wave-fast.json).
N016 recovery, N017 wait kernel and N018 observations are present there. Subsequent
N019 durable store and N020 adapter timeout correction require their own acceptance.
Main documentation through `7e51da91099c13abbcd2a29a62fae59d2b6bafdb` is preserved
in `d96f62e7`: union219/286 carry-over rows, next CO287.

N020: seven new regressions fail on original source; corrected adapter/observations
pass67 tests and five independent adversarial checks.
[Portable receipt](../reports/2026-10-13-resource-admission-contract/raw/n020/README.md).
N019: actual SQL application succeeded but the first fixture incorrectly reused
R4 attempt IDs; the ledger correctly refused both. Fixture c6f5ce5b namespaces them
and retains an explicit collision-refusal test. The next fixture correction calls actual managed begin before testing compensation and also verifies pre-begin refusal. All six stages of the owned resource SQL runner now pass, exit0; [builder receipt](../reports/2026-10-13-resource-admission-contract/raw/n019/final/receipt.json).

Source review and module tests do not establish active schema, installed runtime,
production composition, all-host behavior or owner adoption.

## Historical first-wave receipts

These immutable receipts remain useful; they do not certify the expanded resource wave.

- `agent/harness-waves-20261013` at `de50e9e0fddf9f5fa37cd063fb3659cdc274bbff`:
  pushed historical source and segmented checks.
- `agent/harness-integrated-tested-20261013` at
  `179e71e94682a8d609c32647473ca09f3130d146`: historical full-fast PASS, tree
  `d41e70d134bc2469c8f324afe3adae8b1cb24a5b`.
  [Receipt](../reports/2026-10-13-harness-wave-review/raw/integrated-fast-receipt.json)
  records exit 0, 53 compiler checks, 25 enrollment, 45 MCP and 35 ACP tests plus the rest
  of fast. Docker/native/provider checks were NOT_RUN; toolchain reproducibility unverified.
- Integration `12ff522b04aafaeaa485a91c5ceb53f04d9e0d18` and subsequent closeout:
  [branch delivery readback](../reports/2026-10-13-harness-wave-review/raw/branch-delivery-receipt.json),
  [affected-input compiler receipt](../reports/2026-10-13-harness-wave-review/raw/final-compiler-receipt.json)
  and [PR 31](https://github.com/passioncode-ai/fabric/pull/31).

The [first-wave review](../reports/2026-10-13-harness-wave-review/README.md) preserves
rejected candidates and negative replay fixtures. Repairs cover enrollment identity and
serialization, whole-context limits, acknowledged ACP mode and required Fabric surface,
and MCP cooldown/late-link cleanup. Its nine locally delivered nodes out of eleven were
a historical scope count, not completion of product requirements.

## Exact next work and dependencies

1. Verified merged source1b63e81c11e3327c26f930e93656ac7a2b11fcb6 passed fast
   at tree76bc7d64fb93c1b0db5db28bc905b6d5c96c55c5, exit0,707.51s;
   [receipt](../reports/2026-10-13-resource-admission-contract/raw/closing/merged-1b63-fast.json).
   N022–N025 now have scoped source review and seven-stage actual SQL PASS; receipts
   live under raw/n022–n025 in the resource report. Combined producer source `f2576c109f1de55179e07c7398aa2c4564e12087`
   passed full fast at tree `5ac7a0e834fe38e572d56188ac52b8c38616cc58`, exit0,873.64s;
   [receipt](../reports/2026-10-13-resource-admission-contract/raw/closing/producer-f257-fast.json).
   Source is pushed; N022–25 and N007 are closed against that bounded result. Their activation
   boundaries remain explicit; no module result activates the installed runtime.
2. The [activation prerequisites](../execution/harness-waves/resource-activation-prerequisites.md)
   and the [next input/scope packet](../execution/harness-waves/input-scope-next-packet.md)
   identify the next bounded source work: source-owned input/scope snapshot and actual
   run-to-lease binding, complete trusted worker inventory, then one composed supported launch path.
   N022/N025 now supply the bounded policy/sampler/publication modules; their historical
   absence at the audit pin is not a new task. These local producers
   are executable without portable-protocol approval. Existing ref viewers and
   overlap warnings cannot be substituted for exclusive current ownership.
3. Before activation, resolve migration ordering with the owners of reserved positions
   105–106 after COM-03 applied104; pending 107 is not active DDL. Recheck current admission/Stop protections,
   migration ledger, schema contract, fresh/upgrade/restore and privilege behavior.
   Configure trusted host/pool policy and a fresh sampler explicitly. Production composition,
   all global launch paths, compiled input-closure binding and native termination/recovery proof still
   need implementation and acceptance. A reservation grants neither spend nor file leases.
4. Current runtime blocker: OrbStack stopped again with ENOSPC. One start briefly
   restored healthy Fabric DB, HTTP200 and official MCP project-consent `waiting`.
   The distinct boot at06:07:18UTC ended at06:09:23UTC with storage-full writes;
   [recurrence receipt](../reports/2026-10-13-resource-admission-contract/raw/closing/live-stack-recurrence.json).
   The earlier recovery receipt timestamp records report construction, not probe time.
   No repeated restart or volume reset was attempted. Stable disk headroom and DB
   readiness must come first; then recheck consent through official MCP.
   N009/N010 remain blocked / NOT_SENT. After actual access use official
   `fabric_whoami` → `com.status` → `com.list` → project-addressed `com.submit`.
5. Refresh upstream heads before submitting the
   [owner packets](../execution/harness-waves/owner-packets.md): pipeline provenance and
   idempotency, Observatory lesson contract, hub host routing and MCP profiles. Portable
   protocol publication and cross-owner adoption require their actual owner acceptance.

## Working boundaries

Read the relevant [retro lessons](../evidence/retro.md) before each packet and record which
changed behavior. ADR/grant authority outranks observations; repetition does not promote a
lesson into policy. The [admission/feedback specification](../execution/harness-waves/admission-feedback.md)
and [host matrix](../execution/harness-waves/host-matrix.md) preserve the distinction between
configuration, discovery and observed native consumption.

Keep one heavy-check slot, clean owned fixtures, retain uncertainty and invalidate verdicts
when their inputs change. No live database/provider, service restart or foreign process is
needed for local fixture work. Keep credentials, private machine paths and dependency trees
out of delivery. Hosted CI was not dispatched. Workspace publication is separate and must
follow its owning skill and current source relationship; a pushed branch does not establish
publication, installed behavior or completion of CO-282.


## COM03 wave2 integration and N021

Main ac874946 is retained, including respond-only board tools, grants, runner identity
and UI/docs/model outputs. [N021 receipts](../reports/2026-10-13-resource-admission-contract/raw/n021/README.md)
cover the board-join concurrency correction; both coding identity and separate board cap
survive. The incoming deferred carryover patch is not applied: it proposes another CO282.
The deferred SQL107 also requires order reconciliation before active promotion. Canonical
CO282 stays partial;286 rows/219 open is the validated union, not the future patch counts.


## Producer delivery checkpoint

The source above is pushed and independently read from a clean GitHub-origin checkout:
[receipt](../reports/2026-10-13-resource-admission-contract/raw/closing/producer-fresh-checkout/portable-receipt.json).
24 accepted source hashes and61 relative entry targets resolve. N022–25, N007 and
N008 close only their bounded source/review/delivery contracts:23of25 graph nodes are
complete; N009/N010 retain actual owner acceptance and remain blocked / NOT_SENT.
CO282 stays partial. This checkpoint is not a main merge or product release.
Workspace publication and the report index follow through their owning commands;
`docs/workspace-receipt.json` owns the publication identity, not this narrative.

Next local implementation: the [selected-input packet](../execution/harness-waves/input-scope-next-packet.md).
It names source ordering, trusted assignment, exact bytes and negative cases.
Compiler packet/chain instruction and run-to-lease binding must be resolved before
resource-required production composition; these are future composition prerequisites,
not observed failures in ordinary launch behavior. No global writer enforcement or
complete worker inventory is inferred from these primitives.
