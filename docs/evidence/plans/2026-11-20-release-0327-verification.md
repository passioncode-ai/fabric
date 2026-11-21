# Fabric 0.3.27 release verification

Release gate ledger for 0.3.27 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02). Three
iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the candidate
read-only; findings are disposed here and in the receipts under `docs/evidence/reviews/0.3.27/`.

0.3.27 carries two orders of the owner of 2026-11-20 (paraphrased, ADR-0096): fix first what gets in the way of work
([the plan](2026-11-20-ceo-board-ux/plan.md), wave 0, branch `feat/ceo-board-ux`, session 8343a070) and the voice CEO
retro ([the retro](../../reports/2026-11-20-voice-ceo-retro/README.md), [its fixes](../../reports/2026-11-20-voice-ceo-retro/fixes.md),
branch `feat/voice-retro`, session 9cda1c0f, which runs this release by agreement with 8343a070). Since run eight it
also carries, each by its own source recorded in run eight's section: what `main` took meanwhile, by the owner's answer
of 2026-11-21 to the release's question about `main` moving («Выпустить с main»); the voice reading the board, by his
exception of 2026-11-21 at about 02:10; and the home session's blockers, by its agreement with this session.

## Protocol

- Baseline: 0.3.26's release close `44cd80ca`; `origin/main` took wave 0 at `37d69d6a`, inside the candidate, and the
  candidate merged `origin/main` at `4884bd84` in run eight's merge `5f4dc15b`.
- The reviewers: Claude Code subagents of the release session (Opus 5.5), each a fresh context given
  [the brief](../reviews/0.3.27/brief.md) and its level's focus, reading a separate read-only worktree checked out at the
  candidate, recording HEAD and `git status --short | wc -l` before and after. They ran single test files at most; the
  release session ran the gates.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.
- A run's candidate passes `bash scripts/ci.sh fast` with the browser suites run (`FABRIC_PLAYWRIGHT_MODULE` and
  `FABRIC_CHROME` set, the Chromium Playwright keeps, never the owner's Chrome), started before its reviewers or while
  they run (0.3.26, PL-42), and the verified candidate's run reaches its last step before the tag (DO-28).

## What 0.3.27 carries

The `## 0.3.27` section of [`CHANGELOG.md`](../../../CHANGELOG.md). No
schema step (no migration).

## Iteration 1

Candidate `f6990a9aaed3f243d65a40be601e5b519b9af30d`. Reports and receipts in
[`docs/evidence/reviews/0.3.27/iteration-1/`](../reviews/0.3.27/iteration-1/). Gate: the local `ci.sh fast` with both
browser variables ran while the reviewers read and stopped red at `check-plan-ids.mjs` (CO-605 cited by no lane, PL-1);
the later steps did not run on this candidate. 56 findings, 8 blocking: `first_task` said delivered with no turn
started (PL-2), the plan gate red (PL-1), a match by sound started work in the wrong project (UX-1), a folder inside a
project started in the project's main folder (UX-2), a tie could not be chosen (UX-3), a launch in the home folder
claimed every folder under home (ER-1), a home-folder project would do the same (DO-1), and a secret on a later line of
a tool argument reached the call journal (DA-1). Fixes of code carry a test except these, which were read, not tested: UX-8 (a refusal's wording), ER-12
(`voiceInputs` drops ended consoles) and ER-13 (the unknown-credential log); in iteration 2, ER-17, ER-22, PL-10, UX-18,
UX-19, UX-22, UX-23 and DA-16; in iteration 3 run one, UX-29, ER-25, ER-27 and DA-23 (UX-27 gained its test in run
two); in run two, UX-33, UX-34 and DA-29; the six named in fixes.md
«Watched red» were watched red with their mechanism removed, the others were not planted; the fixes of documents and
of the voice's instructions carry no test. Two reports name synthetic probe folders; their home part is written `/Users/example` for the privacy gate (the docs report's `/Users/x`, the ux report's `/Users/u`). In iteration 2 (DA-11), the names of the owner's private worktrees and folders were replaced by placeholders in the ux, docs and data reports («<worktree-a>», «<a second folder>/research-agent» and the like); the wording is otherwise the reviewers', and the receipts carry the new hashes.

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
| V2-DA-13 | DA-13 | non-blocking | fixed in the iteration-3 candidate: only files named as calls, real files and never links, are pruned or listed, and a call whose first row is a start is ended (callFiles, closeOrphans); test «0.3.27 review DA-13, DA-15», red with the name rule removed |
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

## Iteration 3

### Run one, 3dc2eba7 (superseded)

Candidate `3dc2eba711b3ee9a799ecf8559b0256c6d56e71c`. Five reviewers, one per level; their reports and receipts are in
[`docs/evidence/reviews/0.3.27/iteration-3-3dc2eba7/`](../reviews/0.3.27/iteration-3-3dc2eba7/) (kept as the record; not
this iteration's receipts). Gate: the local `ci.sh fast` was stopped by the release session while the reviewers read,
because fixes were being written in the same worktree; it gave no verdict on this candidate (PL-16). Every iteration-2
fix held, several in part: UX-15 (the project list, UX-26), UX-19 (an ended console, UX-27), UX-21 (a parent folder,
UX-25), ER-14 (subfolders, ER-24), ER-16 (the echo, ER-25), ER-17 (ER-26), DA-11 (the branch history and one more
name, DA-19, DA-20). 29 findings, 6 blocking: a parent folder listed no project (UX-25, PL-15), the project list hid a
worktree match (UX-26), an ended worktree console was offered a resume into the main folder (UX-27), a worktree's last
word beat a project's own name (ER-23), and a folder inside a project holding another was admitted as a new project
(ER-24). The docs and data reviewers found none blocking. Names in the reports are written as in iterations 1 and 2
(placeholders for the owner's private names, `/Users/example` for synthetic homes; one agent project's name in the plan
report is a placeholder for the privacy gate). Tests watched red with their mechanism removed: UX-25's folder list,
ER-24's two-project rule, DA-24's link check.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3-UX-25 | UX-25 | blocking | fixed in the run-two candidate: a folder that is no one project's lists every project in it, with why too-broad where it applies (ceoTools.ts projects); test «0.3.27 review, iteration 3 run one», red with the list removed |
| V3-UX-26 | UX-26 | blocking | fixed in the run-two candidate: the project list marks a match through a worktree (worktree, understood_as, next); same test |
| V3-UX-27 | UX-27 | blocking | fixed in the run-two candidate: an ended console in a worktree is said ended and offered session_open; a resume of a console that ran outside its project's folder is refused with where it would open (ceoTools.ts resume) |
| V3-UX-28 | UX-28 | non-blocking | fixed in the run-two candidate: the worktree last-words tier runs after the words (findProject); same test («review» finds code-review-bot) |
| V3-UX-29 | UX-29 | non-blocking | fixed in the run-two candidate: a copy registered as its own project is no worktree of itself (findProject) |
| V3-UX-30 | UX-30 | non-blocking | fixed in the run-two candidate: an exact name or alias comes first and is named in exact; same test |
| V3-UX-31 | UX-31 | non-blocking | fixed in the run-two candidate: the start and task descriptions say delivered and resubmitted carry no next step, and name unknown |
| V3-ER-23 | ER-23 | blocking | fixed in the run-two candidate: as UX-28; the order is the mechanism |
| V3-ER-24 | ER-24 | blocking | fixed in the run-two candidate: only the home folder, a root, or a folder holding two projects or more is no holder; a folder inside a project holding one other, or right under home, is that project's; same test, red with the rule at one |
| V3-ER-25 | ER-25 | non-blocking | fixed in the run-two candidate: the echo window starts when the ask's line was written (askWrittenAt) |
| V3-ER-26 | ER-26 | non-blocking | ruled: CO-605 (11) |
| V3-ER-27 | ER-27 | non-blocking | fixed in the run-two candidate: an unreadable aliases file is said once per change of the file (ceoProjectAliases.ts) |
| V3-ER-28 | ER-28 | non-blocking | fixed in the run-two candidate: the home folder or a root never finds a project, even one kept from before (findProject); same test |
| V3-DO-20 | DO-20 | non-blocking | fixed in the run-two candidate: fixes.md §1, §4, §6-8 and its test count say the rules as released |
| V3-DO-21 | DO-21 | non-blocking | fixed in the run-two candidate: the ledger names the code fixes with no test; the HANDOFF says findings 1 to 7 watched red, 8 and 10 not planted |
| V3-DO-22 | DO-22 | non-blocking | fixed in the run-two candidate: as ER-28 |
| V3-DO-23 | DO-23 | non-blocking | fixed in the run-two candidate: ceo-setup.md names project folders and the computer's state; deliverFirst's docstring and the window-policy test's comment updated |
| V3-DA-19 | DA-19 | non-blocking | ruled: CO-605 (12), the owner's decision (a rewrite needs a force-push) |
| V3-DA-20 | DA-20 | non-blocking | fixed in the run-two candidate: the worktree's name is a placeholder in the retro README and a neutral fixture name in the code and tests |
| V3-DA-21 | DA-21 | non-blocking | fixed in the run-two candidate: the personal project's name is an example in the CHANGELOG, the tool description, comments, tests and fixes.md, a placeholder in the retro README |
| V3-DA-22 | DA-22 | non-blocking | fixed in the run-two candidate: the row carries a note of the release session saying how its path was rewritten |
| V3-DA-23 | DA-23 | non-blocking | fixed in the run-two candidate: a voice tool that throws is answered as a redacted refusal and written to the journal (index.ts) |
| V3-DA-24 | DA-24 | non-blocking | fixed in the run-two candidate: the calls folder is refused when it is a link and set to 0700 when it exists; test «iteration 3 run one», red with the check removed; the DA-13 wording narrowed to «ended» |
| V3-PL-15 | PL-15 | blocking | fixed in the run-two candidate: as UX-25 |
| V3-PL-16 | PL-16 | non-blocking | fixed by run three: ci.sh fast with both browser variables reached its last step on cbc57ae3 (iteration 3, run three's gate, carried from run two under DO-28); the final candidate's own gate is recorded in its run's section (the last run of this iteration; run five's PL-38) |
| V3-PL-17 | PL-17 | non-blocking | ruled: CO-605 (12), as DA-19 |
| V3-PL-18 | PL-18 | non-blocking | fixed in the run-two candidate: as ER-28 |
| V3-PL-19 | PL-19 | non-blocking | fixed in the run-two candidate: fixes.md's count; the iteration-1 receipts mark ER-5, ER-7 and DA-8 ruled, re-hashed |
| V3-PL-20 | PL-20 | non-blocking | fixed in the run-two candidate: CO-606 names who files the board request and when (after the install, from the log's digest) |

Exit for run one: every finding disposed above; superseded by run two.

### Run two, 67c15053 (superseded)

Candidate `67c15053480dfbe75b8692b4cb448d1dd26a5785`. Reports and receipts in
[`docs/evidence/reviews/0.3.27/iteration-3-67c15053/`](../reviews/0.3.27/iteration-3-67c15053/) (kept as the record).
Gate: the local `ci.sh fast` with both browser variables ran to the wiki projections: every step before passed,
browser suites 26 of 26, mockup previews pinned; it stopped red at `build-plan-projection.mjs --check` (the plan
projection, stale after this release's backlog rows; rebuilt in the run-three candidate). Every run-one fix held, four
in part: UX-26 (its `understood_as` let a «yes» keep a worktree's name as an alias, UX-32), UX-30 (`exact` described
nowhere, UX-34), ER-24 (a project holding two, ER-30), DA-24 (the link check in writes only, DA-27). 24 findings, 1
blocking (UX-32); the errors, docs, data and plan reviewers found none blocking. Tests watched red with their mechanism
removed: UX-32's alias guard, UX-27's resume refusal, DA-27's link check.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3-UX-32 | UX-32 | blocking | fixed in the run-three candidate: a worktree match in the project list carries worktree and next, never understood_as; an alias that is a worktree's folder name or last words is refused; the instructions say never keep it; test «iteration 3 run two», red with the alias guard removed |
| V3-UX-33 | UX-33 | non-blocking | fixed in the run-three candidate: a running console in that folder is named before an ended one (ceoTools.ts start) |
| V3-UX-34 | UX-34 | non-blocking | fixed in the run-three candidate: the project list's description says what exact, understood_as, worktree and why mean; both instruction languages say it for exact, understood_as and worktree |
| V3-UX-35 | UX-35 | non-blocking | fixed in the run-three candidate: the refusals name the console's Claude Code session id to continue where it ran; test «PL-21, UX-35» |
| V3-UX-36 | UX-36 | non-blocking | fixed in the run-three candidate: as ER-30 |
| V3-ER-29 | ER-29 | non-blocking | fixed in the run-three candidate: a worktree named in full is matched before the words, its last words after them; test «iteration 3 run two» (fabric-data) |
| V3-ER-30 | ER-30 | non-blocking | fixed in the run-three candidate: only the home folder or a root is no holder; the deepest project holding a folder is its project; the CHANGELOG says so; same test (mono with two packages) |
| V3-ER-31 | ER-31 | non-blocking | fixed in the run-three candidate: a calls folder that is a link gives no call files, so nothing there is pruned, ended or listed; test «ER-31, DA-27», red with the check removed |
| V3-ER-32 | ER-32 | non-blocking | fixed in the run-three candidate: the code comment names no project; the dated map entry of 2026-11-19 stays as published history (ADR-0096), CO-605 (12) |
| V3-DO-24 | DO-24 | non-blocking | fixed in the run-three candidate: V2-DA-13's wording says what callFiles and closeOrphans do; its receipt re-hashed |
| V3-DO-25 | DO-25 | non-blocking | fixed in the run-three candidate: CO-605 (12) names commits a30f3fff to 3dc2eba7 and the personal project's name |
| V3-DO-26 | DO-26 | non-blocking | fixed in the run-three candidate: the three rows use the retro README's placeholders; receipts re-hashed |
| V3-DO-27 | DO-27 | non-blocking | fixed in the run-three candidate: the ledger lists every code fix without a test, iterations 1 to 3 |
| V3-DO-28 | DO-28 | non-blocking | fixed in the run-three candidate: the protocol line says the gate runs to its end before the tag; run two's section records its gate |
| V3-DO-29 | DO-29 | non-blocking | fixed in the run-three candidate: the findProject comment, «five tools more», the map entry's remainder and the README's status |
| V3-DA-25 | DA-25 | non-blocking | fixed in the run-three candidate: as DO-26 |
| V3-DA-26 | DA-26 | non-blocking | fixed in the run-three candidate: as DO-26 for the reports and ER-32 for the comment; the name is no secret and stays in published history, CO-605 (12) |
| V3-DA-27 | DA-27 | non-blocking | fixed in the run-three candidate: as ER-31 |
| V3-DA-28 | DA-28 | non-blocking | fixed in the run-three candidate: ADR-0197 amendment 4 lists project names with folders and the computer's state, as ceo-setup §3 does |
| V3-DA-29 | DA-29 | non-blocking | fixed in the run-three candidate: a voice tool that throws is also logged with ops.failed |
| V3-PL-21 | PL-21 | non-blocking | fixed in the run-three candidate: the CHANGELOG, SCN-183 and the resume description say the refusal; test «PL-21, UX-35», red with the refusal removed; continuing in place ruled: CO-605 (13) |
| V3-PL-22 | PL-22 | non-blocking | fixed in the run-three candidate: as DO-27 |
| V3-PL-23 | PL-23 | non-blocking | fixed in the run-three candidate: as DO-26 |
| V3-PL-24 | PL-24 | non-blocking | fixed in the run-three candidate: CO-605 (12) says landing by fast-forward puts the history into main, and the release session lands it |

Exit for run two: every finding disposed above; superseded by run three.

### Run three, cbc57ae3 (superseded)

Candidate `cbc57ae3bc5271f3b21280c0415e8e873a0d9b2f`, verified until the owner's blocker of 21:37 reopened the iteration
(run four below). Reports and receipts in
[`docs/evidence/reviews/0.3.27/iteration-3-cbc57ae3/`](../reviews/0.3.27/iteration-3-cbc57ae3/) (kept as the record). The docs and
data reviewers were cut off by a network error of the model's API and run again from the start with the same brief;
the reports are the second runs'. Every run-two fix held (UX-32 to UX-36, ER-29 to ER-32, DA-25 to DA-29, DO-24 to
DO-29, PL-21 to PL-24). 19 findings, none blocking; the five reviewers answered «Ready».

Gate: `bash scripts/ci.sh fast` with both browser variables on this candidate, in parts, each part read by its own exit
(R-009): a run reached vitest, 269 of 269 (run c); a run past vitest stopped once on `PulseScreen.test.tsx` (32.7 s
under a load average of 114) and once on `hub-surface.test.mjs` I3 (an admission count under a load average near 80),
each green alone (8 of 8; 16 of 16, three times); the steps after `hub-surface` ran to the script's last line, browser
suites 26 of 26, «fast tier green». The browser suites ran on the Chromium Playwright keeps (`chromium-1234`); the
`chromium-1255` an earlier run used was removed from that cache between two runs by a cleanup outside this release.
No code changed after this candidate until the owner's blocker of 21:37 (run four): the release commit then planned
carried only the version, the CHANGELOG, this ledger, the release gate, the merge log, the design map, the review
reports and receipts, and fixes.md and the HANDOFF.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3-UX-37 | UX-37 | non-blocking | ruled: CO-609 (1), written to the carry-over register before run four, once the delivery fix reopened the candidate: the project list checks the work folders' last parts before the word filter |
| V3-UX-38 | UX-38 | non-blocking | ruled: CO-609 (2), written to the carry-over register before run four, once the delivery fix reopened the candidate: the alias guard checks the named project's own worktrees only, with a next step; its worktree branch answers worktree |
| V3-UX-39 | UX-39 | non-blocking | ruled: CO-609 (3), written to the carry-over register before run four, once the delivery fix reopened the candidate: the deeper of a holder and a worked folder wins; a folder query inside a holder also lists the projects under it |
| V3-UX-40 | UX-40 | non-blocking | ruled: CO-609 (4), written to the carry-over register before run four, once the delivery fix reopened the candidate: the next step says Switchboard continues in a Terminal window of its own, checked once on a real ended worktree console |
| V3-ER-33 | ER-33 | non-blocking | ruled: CO-609 (5), written to the carry-over register before run four, once the delivery fix reopened the candidate: a one-word worktree name answers ambiguous with the project the words find |
| V3-ER-34 | ER-34 | non-blocking | ruled: CO-609 (2), written to the carry-over register before run four, once the delivery fix reopened the candidate (as UX-38) |
| V3-ER-35 | ER-35 | non-blocking | ruled: CO-609 (6), written to the carry-over register before run four, once the delivery fix reopened the candidate: ops.failed takes the tool's name directly and the ok line moves after the run |
| V3-ER-36 | ER-36 | non-blocking | ruled: CO-609 (7), written to the carry-over register before run four, once the delivery fix reopened the candidate: the folders above home are no holder, as isTooBroad says |
| V3-ER-37 | ER-37 | non-blocking | fixed in the release commit: the CHANGELOG says a Claude Code console's answer names its session id |
| V3-DO-30 | DO-30 | non-blocking | fixed in the release commit: as PL-27 |
| V3-DO-31 | DO-31 | non-blocking | ruled: CO-609 (8), as PL-27 |
| V3-DO-32 | DO-32 | non-blocking | fixed in the release commit: fixes.md says 22 review tests, 36 in all |
| V3-DO-33 | DO-33 | non-blocking | fixed in the release commit: V3-UX-34's row says why is described in the project list's description, not the instructions |
| V3-DO-34 | DO-34 | non-blocking | fixed in the release commit: the protocol's baseline line names 0.3.26's close and origin/main at 37d69d6a inside the candidate |
| V3-DA-30 | DA-30 | non-blocking | ruled: CO-609 (6), written to the carry-over register before run four, once the delivery fix reopened the candidate (as ER-35) |
| V3-PL-25 | PL-25 | non-blocking | ruled: CO-609 (5), written to the carry-over register before run four, once the delivery fix reopened the candidate (as ER-33) |
| V3-PL-26 | PL-26 | non-blocking | ruled: CO-609 (2), written to the carry-over register before run four, once the delivery fix reopened the candidate (as UX-38) |
| V3-PL-27 | PL-27 | non-blocking | fixed in the release commit: V3-PL-16 names the verified candidate and this section records its gate; fixes.md's count is 36; CO-605 (12)'s range (to 67c15053, the comment already on main) ruled: CO-609 (8), written to the carry-over register before run four |
| V3-PL-28 | PL-28 | non-blocking | ruled: CO-609 (9), written to the carry-over register before run four, once the delivery fix reopened the candidate: the release gate's row rule takes the V1-UX-1 form, with a test watched red |

Exit for run three: every finding disposed above; superseded by run four (the owner's blocker of 21:37).

### Run four, b5683470 (superseded)

Candidate `b5683470db10e0356217c709bd1a37e0cea71d94`. The owner's blocker of 2026-11-20, 21:37 (a session's first task
and the CEO popup's messages were lost) was fixed on `fix/delivery-never-drops` by the home's session and merged before
the tag (`40250359`), which reopened this iteration; CO-609 was written to the register. At 2026-11-21, 00:30 the owner
paused new features until the strategic plan: only the voice retro's bug fixes continue, so the registry fix
`fix/registry-contract` (`279dcd15`) was held out, its row CO-614. Reports and receipts in
[`docs/evidence/reviews/0.3.27/iteration-3-b5683470/`](../reviews/0.3.27/iteration-3-b5683470/) (kept as the record).
Gate: `bash scripts/ci.sh fast` on this candidate; a first run used a wrong Playwright path and is not counted; the
counted run passed every step through the browser suites (26 of 26) and stopped red at the provider matrix, since
Claude Code updated itself on this Mac from 2.1.329 to 2.1.330 during the release (re-pinned in `6a8c9b67`). 41 findings,
8 blocking (UX-41, UX-42, UX-43, ER-38, ER-39, DO-35, DO-36, DA-31: the CEO queue's order, its one owner per line, a
stopped CEO said as busy, the files' Enter); the plan reviewer found none blocking. Each is fixed in the next candidate,
with tests watched red with their mechanism removed (the order check, the queue's ownership). What remains is CO-615.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3R4-UX-41 | UX-41 | blocking | fixed: a CEO that is not running is said as not running beside «Попробовать снова», never as busy (`CeoComposer.tsx`, `ceoAgent.composer.queuedStopped`; test «a CEO that is not running is said as not running») |
| V3R4-UX-42 | UX-42 | blocking | fixed: a message sent while others wait goes behind them (`ceoAgent.ts#send`, `enqueue`; test «run four: a message sent while others wait…», watched red with the check removed) |
| V3R4-UX-43 | UX-43 | blocking | fixed: a queued line naming files gets the settled Enter when the queue types it (`ceoAgent.ts#enterAfterFiles`; test «run four: a queued message naming files…») |
| V3R4-UX-44 | UX-44 | non-blocking | fixed: cursor moves read as spaces before the prompt test (`deliveryQueue.ts#noteOutput`; test «a hint drawn with cursor moves…») |
| V3R4-UX-45 | UX-45 | non-blocking | fixed: the longer window holds only until the prompt is drawn; after it an item waits 30 s (`deliveryQueue.ts#enqueue`) |
| V3R4-UX-46 | UX-46 | non-blocking | ruled: CO-615 (1): the window lists no waiting messages and has no discard |
| V3R4-UX-47 | UX-47 | non-blocking | fixed: as ER-45 |
| V3R4-UX-48 | UX-48 | non-blocking | fixed: as ER-40 |
| V3R4-ER-38 | ER-38 | blocking | fixed: a queued line is owned by the queue alone (`entry.retyped`), so a fallback does not retype it (test «run four: a queued line belongs to the queue…», watched red with the mark removed) |
| V3R4-ER-39 | ER-39 | blocking | fixed: as UX-41 |
| V3R4-ER-40 | ER-40 | non-blocking | fixed: an unknown write is said as `delivery-unknown`, never queued or typed again; an unknown retype counts as typed; the queue's retries back off from 10 s to five minutes (`ceoAgent.ts#typeInto`, `drainLater`; test «run four: a write whose outcome is unknown…») |
| V3R4-ER-41 | ER-41 | non-blocking | fixed: a file that does not parse is kept aside as `pending.json.corrupt-<time>` and recorded (test «run four: a pending file that does not parse…») |
| V3R4-ER-42 | ER-42 | non-blocking | fixed: one bound, 50, at send and at load; a send past it is refused and said, a cut at load recorded (`CEO_QUEUE_MAX`; test «run four: one bound…») |
| V3R4-ER-43 | ER-43 | non-blocking | fixed: as UX-42 |
| V3R4-ER-44 | ER-44 | non-blocking | fixed: a `queue-operation` enqueue or dequeue line counts as taken (`claudeTranscript.ts#hasPersonTurn`; test «run four: a meta line…») |
| V3R4-ER-45 | ER-45 | non-blocking | fixed: `isMeta` lines and tool results alone are no turn (`hasPersonTurn` parses the lines; same test) |
| V3R4-DO-35 | DO-35 | blocking | fixed: as UX-42 |
| V3R4-DO-36 | DO-36 | blocking | fixed: as ER-38 |
| V3R4-DO-37 | DO-37 | non-blocking | fixed: the voice's `ask_ceo` says a queued line waits, and no echo window starts for it (`index.ts#runVoiceTool`) |
| V3R4-DO-38 | DO-38 | non-blocking | fixed: `pending.json` and the queue's retry in AGENTS.md's `userData/ceo` and CEO console rows and in CHANGELOG «Upgrading» |
| V3R4-DO-39 | DO-39 | non-blocking | fixed: CHANGELOG bullet 3 and CO-606 point to the measured cause; the `first_task` meanings and `FirstInstructionOutcome` name the transcript and the retype |
| V3R4-DO-40 | DO-40 | non-blocking | fixed: as UX-45; `FIRST_TASK_WAIT_MS`'s comment says a slow start answers `pending` |
| V3R4-DO-41 | DO-41 | non-blocking | fixed: CHANGELOG bullet 1 says «for at most a minute, then the old rule» |
| V3R4-DO-42 | DO-42 | non-blocking | fixed: as UX-41 |
| V3R4-DO-43 | DO-43 | non-blocking | fixed: as ER-42; CHANGELOG bullet 2 says the bound |
| V3R4-DO-44 | DO-44 | non-blocking | fixed: this section; the gate moves to the final candidate in the release commit |
| V3R4-DA-31 | DA-31 | blocking | fixed: as UX-42 |
| V3R4-DA-32 | DA-32 | non-blocking | fixed: as ER-42 |
| V3R4-DA-33 | DA-33 | non-blocking | ruled: CO-615 (1): no age limit and no list or discard for waiting messages |
| V3R4-DA-34 | DA-34 | non-blocking | fixed: as DO-38 |
| V3R4-DA-35 | DA-35 | non-blocking | ruled: CO-615 (2): transcripts in a home Switchboard made are not looked for; their check answers unknown and nothing is retyped |
| V3R4-DA-36 | DA-36 | non-blocking | fixed: in part: `isMeta` lines are no turn (as ER-45); a transcript not yet written counted as no turn is ruled: CO-615 (3) |
| V3R4-DA-37 | DA-37 | non-blocking | fixed: as ER-40 |
| V3R4-PL-29 | PL-29 | non-blocking | fixed: run three kept in `iteration-3-cbc57ae3/`, run four in `iteration-3-b5683470/`, moved in the fix commit before the next candidate |
| V3R4-PL-30 | PL-30 | non-blocking | fixed: run three titled superseded; V3-PL-16 no longer names cbc57ae3 as final |
| V3R4-PL-31 | PL-31 | non-blocking | fixed: the pause and the held registry fix named in this section; its row is CO-614 |
| V3R4-PL-32 | PL-32 | non-blocking | fixed: as DO-38 |
| V3R4-PL-33 | PL-33 | non-blocking | fixed: SCN-189 has its index row |
| V3R4-PL-34 | PL-34 | non-blocking | fixed: «Next free ID» reads `CO-616` and names CO-607 to CO-615 |
| V3R4-PL-35 | PL-35 | non-blocking | fixed: as ER-38 |
| V3R4-PL-36 | PL-36 | non-blocking | fixed: as ER-42 and UX-41: the bound is said, a stopped CEO is said |

Exit for run four: every finding disposed above; superseded by run five.

### Run five, 6a8c9b67 (superseded)

Candidate `6a8c9b6730d257bf75e296ab217366bf2a19f5a8`. Reports and receipts in
[`docs/evidence/reviews/0.3.27/iteration-3-6a8c9b67/`](../reviews/0.3.27/iteration-3-6a8c9b67/) (kept as the record).
The times «21:37» and «00:30» in this ledger are the owner's, as his relayed messages give them; this session's clock
(CET, UTC+1) had the pause before `824dd2b1` (00:10). The rule applied under the pause: a fix of a review finding on code
already in the candidate is part of releasing that candidate, while a fix of code outside it (the registry, CO-614)
waits. Gate: `bash scripts/ci.sh fast` on this candidate ran to its last line, «fast tier green», browser suites 26 of
26, with Claude Code 2.1.330 installed, equal to the pin (run six's PL-45). 31 findings, 5 blocking (UX-49, ER-46, DO-45: with a message
waiting, writing to a stopped CEO no longer started it, a regression of run four's order fix; ER-47: a queued line
typed into a console that then showed its limit was lost; DO-46: a queued voice ask sent the voice to ask again). The
fix routes every send through the one queue, which records what it types as owed to that console; tests watched red
with their mechanism removed. What remains is in CO-615.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3R5-UX-49 | UX-49 | blocking | fixed: every send goes through the queue after the stop is waited for, the hold cleared and the console started (`ceoAgent.ts#send`); the line names «Запустить» or, after a failed start, «Попробовать снова» (`CeoComposer.tsx`); test «run five: with a message waiting, writing to a CEO the person stopped starts it…», watched red with the start removed |
| V3R5-UX-50 | UX-50 | non-blocking | fixed: a line typed for a waiting send whose write breaks off is said as `delivery-unknown` (`endedUnknown`; test «run five: a line the queue typed with an unknown outcome…»); a later timer drain's unknown is ruled: CO-615 (4) |
| V3R5-UX-51 | UX-51 | non-blocking | fixed: a start resets the backoff and drains at once (`ceoAgent.ts#start`) |
| V3R5-UX-52 | UX-52 | non-blocking | fixed: a CEO still starting is said as busy (`not-delivered`) |
| V3R5-UX-53 | UX-53 | non-blocking | fixed: a queued ask keeps its mark with no write time; `ceo_reply` answers `queued` with «do not ask again», and the queue sets the write time when it types the line (`index.ts#runVoiceTool`, `ceoVoiceTools.ts#ceoReply`; test «run five: ceo_reply says a queued ask waits…») |
| V3R5-ER-46 | ER-46 | blocking | fixed: as UX-49 |
| V3R5-ER-47 | ER-47 | blocking | fixed: the queue records what it typed as owed to that console, so a limit or sign-in answer retypes it on the next runner, once; a failed write moves on to a console a fallback brought (`ceoAgent.ts#drainOnce`; test «run five: a line the queue typed into a console that answers with a limit…», watched red with the record removed) |
| V3R5-ER-48 | ER-48 | non-blocking | fixed: every send goes through the one queue (test «run five: two sends that overlap…») |
| V3R5-ER-49 | ER-49 | non-blocking | fixed: an unknown write in the queue is never queued again nor owed |
| V3R5-ER-50 | ER-50 | non-blocking | fixed: as UX-51 |
| V3R5-ER-51 | ER-51 | non-blocking | fixed: a send waits for the drain in flight, which holds until a files line's Enter is written |
| V3R5-ER-52 | ER-52 | non-blocking | fixed: `ask_ceo` answers an unknown write with «do not ask again; read ceo_reply» and starts the echo window |
| V3R5-DO-45 | DO-45 | blocking | fixed: as UX-49 |
| V3R5-DO-46 | DO-46 | blocking | fixed: as UX-53 |
| V3R5-DO-47 | DO-47 | non-blocking | fixed: as ER-48 |
| V3R5-DO-48 | DO-48 | non-blocking | fixed: as UX-51 and UX-52 |
| V3R5-DO-49 | DO-49 | non-blocking | fixed: SCN-189 lists the new lines and states |
| V3R5-DO-50 | DO-50 | non-blocking | fixed: CO-615 says eight blocking findings (four defects) |
| V3R5-DO-51 | DO-51 | non-blocking | fixed: the map entry says the matrix data changes, behaviour does not |
| V3R5-DA-38 | DA-38 | non-blocking | fixed: kept-aside files are kept 30 days and at most three; the record says whether the rename worked (`ceoAgent.ts#keepAside`; test «run five: a full queue refuses before saving any file…») |
| V3R5-DA-39 | DA-39 | non-blocking | fixed: a file of the wrong shape, or with invalid entries, is kept aside and recorded (same test) |
| V3R5-DA-40 | DA-40 | non-blocking | fixed: a full queue refuses before any file is saved (same test) |
| V3R5-DA-41 | DA-41 | non-blocking | fixed: as ER-48 |
| V3R5-PL-37 | PL-37 | non-blocking | fixed: the release commit after the last run changes only declared metadata; a register edit goes in a candidate or on main after the tag; the last run's section names the Claude Code build its gate ran with |
| V3R5-PL-38 | PL-38 | non-blocking | fixed: run three's sentence says code changed at the 21:37 blocker; V3-PL-16 points at the last run; run four's gate outcome and exit lines for runs three and four are recorded |
| V3R5-PL-39 | PL-39 | non-blocking | fixed: CO-609 points at `iteration-3-cbc57ae3/` |
| V3R5-PL-40 | PL-40 | non-blocking | fixed: as DO-50 |
| V3R5-PL-41 | PL-41 | non-blocking | fixed: the Now line, CO-606 and the retro's HANDOFF name the pause and CO-614 |
| V3R5-PL-42 | PL-42 | non-blocking | fixed: the rule is stated in this section |
| V3R5-PL-43 | PL-43 | non-blocking | fixed: as UX-50; the CHANGELOG says a later queue unknown is recorded |
| V3R5-PL-44 | PL-44 | non-blocking | fixed: the times are named as the owner's, as relayed, in this section and the HANDOFF |

Exit for run five: every finding disposed above; superseded by run six.

### Run six, 755687ab (superseded)

Candidate `755687ab0b438a67c0ce26a6d448e3d5150ae8a1`. Reports and receipts in
[`docs/evidence/reviews/0.3.27/iteration-3-755687ab/`](../reviews/0.3.27/iteration-3-755687ab/) (kept as the record).
Gate: `bash scripts/ci.sh fast` on this candidate ran to its last line, «fast tier green», browser suites 26 of 26,
with Claude Code 2.1.330 installed, equal to the pin. 28 findings, 2 blocking (ER-53: a drain that found the CEO not
running cleared its in-flight marker before setting it, and the queue stopped for good; DA-42: the 30-day bound of the
kept-aside queue files AGENTS.md states was applied only when another file was kept aside). The ux, docs and plan
reviewers found none blocking. The fix also puts the lines a lost console owed back at the head of the queue, so the
one queue holds the order across a fallback; tests watched red with their mechanism removed (the marker). What
remains is in CO-615.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3R6-UX-54 | UX-54 | non-blocking | fixed: for a CEO that is not running, `ask_ceo` tells the voice nothing is typed until the owner starts it, and `ceo_reply` says so before the waiting mark (`index.ts#runVoiceTool`, `ceoVoiceTools.ts#ceoReply`; test «run six: ceo_reply says a CEO that is not running first…») |
| V3R6-UX-55 | UX-55 | non-blocking | fixed: `ceo_reply` reads the transcript from when the ask was written (`askWrittenAt`) |
| V3R6-UX-56 | UX-56 | non-blocking | fixed: the queue tells the voice side about an unknown write too; `ceo_reply` answers `unknown`, «do not ask again» (same test) |
| V3R6-UX-57 | UX-57 | non-blocking | fixed: a send waits for the fallback its own line caused, then for the queue to type it on the next runner (`ceoAgent.ts#send`) |
| V3R6-UX-58 | UX-58 | non-blocking | fixed: as ER-55 |
| V3R6-UX-59 | UX-59 | non-blocking | fixed: two composer tests assert the button each state names (`CeoComposer.test.tsx`) |
| V3R6-ER-53 | ER-53 | blocking | fixed: the in-flight marker is cleared by the promise it marks, never inside the call that sets it (`ceoAgent.ts#drain`; test «run six: a drain that finds the CEO not running does not stop the queue…», watched red with the marker never cleared) |
| V3R6-ER-54 | ER-54 | non-blocking | fixed: the lines a lost console owed go back to the head of the queue, so a failed retype or a walk that ends with every runner set aside keeps them for the next start |
| V3R6-ER-55 | ER-55 | non-blocking | fixed: as ER-54: the owed lines go in before newer ones (test «run six: after a limit, the line the lost console owed goes in before…») |
| V3R6-ER-56 | ER-56 | non-blocking | fixed: the valid lines of a file with invalid entries are written back at once (test «run six: a kept-aside queue file older than 30 days…») |
| V3R6-ER-57 | ER-57 | non-blocking | fixed: a send waits only until its own line leaves the queue or the drain stops (`leftQueue`) |
| V3R6-ER-58 | ER-58 | non-blocking | fixed: a requeued owed line keeps `files`, so the queue gives it its Enter |
| V3R6-ER-59 | ER-59 | non-blocking | fixed: a start clears the armed retry timer before it drains |
| V3R6-ER-60 | ER-60 | non-blocking | fixed: as UX-56 |
| V3R6-DO-52 | DO-52 | non-blocking | fixed: as ER-56 |
| V3R6-DO-53 | DO-53 | non-blocking | fixed: as ER-55 |
| V3R6-DO-54 | DO-54 | non-blocking | fixed: as UX-56 |
| V3R6-DO-55 | DO-55 | non-blocking | fixed: SCN-189 step 1 ties each line to its state; Errors & recovery and Telemetry describe the one queue, the requeue and the kept-aside bound |
| V3R6-DO-56 | DO-56 | non-blocking | fixed: the kept-aside files are pruned at every start; CHANGELOG «Upgrading» names them |
| V3R6-DO-57 | DO-57 | non-blocking | fixed: the unused fallback counter and its comment are removed |
| V3R6-DA-42 | DA-42 | blocking | fixed: as DO-56 (test «run six: a kept-aside queue file older than 30 days is removed at the next start…») |
| V3R6-DA-43 | DA-43 | non-blocking | fixed: as ER-56 |
| V3R6-DA-44 | DA-44 | non-blocking | fixed: `ceo.agent.queued` is recorded only for a line still waiting after the first drain |
| V3R6-DA-45 | DA-45 | non-blocking | fixed: each removal on its own, plain files only, newest by the time in the name (`ceoAgent.ts#pruneAside`) |
| V3R6-PL-45 | PL-45 | non-blocking | fixed: run five's gate is recorded: last line, browser suites 26 of 26, Claude Code 2.1.330 |
| V3R6-PL-46 | PL-46 | non-blocking | fixed: one sentence of the pause, with its source, in the Now line, CO-606, CO-614 and the retro's HANDOFF; the strategist's handoff on `feat/ceo-persona` takes the same sentence |
| V3R6-PL-47 | PL-47 | non-blocking | fixed: CO-615 names run five and its folder |
| V3R6-PL-48 | PL-48 | non-blocking | fixed: as DO-55; Coverage names the run-five and run-six tests |

Exit for run six: every finding disposed above; superseded by run seven.

### Run seven, f10fa4b8 (superseded)

Candidate `f10fa4b86eabb62672955f58e024cb9c457cb8e4`. Reports and receipts in
[`docs/evidence/reviews/0.3.27/iteration-3-f10fa4b8/`](../reviews/0.3.27/iteration-3-f10fa4b8/) (kept as the record).
Gate: `bash scripts/ci.sh fast` on this candidate (outcome in the next run's section). 20 findings, 3 blocking: DO-58 (a
write that landed after a fallback's requeue removed the owed line, not its own), DA-46 (the requeue pushed the file past
50 and a restart dropped the person's newest lines), PL-49 (`main` moved 41 commits past the candidate during this run,
and the gate cuts a release only from `main`). The ux and errors reviewers found none blocking. DO-58 and DA-46 are fixed
in the next candidate, tests watched red with their mechanism removed. PL-49 is the owner's to decide: whether 0.3.27
takes what `main` holds (Memory, the estate graph, an update in place, new features under his pause) or waits for the
strategic plan. No tag before his answer. The ledger's protocol line about `main` (wave 0 inside the candidate) holds
for this run's start only.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3R7-UX-60 | UX-60 | non-blocking | fixed: while the CEO starts or switches runners, `ceo_reply` says it waits (`ceoState`; test «run seven: while the CEO starts or switches runners…») |
| V3R7-UX-61 | UX-61 | non-blocking | fixed: after a broken-off queue write, `ceo_reply` still reads the CEO's answer and carries the doubt beside it; it says `unknown` only when no answer shows by the deadline |
| V3R7-UX-62 | UX-62 | non-blocking | fixed: the person's stop drops the lines a lost console owed, which were said as sent; the person's own waiting lines stay (`stopNow`; test «run seven: … the person's stop drops owed lines») |
| V3R7-ER-61 | ER-61 | non-blocking | fixed: as DO-58 |
| V3R7-ER-62 | ER-62 | non-blocking | fixed: as DA-46 |
| V3R7-ER-63 | ER-63 | non-blocking | fixed: as UX-61 |
| V3R7-ER-64 | ER-64 | non-blocking | fixed: a folder read failure other than a missing folder is recorded |
| V3R7-ER-65 | ER-65 | non-blocking | fixed: the record is `ceo.agent.requeued`; a typed retype's `queue-delivered` carries `retype: true` |
| V3R7-DO-58 | DO-58 | blocking | fixed: the drain removes the line it typed by identity, and a line written into a console a fallback lost meanwhile goes back behind the owed ones, once (test «run seven: a write that lands after a limit…», watched red with `shift()` back) |
| V3R7-DO-59 | DO-59 | non-blocking | fixed: as DA-46 |
| V3R7-DO-60 | DO-60 | non-blocking | fixed: as UX-60 |
| V3R7-DO-61 | DO-61 | non-blocking | fixed: CO-615 names runs four to seven, their folders and their blocking counts |
| V3R7-DO-62 | DO-62 | non-blocking | fixed: CO-614's source cell points to the one sentence and cites the brief on the owner's Mac; its target waits for the owner's answer |
| V3R7-DA-46 | DA-46 | blocking | fixed: the bound counts the person's lines (50); on disk up to 10 owed lines ride on top; a file past 60 is kept aside whole before it is cut (test «run seven: a fallback on a full queue, then a restart…», watched red with the old bound) |
| V3R7-DA-47 | DA-47 | non-blocking | fixed: plain files only count, a name more than a day in the future is old, and the file just kept aside is never removed (test «run seven: names dated in the future…») |
| V3R7-DA-48 | DA-48 | non-blocking | fixed: a requeued line keeps the time it was sent |
| V3R7-PL-49 | PL-49 | blocking | ruled: the owner's decision: 0.3.27 is cut from `main`, which took 41 commits of other sessions (Memory, the estate graph, an update in place) during this run; asked on 2026-11-21 in Fabric (question about `fabric.release-0327.main-moved`, recommendation: merge `main` into a new candidate and review it whole) and told through the communicator; no tag before the answer |
| V3R7-PL-50 | PL-50 | non-blocking | fixed: as DO-61 |
| V3R7-PL-51 | PL-51 | non-blocking | fixed: as DO-62; the strategist's handoff points at this ledger |
| V3R7-PL-52 | PL-52 | non-blocking | fixed: as DA-46 |

Exit for run seven: every finding disposed above; superseded by run eight.

### Run eight, 777e96f4 (superseded)

Candidate `777e96f49c90770f25c21803d46b34c6074ff922`. Reports and receipts in
[`docs/evidence/reviews/0.3.27/iteration-3-777e96f4/`](../reviews/0.3.27/iteration-3-777e96f4/) (kept as the record).

**What the candidate carries, and by whose word.** (1) The owner's answer to run seven's PL-49, given in Fabric on
2026-11-21 to the release's question about `main` moving: «Выпустить с main»; merged as `5f4dc15b` (MERGES
`RELEASE-0327-MAIN`). (2) The owner's exception to his pause, said in the CEO window on 2026-11-21 at about 02:10 and
relayed by the CEO with its brief (`userData/ceo/inbox/2026-11-21-voice-direct-board-access-brief.md` on the owner's
Mac): the voice reads the board itself, and «директор», «шеф», «босс», «менеджер», «главный», «SEO» mean the CEO;
`feat/voice-board`, SCN-191. (3) The agreement with the home's session (8343a070, `fabric-8b`), made between
the two sessions on 2026-11-21 in Claude Code's messages between sessions, not on the board (board request `85e5af41`
is Fabric Inbox's ask, ADR-0204): one release of `main`, the voice retro, the voice board and its blockers; merged: `fix/registry-contract`
with Inbox's connection (ADR-0204, the owner's own words of 2026-11-20, «вообще это все должно быть автоматически, не
надо никакой подключать»), `fix/stack-outage-banner` (wave 0's last fix, plan part 5), `feat/ceo-window-place` and
`fix/ceo-dictation-tail` (owner-words part 5).

**Gate.** `bash scripts/ci.sh fast` on run seven's candidate `f10fa4b8` was not run before the merge; it ran on the
merged candidates instead: `a825cbf9` failed 9 design-gate checks in the merged blockers (raw line-height, four classes
outside the registry, short ids on the console line against SP-2), fixed in `777e96f4`; `777e96f4` failed the
prototype check of `launch.css` (a rule written inside the ported block), fixed in `ec06a616`; `ec06a616` failed the
product model's journey coverage (SCN-188, SCN-189, SCN-191 lost when the merge took one side's model), fixed in
`3dfc6778`; `3dfc6778` failed the adoption report's bytes, rebuilt in the next candidate. Its outcome on the next
candidate is in run nine's section. Run eight read `777e96f4`; the commits after it to `3dfc6778` change only styles,
the product model and map entries, and the next candidate carries run eight's fixes, which run nine reads.

53 findings, 14 blocking: UX-63 to UX-65, ER-66 to ER-70, DO-63 to DO-66, DA-49, PL-53. All are in what the merge
brought: the estate index kept and served text as typed (DA-49), the CEO's address words still reached a project and a
new folder was refused beside a longer-named one (UX-63, ER-66, UX-65), the voice could not open a task by the id it
gave (UX-64, ER-67), stale document sections were found and confirmed (ER-68), Inbox's connection undid the person's
Disconnect (ER-69), a scheduled update named an end that does not come (ER-70), and the records did not say what 0.3.27
carries (DO-63 to DO-66, PL-53). Each is fixed in the next candidate, the code ones with a test watched red with the
fix taken out. Not run end to end here: the update's wait loop (ER-70), and the voice's refusal of `index.refresh` and
`index.rebuild`, which lives in `main/index.ts`'s call handler. What is carried is CO-620.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3R8-UX-63 | UX-63 | blocking | fixed: `start` asks main's matcher only when the CEO's address words, a folder too broad and a folder path are not in play; `knowledge_search` refuses an address word as its project (`ceoTools.ts#start`, `knowledgeTools.ts#search`; test «run eight: «SEO» and «CEO» start nothing…», watched red with the old condition) |
| V3R8-UX-64 | UX-64 | blocking | fixed: the voice board gives whole ids and opens a task by an id's first characters within its project (`voiceBoard.ts#brief`, `#task`; test «run eight: the voice opens a task by the id board_tasks gave…» through the host's own filter, watched red with the 8-character id) |
| V3R8-UX-65 | UX-65 | blocking | fixed: a folder path never goes to the second matcher, so a new folder beside a longer-named one becomes its own project (test «run eight: a new folder beside a longer-named project's folder…», watched red) |
| V3R8-UX-66 | UX-66 | non-blocking | fixed: running, then review, then the backlog, each newest first, null dates last (`voiceBoard.ts#STATUS_ORDER`; the run-eight voice-board test) |
| V3R8-UX-67 | UX-67 | non-blocking | ruled: CO-620 (4) |
| V3R8-UX-68 | UX-68 | non-blocking | fixed: SCN-110 step 3 says the window is no longer the main window's child and the button brings it forward |
| V3R8-UX-69 | UX-69 | non-blocking | fixed: `.ceo-popup-runner` and `.ceo-popup-state` are no-drag, so their hover text shows (`styles.css`) |
| V3R8-UX-70 | UX-70 | non-blocking | fixed in the tool descriptions: the voice's tools name `knowledge_*` and `session_resume` (`ceoTools.ts#ceoVoiceTools`, `knowledgeTools.ts#knowledgeVoiceTools`); the search answer's note is CO-620 (6) |
| V3R8-UX-71 | UX-71 | non-blocking | fixed: the CEO brief carries the address rule, phrased for the CEO itself (`ceoAgent.ts#ceoBrief`, `ceoAddress.ts#ceoAddressRule`; test «the CEO brief carries the address words…») |
| V3R8-UX-72 | UX-72 | non-blocking | ruled: CO-620 (5) |
| V3R8-UX-73 | UX-73 | non-blocking | fixed: `session_resume`'s description says a task always starts a new conversation and no task continues it as itself |
| V3R8-ER-66 | ER-66 | blocking | fixed: as UX-63 |
| V3R8-ER-67 | ER-67 | blocking | fixed: as UX-64 |
| V3R8-ER-68 | ER-68 | blocking | fixed: each read of a project's documents removes the sections and files this HEAD no longer holds (`estateIndex.ts#pruneDocs`, `estateRun.ts`); test «a document read again leaves no stale section behind…», watched red with the prune a no-op |
| V3R8-ER-69 | ER-69 | blocking | fixed: the person's Disconnect (the newest connection removed) or Deny (the newest answer since it), read from the database, stops the auto-connect across ticks and restarts; a read that fails stops it too (`inboxAutoConnect.ts`, `board.ts` `saidNo`; test watched red without the check) |
| V3R8-ER-70 | ER-70 | blocking | fixed: the installer and `release-mac.md` name the real ends (logout, a restart of the Mac, a Quit with «Служба доски» off), and an end counts only when Fabric is still gone 2 s later, so a restart is waited out rather than dropped (`install-mac-update.mjs`); the wait loop is not run end to end here |
| V3R8-ER-71 | ER-71 | non-blocking | ruled: CO-620 (3) |
| V3R8-ER-72 | ER-72 | non-blocking | fixed in part: `board_tasks` says `capped` at the read's bound (`voiceBoard.ts#TASKS_READ`); the rest is CO-620 (4) |
| V3R8-ER-73 | ER-73 | non-blocking | ruled: CO-620 (5) |
| V3R8-ER-74 | ER-74 | non-blocking | fixed: resuming as itself never admits a cache or temporary folder (`ceoTools.ts#resumeAsItself`, `scratch`) |
| V3R8-ER-75 | ER-75 | non-blocking | fixed: a failed catalogue read is recorded as `ceo.projects.catalogue-failed` (`ceoTools.ts#rolesOf`) |
| V3R8-ER-76 | ER-76 | non-blocking | ruled: CO-620 (1) |
| V3R8-ER-77 | ER-77 | non-blocking | ruled: CO-620 (1) |
| V3R8-ER-78 | ER-78 | non-blocking | ruled: CO-620 (1) |
| V3R8-ER-79 | ER-79 | non-blocking | ruled: CO-620 (1) |
| V3R8-ER-80 | ER-80 | non-blocking | ruled: CO-620 (1) |
| V3R8-DO-63 | DO-63 | blocking | fixed: a `## 0.3.27` bullet for the registry fix and ADR-0204, CO-614 closed as shipped, the MERGES entries corrected, the HANDOFF sentence |
| V3R8-DO-64 | DO-64 | blocking | fixed: the CHANGELOG says the index stays on the machine and its hits reach the CEO's model and xAI redacted; `ceo-setup.md` §3 lists search passages and task holders; the index is now redacted as written (DA-49) |
| V3R8-DO-65 | DO-65 | blocking | fixed: AGENTS.md has lifecycle rows for the estate index and the console line (Inbox's row was there), and the Windows and Linux paragraph names them |
| V3R8-DO-66 | DO-66 | blocking | fixed: the pause's one sentence, in the Now line, CO-606, CO-614 and the HANDOFF, says what 0.3.27 carries and by whose words; CO-606's ADR clause is past; the HANDOFF names run eight and the next task |
| V3R8-DO-67 | DO-67 | non-blocking | fixed: CO-615 says DO-58 and DA-46 are fixed and PL-49 was the owner's decision |
| V3R8-DO-68 | DO-68 | non-blocking | fixed: SCN-189 drops `queue-trimmed` and names the over-bound cause; the comment above the bound says 50 plus 10, kept aside whole |
| V3R8-DO-69 | DO-69 | non-blocking | fixed: as UX-64 |
| V3R8-DO-70 | DO-70 | non-blocking | fixed: fixes.md says 40 with the dictation tail's test |
| V3R8-DO-71 | DO-71 | non-blocking | fixed: «Upgrading» names `ceo-window.json` and `estate-index/` |
| V3R8-DO-72 | DO-72 | non-blocking | fixed: a paragraph under `## 0.3.27` says what rides by the owner's answer, his exception and the agreement; MERGES has `RELEASE-0327-MAIN` for `5f4dc15b` |
| V3R8-DO-73 | DO-73 | non-blocking | fixed: ADR-0199 cites a neutral transcript path (privacy, ADR-0096) |
| V3R8-DO-74 | DO-74 | non-blocking | fixed: SCN-188 says the hidden parts are on the agent's page |
| V3R8-DA-49 | DA-49 | blocking | fixed: every document, label, attribute, edge evidence and transcript state is redacted as the index writes it (`estateIndex.ts#putDocs`, `#putGraph`, `#setFileState`), the knowledge doors redact their answers again (`knowledgeTools.ts#run`), and schema 3 removes an index an earlier build wrote, and any copy kept aside; test «a key typed into a transcript is redacted…» (search, node.get, graph.neighbours and the file bytes), watched red with the body unredacted |
| V3R8-DA-50 | DA-50 | non-blocking | fixed: the folder is created 0700 and the files set 0600 (`estateWiring.ts#open`) |
| V3R8-DA-51 | DA-51 | non-blocking | ruled: CO-620 (1); the `.unreadable` copy is no longer made and an old one is removed (DA-49) |
| V3R8-DA-52 | DA-52 | non-blocking | fixed: the voice cannot run `index.refresh` or `index.rebuild` (`knowledgeTools.ts#VOICE_REFUSED_OPERATIONS`, `index.ts`), and `board_tasks` says `capped` at its bound |
| V3R8-DA-53 | DA-53 | non-blocking | fixed: as DO-65 |
| V3R8-DA-54 | DA-54 | non-blocking | ruled: CO-620 (2) |
| V3R8-DA-55 | DA-55 | non-blocking | ruled: CO-620 (3) |
| V3R8-PL-53 | PL-53 | blocking | fixed: decided by the release session under the agreement with the home's session, whose blockers include `fix/registry-contract`; the owner's own words on Inbox («вообще это все должно быть автоматически, не надо никакой подключать», 2026-11-20 at 22:50, ADR-0204) came before his pause, and he did not answer CO-614's question himself; its CHANGELOG bullet, MERGES and CO-614 (closed) say so, and the release close tells him the access change through the communicator |
| V3R8-PL-54 | PL-54 | non-blocking | fixed: the MERGES entry says it merged into the candidate as wave 0's last fix |
| V3R8-PL-55 | PL-55 | non-blocking | fixed: as DO-66; run eight's section records the owner's answer, his exception and the agreement with their sources |
| V3R8-PL-56 | PL-56 | non-blocking | fixed: as DO-67 |
| V3R8-PL-57 | PL-57 | non-blocking | fixed: as DO-71 |
| V3R8-PL-58 | PL-58 | non-blocking | ruled: CO-620 (5); SCN-188's amendments answer F1, F4 and F5, its narrow-window rule F2 and F3; F9 is fixed (the test checks `.is-branch svg`); F6, F7 and F8 are in CO-620 (5) |
| V3R8-PL-59 | PL-59 | non-blocking | fixed: as DO-70 |
| V3R8-PL-60 | PL-60 | non-blocking | fixed: as DO-65, in this candidate |

Exit for run eight: every finding disposed above; superseded by run nine.

### Run nine, ee544e2a (superseded)

Candidate `ee544e2a2f4cfcc4da4681b368b59ed63cb960f6`. Reports and receipts in
[`docs/evidence/reviews/0.3.27/iteration-3-ee544e2a/`](../reviews/0.3.27/iteration-3-ee544e2a/) (kept as the record).
Gate: `bash scripts/ci.sh fast` on this candidate stopped at the operations check (`check-ops`): the Inbox
auto-connect's catches, from the home's branch, did not say why they were right; fixed in `0d7eefb2` (comments only).
Its outcome on the next candidate is in run ten's section.

34 findings, 7 blocking: UX-74, UX-75, ER-81, ER-82, DO-75, DA-56, DA-57. Two are this release's own fixes going wrong: DA-49's
redaction ran over a transcript's saved state as text and broke its JSON (ER-81, DA-56), and UX-69's hover fix took the
CEO head's second row out of the drag region (UX-74). The others: a task given with a found session was dropped on the
way to Switchboard (UX-75); the update installer did not see the Fabric launchd started (DO-75) and promised a logout or
a restart would apply an update while «Служба доски» keeps Fabric running (ER-82); the CHANGELOG promised redaction of
any key (DA-57). Each is fixed in the next candidate, the code ones with a test watched red with the fix taken out (the
installer's predicate by its unit test; its wait loop is not run end to end here). What is carried is in CO-620
(7) to (10).

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3R9-UX-74 | UX-74 | blocking | fixed: UX-69's no-drag on the head's runner line and state is taken back, so the whole head drags again; the runner's hover is ruled into CO-620 (5) (test «the head's name, runner line and state are never held out of the drag», watched red with the rule back) |
| V3R9-UX-75 | UX-75 | blocking | fixed: a found session with a task opens a new console in its project with that task; a task is never passed to Switchboard (refused); a refusal for a found session says Fabric found it (`ceoTools.ts#resume`; test «run nine: a found session with a task…», watched red) |
| V3R9-UX-76 | UX-76 | non-blocking | fixed: the brief's rule holds only when a word stands alone as an address; inside a phrase a word keeps its meaning (`ceoAddress.ts#ceoAddressRule`, reader `ceo`) |
| V3R9-UX-77 | UX-77 | non-blocking | fixed: a project whose own name is an address word is searched as that project (`knowledgeTools.ts#search`) |
| V3R9-UX-78 | UX-78 | non-blocking | fixed: the voice's descriptions and operation list leave out `index.refresh` and `index.rebuild`; the refusal answers `reason` (test «run nine: the voice's knowledge tools do not offer…») |
| V3R9-UX-79 | UX-79 | non-blocking | fixed: the voice instructions say ids are for the tools and a task is named by its title (`ceoVoice.ts#voiceInstructions`) |
| V3R9-UX-80 | UX-80 | non-blocking | fixed in part: a restore's removal no longer counts as a no (`board.ts` `saidNo`, `removed_by`); Fabric's own late withdrawal is ruled: CO-620 (7) |
| V3R9-ER-81 | ER-81 | blocking | fixed: a transcript's state is redacted value by value, so its JSON stays whole, and a state that does not parse is read again from the start (`estateIndex.ts#redactState`, `estateSources.ts#readTranscript`; test «run nine: a prompt ending in NAME_KEY=…», watched red as run nine's probe) |
| V3R9-ER-82 | ER-82 | blocking | fixed in the promise: the installer and `release-mac.md` say that with «Служба доски» on Fabric runs through a Quit, a logout and a restart, so it is turned off and then Quit; staging before the check and the silent drop are ruled: CO-620 (9) |
| V3R9-ER-83 | ER-83 | non-blocking | fixed: the guard compares the operation trimmed and lowercased (`index.ts`) |
| V3R9-ER-84 | ER-84 | non-blocking | ruled: CO-620 (7); a restore's removal is fixed as UX-80 |
| V3R9-ER-85 | ER-85 | non-blocking | ruled: CO-620 (8) |
| V3R9-ER-86 | ER-86 | non-blocking | fixed: run nine's rows say what of ER-69 and ER-70 is left and CO-620 (7) and (9) carry it |
| V3R9-DO-75 | DO-75 | blocking | fixed: the installer finds Fabric by its executable as well as its command line, so launchd's `Fabric --background` copy is seen (`scripts/lib/install-mac-update.mjs#fabricRunning`; test «a Fabric launchd started is seen by its executable…») |
| V3R9-DO-76 | DO-76 | non-blocking | fixed: as UX-80; AGENTS.md says a restore's removal does not count |
| V3R9-DO-77 | DO-77 | non-blocking | fixed: the Inbox lifecycle row and the CHANGELOG bullet say a Disconnect stops it until the person connects again |
| V3R9-DO-78 | DO-78 | non-blocking | fixed: as UX-78 |
| V3R9-DO-79 | DO-79 | non-blocking | fixed: the HANDOFF says the prototype and journey gaps were fixed after run eight |
| V3R9-DO-80 | DO-80 | non-blocking | fixed: as DA-57 |
| V3R9-DO-81 | DO-81 | non-blocking | fixed: `estateWiring.ts`'s header says removed and built again, 5 s apart |
| V3R9-DO-82 | DO-82 | non-blocking | fixed: SCN-191 states the order, the ids and the capped count |
| V3R9-DO-83 | DO-83 | non-blocking | fixed: the voice-board test's projects have neutral names |
| V3R9-DO-84 | DO-84 | non-blocking | fixed: MERGES says 42 commits, 39 without merges |
| V3R9-DA-56 | DA-56 | blocking | fixed: as ER-81 |
| V3R9-DA-57 | DA-57 | blocking | fixed: the redactor knows xAI, Stripe, Hugging Face, Supabase and Telegram bot keys (`redact.ts`; test «removes an xAI, Stripe…»), and the CHANGELOG and `ceo-setup.md` §3 say only keys of a known shape are caught; schema 3 is first released in 0.3.27, so no second bump is needed |
| V3R9-DA-58 | DA-58 | non-blocking | fixed: as ER-83 and UX-78 |
| V3R9-DA-59 | DA-59 | non-blocking | ruled: CO-620 (10), the owner's to say |
| V3R9-DA-60 | DA-60 | non-blocking | fixed: `ceo-setup.md` §3 names tasks, notes, board messages, memory facts, other sources' records and every context |
| V3R9-DA-61 | DA-61 | non-blocking | ruled: CO-620 (8) |
| V3R9-PL-61 | PL-61 | non-blocking | fixed: run eight's section says the agreement was made between the two sessions in Claude Code's messages, and that `85e5af41` is Inbox's ask |
| V3R9-PL-62 | PL-62 | non-blocking | fixed: V3R8-PL-53 says the release session decided under the agreement and the owner did not answer CO-614 himself; the pause's sentence separates the owner's words from the agreement; the release close tells him the access change |
| V3R9-PL-63 | PL-63 | non-blocking | fixed: the ledger's opening names the later sources, the protocol names `4884bd84`, and «What 0.3.27 carries» points to `## 0.3.27` |
| V3R9-PL-64 | PL-64 | non-blocking | fixed: run eight's carried rows say «ruled: CO-620 (n)» |
| V3R9-PL-65 | PL-65 | non-blocking | fixed: V3R8-PL-58 disposes F2, F3 and F9, and CO-620 (5) names F7 and F8 |

Exit for run nine: every finding disposed above; superseded by run ten.

