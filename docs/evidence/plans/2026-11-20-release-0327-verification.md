# Fabric 0.3.27 release verification

Release gate ledger for 0.3.27 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02). Three
iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the candidate
read-only; findings are disposed here and in the receipts under `docs/evidence/reviews/0.3.27/`.

0.3.27 carries two orders of the owner of 2026-11-20 (paraphrased, ADR-0096): fix first what gets in the way of work
([the plan](2026-11-20-ceo-board-ux/plan.md), wave 0, branch `feat/ceo-board-ux`, session 8343a070) and the voice CEO
retro ([the retro](../../reports/2026-11-20-voice-ceo-retro/README.md), [its fixes](../../reports/2026-11-20-voice-ceo-retro/fixes.md),
branch `feat/voice-retro`, session 9cda1c0f, which runs this release by agreement with 8343a070).

## Protocol

- Baseline: `origin/main` `44cd80ca` (0.3.26's release close).
- The reviewers: Claude Code subagents of the release session (Opus 5.5), each a fresh context given
  [the brief](../reviews/0.3.27/brief.md) and its level's focus, reading a separate read-only worktree checked out at the
  candidate, recording HEAD and `git status --short | wc -l` before and after. They ran single test files at most; the
  release session ran the gates.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.
- A run's candidate passes `bash scripts/ci.sh fast` with the browser suites run (`FABRIC_PLAYWRIGHT_MODULE` and
  `FABRIC_CHROME` set, the Chromium Playwright keeps, never the owner's Chrome), before its reviewers start or while
  they run (0.3.26, PL-42).

## What 0.3.27 carries

The `## 0.3.27 (unreleased)` section of [`CHANGELOG.md`](../../../CHANGELOG.md), renamed `## 0.3.27` at the release. No
schema step (no migration).

## Iteration 1

Candidate `f6990a9aaed3f243d65a40be601e5b519b9af30d`. Reports and receipts in
[`docs/evidence/reviews/0.3.27/iteration-1/`](../reviews/0.3.27/iteration-1/). Gate: the local `ci.sh fast` with both
browser variables ran while the reviewers read and stopped red at `check-plan-ids.mjs` (CO-605 cited by no lane, PL-1);
the later steps did not run on this candidate. 56 findings, 8 blocking: `first_task` said delivered with no turn
started (PL-2), the plan gate red (PL-1), a match by sound started work in the wrong project (UX-1), a folder inside a
project started in the project's main folder (UX-2), a tie could not be chosen (UX-3), a launch in the home folder
claimed every folder under home (ER-1), a home-folder project would do the same (DO-1), and a secret on a later line of
a tool argument reached the call journal (DA-1). Every fix carries its test; the new tests were watched red with their
mechanism removed (fixes.md, «Watched red»). Two reports name synthetic probe folders; their home part is written `/Users/example` for the privacy gate (the docs report's `/Users/x`, the ux report's `/Users/u`), the wording otherwise the reviewers'.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V1-UX-1 | UX-1 | blocking | fixed in the iteration-2 candidate: a match by sound is asked back with understood_as and choices, nothing starts or is kept until the project is named exactly (ceoTools.ts start, alias); the instructions say ask first; test «UX-1, UX-9: a name matched by sound is asked back», red with the confirm removed |
| V1-UX-2 | UX-2 | blocking | fixed in the iteration-2 candidate: a folder that is not the project's own folder is refused with where to go (ceoTools.ts start); test «UX-2: a folder inside a project or its worktree…» |
| V1-UX-3 | UX-3 | blocking | fixed in the iteration-2 candidate: findProject takes a choice read back as offered, «name (folder)», by its folder; test «UX-3» |
| V1-UX-4 | UX-4 | non-blocking | fixed in the iteration-2 candidate: the project list hides a copy when the project of its name is listed, copies_hidden says how many; test «UX-4» |
| V1-UX-5 | UX-5 | non-blocking | fixed in the iteration-2 candidate: near names only within distance 0.5, each once; next says read them and ask; a worktree folder found by its last words; test «UX-5, ER-1» |
| V1-UX-6 | UX-6 | non-blocking | fixed in the iteration-2 candidate: by voice a start waits 8 s (VOICE_FIRST_TASK_WAIT_MS), then pending pointing at session_task; test «UX-6» |
| V1-UX-7 | UX-7 | non-blocking | fixed in the iteration-2 candidate: next steps name both doors' tools; the voice's tool descriptions use its own names (ceoVoiceTools); test «UX-7» |
| V1-UX-8 | UX-8 | non-blocking | fixed in the iteration-2 candidate: the refusal's next offers session_open, and the instructions say the limit |
| V1-UX-9 | UX-9 | non-blocking | fixed in the iteration-2 candidate: an alias can be forgotten (remove), another project's name is refused, a match by sound is asked back before keeping; test «UX-9»; an alias the owner gave is an exact name, so it answers no understood_as (not a defect) |
| V1-UX-10 | UX-10 | non-blocking | fixed in the iteration-2 candidate: as PL-2, written_unconfirmed when no turn started |
| V1-UX-11 | UX-11 | non-blocking | fixed in the iteration-2 candidate: recap reads project names (index.ts projectNames); test «finding 10» |
| V1-UX-12 | UX-12 | non-blocking | fixed in the iteration-2 candidate: SCN-183 amended 2026-11-20 (the voice retro and the review), the alt paths for scratch and subfolders |
| V1-UX-13 | UX-13 | non-blocking | fixed in the iteration-2 candidate: `~` is expanded before the lookup; «~» alone is too broad; test «UX-13, ER-9» |
| V1-UX-14 | UX-14 | non-blocking | fixed in the iteration-2 candidate: ceo_reply reads assistant turns after the CEO's own record of the ask (assistantSince); test «UX-14, ER-6», red with the window removed |
| V1-ER-1 | ER-1 | blocking | fixed in the iteration-2 candidate: only an agent's worktree copy is a work folder (ceoTools.ts workFolders); test «UX-5, ER-1», red with the filter removed |
| V1-ER-2 | ER-2 | non-blocking | fixed in the iteration-2 candidate: a call left open is ended with its measured length and price (closeLeft), and a run's orphans at start (closeOrphans); test «DA-3, ER-2, ER-4» |
| V1-ER-3 | ER-3 | non-blocking | fixed in the iteration-2 candidate: as DA-2 |
| V1-ER-4 | ER-4 | non-blocking | fixed in the iteration-2 candidate: the call is read before the tool runs, ask_ceo's time is kept per call; test «DA-3, ER-2, ER-4» |
| V1-ER-5 | ER-5 | non-blocking | fixed in the iteration-2 candidate in part: the transcript's path is found once per CEO session; reading only the appended bytes ruled: CO-605 (6) |
| V1-ER-6 | ER-6 | non-blocking | fixed in the iteration-2 candidate: a CEO console that does not run is said; on another runner answered needs output after the ask; test «UX-14, ER-6» |
| V1-ER-7 | ER-7 | non-blocking | fixed in the iteration-2 candidate in part: escapes taken out before matching, `esc to (interrupt|stop)`; reading the decoded input line and the written counter ruled: CO-605 (7) |
| V1-ER-8 | ER-8 | non-blocking | fixed in the iteration-2 candidate: as UX-6 |
| V1-ER-9 | ER-9 | non-blocking | fixed in the iteration-2 candidate: too broad is a home folder, a root or a folder holding two projects or more; test «UX-13, ER-9» |
| V1-ER-10 | ER-10 | non-blocking | fixed in the iteration-2 candidate: as DA-7 |
| V1-ER-11 | ER-11 | non-blocking | fixed in the iteration-2 candidate: as DA-4 |
| V1-ER-12 | ER-12 | non-blocking | fixed in the iteration-2 candidate: recap names projects; voiceInputs drops consoles that ended |
| V1-ER-13 | ER-13 | non-blocking | fixed in the iteration-2 candidate: a leave is not named as an unknown credential, and the map evicts by last use (agentSurface.ts) |
| V1-DO-1 | DO-1 | blocking | fixed in the iteration-2 candidate: a project whose folder is home, right under it or holds others holds no folder (findProject); no such project exists in the registry (fixes.md §5); test «finding 4: a worktree folder…» extended |
| V1-DO-2 | DO-2 | non-blocking | fixed in the iteration-2 candidate: SCN-183 amended, CHANGELOG line «The CEO's console gets the same doors» |
| V1-DO-3 | DO-3 | non-blocking | fixed in the iteration-2 candidate: ADR-0197 amendment 4; the journal's header says who reads it |
| V1-DO-4 | DO-4 | non-blocking | fixed in the iteration-2 candidate: AGENTS.md rows `userData/ceo` (calls/, project-aliases.json) and fabric-mcp (the scratch refusal and its wait) |
| V1-DO-5 | DO-5 | non-blocking | fixed in the iteration-2 candidate: fixes.md names every plant and the archive's query, seqs and ids |
| V1-DO-6 | DO-6 | non-blocking | fixed in the iteration-2 candidate: a first instruction is quietOnly, never on the busy path (deliveryQueue.ts); test «0.3.27 review DO-6» in delivery-queue.test.mjs |
| V1-DO-7 | DO-7 | non-blocking | fixed in the iteration-2 candidate: as UX-6 |
| V1-DO-8 | DO-8 | non-blocking | fixed in the iteration-2 candidate: as UX-11 |
| V1-DO-9 | DO-9 | non-blocking | fixed in the iteration-2 candidate: the HANDOFF points at the release's ledger |
| V1-DO-10 | DO-10 | non-blocking | fixed in the iteration-2 candidate: the aliases header names project-aliases.json, the voice tools' region points at §10, deliveryQueue.ts has its region |
| V1-DO-11 | DO-11 | non-blocking | fixed in the iteration-2 candidate: the owner is paraphrased in the CHANGELOG and the retro's head (ADR-0096); fixes.md §5 names no private project or folder |
| V1-DA-1 | DA-1 | blocking | fixed in the iteration-2 candidate: tool arguments and answers pass redactPayload field by field before they are serialised; test «DA-1, DA-2», red with it removed |
| V1-DA-2 | DA-2 | non-blocking | fixed in the iteration-2 candidate: the cap counts Buffer.byteLength; test «DA-1, DA-2» with Cyrillic lines |
| V1-DA-3 | DA-3 | non-blocking | fixed in the iteration-2 candidate: as ER-4 |
| V1-DA-4 | DA-4 | non-blocking | fixed in the iteration-2 candidate: pruned at every call, at most KEEP_CALLS (200) files; AGENTS.md row; test «DA-4» |
| V1-DA-5 | DA-5 | non-blocking | fixed in the iteration-2 candidate: ADR-0197 amendment 4 and ceo-setup.md §3 say the CEO's runner reads the calls and what reaches its provider; keeping them in the CEO's folder is the decision recorded there |
| V1-DA-6 | DA-6 | non-blocking | fixed in the iteration-2 candidate: the same two documents list what reaches xAI; recap reads project names |
| V1-DA-7 | DA-7 | non-blocking | fixed in the iteration-2 candidate: a scratch clone of a known repository is refused before the remote attach (sessionEnroll.ts); test «DA-7, ER-10», red with the check removed |
| V1-DA-8 | DA-8 | non-blocking | fixed in the iteration-2 candidate: fixes.md records the method, query, seqs 214331 to 214348 and ids, the open onboarding tasks; the CHANGELOG says on the owner's computer only; a restore door ruled with CO-574 |
| V1-DA-9 | DA-9 | non-blocking | fixed in the iteration-2 candidate: fixes.md §5 names no private project or folder; the list went to the owner privately |
| V1-DA-10 | DA-10 | non-blocking | fixed in the iteration-2 candidate: the header names project-aliases.json; an archived project's names are never read, since the lookup reads active projects only (not a defect) |
| V1-PL-1 | PL-1 | blocking | fixed in the iteration-2 candidate: CO-605 and CO-606 in lane 12; check-plan-ids PASS |
| V1-PL-2 | PL-2 | blocking | fixed in the iteration-2 candidate: delivered only when Claude Code started its turn, else written_unconfirmed with the next step (consoleOpen.ts deliverFirst); test «0.3.27 review PL-2» in console-open.test.mjs, red with the old answer; CHANGELOG and SCN-183 say so; the cause carried in CO-606 |
| V1-PL-3 | PL-3 | non-blocking | ruled: CO-606, the waves A to I with their board tasks and wave 0's found rows |
| V1-PL-4 | PL-4 | non-blocking | fixed in the iteration-2 candidate: the general plan's Now line names the 2026-11-20 order and its sequence |
| V1-PL-5 | PL-5 | non-blocking | fixed in the iteration-2 candidate: fixes.md rows 1, 4 and 10 say what was narrowed and where it is carried; a tie is not counted as a failed guess; test «finding 8» extended |
| V1-PL-6 | PL-6 | non-blocking | fixed in the iteration-2 candidate: the CHANGELOG says the archive was on the owner's computer only, other installs keep theirs (CO-605) |
| V1-PL-7 | PL-7 | non-blocking | fixed in the iteration-2 candidate: the retro's header status says fixed on the 0.3.27 candidate except CO-605 |
| V1-PL-8 | PL-8 | non-blocking | ruled: CO-606 (wave C), the ADR when feat/knowledge-graph's ADR-0199 and ADR-0200 land |

Exit for iteration 1: every finding disposed above. Blocking findings open: none.
