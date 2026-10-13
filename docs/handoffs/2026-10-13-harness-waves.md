# CO-282 — portable harness waves handoff

One entry: [execution plan](../evidence/plans/2026-10-13-harness-waves.md).
Objective: modular autonomous work with bounded resources, asynchronous independent review,
source-bound feedback and explicit support per host. Status: first Fabric repair wave;
CO-282 remains open, not universal runtime acceptance.

Source baseline a5b78e4919d82c6eae88bee72e59eba3e0c1fbae; integrated repair source
a2965695f5bdfcc5452fce0c8ff9bd342fd6ffb9. Main delivery branch: `agent/harness-waves-20261013`.
All outputs and packets are repository-relative under `docs/execution/harness-waves`.
[Review and limitations](../reports/2026-10-13-harness-wave-review/README.md).

Completed: detailed graph/packets (initial ten nodes; N-011 added for observed MCP retry failure); three reviewed repairs (pending bearer identity
and admission race; whole-context budget; negotiated ACP mode and mandatory surface);
all-host evidence matrix; owner packets and shared admission/feedback specification.
One ACP patch was rejected and repaired before integration; earlier green checks were not reused.

Decisions: existing ADR/grant authority outranks observed lessons; board is the sole
cross-project request record; no runtime support inferred from installation; no broad
copying of global homes; builders/reviewers share the run's scarce test capacity.

Next local verification: freeze source, run `pnpm_config_verify_deps_before_run=warn bash scripts/ci.sh fast`
and preserve exact result. Use existing compatible dependencies only; no install required.
Final result will be appended to the wave review before branch delivery.

Next implementation wave: submit [owner packets](../execution/harness-waves/owner-packets.md)
to owning Projects through Fabric COM, refresh their source heads, then finish pipeline
receipt provenance, Observatory lesson contract and host-aware hub/MCP selection in those
owners. N-009/N-010 remain blocked, packets NOT_SENT: MCP registration was explicitly approved and completed. The official MCP
`fabric_whoami` first answered `no-project` after the database recovered, then `waiting`: the project is recognized and Fabric awaits operator project-access consent. Registration alone is not enrollment. Read-only diagnostics show Docker OK, REST200 and database healthy; no service was restarted by this run. The registered MCP was called
through the adapter skill’s stdio client; no hub token was read or direct hub bypass used.

Fabric follow-ups: effective generated-home skill loading, per-host identity/hooks/resume,
MCP isolation and multi-instance gateway support; admission/feedback remains a specification
pending its protocol-owner contract. Exact positive/negative tests are in the matrix and
admission document. The [six resource packets](../execution/harness-waves/resource-implementation.md) define the sequence R1 → R2 → {R3, R4, R6} → R5 with exact source seams and negative tests; all runtime acceptance is NOT_RUN. Do not implement duplicate upstream queues or policy copies here.

No merge to main, release, installed skill update or workspace publication was performed.
The source review branches preserve independent-review targets; root verifies remote SHAs
before reporting delivery. Dependency links are local-only and must never be committed.
No foreign worktree, credential or service lifecycle was changed.

Canonical lessons are in [the project retrospective](../evidence/retro.md); its stamp table
was bounded to ten with all118 moved rows preserved in the Q3 archive. Historical evidence
repair and Observatory lesson-store publication are not claimed.

Later MCP observation: HTTP429 `call budget exhausted before body admission`; the temporary
stdio client was closed to stop its retry traffic. This does not grant or deny access.
Enrollment polling/backoff is being examined as a local resource-efficiency finding.

N-011 now owns the local MCP cooldown repair before N-007 combined acceptance. Two injected
HTTP429 negative tests failed before production edits: Retry-After lost at the SDK boundary,
and whoami/connect retry before the server deadline. Aggregate live saturation cause is
unmeasured. Shared cross-process poll leadership is not implemented by this bounded patch.
