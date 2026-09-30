# ADR-0081 — Codex execution uses an owned, authenticated loopback backend

**Status:** accepted architecture for the authorized R0 work; implementation pending
(packets B0–B4 and N1 in the [first-slice plan](../evidence/plans/2026-09-27-first-slice-plan.md)).
**Date:** 2026-09-27. **Decided by:** the operator, choosing between the two candidates of the
[provider topology proposal](../launch/harness-r0/provider-topology-proposal.md#candidates-for-review).
**Extends:** ADR-0073 — process ending needs its own evidence, here a backend execution receipt.
Changes no meaning of Project, Person, TaskRun or membership.

## Decision

1. A managed Codex Run executes in **one Fabric-started `codex app-server` per managed scope,
   listening on an authenticated loopback WebSocket**. Fabric's controller and the operator's
   native Codex TUI (`--remote`) are both clients of that backend. The TUI is a **view**: its
   exit or detach is never a Stop, and it never creates a Run.
2. The [owned backend process registry](../../apps/desktop/src/main/ownedBackendProcessRegistry.ts)
   owns the backend **process** — admission-gated start, process group, exit observation and
   signals. For this topology it does not carry RPC: its stdio pipes are not claimed for Codex,
   so its descriptor-level write fence does not apply to Codex requests.
3. The per-request authority fence therefore moves to the **WebSocket write edge**: the check
   that a command is still allowed runs immediately before the frame is written, not only before
   it is queued. A request whose authority lapses between queue and write is not sent.
4. This topology gets its **own runtime profile** in the provider contract
   ([`providerExecution.ts`](../../apps/desktop/src/shared/providerExecution.ts)). It is never
   labelled `owned-stdio` to pass the existing validators.
5. The listener's bearer token is minted per backend, held only by trusted main and the view it
   launches, and never written to logs, transcripts or UI. Loopback reachability is not
   authorization; a successful handshake is not a thread-scoped grant.
6. Claude is unaffected: its control stream remains owned stdio
   ([`claudeControlTransport.ts`](../../apps/desktop/src/main/claudeControlTransport.ts)), where
   the registry's pipes and descriptor fence do apply.

## Evidence

- T2 connection receipt: `apps/desktop/test/codex-loopback-native.test.mjs` on the installed
  `codex-cli 0.157.1` — absent and wrong token refused with 401, two authorized clients
  initialized with isolated request IDs, the backend outlived a client disconnect. No thread,
  turn or model was used ([checks](../launch/harness-r0/checks.md#capture-recovery-and-provider-topology)).
- T3 empty-view receipt: the native TUI attached, created an empty thread and unsubscribed; a
  second client read the same session from the continuing backend
  ([proposal](../launch/harness-r0/provider-topology-proposal.md#native-empty-view-receipt--2026-09-27)).
- Neither receipt shows complete event coverage, exact-thread resume, writer quiescence or Stop.

## Alternatives

- **Owned stdio backend behind a Fabric protocol gateway** keeps the existing `owned-stdio`
  validators and the registry's descriptor fence, but makes Fabric a protocol authority:
  request-ID namespaces, approval routing, method allowlist and multiplexing for the native TUI.
  Rejected as the first choice for its size, not for a defect.
- **Owned stdio backend with a Fabric-rendered chat only** loses the native terminal the
  operator asked to keep.
- **Direct Unix listener** uses a fixed protected socket directory and was not measured.

## Stop condition

The direct listener is accepted only while it meets the proposal's native gates: (a) the
Fabric observer receives the complete scoped event stream for work started from the TUI;
(b) exact-thread resume reattaches without a fork or fallback; (c) detach does not fabricate
Stop, and Stop disables mutating input from every client; (d) interrupt and cleanup
acknowledgements precede independent exit and background evidence; (e) foreign-thread
requests, late approvals, reconnect and lost replies cannot create an untracked writer. If any
gate cannot be met with vendor capabilities, stop and bring the gateway alternative back as a
separately reviewed packet — never patch around the gap.

## Consequences

- Stop SQL today accepts only `terminal.closed@1` as the process-exit receipt. A backend exit
  needs its own receipt contract and migration (packet B3); a view's `terminal.closed@1` is
  never reinterpreted as backend exit.
- The registry must run inside Electron's main process. Electron 44 embeds Node 24.18.1
  (measured with `ELECTRON_RUN_AS_NODE=1 electron -e 'process.versions'`), while the registry
  currently refuses any runtime but Node 26.8.2; packet E0 measures the Electron runtime before
  any wiring.
- **E0 delivered, 2026-09-28.** The Node-version equality is replaced by measured runtime tuples
  ([`runtimeAdmission.ts`](../../apps/desktop/src/main/runtimeAdmission.ts)); the registry's 17
  groups and the native view host's 14 pass inside a real Electron 44 main process, with no
  descriptor behaviour different from Node 26.8.2
  ([report](../../apps/desktop/test/reports/owned-backend-process-registry.md#addendum--electron-main-measured--2026-09-28-first-slice-plan-e0)).
  The packaged, re-signed app still needs its own tuple (N1).
- The Codex descriptor keeps reporting no verified Fabric surface until N1 passes on the exact
  source. No capability is published beyond what N1 measures.
