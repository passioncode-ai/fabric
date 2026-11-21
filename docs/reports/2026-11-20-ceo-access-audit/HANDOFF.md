---
report: fabric-ceo-access-audit
date: 2026-11-20
kind: handoff
---

# Handoff: CEO access (points 1 and 2) and package D, 2026-11-20

**Objective.** The owner's two additions to the voice CEO retro (CEO window, 2026-11-20): audit what the CEO and its
voice can reach and close the gaps; start a session on a chosen agent or Switchboard account; then package D: the owner's
approval modes, delegation to the end, and a journal of what agents did on whose word.

**Branches.** `feat/ceo-access` (points 1 and 2) and `feat/approval-modes` on top of it (package D). Both build on the
0.3.27 candidate and ship in 0.3.28 (CHANGELOG `## 0.3.28 (unreleased)`).

## Done

- The audit table: [README.md](README.md). G1 (account on a start) and G2 (wait for an answer) built:
  `shared/launchChoice.ts`, `main/launchAccounts.ts`, `fabric_ceo_accounts`, `fabric_ceo_session_wait`, `account` on
  `fabric_ceo_session_start`; tests `apps/desktop/test/ceo-access.test.mjs`.
- Package D ([ADR-0203](../../adr/0203-the-owners-approval-mode-says-which-acts-wait-for-him.md)):
  - `shared/approvalMode.ts`: five modes, labels, `waitsForOwner`, `approvalRule`, the human gates.
  - `settings.json` `approvalMode` (a window may write it; unknown reads as `important`).
  - The floor issues its own one-shot grant when the mode lets an act through (`main/effectTools.ts#grantByMode`,
    `main/policy.ts#actedBefore`).
  - `fabric_whoami` answers `approval`; the CEO brief (step 6) and the voice instructions carry the rule.
  - `main/behaviourJournal.ts`: `userData/ceo/behaviour/<day>.jsonl`, written by the CEO's acting tools (with the voice
    call's id) and by every decision of the floor; read with `fabric_ceo_journal` / `session_journal`.
  - Tests: `approval-mode.test.mjs`, `behaviour-journal.test.mjs`, additions to `effect-tools.test.mjs`,
    `ceo-access.test.mjs`, `appSettings.test.ts`, and the stack probe `agent-surface.test.mjs`.

## Open

- The home screen's control «Согласовывать: важное ▾» and the launch menu: the home screen's session builds them on
  `shared/approvalMode.ts` and `shared/launchChoice.ts` (agreed on 2026-11-20).
- G3 (a Telegram gateway grant for the CEO), G4 (the CEO's identity at Morpheus, its owner's session), G5 (Hermes's MCP
  list): recorded in the audit with their owners.
- A live check of `switchboard launch <id> --in-place` from a Fabric console, and of a mode grant end to end.

## Checks actually run

Unit suites of the changed surface (21 node tests, 33 vitest in `appSettings.test.ts`), both typecheck projects,
`check-regions`, `check-ops`; a planted defect in `waitsForOwner` (an unknown history let through) was caught by two
tests. The full `scripts/ci.sh fast` runs before the branch lands.

## Next task

Land `feat/ceo-access` and `feat/approval-modes` after 0.3.27 is tagged: rebase on `main`, `scripts/ci.sh fast`, then the
0.3.28 release review.
