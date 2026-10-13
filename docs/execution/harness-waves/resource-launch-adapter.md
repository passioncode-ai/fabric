# Local resource launch adapter preparation

This implements an opt-in internal adapter, not active resource enforcement.
`index.ts` does not configure it. No capacity defaults, sampler, public protocol,
UI path, migration activation, provider call or native-host acceptance is added.
The pending SQL dependency is R2 commit
`2b72bd37626270ee8c7a12378cac11670aaf9122`,
`supabase/pending-migrations/20261013000107_resource_reservations.sql`.
Migration positions 104–106 remain prerequisites to its eventual activation.

<a id="contract"></a>
## Contract

`createAdmitExisting(db, resources?)` selects the required resource adapter only
at trusted main-process composition. No task input selects or disables it.
The function reports `resourceMode: required` or `legacy_not_enforced`; the
latter preserves existing launches and makes no resource claim
(`apps/desktop/src/main/admitExisting.ts:36`).

`createResourceLaunchAdapter` takes explicit operation timeout and retained-entry
bounds, a trusted preparation provider and a trusted currentness provider.
Preparation supplies the actual R1 request/context/independent checks plus
`ownDemand`: this worker's consumption inside its allocation envelope. Each
quantity is a nonnegative safe integer, own demand cannot exceed the envelope,
and its worker-slot count must be positive. Provider quotas remain separate.
R1's `eligible` result is still advisory; only the combined SQL command allocates
capacity (`apps/desktop/src/main/resourceLaunchAdapter.ts:148`).

The adapter calls only `admit_resource_task_launch` in required mode. It passes
host/pool separately and the eight internal binding fields: reservationId,
attemptId, fence, ownerId, role, inputDigest, scopeDigest and localPolicyRevision.
The response must bind the exact task/session and reservation, a valid run/project,
a positive matching run ordinal, a positive admission sequence, an instruction,
and a **held** resource reservation. Released or malformed receipts refuse.
Missing RPC, errors, timeouts and unknown evidence never invoke legacy admission
(`apps/desktop/src/main/resourceLaunchAdapter.ts:107`, `:148`).

An immutable retained entry binds each session to its complete input. Identical
concurrent/repeated requests share one outcome; a changed identity refuses. An
ambiguous result is retained, not retried with a fresh reservation. Late RPC
success after timeout cannot populate an admitted entry. Entries are not evicted
to make room for new work: exhaustion refuses until the owner explicitly replaces
this preparation adapter. Durable uncertain-outcome recovery and lifecycle-driven
entry retirement remain unimplemented (`apps/desktop/src/main/resourceLaunchAdapter.ts:138`).

The **same adapter instance** must be passed to both `createAdmitExisting` and
`ManagedLaunchDeps.resources`, including the chain's separate admission caller.
The coordinator checks a known resource receipt before begin, including its
pre-admitted chain path. A marked resource receipt with no adapter refuses.
Before the final SQL launch validation, the existing before-spawn callback
asks the trusted provider to refresh input closure, mutable scope, fence,
ownership and policy. Only literal `true` allows that callback to proceed to
SQL, which rechecks current authority and resource state after the asynchronous
refresh completes. A prior SQL verdict is never reused across that refresh.
The provider must read independent current evidence, not echo its expected input
(`apps/desktop/src/main/managedLaunch.ts:71`, `:94`).

This is a dependency seam, not an implementation of those evidence readers.
It also relies on the existing owned `open` adapter consuming `beforeSpawn`.
PTY executable resolution still has an asynchronous step after that callback;
this packet neither changes `pty.ts` nor claims the final native boundary is
fully integrated.

## Cancellation and release

For an ungranted or uncertain begin, `cancelUnbegun` asks SQL to prove that no
spawn permission was consumed under its existing begin lock. Local absence or a
lost response never substitutes for that proof. A racing winner remains owned.
The request retains exact estate/reservation/run/session/fence identity
(`apps/desktop/src/main/managedLaunch.ts:80`, `:105`; `apps/desktop/src/main/resourceLaunchAdapter.ts:127`).

Only confirmed `fail_task_launch` compensation with `processStarted === false`
invokes `releaseCompensated`. SQL independently checks its durable stop/compensation
state. A lost release answer makes the launch outcome unknown. No hook releases
capacity on a stop signal, PTY exit, task-claim release, timeout or missing process
(`apps/desktop/src/main/managedLaunch.ts:117`). These hooks do not implement R4 crash reconciliation or
provider termination evidence.

## Focused verification

Executed against production TypeScript without starting a CLI, database or model:

```sh
node --experimental-strip-types --test apps/desktop/test/resource-launch-adapter.test.mjs apps/desktop/test/managed-launch.test.mjs
```

Result after the review correction: **44 passed, 0 failed**, exit 0. The existing
coordinator script is reported by Node as one file-level test; this is not
44 native scenarios.

The adapter fixtures cover actual R1 preflight, exact combined-RPC fields,
malformed and released receipts, absent SQL, transport uncertainty, bounded waits,
late replies, concurrent identical requests, changed identities, nested allocation,
required-mode ordinary and pre-admitted launch paths, currentness failure and
compensation/cancellation ordering. The existing coordinator fault suite checks
legacy behavior. These are injected transport/launch tests, not active SQL or native
acceptance. The synthetic `answer` launch trigger test exercises the coordinator's
accepted input type; production answers currently resume an existing session.

Independent review of `29639beb` reproduced a spawn after SQL authority changed
during the asynchronous currentness callback; its original 42 tests passed and
asserted the wrong ordering. The correction makes SQL the final check inside
`beforeSpawn`. Both ordinary and pre-admitted regression cases change the SQL
verdict while currentness waits and require zero spawns. This closes that added
asynchronous gap, not the separately documented native PTY resolution gap.

## Remaining integration

- Activate reviewed pending SQL only after migration-order prerequisites; its
  presence in a source checkout does not make the RPC available.
- Supply explicit pool/host policy, coherent readings, real independent ownership
  and input-closure providers; configure the same adapter at every managed
  admission call site. No global enablement switch is introduced here.
- Plumb the compiled context closure to the final native boundary and address
  the asynchronous PTY resolution gap before claiming final-boundary enforcement.
- Free terminals still bypass managed launch. Backend adapters are reusable but
  have no production composition here; their existing local cap remains unchanged.
- Provider quiescence, Windows tree observation, durable recovery and reservation
  retirement remain separate acceptance work. No all-host support claim follows
  from these fixtures.
