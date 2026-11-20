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
a tool argument reached the call journal (DA-1). Fixes of code carry a test; the six named in fixes.md «Watched red» were watched red with their mechanism removed,
the others were not planted; the fixes of documents and of the voice's instructions carry no test. Two reports name synthetic probe folders; their home part is written `/Users/example` for the privacy gate (the docs report's `/Users/x`, the ux report's `/Users/u`). In iteration 2 (DA-11), the names of the owner's private worktrees and folders were replaced by placeholders in the ux, docs and data reports («<worktree-a>», «<a second folder>/research-agent» and the like); the wording is otherwise the reviewers', and the receipts carry the new hashes.

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

## Iteration 2

Candidate `81e2ee85fb27ac36e9f2fa19cdbcbd2919a1b956`. Reports and receipts in
[`docs/evidence/reviews/0.3.27/iteration-2/`](../reviews/0.3.27/iteration-2/). Gate: the local `ci.sh fast` with both
browser variables ran while the reviewers read and stopped red at `ipc-window-policy.test.mjs`: the two new CEO-only
channels of the call journal (`ceoAgentVoiceLine`, `ceoAgentVoiceEnd`) were not in the test's expectations, so the same
test was red on iteration 1's candidate too, behind the earlier stop. Fixed in the iteration-3 candidate (the test
names both channels); the later steps did not run on this candidate. Every iteration-1 fix was checked by the reviewers
of its level; ER-5, ER-6, ER-7, ER-9 and UX-4, UX-5, UX-14 held in part and their rest is below. 41 findings, 5
blocking, three in substance: a project was no longer found by its own folder when right under home or holding a
registered worktree (PL-9, DO-12, ER-14, a regression of the DO-1 fix), a worktree named by its folder's name still
started work in the project's main folder (UX-15), and the owner's private worktree names were still in the published
reports (DA-11). Tests watched red with their mechanism removed: PL-9's exact match, UX-15's worktree refusal, ER-16's
echo window, ER-18's cursor moves (console-open) and DA-13's call names.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V2-UX-15 | UX-15 | blocking | fixed in the iteration-3 candidate: a match through a worktree, by path or by its folder's name, is refused with where to go (findProject marks worktree; ceoTools.ts start, alias); test «0.3.27 review UX-15, UX-17, UX-21», red with the check removed |
| V2-UX-16 | UX-16 | non-blocking | fixed in the iteration-3 candidate: a copy whose name starts with a listed project's name gives way in the project list; same test |
| V2-UX-17 | UX-17 | non-blocking | fixed in the iteration-3 candidate: a tool result opens no answer; only the person's words do (assistantSince); same test |
| V2-UX-18 | UX-18 | non-blocking | fixed in the iteration-3 candidate: the start and task descriptions list the five states; session_task gives next steps |
| V2-UX-19 | UX-19 | non-blocking | fixed in the iteration-3 candidate: the refusal names the session working in that folder and how to reach it, else only the project's own folder |
| V2-UX-20 | UX-20 | non-blocking | ruled: CO-605 (8); the CHANGELOG and SCN-183 now say «a worktree Fabric has run in» |
| V2-UX-21 | UX-21 | non-blocking | fixed in the iteration-3 candidate: understood_as only for a match by sound; a folder query is looked up, never matched as a substring; same test |
| V2-UX-22 | UX-22 | non-blocking | fixed in the iteration-3 candidate: the resume refusal and the session_id description name both doors' tools |
| V2-UX-23 | UX-23 | non-blocking | fixed in the iteration-3 candidate: a folder the same start admitted is its project's own (ceoTools.ts start, admittedNow) |
| V2-UX-24 | UX-24 | non-blocking | ruled: CO-605 (9) |
| V2-ER-14 | ER-14 | blocking | fixed in the iteration-3 candidate: as PL-9 |
| V2-ER-15 | ER-15 | non-blocking | fixed in the iteration-3 candidate: as UX-17 |
| V2-ER-16 | ER-16 | non-blocking | fixed in the iteration-3 candidate: output within 2 s of the ask (its echo) is no answer, and an ended console reads as not running; test «0.3.27 review ER-16, ER-21, DA-18», red with the echo window removed |
| V2-ER-17 | ER-17 | non-blocking | fixed in the iteration-3 candidate: the transcript's path is found again after 20 s, so a /clear in the CEO's console is followed |
| V2-ER-18 | ER-18 | non-blocking | fixed in the iteration-3 candidate: a cursor-forward move becomes spaces, and every other sequence with any parameters goes; console-open's fixture draws the hint with cursor moves and turns red with it removed |
| V2-ER-19 | ER-19 | non-blocking | fixed in the iteration-3 candidate: as UX-15 |
| V2-ER-20 | ER-20 | non-blocking | fixed in the iteration-3 candidate: after the extra Enter a second look for the turn, else written_unconfirmed; logged at warn (PL-10); test «0.3.27 review ER-20, DO-6», which also asserts quietOnly |
| V2-ER-21 | ER-21 | non-blocking | fixed in the iteration-3 candidate: forgetting a name never kept is refused, nothing written; same test as ER-16 |
| V2-ER-22 | ER-22 | non-blocking | fixed in the iteration-3 candidate: an orphan is found from the last 8 KB of each call file; pruning keeps 200 at most (as DA-14) |
| V2-DO-12 | DO-12 | blocking | fixed in the iteration-3 candidate: as PL-9 |
| V2-DO-13 | DO-13 | non-blocking | fixed in the iteration-3 candidate: the CHANGELOG says up to three near names when any are close |
| V2-DO-14 | DO-14 | non-blocking | fixed in the iteration-3 candidate: the CHANGELOG, the journal's header and ceo-setup.md say 30 days and 200 at most, at every call; «To remove kept calls, delete the folder» |
| V2-DO-15 | DO-15 | non-blocking | fixed in the iteration-3 candidate: the ledger says which tests were watched red and which fixes carry no test |
| V2-DO-16 | DO-16 | non-blocking | fixed in the iteration-3 candidate: as DA-17 |
| V2-DO-17 | DO-17 | non-blocking | fixed in the iteration-3 candidate: the three synthetic paths in the docs report are one placeholder; fixes.md says «not into this file» |
| V2-DO-18 | DO-18 | non-blocking | ruled: as DA-12, CO-605 (10) |
| V2-DO-19 | DO-19 | non-blocking | fixed in the iteration-3 candidate in part: CO-605 (1) cites CO-497 for the duplicate; the region keeps its one reference (§10), as a region names one heading |
| V2-DA-11 | DA-11 | blocking | fixed in the iteration-3 candidate: the owner's private worktree and folder names are replaced by placeholders in the iteration-1 and iteration-2 reports, the retro README, the code comment and the tests' fixtures; the ledger says so and the receipts carry the new hashes |
| V2-DA-12 | DA-12 | non-blocking | ruled: CO-605 (10), kept verbatim by the owner's order of 2026-11-20 to keep his words with the retros |
| V2-DA-13 | DA-13 | non-blocking | fixed in the iteration-3 candidate: only files named as calls, real files and never links, whose first row is a start, are pruned, listed or ended (callFiles); test «0.3.27 review DA-13, DA-15», red with the name rule removed |
| V2-DA-14 | DA-14 | non-blocking | fixed in the iteration-3 candidate: pruned to KEEP_CALLS - 1 before a call starts, so 200 at most; age from the start in the file name; test «DA-4» asserts 200 |
| V2-DA-15 | DA-15 | non-blocking | fixed in the iteration-3 candidate: keys are redacted like values (cleanKeys); test «0.3.27 review DA-13, DA-15» |
| V2-DA-16 | DA-16 | non-blocking | fixed in the iteration-3 candidate: every voice tool's answer is redacted whole before it goes back to the call (index.ts, redactPayload) |
| V2-DA-17 | DA-17 | non-blocking | fixed in the iteration-3 candidate: fixes.md §5 has the selecting query, the session id and what the check does not cover; §1 points at ADR-0197 amendment 4 |
| V2-DA-18 | DA-18 | non-blocking | fixed in the iteration-3 candidate: an unreadable aliases file is kept aside before a write (`.bad-<time>`) and the failure counted; test «0.3.27 review ER-16, ER-21, DA-18» |
| V2-PL-9 | PL-9 | blocking | fixed in the iteration-3 candidate: a project's own exact folder is matched first, as in 0.3.26; the broad rule applies to holding other folders only and leaves copies out (findProject); test «0.3.27 review PL-9», red with the exact match removed |
| V2-PL-10 | PL-10 | non-blocking | fixed in the iteration-3 candidate: written_unconfirmed is logged at warn with the screen's last 15 lines, redacted (index.ts, terminal.first-instruction); CO-606 says this is the measurement |
| V2-PL-11 | PL-11 | non-blocking | fixed in the iteration-3 candidate: the CHANGELOG and SCN-183 say another runner answers delivered when written; the per-runner turn check ruled: CO-606 |
| V2-PL-12 | PL-12 | non-blocking | fixed in the iteration-3 candidate: CO-605 (1) names other machines' cache and temporary projects and the missing door (CO-574); the hub's second client ruled in CO-606 |
| V2-PL-13 | PL-13 | non-blocking | fixed in the iteration-3 candidate: the voice's instructions keep the heard word with session_alias when the owner says yes to an understood_as |
| V2-PL-14 | PL-14 | non-blocking | ruled: CO-606 names feat/ceo-session-windows and its amendment 3, and which lands first |

Exit for iteration 2: every finding disposed above. Blocking findings open: none.

