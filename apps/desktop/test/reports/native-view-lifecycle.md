<sub>ssheleg skills — task-pipeline · agent-orchestrator · evidence-docs</sub>

# T1 — execution owner and native view lifecycle seam

This packet adds an importable coordinator, not a runtime activation. Its scope is
[`nativeViewLifecycle.ts`](../../src/main/nativeViewLifecycle.ts) and the
[actual-module tests](../native-view-lifecycle.test.mjs). It starts from source
`b18b337` and does not alter main index wiring, SQL, descriptors, provider profiles,
shared registries, UI, global configuration or production process launch.

## Existing contracts and the gap

- [`managedLaunch.ts#createManagedLaunch`](../../src/main/managedLaunch.ts) owns an
  admitted Run and one Fabric session. `begin_task_run_launch` and final launch validation
  do not grant authority to unrelated windows.
- [`admission.ts#AdmissionReceipt`](../../src/shared/admission.ts) already names
  `task_run_id`, `run_ordinal`, `session_id` and `project_id`.
- [Migration 62](../../../../supabase/migrations/20260927000062_managed_stop.sql)
  rejects stale Run ordinals/session mismatches before canonical Stop commands.
- [`pty.ts`](../../src/main/pty.ts) currently treats its managed PTY exit as an
  execution-terminal event: the callback closes delivery and records `terminal.closed`.
  A detachable native **view** must not use that path under the owner's Fabric session ID.
- [`nativeStopRuntime.ts#createNativeStopRuntime`](../../src/main/nativeStopRuntime.ts)
  and [`managedStop.ts`](../../src/main/managedStop.ts) remain the evidence-gated execution
  Stop boundary. This coordinator has no Stop, signal-backend, journal, Run-update or
  lease-release port.
- [`providerExecution.ts#validateProviderBinding`](../../src/shared/providerExecution.ts)
  requires an observed Codex turn ID. An idle empty-thread view is not such an execution
  observation. No fake turn, invented runtime profile or weakened validator is introduced.

These links describe source at the packet's base; the implementation below is a separate
transport/view layer and produces no provider load/quiescence proof.

## Exact owner and view identity

`NativeViewOwner` is supplied by the trusted host after it establishes ownership:

```text
fabric   = estateId + projectId + taskId + runId + runOrdinal + sessionId
                  (existing durable Fabric generation)
authority = personId + membership revision
backend  = ownerId + hostInstanceId + bootId + processIdentityRef + connectionId
                  (already-owned backend/process/transport epoch)
```

`NativeViewTicket = owner + viewId + attachment`. Attachment ordinals never repeat within
one coordinator. A view ID can reconnect only through an exact previous closed ticket,
which gets a new attachment. The host registry must key the **entire ticket**, not just
its ordinal or a mutable current PID. Owner IDs and connection epochs are host-owned;
they must not be recycled or accepted from renderer-supplied metadata.

The coordinator copies/freezes the owner, validates closed metadata shapes without
executing getters, and compares a fresh trusted `currentOwner()` snapshot before effects.
The host is responsible for authoritative SQL/membership refresh and explicit loss events;
an in-process snapshot is not a substitute for durable admission checks.

## Ports and lifecycle

| Surface | Behavior / obligation |
|---|---|
| `openView(ticket, fence)` | Creates only the exact native view. Honor the fence at actual process/transport effect, not merely at enqueue. Reply with the same ticket and `opened: true`. |
| `writeView(ticket, text, fence)` | Writes only to that view. An acknowledgment is local transport evidence, never proof that a provider accepted or completed a task. No automatic replay. |
| `closeView(ticket, fence)` | Requests exact view closure, never execution Stop. A missing/malformed/lost closure receipt stays unknown. |
| `disposeView(ticket, fence)` | Compensation for a late/failed open: only the exact owned **local view process**. No provider RPC, backend signal, credential revocation or execution-finalizer callback. |
| `ownsView(ticket)` | Literal-true exact local-handle ownership. Truthy objects/promises never grant authority. Disposal can check an old view even after owner authority is lost. |
| `viewExited(ticket)` | Trusted host exit observation for this view only. It settles view closure and never changes execution status or emits `terminal.closed`. |
| `acceptOutput(ticket, cursor)` | Synchronous gate immediately before UI delivery, checking local handle, owner and current attachment again. Increasing display cursor only; this is not a provider journal cursor. Raw output is not retained. |
| `connectionLost(connectionId)` | Exact current owner connection becomes sticky `outcome_unknown`; all queued effect fences and admission veto react immediately. |
| `retire()` | Permanently fences the coordinator. It does not assume that backend or views exited. Explicit exact-view disposal/exit remains separate. |
| `isAdmissionFenced()` | True is a veto. **False is never an execution admission grant.** |

Owner states are `connected`, `outcome_unknown`, and `retired`. View states separately
track `opening`, `attached`, `detaching`, `detached`, `exited`, and `outcome_unknown`.
A view may still physically exist while its owner is unknown; consumers must display the
owner-level uncertainty and must not infer permission from an `attached` row alone.

An ambiguous input write creates a sticky **owner-wide** veto: the input may already have
reached the backend. Neither sibling windows nor closing/reopening the affected view can
hide this uncertainty. Only external execution reconciliation plus a new coordinator can
restore the transport layer; existing ProviderExecution/SQL gates remain independently
required. The same applies to a lost/changed owner connection or changed generation,
process identity, boot or membership revision.

Each operation has a monotonic bounded deadline, including synchronous host-guard stalls.
Late replies cannot restore its fence. A late open can still materialize a local view; its
exact handle is disposed, including after an earlier exit event or while an earlier
cleanup receipt is pending. Disposal uncertainty stays explicit. Recursive callbacks,
repeat attachment and overlapping detach calls do not create extra opens. One input
write at a time is allowed per attachment; a busy second write is refused.

The lifetime limits are 8 unresolved views and 128 attachment identities, with no unsafe
history eviction. Closing a view does not free its historical identity. Input is bounded
to 65,536 characters and is never stored in snapshots. Reaching the history bound refuses
new attachments; rotating coordinators is an explicit host action with fresh authority,
not an automatic workaround for uncertainty.

## Measured validation

```sh
node --experimental-strip-types apps/desktop/test/native-view-lifecycle.test.mjs
```

**19 grouped tests PASS** against the actual imported coordinator: idle/exit/reconnect,
stale output, ownership change during open, exact local compensation, connection-loss
fences, partial writes and no replay, overlapping detach/exit, late materialization and
cleanup overlap and late rejected opens, malformed port receipts, truthy/async authority denial, active/history
bounds, getter rejection, reentrant callbacks, synchronous deadline starvation, and a remaining-budget timer after slow preflight.
Tests use deterministic in-memory owned handles. They invoke no provider, model, network,
authentication, journal or database.

A standalone strict TypeScript check passed:

```sh
tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext \
  --allowImportingTsExtensions --skipLibCheck apps/desktop/src/main/nativeViewLifecycle.ts
```

`git diff --cached --check` also passed. Independent review reran all 19 groups and accepted the final deadline and late-open cleanup corrections. Native T3b evidence is a **separate** probe; it does not
prove this production seam is wired. Repository-wide fast checks, SQL integration,
native port conformance, product UI behavior and capability activation are NOT_RUN here.

## Handoff and exact next packet

Root owns the ADR, capability status, shared documentation, source integration and workspace
publication. Integrate this module only after bounded independent review. The next production
packet must implement a host registry and concrete view-only ports, prove whole-ticket
identity at their actual effect edges, and route view exit away from existing execution
PTY finalization. It must connect owner-loss/input uncertainty to existing admission and
provider controllers without restoring authority automatically. Keep backend Stop on its
existing durable evidence path. Test native reconnect and cleanup with those actual ports
before enabling any descriptor or exposing the capability to users.

### Recommended bounded write set for the next production packet

1. Add `apps/desktop/src/main/nativeViewHost.ts` as the concrete supervised local-view
   registry/adapter. It must own actual handles and compare complete tickets at spawn,
   PTY input and disposal; keep view IDs in their own namespace. Test with real owned
   local PTYs and no-model fixture processes, including partial write, delayed handshake,
   recycled handle, descendant/closure uncertainty and owner-loss races. This is actual
   host integration, not another protocol-only controller.
2. Compose that registry in `apps/desktop/src/main/index.ts` only after an actual owned
   backend record exists. Build the owner from the admitted Run ordinal, guarded identity
   and measured host/process/connection record. Never derive it from renderer metadata,
   a TUI process ID or an invented turn. Current `bootstrap` constructs `PtyManager` with
   an execution `onExit` that revokes credentials and invokes `stopRuntime.stop`; view
   callbacks must bypass that path by construction.
3. Integrate the sticky veto at the concrete launch/continuation effect boundary:
   `index.ts` currently composes membership guard and `validateLaunch` into
   `PtyManager.open`'s `beforeSpawn`. A view-owner veto supplements those checks; it never
   replaces SQL admission. The existing continuation/delivery path must check the same
   owner epoch at its actual write edge, so a queued input cannot bypass connection loss.
4. Keep `pty.ts` and `nativeStopRuntime.ts` execution semantics unchanged unless a
   separately reviewed host interface is unavoidable. Prefer a separate view PTY registry
   to adding a permissive boolean that skips execution finalization. Any necessary shared
   process helper extraction needs regression tests showing ordinary execution exits still
   revoke/finalize while view exits do neither.

Acceptance for that packet: actual hosted view exit leaves the owner Run/lease/backend
intact; owner loss prevents queued/manual/continuation writes and new admission; stale
view cleanup cannot touch a newer process; unknown closure remains unknown. Descriptor,
provider load/Stop capability promotion, UI exposure and global configuration are outside
that write set. A real backend owner registry is a prerequisite, not something this
coordinator's immutable snapshot proves exists.

---
**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded module/test packet and durable handoff
- [`agent-orchestrator`](https://github.com/ssheleg/agent-stack) — immutable identity and lifecycle boundaries
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — source links and actual test receipts
