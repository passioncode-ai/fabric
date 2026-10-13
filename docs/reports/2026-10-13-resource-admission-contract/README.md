---
report:
  id: fabric/2026-10-13-resource-admission-contract
  title: "CO-282: local resource admission wave"
  kind: review
  project: fabric
  domains: [architecture]
  as_of: 2026-10-13
  status: draft
  valid_until: 2026-10-27
  summary: >-
    Continuation of the harness wave: local resource preflight and pending durable SQL
    reservation can be implemented before project-board access. Source, isolated tests,
    active schema, native enforcement and portable contract acceptance remain distinct.
  sources:
    - name: Resource implementation packets
      path: docs/execution/harness-waves/resource-implementation.md
      read_at: 2026-10-13
    - name: Local resource authority decision
      path: docs/adr/0152-resource-preflight-and-durable-reservation-are-distinct.md
      read_at: 2026-10-13
  produced_by: {agent: codex, task: CO-282}
  supersedes: []
  consumers: [fabric]
---

<sub>ssheleg skills — task-pipeline · agent-sync · agent-stack · evidence-docs · project-reports</sub>

# CO-282 — local resource admission wave

This wave extends the [first repair review](../2026-10-13-harness-wave-review/README.md).
It does not supersede its immutable source receipts. The first review's11-node snapshot
is historical; the living graph includes subsequent tasks.

## Implementation boundary

[ADR-0152](../../adr/0152-resource-preflight-and-durable-reservation-are-distinct.md) records
local design authority. Fabric board access blocks owner requests, not internal injected
functions or isolated SQL implementation. The R1 preflight cannot grant admission. R2 uses
the current migration62 protections and remains pending DDL while104–106 ordering resolves.
No live schema, private database, portable contract or native/provider behavior is certified.

## Checks and open work

R1, pending R2 SQL and opt-in adapter preparation have scoped independent acceptance.
Combined fast validation is pending; active runtime enforcement is not claimed.
The [execution graph](../../execution/harness-waves/graph.json) owns task state; the six
resource packets retain negative tests and the distinction between source and activation.


## R1 — reviewed local decision

Source `d984d98358b82824695e0636d8f3e0c50ec6eb82`, integrated byte-identically as
`c5bb122f`:106 production-function tests pass. [Receipt](raw/r1-review-receipt.json)
binds source/tests, commands, original rejected artifacts and accepted replay scripts.
Independent reviewer ran5016 seeded BigInt arithmetic cases plus identity, missing-reading,
nested-accounting and adversarial property checks. Eight extra Promise/thenable cases pass.

The first candidate7797d1fb exposed a trusted-provider error boundary: an accidental async
proof rejection was refused but later emitted an unhandled rejection. The builder identified
it; the reviewer independently reproduced it. The fix observes ordinary native Promise
rejections without invoking arbitrary thenable getters. Exotic Promise subclasses/constructor
overrides remain outside the supported trusted synchronous dependency contract.

All results explicitly deny execution authorization and require reservation. Ownership proof
is independently injected local evidence, not a request boolean or portable authentication.
No capacity ledger, quota, process or live host was mutated by R1. Full combined validation
will follow R2 integration; this scoped receipt does not certify future source changes.


## R2 — reviewed pending reservation authority

The original candidate `2b72bd37626270ee8c7a12378cac11670aaf9122` was rejected
by independent review: numeric fence `1.0` was admitted but a canonical `1` could
not release it. The [rejected receipt](raw/r2-rejected/receipt.json) records why
exit0 from the probe was not acceptance: this case printed a semantic counterexample.

The correction `0b0ad6a9dd9e14a58762e0fc5aaf982bd5789af1`, integrated as
`aba21213`, canonicalizes validated numeric fences before retry comparison/storage.
The [accepted independent receipt](raw/r2-fixed/receipt.json) binds source hashes,
real SQL fixtures and six raw-number cancellation/release controls. Both builder
and reviewer ran separate socket-only disposable PostgreSQL clusters and removed
them. Existing dispatch, managed launch and Stop cases passed with the pending SQL.

Atomic pool admission, exact retry binding, parent/child accounting, role boundaries
and operational release/restore checks have fixture evidence. This is not active
schema, distributed stress, measured savings or native/provider acceptance.
Portable archived scripts use `FABRIC_REVIEW_ROOT=<checkout>`; original local receipt
and artifact digests are retained while private paths are parameterized/redacted.

## N-014 — opt-in R3/R4 adapter preparation

Candidate `29639beb72902a567a1bd69f08f48dcd7ecb20bc` passed42 focused tests but
was rejected by review: SQL authority could become stale during an awaited local
currentness callback, and the coordinator still spawned. The correction
`ae23efc24e4d83800aeb8b7d26e1074a7fcd2dab`, integrated as`981c5afc`, runs that
refresh before the final SQL check. Ordinary and pre-admitted paths now have separate
regressions.44 focused tests pass; root replay of the independent counterexample
confirms zero spawns. [Receipt and replay](raw/r3-review-receipt.json).

Required mode never falls back to legacy admission. Exact resource receipts bind both
launch paths; release hooks retain uncertain ownership. Production composition does
not enable this adapter. Trusted policy/readings/input providers, complete native boundary,
free-terminal/backend coverage and full R4 recovery remain open. The [adapter
contract](../../execution/harness-waves/resource-launch-adapter.md#contract) lists these
limits. Preparing the seam does not complete the full R3/R4 resource packets.

## N-015 — executable preparation before final authority

The production PTY manager awaited executable resolution after its final authority
callback, including an async wrapper on non-Windows hosts. Correction
`9b83706ed61373c205113dc84518a8c3a371f889`, integrated as`79aa9e5b`, completes
that preparation first. The [independent receipt](raw/n015/receipt.json) records the
production-manager test passing fixed and failing with exact parent source while the
test stays unchanged. Root replay of the portable negative loader also fails at the
intended assertion. Spawn itself is synthetic; no native or Windows acceptance is
inferred, and an asynchronous authority lookup is not an atomic remote lock.

## Coordination finding and recovery

Installed agent-sync1.22.1 could report its own expired resource lease as acquired
without updating its remote timestamp. Independent source review confirmed the branch;
the [owner packet](../../execution/harness-waves/owner-packets.md#agent-sync--expired-own-git-lease-reported-as-acquired)
remains NOT_SENT. This run disclosed the false-success interval, reaped only its own
expired refs, then reacquired them. No foreign lease or installed skill was changed.
A foreign reservation-document lease delayed reconciliation without blocking the
independent PTY fix. The bounded watcher acquired it on its20th attempt, then stopped.
Agent-sync reserved ADR-0153 for the unexecuted pipeline reservation; its own collision
rule moved unused0150 after ADR-0152. The targeted `fix-pf-06.03.py` check now passes.
Reserved migrations104–106 and all applied ADRs remain unchanged.

## Preflight and historical dispatch snapshot

[Preflight receipt](raw/preflight-receipt.json) records passing types/docs before the
last narrow edits and the corrected reservation check. It also preserves a separate
failed command: `node scripts/unified-plan.mjs check` selects the old2026-10-04
research cut when no current pointer exists, and correctly refuses stale source
revisions and uncovered canonical work. That dated snapshot was not rewritten or
used to dispatch this run; the CO-282 task-pipeline graph owns this bounded execution.
The mandatory fast tier independently tests fresh compiler/reconciliation behavior.
No claim is made that the historical research cut is now a current whole-project queue.

## Runtime boundary

A later bounded official MCP read, after20 seconds of startup, returned `waiting` for
operator project-access consent. Earlier `starting` and429 observations remain historical. Board
requests, acknowledgements, owner acceptance and Observatory lesson delivery are NOT_SENT.
Registration persists from the operator's earlier explicit approval. No sign-in, grant,
service restart, private token, installed Fabric change or live provider call was performed.


---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — modular waves and review
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — exclusive ownership
- [`agent-stack`](https://github.com/ssheleg/agent-stack) — admission boundaries
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — source-bound evidence
- `project-reports` — durable report — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
