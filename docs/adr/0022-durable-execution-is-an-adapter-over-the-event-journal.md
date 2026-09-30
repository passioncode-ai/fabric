# Durable execution is an adapter over the Event Journal

- **Status:** Accepted
- **Consequences / affects:** `docs/architecture/passioncode-platform.md`, future run,
  scheduler, worker and effect-reconciliation contracts
- **Source:** operator request, 2026-08-29 — resolves CO-077; Temporal, Restate and
  Cloudflare Workflows primary documentation reviewed 2026-08-29

Fabric requires a durable execution profile, but the workflow engine is not the domain
source of truth. ADR-0014's Event Journal owns business history and projections; an
engine owns recovery of orchestration code. The two are joined through a
`DurableExecutionPort` and correlated by `run_id` plus monotonic Fabric event ids.

The reference managed implementation is **Temporal** for scheduled, effect-bearing and
multi-day Runs. Restate and Cloudflare Workflows remain valid adapter candidates when a
deployment profile can satisfy the same fixture suite. A simple database queue may serve
development or short, effect-free work, but may not advertise the durable profile until
it passes that suite.

The mandatory contract is:

1. Orchestration code is deterministic/replay-safe. Model calls, tools, network I/O,
   clocks, randomness and provider execution are Activities/Steps whose results are
   persisted before the graph advances.
2. Every agentic iteration checkpoints messages/state, iteration and budget counters,
   partial artifacts and the last committed Fabric event. A suspended Run frees its
   worker.
3. Timers, questions, approvals and external input are one durable wait contract. A
   reconnecting client resumes the progress view from a monotonic event id; the stream is
   never the record.
4. Dispatch is at-least-once. Every external attempt carries a stable idempotency key and
   an effect-attempt record. Fabric claims exactly-once logical commit only where the
   target deduplicates or a reconciliation/compensation path proves the outcome.
5. Transient infrastructure/provider errors use bounded exponential backoff with jitter
   under attempt, elapsed-time and budget ceilings. Validation, policy, credential and
   declared terminal errors do not retry. An unknown exhausted failure becomes an
   attention item; it does not loop forever.
6. Worker loss resumes from the last committed engine step and Fabric event. An in-flight
   operation without a receipt may be redelivered with the same idempotency key.
7. Cancellation is cooperative and stops future work. Completed effects are not rolled
   back by deleting history; compensation is an explicit new graph/effect with its own
   authorization and receipt.
8. A Run pins engine kind, namespace/partition, workflow type and build/revision. Workflow
   updates use the engine's replay/versioning mechanism and conformance fixtures.

There is deliberately no live cross-engine history migration. Existing Runs drain or
resume on the engine/build they pinned. New Runs bind to the successor. If a suspended
Run must move, Fabric closes it with a portable state snapshot and starts a linked
continuation Run; it never presents two incompatible histories as one Run.

Primary receipts:

- [Temporal documentation](https://docs.temporal.io/) — durable recovery across process
  and infrastructure failure; self-hosted and managed deployment options.
- [Temporal architecture](https://github.com/temporalio/temporal/blob/main/docs/architecture/README.md)
  — deterministic workflow code and idempotent-or-non-retryable Activities.
- [Restate key concepts](https://docs.restate.dev/foundations/key-concepts) — journaled
  steps, retry recovery and persisted results.
- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/) — durable steps,
  retries, timers and waits for external events.

Retention, RPO/RTO and production SLO values remain CO-082; this decision defines
semantics, not service objectives. The implementation spike still chooses Temporal
namespace/tenant topology, SDK language, self-hosted versus managed deployment and the
adapter fixture thresholds; none may weaken the contract above.
