# CO-282 — portable harness waves handoff

Start with [the execution plan](../evidence/plans/2026-10-13-harness-waves.md), then
[the review](../reports/2026-10-13-harness-wave-review/README.md) and
[the graph](../execution/harness-waves/graph.json). CO-282 remains partially complete:
Fabric repairs are implemented; cross-owner acceptance and shared scheduling are open.

## Delivered source

Repository: `git@github.com:passioncode-ai/fabric.git`.

| Branch | Source | Status / entry |
|---|---|---|
| `agent/harness-waves-20261013` | de50e9e0fddf9f5fa37cd063fb3659cdc274bbff | Pushed historical source and segmented checks |
| `agent/harness-integrated-tested-20261013` | 179e71e94682a8d609c32647473ca09f3130d146 | Pushed immutable full-fast PASS candidate |
| `agent/harness-integrated-20261013` | 12ff522b04aafaeaa485a91c5ceb53f04d9e0d18, followed by delivery receipts | Pushed integration on main938acc62; this handoff is the entry |

The full-fast candidate tree is d41e70d134bc2469c8f324afe3adae8b1cb24a5b.
Its [receipt](../reports/2026-10-13-harness-wave-review/raw/integrated-fast-receipt.json)
records exit0,53 compiler checks,25 enrollment,45 MCP and35 ACP tests plus the rest of fast.
Toolchain reproducibility is UNVERIFIED; full Docker tier/native/provider checks NOT_RUN.
Later documentation changes need separate checks and never inherit unchanged-input claims
for the compiler. Production/script bytes are unchanged by the938acc62 reconciliation.

Four repairs: pending-bearer identity and serialized admission; exact whole-context budget
with mandatory refusal; acknowledged ACP mode and required Fabric surface; MCP cooldown,
late-link disposal and preservation of already-issued consent without further requests.
Independent review rejected two initially green candidates before their corrections.
Rejected source and replay scripts remain in the review report's raw directory.

The modular plan has11 nodes plus six resource implementation packets. The
[host matrix](../execution/harness-waves/host-matrix.md) separates configuration from native
consumption. [Owner packets](../execution/harness-waves/owner-packets.md) retain exact
upstream heads and distinguish existing implementation from remaining gaps. The
[admission/feedback contract](../execution/harness-waves/admission-feedback.md) is a
specification; [resource packets](../execution/harness-waves/resource-implementation.md)
sequence R1 → R2 → {R3,R4,R6} → R5. Their runtime acceptance is NOT_RUN.

## Continuation in progress

The first-wave completion above is historical. The living graph now has13 nodes: N-012/R1
and N-013/R2 local implementation are underway, and N-007/N-008 acceptance was invalidated
for the expanded source candidate. [Resource-wave review](../reports/2026-10-13-resource-admission-contract/README.md)
and ADR-0152 own this continuation. Board access blocks external owner requests, not local
injected code or owned SQL fixtures. The pending107 migration preserves reserved104–106;
its source acceptance is distinct from active schema and R3–R6 runtime enforcement.

## Exact next work

1. Finish source-branch integration under repository policy, preserving CO-282 as partial.
   Inspect the appended final receipts before choosing any repeated check. Main merge,
   Fabric installation and workspace publication are not implied by a pushed branch.
2. At the human project-access gate, the operator confirms access in Fabric. Then use the
   official registered MCP: `fabric_whoami` → `com.status` → `com.list` → project-addressed
   `com.submit` for the prepared owner packets. Registration was explicitly approved and
   completed; it does not grant project access. Do not replace the board with foreign edits
   or direct session messages. N-009/N-010 remain blocked / NOT_SENT.
3. Refresh owning-project heads before work: pipeline receipt provenance and idempotency;
   Observatory lesson contract; skill-hub host selection and MCP profiles. Some older findings
   are already addressed in source. Follow each packet's negative acceptance, not old prose.
4. Implement Fabric resource packets only after their protocol dependencies have owner
   acceptance. Use one shared builder/reviewer budget, per-module review as soon as ready,
   durable wait reasons and exact-source verdict invalidation. No blanket native PASS.

## Feedback, prerequisites and boundaries

Canonical lessons: [retro](../evidence/retro.md);118 archived rows plus10 active rows conserve
all127 historical rows and this run's stamp. Archive provenance debt is disclosed; Observatory
lesson-store delivery is NOT_SENT. Read relevant lessons before each packet and record which
changed behavior. ADR/grant authority outranks observed lessons; repetition alone does not
promote a rule.

The observed local stack recovered from REST503 to200 without any restart by this run.
The official MCP progressed from no-project to awaiting consent and later429. The temporary
client was closed to stop retries. The cooldown fix is source-only, not installed. Apart from the explicitly approved Codex MCP registration, no unrelated private host
configuration was changed. No supervisor, foreign process, credential or service lifecycle
was changed.

Only owned worktrees and ignored dependency links were used, with one heavy-check slot and
no Node dependency installation. Keep credentials and generated build output out of Git. Hosted CI was
not dispatched. Workspace publication remains separate: the initialized child is detached at
its recorded pin and `workspace status` reports stale. Follow the publication skill after source
integration and owning-project coordination; do not publish over another session's work.


Delivery readback: [receipt](../reports/2026-10-13-harness-wave-review/raw/branch-delivery-receipt.json)
records all three remote tips and a separate network clone checking out the integration source.
N-001…008 and N-011 are locally delivered; N-009/N-010 remain blocked. This is9 of11 scoped
nodes, not9 of11 product requirements: REQ-007/008 and resource/native acceptance stay open.


Final affected-input acceptance: [compiler receipt](../reports/2026-10-13-harness-wave-review/raw/final-compiler-receipt.json)
records53/53,0 skips after938acc62; document/graph/register/projection checks pass.
Integration entry: [PR31](https://github.com/passioncode-ai/fabric/pull/31). The newer main privacy-redaction commit a1de7f43 is now preserved in the branch.
Application source remains unchanged; the one changed compiler fixture input is rechecked.
