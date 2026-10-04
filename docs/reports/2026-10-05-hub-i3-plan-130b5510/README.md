---
report:
  id: fabric/2026-10-05-hub-i3-plan-130b5510
  title: "Fabric 0.3.1 · iteration 3 · plan review at 130b5510"
  kind: review
  project: fabric
  domains: [architecture, reliability]
  as_of: 2026-10-05
  status: active
  valid_until: 2026-10-19
  summary: >-
    Independent iteration-3 plan review of the converged 0.3.1 candidate 130b5510: verdict request-changes,
    10 findings, 2 blocking. Dispositions live in the hub verification ledger.
  sources:
    - name: "Candidate source"
      url: "https://github.com/passioncode-ai/fabric/tree/130b5510011a0f15858642838fc906ad4af4bf67"
      read_at: 2026-10-05
  produced_by:
    agent: "independent reviewer subagent (fresh context), saved by the coordinator"
    task: "p08-i3-review-130b5510"
  supersedes: []
  consumers: [fabric]
---

# Fabric 0.3.1 · iteration 3 · plan review at 130b5510

Candidate: `130b5510011a0f15858642838fc906ad4af4bf67`. This is an independent reviewer run: a fresh context, with the findings formed before the hub ledger or any earlier review was opened. The coordinator saved the report verbatim from the reviewer's final message, because the reviewer's harness refused `.md` writes. The structured findings are in `findings.json`. The gate probe is in `probe-gate.mjs` and its output in `probe-gate.out.json`.

## Method

I read the plan, its carry-over rows, the release gate, the CHANGELOG, the runbook, the two report directories and the knowledge-base pages. I checked every cited commit, branch, PR, issue and run. I probed the gate in memory using the candidate's own libraries.

## What holds on this commit

- **Schema.** The candidate has 78 migration files, and its schema contract says 78/78 (v0.3.0: 75/75). `schema_version()` counts applied migrations. The newest filename ends in 80.
- **Upgrade order.** The runbook matches P-08:
  1. keep 0.3.0 at schema 75;
  2. install the verified 0.3.1;
  3. back up;
  4. rehearse on a disposable stack;
  5. migrate;
  6. accept, or roll back if needed.
- **The gate refuses this commit as a release:**
  - the gate file still names version 0.3.0 and has no review receipts;
  - no verified commit is pinned;
  - a `v0.3.1` tag does not match the package version;
  - CHANGELOG has no finalized `## 0.3.1` heading.
- **Receipts for finished work check out:**
  - P-03: run 37159239646, the v0.3.0 assets, fabric#4/#5 closed;
  - CO-193: agent-contract PR #9;
  - CO-196: workspace PR #33;
  - CO-197: its commits are ancestors.
- **The knowledge base agrees on versions.** Fabric 0.3.0 is released, Fabric Inbox is 0.9.0, and the Now line is P-08.

## Commands and exit codes

| Command | Exit | Result |
|---|---|---|
| `check-registers.mjs` | 0 | pass |
| `check-plan-ids.mjs` | 0 | pass |
| `check-design-map.mjs` (no refresh) | 0 | pass |
| release-gate and release-mac tests | 0 | 27/27 pass |
| `unified-plan.mjs check` | 1 | 645 lines: COM-01…14 uncovered, lane count drift |
| `unified-plan.mjs next` | 1 | refuses |
| `check --report …unified-converged-1fd05937` | 1 | "Dirty or forged reconciliation source receipt" |
| `check --report …cleanup-start` | 1 | no `plan.json` |
| `workspace.mjs status` | 0 | stale |
| `workspace.mjs check --require-child` | 1 | stale (expected while CO-197 is open) |
| `probe-gate.mjs` | 0 | see P-1 and P-2 |

## Findings

| ID | Blocking | Finding | Evidence | Fix |
|---|---|---|---|---|
| P-1 | **Yes.** The gate can pass a release whose "three iterations" are one iteration, or whose receipts were written later. | The gate does not tie iterations 1 and 2, or the ledger, to real commits. | `release-gate.mjs:42-44` only checks that each iteration's commit is a 40-character hex string. Only iteration 3 is compared with `verifiedCommit`. The ledger body is never matched to a commit, and the title check accepts "Fabric 0.3.0 (not 0.3.1)". The probe got an empty problem list for: iterations 1 and 2 naming commits that do not exist; all three iterations on one commit; a ledger with no finding rows; reviewer labels that differ only by suffix. | In `release-mac.mjs`, require that each iteration's commit exists. Iteration 1 must be an ancestor of 2, 2 an ancestor of 3, and 3 equal to `verifiedCommit`. Each ledger section must name its commit in full, and the title must name no other version. Add a negative test for each case. |
| P-2 | **Yes.** The release notes misstate what ships. | The 0.3.1 CHANGELOG lists only the hub and would publish "Not released yet". | Missing from the notes: provider sign-in status at first run and one project per ticked repository in the scan (`c93523ec`); onboarding launcher and scroll fixes (`71aa07d8`, `4c85dd35`); the draft authority fix (`2e06e501`); the repeated provider-stop fix. `CHANGELOG.md:11-12` survives the rename-only step the runbook gives (`release-mac.md:29-31`). The check also passes when `## 0.3.1` and `## 0.3.1 (unreleased)` both exist. P-08 also describes the release as the hub only. | Finalize the section before tagging; CHANGELOG may change after verification without a new review. Make the runbook say "rename and finalize". Refuse a leftover unreleased heading. Name the non-hub content in P-08. |
| P-3 | No | P-08 status and the Now line are stale, and the candidate is named nowhere. | P-08 still points at `ff7eb7f3` on `codex/hub-i3-fixes-20261004`, which is now at `844561b9`. Now says "converge with main", which is what this commit does. `130b5510` and `agent/p08-converge-20261004` appear in no plan file. Draft PR #11 still has the rejected `3b2878fc` as its head. | Name the candidate, its branch, the checks run and the landing route. Close or retarget #11. |
| P-4 | No | Lane 13 sits outside the lane table. | `backlog.md:95` comes after the prose, so it renders as stray text. The id check passes because it reads between the markers. The knowledge base (`plans.md:13`) says "twelve lanes". | Move the row under lane 12. Fix the knowledge-base wording through CO-196. |
| P-5 | No | The plan's dispatch context cites a superseded cut, and no cut validates at the candidate. | `backlog.md:55-63` points at `2026-10-04-unified-execution`. Every cut's `check` exits 1 here. | Point at the current cut or mark it invalid. Recompile at the final integrated commit. |
| P-6 | No | The runbook leaves out the required review-receipt packet and has stale website facts. | `release-mac.md:33-50` does not mention `reviewReceipts`, the required paths (`docs/reports/` or `docs/evidence/reviews/`), or how iterations 1 and 2 get receipts. The contract exists only in a handoff README. Step 9 says the site still serves 0.2.0. | Document the packet, the path rule and the iteration 1/2 rule. Rewrite step 9. |
| P-7 | No | Spaces are missing before numbers, including in text that will be published. | "Fabric0.3.1", "schema78", "suffix80", "rejected3b2878fc", "exit0" and "lane5" in `backlog.md`; "The0.9.0" and "suffix80" in `CHANGELOG.md`; the same in the CO-193/196/197 rows. A byte dump confirms there is no hidden space character. | Restore the spaces and fix the tool that stripped them. |
| P-8 | No | Carry-over rows contradict what ships and P-08. | CO-176 says sign-in "is not built", but CO-176.1 ships. CO-179's own row describes a restyle while P-08 calls it containment, and CO-179 sits in lanes 1 and 2. P-02 says the gate reads the ledger clear; the gate now refuses that legacy ledger. | Annotate CO-176 and CO-179. Keep CO-179 in one lane. Mark P-02's claim as historical. |
| P-9 | No | The CHANGELOG's Fabric Inbox sentence reads as if 0.9.0 is enough. | CO-195 records that v0.9.0 lacks account narrowing (#24). fabric-inbox#26 is still open. | Say that the version check does not prove narrowing. |
| P-10 | No | A dead branch reference, and a one-off file exempted from the gate for every future release. | CO-195 cites fabric-inbox `agent/hub-connect`, which returns 404. `release-mac` lib line 108 hard-codes `docs/handoffs/2026-10-04-claude-recovery.md` as permanently exempt. | Cite the merged PR or commit. Move the path into a declared list. |

## Not run

- `ci.sh` fast or full (forbidden by the brief), and `check-docs.sh` (not on the allowed list).
- `release-mac.mjs --check-only`: it fetches into the worktree's refs, so I called the same library functions in memory instead.
- No tag, release, signing, installation, database backup or upgrade, or workspace publish.
- I did not check the live passioncode.ai site or Fabric Inbox's deployed source.

## Verdict

**Request changes.** Neither blocker needs the runtime code re-verified. P-2 is CHANGELOG and runbook text. P-1 is release-script code, so it has to land before `verifiedCommit` is pinned; afterwards the gate would refuse it as an unverified change.

## Comparison with the earlier iteration-3 plan review

I read the earlier review only after my findings were written.

| Earlier finding | What it said | Status at this commit |
|---|---|---|
| I3-PLAN-01 | COM tasks not covered by the unified graph | Still open (my P-5) |
| I3-PLAN-02 | schema 76 and obsolete branch status | Partly closed. Schema 78 is now correct everywhere; the branch status is stale again (my P-3). |
| I3-PLAN-03 | COM-12/14 depended on optional Telegram | Closed |
| I3-PLAN-04 | COM-05 prerequisites | Closed |
| I3-PLAN-05 | gate checked only syntactic links | Partly closed. Receipts now enforce artifacts, five levels, hashes and the iteration-3 commit; the iteration 1/2 and ledger binding remains (my P-1). |

The hub ledger's iteration 3 is still "in progress" on the rejected `3b2878fc` and has no exit line, so the gate would correctly refuse it today.
