---
report: fabric-paused-ceo-work-handoff
date: 2026-11-21
project: fabric
kind: handoff
---

# Handoff for the strategist: CEO work paused on 2026-11-21 00:30

The owner's pause (fabric-workspace session 2d03ce15, brief `2026-11-21-strategic-plan-fable-brief.md`): new features
wait for the strategic plan; in 0.3.27 only the voice retro's fixes and the review's findings on its own code go ahead;
whether a fix outside 0.3.27 may start before the plan is the owner's open question, held in CO-614. Everything already
designed is committed and pushed. **Nothing below ships until the strategist decides.**

## One entry point per piece of work

| Work | Branch (pushed) | State | Read first |
|---|---|---|---|
| 0.3.27: the voice retro's fixes, plus "a session's first task reaches Claude Code" and "a message to the CEO is never lost" | `feat/voice-retro` | **Continues** (bug fixes). Remaining steps: ci.sh fast on the merged candidate, the fourth review run, the tag. | `docs/reports/2026-11-20-voice-ceo-retro/HANDOFF.md`, `docs/evidence/plans/2026-11-20-release-0327-verification.md` |
| CEO access: start a session on a chosen Switchboard account; wait for a session's answer | `feat/ceo-access` (`30564571`) | Built and tested. Not released. | `docs/reports/2026-11-20-ceo-access-audit/README.md` |
| Approval modes and the agents' behaviour journal (package D) | `feat/approval-modes` (`52249c78`, on top of ceo-access) | Built and tested. Not released. **Paused.** | `docs/adr/0203-the-owners-approval-mode-says-which-acts-wait-for-him.md`, `docs/reports/2026-11-20-ceo-access-audit/HANDOFF.md` |
| CEO persona on the home, voice options, calls | `feat/ceo-persona` (on top of approval-modes) | Persona module and header built and tested. Voice and calls researched only. **Paused.** | `docs/evidence/specs/2026-11-20-ceo-persona.md` |
| Agents reach Fabric Inbox again: the registry follows the descriptor contract (session 8343a070) | `fix/registry-contract` (`279dcd15`) | A bug fix, tested (agent-registry 19/19). Held out of 0.3.27 by the pause. **Proposed first in the next release; whether it may start before the plan is the open question in CO-614.** | its commit message and `apps/desktop/test/agent-registry.test.mjs` |
| Fabric mobile app (order of 2026-11-21 00:05) | none | **Not started:** it arrived as the pause began. | `userData/ceo/inbox/2026-11-21-fabric-mobile-app-brief.md` |

## Decisions the strategist holds

1. **Ship or drop the CEO access branch.** It closes two gaps the CEO hit for real: choosing an account, and waiting
   for an answer instead of polling the screen.
2. **Approval modes (ADR-0203).** These change who issues a grant above the floor. The default (`important`) behaves
   exactly as before.
3. **The persona header on the home.** If shipped, the home's session (8343a070) places it in place of `HomeStats`.
4. **The voice.** Options:
   - offer all 28 xAI voices (cheap, now);
   - the Morpheus voice through an xAI console custom voice: the owner's sign-in, and a US-only region rule;
   - the Morpheus voice through an ElevenLabs pipeline: both prices, added delay;
   - drop the Morpheus voice for a public build (rights).
5. **«Настройка CEO» with Telegram calls.** It needs the CEO's own Telegram account. The human gate is named exactly in
   the spec, section 4.

## Coordination

The sessions working on the same surfaces, and what was agreed with each:
- **8343a070 (home, questions, CEO board):** the boundary is agreed. It is told the persona header and the approval-mode
  control are paused.
- **f6c9238c (CEO popup, call history, the CEO's face):** the boundary is agreed. It is told the voice work is paused.
- **0daa75f1:** Memory.

## Machine

The MacBook's disk was at 99%, with 6 to 7 GB free on 2026-11-20 at 23:10. An outside cleanup emptied `/private/tmp`
mid-run and killed a CI run. Removed: one pushed worktree of mine; the dependency folders of another; npm's cache. No
other session's files were touched. The machine-wide plan belongs to Observatory.

## Next task

Finish 0.3.27 (`feat/voice-retro`): ci.sh fast green on the merged candidate, the fourth review run of iteration 3, the
gate, the tag, the published build installed and checked.
