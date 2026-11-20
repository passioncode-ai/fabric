---
report: fabric-voice-ceo-retro
date: 2026-11-20
project: fabric
kind: handoff
---

# Handoff: the voice CEO retro, 2026-11-20

**Objective.** The owner's order (CEO window, 2026-11-20): review the voice agent's calls, fix every defect, add the
missing tools ([the retro](README.md)). Session 9cda1c0f.

**Entry point.** Branch `feat/voice-retro` on `origin`, worktree `~/DATA/_worktrees/fabric-voice-retro`, stacked on
`feat/ceo-board-ux` (session 8343a070). The ledger of fixes, with code and tests per finding: [fixes.md](fixes.md).

## Done

| What | Where |
|---|---|
| The retro copied from the CEO's inbox, private paths made neutral | `a30f3fff`, [README.md](README.md) |
| Findings 1 to 8 and 10 fixed with tests; findings 1 to 7 watched red (6 plants), 8 and 10 not planted | `807276b0`, [fixes.md](fixes.md) |
| Design map entry `#iteration-2026-11-20-voice-retro`, the product model and mockup coverage | `cea84623` |
| 18 project records in caches and temporary folders archived (journal `project.archived@1`, folders untouched) | [fixes.md §5](fixes.md#5-the-project-registry) |
| Two insights for every agent recorded in the agents base (intake `in-20261120-b7433c`, `in-20261120-43edca`) | the base's branch `records/voice-retro-insights` `902c78bf`, handed to the base by board request `b9f814c1` (its `check.py` fails only on the flaky `test_daily_retry`, flaky on its `main` too) |

## Decisions

- Stacked on 8343a070's branch rather than `main`: the same files (`shared/ceoAgent.ts#findProject`, `main/ceoTools.ts#start`)
  carry its fixes of findings 2 and 9. The split was agreed with that session (agent-sync lease `VOICE-RETRO`).
- 8343a070 lands `feat/ceo-board-ux` on `main`; this branch then takes `main` by a merge (so reviewed commits stay
  ancestors) and runs the 0.3.27 release for both (that session's words, 2026-11-20).
- The call journal lives in the CEO's folder (`<userData>/ceo/calls/`), not beside the voice key, so the CEO's
  console reads it; the key's folder stays apart (DA-11 of 0.3.24).
- A message to the owner by voice is delegated to the CEO (`ask_ceo`): the voice holds no messaging credential.
- The worktree-copy projects and the two `research-agent` projects are listed for the owner, not archived: the order
  allowed archiving only records in caches and temporary folders.

## Open

1. Release 0.3.27 per `docs/launch/release-mac.md`: three review iterations (five reviewers each, receipts), the
   verification ledger, the release gate, the tag, the published DMG installed and smoked on this Mac, then a live
   call: a project named by voice, `ceo_reply`, and a file in `<userData>/ceo/calls/`.
2. The owner decides on the worktree-copy projects and the duplicate `research-agent` ([fixes.md §5](fixes.md#5-the-project-registry)).
3. Board request 51d22d2b (the CEO's production version) is wider than this order and is not answered by it.

## Prerequisites

`feat/ceo-board-ux` on `main` (8343a070 sends the commit when it lands).

## Checks actually run

- `node --experimental-strip-types --test apps/desktop/test/voice-retro.test.mjs`: 14 pass.
- `node --experimental-strip-types --test apps/desktop/test/ceo-agent.test.mjs`: 56 pass; `session-enroll`,
  `project-admission`, `automatic-registration-scenario`, `fabric-mcp`, `session-enroll-request`: pass.
- `npx vitest run src/renderer/src/ceo/voiceCall.test.ts`: 13 pass.
- Both `tsc` projects: no error. `check-regions`, `check-private`, `check-docs.sh`, `check-registers`,
  `check-design-map`: pass.
- `bash scripts/ci.sh fast`: see the ledger of the release (the first run failed on stale mockup coverage, rebuilt
  in `cea84623`).

## Since then

`feat/ceo-board-ux` landed on `main` (`37d69d6a`) and this branch merged it; the release of 0.3.27 is under way. Its
ledger is the entry point from here: `docs/evidence/plans/2026-11-20-release-0327-verification.md`.

## The exact next task (as written before the merge)

When `feat/ceo-board-ux` is on `main`: `git merge origin/main` in the worktree, `bash scripts/ci.sh fast`, then open
review iteration 1 of 0.3.27 on that commit.
