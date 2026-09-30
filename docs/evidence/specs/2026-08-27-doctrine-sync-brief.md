# Task brief — doctrine-sync

> Stage-0 intake artifact, run `2026-08-27-doctrine-sync`. Operator instruction of
> 2026-08-27: audit the architecture against the skills installed on this machine,
> improve what can be improved, and fix what needs fixing before moving on.

- **Date:** 2026-08-27
- **Task (one line):** absorb what the operator's own `agent-stack` pack (0.13.5 —
  `agent-orchestrator`, `agent-evals`, `agent-interop`, `agent-harness`) imposes on the
  fabric: extend `adopted-doctrine.md`, amend `agent-production.md`'s intake and eval
  gates, and file the deferred findings of review passes 1–3 as carry-over rows.
- **UI verdict:** no — internal documentation.
- **Coordination:** lease `DOCTRINE-SYNC`, branch `feat/doctrine-sync`, ids
  CO-060…CO-067 reserved via `agent_sync.py reserve`.
- **Why adopted-doctrine is the home:** that file's own charter — "what the operator's
  **own** published standards impose, which is binding in the same way" — and
  `agent-stack` is such a standard (published at `ssheleg/agent-stack`, installed
  0.13.5). Nothing filed here is a new decision.

## Sources

| Source | What it gives | Fresh? |
|---|---|---|
| `agent-stack` 0.13.5: 4 × SKILL.md (1 046 lines) + `references/governance.md`, `references/runtime.md` | the doctrine table in adopted-doctrine §3 | read 2026-08-27 |
| fabric docs @ `00a30d8` | full context from review passes 1–3, same day | current |
| review passes 1–3 (session reports, 2026-08-27) | findings F-07, SCALE-1/2/4, §06/§08 of pass 3 | same session |
| `/reload-plugins` output + `claude plugin list` | live receipt for CO-066: "1 error", cause `supabase-community-supabase-plugin: cache-miss` found only by hand | measured 2026-08-27 |

## Requirements

| ID | Requirement | How it's verified | Status |
|---|---|---|---|
| DS-REQ-001 | `adopted-doctrine.md` gains the agent-stack source row and a §3 naming what the pack imposes, each row with its skill-section receipt; the closing list renumbered and extended | section present; receipts resolve to installed skill files | open |
| DS-REQ-002 | `agent-production.md` intake gate gains the workflow-or-agent question; the eval stage gains the two-clock rule (observables before build, corpus from production) | both edits present, citing adopted-doctrine §3 | open |
| DS-REQ-003 | CO-060…CO-067 appended (checker shape; fail-open/closed; policy-equivalent fallback; governor+scheduler; lifecycle+dependency projection; budgeted standing grant; skills observability; rule-routing before CEO); next free id CO-068 | ledger rows present | open |
| DS-REQ-004 | Checks green: schemas script, link resolution over changed files, `git diff --check` | command outputs in run log | open |
| DS-REQ-005 | Verification rows, retro stamp, record → board → merge --key → push; lease released on every path | `agent_sync.py status` clean; MERGES row | open |

## Out of scope, listed so it is not lost

The two ADR candidates from pass 3 — the extensibility law (connectors are providers,
M11 collapses; checkers are `check.*` providers) and the knowledge pack — are decisions,
not deferrals, and wait for the operator's explicit word. The upstream items (agent-sync
`fabric` plane adapter; contract conformance tiers L0/L1/L2; contract-profile deprecation
sweep in CI) belong to their own repositories.
