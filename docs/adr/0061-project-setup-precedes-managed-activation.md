# ADR-0061 — A project can persist in setup before managed activation

**Status:** accepted as architecture · 2026-09-17 · implementation remains per-capability and receipt-gated.
**Source:** operator approved the progressive-adoption plan and instructed execution through completion on 2026-09-17; bounded AD01 contract review.
**Narrows:** ADR-0010 §2 and ADR-0013 §1/§4 only where they require an assigned Product Manager at initial Project persistence.
**Retains:** one Project identity, one accountable PM for managed operation, canonical Project/Task/Agent ownership, provider admission and the policy floor.
**Does not accept:** the broader RoleSlot/epoch/external-CEO design in proposed ADR-0046, or provider-native continuity in proposed ADR-0051.

## Context and observed boundary

The first useful result can be a saved purpose, selected source context and a clear next step. A new idea may have no repository, executor or configured PM yet. Requiring all of those before persistence makes the operator perform infrastructure setup before obtaining that result.

The current normative contract and runtime also disagree:

- `docs/ux/foundation.md`, ST-001, requires one Project with exactly one PM and configuration revision `1` after creation.
- `CONTEXT.md`, Project and Product manager, and ADR-0010/0013 require one PM per Project from creation.
- `supabase/migrations/20260831000001_migration_one.sql`, `one_pm_per_project`, prevents a second active PM; a unique partial index does not prove that one exists.
- `apps/desktop/src/main/index.ts`, `IPC.projectsCreate`, persists a Project and then attaches selected repositories; it does not create a PM binding.
- `apps/desktop/src/shared/onboardingDraft.ts`, `Draft`, already distinguishes the future Project ID from a committed Project. Its default runner is configuration, not evidence of a verified executor or PM.
- `supabase/migrations/20260908000037_deterministic_config_revision.sql`, `apply_estate_and_projects`, uses the causing event sequence as the configuration revision for updates. A consumer cannot require a literal value or do revision arithmetic.

Inspected source: [c1fb561](https://github.com/passioncode-ai/fabric/tree/c1fb56125c28f14de88191e7ffb162b7eb0eed72). Exact file hashes and symbol/line anchors are retained in [the producer matrix](../launch/adoption/contract-bindings.json); `node scripts/check-adoption-bindings.mjs` verifies them against that commit. These are source observations, not native acceptance evidence. AD01's producer matrix records their immutable source bindings. The diagram or mockup does not close the runtime gaps.

## Decision

1. **Persistence and managed activation are separate outcomes.** A Project may be saved in explicit setup, with a stable identity and purpose, while its PM responsibility is unconfigured. It is a real Project, not a tutorial-only object. Unsent onboarding drafts remain personal local state and are not Projects.

2. **Unconfigured means unconfigured.** It creates no fictitious provider named `later`, no active PM or developer binding, no Session or TaskRun, no grant and no automatically enabled routine. The interface states what remains unconfigured and lets the operator return to it when the capability is needed.

3. **Exactly one admitted PM is required before managed activation.** The trusted activation command must verify one canonical Project PM assignment, current admission/binding evidence, scope, revision and required capability readiness. No assignment, two assignments, unread evidence or unsupported capability refuses activation with a reason; a pending role is not runnable. An assigned but suspended PM is not silently replaced by a second authoritative writer.

4. **PM responsibility and developer execution are separate.** Selecting or admitting a developer/executor does not fill the PM role, and selecting a PM does not admit every executor. Existing explicitly requested manual capabilities keep their own admission rules; their use does not by itself mark the Project managed. Setup completion cannot start managerial automation, grant authority or bypass an existing execution gate.

5. **Setup does not hide the product.** The operator may save an idea, inspect authorized sources, preserve context, create durable work through permitted commands and return to it without a running manager. A feature needing missing authority or execution readiness explains that specific prerequisite. No blanket claim that the entire Project is ready follows from a saved setup.

6. **Revision values are owned by producers.** Configuration and object revisions are opaque equality tokens. Consumers preserve the value read, supply it where the command requires a precondition, and display stale/conflict/unknown explicitly. No acceptance criterion requires initial revision `1`, assumes a missing revision means zero, or advances it locally.

7. **The ownership boundary remains singular.** Business Messages, accepted ContextCheckpoints and command outcomes extend the existing Estate journal and canonical projections through versioned registered events/commands. Unsent drafts, personal review cursors and guide state reuse the existing local-state CAS/recovery mechanism. This decision introduces no second Project, Task, Agent or event store.

8. **Return context acknowledges exactly what was shown.** Journal-backed source cuts use the existing Estate sequence; external sources carry their own immutable revision alongside it. Acknowledgement names the displayed snapshot and its source boundary. The existing native digest's payload-bound seq behavior is retained. Unread or missing sources are not represented as no changes.

## Implementation and migration constraints

`setup`, `unconfigured` and `managed activation` above are domain states, not a claim that a new database column or public wire enum already exists. AD04 binds the exact additive persistence/read model; AD15 binds the actual activation command and readiness checks. Until those are implemented and tested, the interface reports the missing capability and no activation success receipt is produced.

Existing Projects retain their identities, history, tasks and bindings. Migration must not manufacture a PM, create grants, enable schedules or mark a Project managed merely because it exists. Where current readiness cannot be determined, retain unknown and require a current read before activation. Existing manually admitted work is not relabelled as manager-controlled work.

The current declared project blueprint describes configured organisation and keeps its PM requirement. This ADR does not pass a partial setup object off as that completed blueprint. Any wire/export format for partial setup needs its own versioned representation and explicit reader behavior before activation.

Schema registration, command idempotency, message audience/ACL and new typed reference kinds remain packet-owned bindings; missing producers are named missing, not supplied by an invented type cast. A typed wrapper reuses canonical `Scope` and `EntityRef` and does not replace them.

Rollback disables the new setup/activation or guide surface while preserving saved Projects, original messages, command receipts and drafts. It does not turn a pending or unknown outcome into success. Unknown effects are reconciled using the original command identity before another effect is attempted.

## Required checks before implementation is accepted

- Create an idea without a repository, PM or executor: one Project persists, no fake binding/grant/Session/TaskRun/routine activation appears.
- Restart after saving: setup state, purpose, Project identity and exact next step survive without an invented completion claim.
- Retry the same immutable create command after response loss: same Project/receipt; a changed payload under the old identity refuses.
- Activate with zero/two/unread/unsupported PM assignments: refused; one current admitted assignment can pass only its real capability gate.
- Select a developer while PM remains unconfigured: developer selection does not satisfy PM activation. Selecting a PM does not grant developer tools.
- Read a configuration whose revision is neither `1` nor a small counter: round-trip unchanged; stale/unknown revision refuses protected mutation.
- Migrate an existing Project lacking observed PM readiness: no invented binding or activation; historical work remains readable.
- Receive new events after the snapshot shown: they remain unread; failed source read cannot acknowledge an empty replacement.

## Consequences

The first useful Project is smaller than a fully equipped organisation. Setup and activation become separately visible, so the user can obtain context value without a fictional agent. Managed operation retains a single accountable PM and remains gated by actual authority and admission evidence.

AD03 updates the unified target journey; AD04 implements durable setup creation; AD06/AD07 implement checkpoint/return projection; AD09 implements the business conversation boundary; AD15 implements PM/executor readiness; AD17 implements save-paused cycles; AD18/AD19 derive personal guide progress from those receipts. Each closes only at its required proof tier. AD01's source proof accepts ownership and contracts, not those runtime outcomes.
