# Task brief — runtime-policy-decisions

> Supplemental Stage-0 brief for the confirmed high-level-vision run. The operator
> answered the five blocking choices directly on 2026-08-29; this brief records those
> answers, the technical source check and the public/private propagation boundary.

- **Date:** 2026-08-29
- **Task:** close CO-068, CO-075, CO-076, CO-077 and CO-079 across the decision,
  architecture, UX and carry-over sources without placing internal commercial packaging
  in public open-source surfaces.
- **UI verdict:** yes — CO-076 changes the workspace interaction contract.
- **Coordination:** branch `codex/runtime-policy-decisions`; lease
  `RUNTIME-POLICY-DECISIONS`; ADR-0021..0025 reserved before writing.

## Source ledger

| Source | Contribution | Authority / freshness |
|---|---|---|
| Operator answers, 2026-08-29 | placement depends on provider/agent; constrained grid; Estate subscription includes cloud continuity and platform-agent credits; CO-077/079 require detailed semantics | current operator decision |
| `docs/architecture/passioncode-platform.md` | names the five questions as the next architecture blockers and already separates control, execution, evidence and product planes | canonical architecture at `a80d086` |
| ADR-0014, ADR-0016, ADR-0017, ADR-0020 | Event Journal source of truth; Estate/federation model; artifact aperture; host-owned provider-view frame | accepted decisions |
| `docs/ux/{foundation,flows,screens,scenarios}.md` | FLW-08 / SCR-17 / SCN-018 already carry workspace composition but leave constraints underspecified | UX source at `a80d086` |
| [Temporal docs](https://docs.temporal.io/) and [architecture](https://github.com/temporalio/temporal/blob/main/docs/architecture/README.md) | durable recovery, deterministic workflow code, Activities and deployment profiles | primary sources fetched 2026-08-29 |
| [Restate key concepts](https://docs.restate.dev/foundations/key-concepts) | journaled durable steps and recovery | primary source fetched 2026-08-29 |
| [Cloudflare Workflows](https://developers.cloudflare.com/workflows/) | durable steps, retries, timers and external-event waits | primary source fetched 2026-08-29 |
| [Cedar authorization](https://docs.cedarpolicy.com/auth/authorization.html) and [validation](https://docs.cedarpolicy.com/policies/validation.html) | PARC, default deny, forbid precedence, skip-on-error diagnostics and schema validation | primary sources fetched 2026-08-29 |
| [OPA operations](https://www.openpolicyagent.org/docs/operations), [bundles](https://www.openpolicyagent.org/docs/management-bundles) and [decision logs](https://www.openpolicyagent.org/docs/management-decision-logs) | caller-owned fail semantics, last-known-good bundle activation and auditable revisions | primary sources fetched 2026-08-29 |
| `docs/DOCMAP.md` and `scripts/check-narrative.sh` | public surfaces are README, organization profile and EN/RU public guides; internal economics must not propagate there | current documentation contract |
| `agent_sync.py reconcile` | reports pre-existing post-baseline ADR/CO rows without as-built records; no other run holds a lease | measured 2026-08-29; standing divergence, not caused by this run |

**Contradictions:** (1) the canonical architecture calls the five questions open after
the operator has now answered them; (2) federation equates personal estates with a later
hosted pool, while placement is actually per binding; (3) the workspace docs say
"constraints" but do not forbid overlap/arbitrary coordinates or define semantic order;
(4) Cedar's native skip-on-error semantics are insufficient for effect-bearing Fabric
requests unless the integration wrapper tightens them; (5) a workflow engine cannot be
the same source of truth as ADR-0014's domain journal.

## Requirements

| ID | Requirement | Verification |
|---|---|---|
| RPD-REQ-001 | CO-068 closes with a per-binding placement model covering local harness, provider-managed, estate-managed and platform-managed execution | ADR-0021 plus architecture/federation review |
| RPD-REQ-002 | CO-077 closes with crash, retry, wait, cancellation, idempotency, upgrade and migration semantics; engine history does not replace the Fabric journal | ADR-0022 plus primary-source receipts |
| RPD-REQ-003 | CO-079 closes with a typed decision port, reference evaluator, decision receipt and explicit missing/error/outage/expiry semantics | ADR-0023 plus primary-source receipts |
| RPD-REQ-004 | CO-076 closes as a constrained responsive grid with revisioning, narrow reflow and keyboard/focus order | ADR-0024 plus FLW-08/SCR-17/SCN-018 updates and UX lint |
| RPD-REQ-005 | CO-075 closes as an Estate subscription containing managed continuity and platform-agent credits | internal ADR-0025 and internal architecture/carry-over only |
| RPD-REQ-006 | Public open-source narrative contains no subscription, credit or commercial-unit details | `bash scripts/check-narrative.sh` and diff review of public surfaces |
| RPD-REQ-007 | Every new decision is indexed, every resolved CO points to its ADR, and docs/schema/UX gates remain green | `bash scripts/check-docs.sh`; UX and schema checks |
| RPD-REQ-008 | The repository graph is refreshed at the accepted commit and the branch is merged/pushed | Graphify commit match; agent-sync finish |

## Locked decisions and boundaries

1. Placement is a provider-binding property, not an Estate type.
2. Temporal is the reference managed durable profile; `DurableExecutionPort` keeps the
   contract replaceable and live cross-engine migration is not promised.
3. Cedar-compatible embedded evaluation is the v1 reference policy engine; valid signed
   last-known-good policy can survive control-plane outage, but uncertainty never grants
   a new effect.
4. Operational workspaces use a constrained responsive grid. A future spatial canvas is
   a separate product surface, not a layout toggle.
5. The commercial unit is an Estate subscription with managed continuity and included
   platform-agent credits. Exact tiers/prices/overages/BYOK/marketplace settlement remain
   private later decisions.
6. Public README, organization profile and guides remain unchanged by Decision 5.

## Scope and acceptance

This is an architecture/documentation run. It changes no runtime, schema, deployment or
public offer and claims none implemented. Acceptance requires the documentation,
narrative, brand, schema and UX gates; a refreshed Graphify index; an as-built record;
clean merge to `main`; and a pushed `origin/main`.
