# Release verification — Fabric 0.3.2, the full-audit fix release: three independent iterations

Run `2026-10-06-release-032-verification`. The operator's rule (2026-10-03, plan row P-02, kept for every release):
before the DMG and the release, three independent testing iterations across every level of the project, every
finding fixed, and only then the release. This file is the ledger for **Fabric 0.3.2** — plan row
[P-11](../backlog.md#general-development-plan): the fixes from the
[full audit of the 0.3.2 candidate `e19e1b9e`](../../reports/2026-10-05-release-032-audit/README.md) plus what landed on `main`
after 0.3.1 (schema 79, usage counts, Kilo/Hermes/Cline runners). 0.3.1 was cleared by its own ledger,
[2026-10-04-hub-verification.md](2026-10-04-hub-verification.md).

## Protocol

The protocol is 0.3.1's, unchanged ([hub ledger, Protocol](2026-10-04-hub-verification.md#protocol)):

- **Independent** — each iteration is read by fresh reviewer agents that have not seen an earlier iteration's
  findings or fixes; they read the product and the code first, and a finding an earlier iteration closed is
  checked again, not skipped.
- **Levels**, one reviewer each: scenarios, UX and UI (UX-n); errors and boundaries (ER-n); code ↔ documentation
  (DO-n); data, memory, orchestration, harness (DA-n); plan and roadmap (PL-n).
- **A finding** gets an id `V<iteration>-<n>`, its source, evidence and a disposition: **fixed** (with the test that
  now catches it, its planted defect watched), **ruled** (a register id and the reason it is not a release blocker),
  or **not a defect** (with the measurement).
- **Exit** — the release proceeds only after iteration 3 ends with zero open findings marked blocking.

Reviewers work read-only in a detached checkout of the candidate. Their reports are committed as written, with
machine paths replaced by `<scratchpad>/`, `<worktrees>/` and `~/`; their probes and screenshots stay outside
the repository (the operator's rule of 2026-10-06: media does not go into git). Iteration 3's reports are
committed under `docs/evidence/reviews/0.3.2/iteration-3/`, because after `verifiedCommit` the release gate admits
review artifacts only under `docs/reports/` or `docs/evidence/reviews/` (0.3.2 verification PL-9).

## Iteration 1

Five fresh reviewers, 2026-10-06, against `35b884c8` (`35b884c8a265d1999b8ec25e9c2bbf08fe9f389c`, the head of
`agent/release-032-candidate`). Reports:
[scenarios/UX/UI](2026-10-06-release-032-verification/iteration-1/2026-10-06-ux.md) (UX-n, 2 blocking + 12),
[errors and boundaries](2026-10-06-release-032-verification/iteration-1/2026-10-06-errors.md) (ER-n, 1 + 9),
[code ↔ documents](2026-10-06-release-032-verification/iteration-1/2026-10-06-docs.md) (DO-n, 6 + 16),
[data, memory, orchestration, harness](2026-10-06-release-032-verification/iteration-1/2026-10-06-data.md) (DA-n, 2 + 9),
[plan and roadmap](2026-10-06-release-032-verification/iteration-1/2026-10-06-plan.md) (PL-n, 1 + 14).
72 findings; merged where two reviewers found one thing, they give the rows below. The ACP-area fixes were made
by a separate implementing agent in the same working tree, the rest in the main session; every "fixed" row's test
was run with the fix reverted in place and watched failing, then restored. **Blocking** marks what a reviewer
named blocking; none is ruled.

A process slip, recorded rather than hidden: the commit `35b884c8` itself edited
`docs/evidence/plans/task-pipeline-persistence-contract.md`, a guarded file, without an agent-sync lease. No other
holder existed (`agent_sync.py status`: no leases held, no other runs); every later guarded edit of this
iteration was made under the lease `release-032-registers`.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | PL-1, DA-8, DO-1, DO-3, DO-14 (blocking) | The 0.3.2 release notes omitted schema 78 → 79 and its one-way upgrade, usage counts on by default, the project board, the new runners and the rehearsal command; the runbook still targeted 78 | fixed: `CHANGELOG.md` 0.3.2 names each; `docs/launch/release-mac.md` upgrade section at 79 with `--from 78 --ref v0.3.2`; CO-198 extended to 79 |
| V1-2 | UX-2, DO-2 (blocking) | README and the Settings note called the counts anonymous and said no ids are sent; every event carries a shared installation id | fixed: README, `analytics.label`/`analytics.note` (en, ru), SCN-134 and `docs/ANALYTICS.md` name the id, version, OS and session id; `UsageCountsSetting.test.tsx` reads the new note. Whether counting may start before the person sees the switch is ruled CO-218 (V1-14) |
| V1-3 | DA-1, ER-1, DO-4 (blocking) | An ACP agent that exits on end of input left its tools running: the group was signalled only if the leader outlived the grace | fixed: `acpShell.ts` sweeps the agent's group on every end; `acp-shell.test.mjs` "ending a session ends the tools the agent started, even when the agent itself exits on end of input" and "the shell process: SIGTERM ends the agent and every tool in its group" (watched: "tool … is still running") |
| V1-4 | DA-2, DO-5, PL-14 (blocking) | Hermes, the only `acp-session` runner, takes no HTTP MCP, so its granted servers were dropped and the session launched anyway | fixed: one stdio bridge per granted server (`sessionBundle.ts` `grantsOverStdio`, `FABRIC_BRIDGE_HEADER`); a session whose grants cannot be carried is refused, exit 3; `acp-shell.test.mjs` "granted servers go with the surface over HTTP, and each through its own stdio bridge otherwise", `mcp-stdio-bridge.test.mjs` header tests, `session-bundle.test.mjs` (watched failing) |
| V1-5 | UX-1 (blocking) | Cline's CLI approves every tool by default, and Fabric showed it as "nothing to ask about" | fixed: Cline's row defaults to Ask (`--auto-approve false`), Bypass carries the warning; `agents.test.ts` "Cline asks before each tool unless the session is Bypass" (watched against the old row); `check-containment.mjs` admits only the `false` spelling |
| V1-6 | DO-6 (blocking) | A window whose renderer process died stayed blank: recorded, never reloaded | fixed: `rendererRecovery.ts` + `index.ts` reload a dead renderer, at most 3 times a minute, never on `clean-exit` or while quitting; `renderer-recovery.test.mjs` |
| V1-7 | PL-2 | The plan never named 0.3.2; no ledger; Now/Next described 0.3.1 | fixed: plan row P-11, this ledger, Now/Next; `release-gate.json` moves to 0.3.2 in the release commit |
| V1-8 | PL-3 | CO-179 and CO-206 were due "before 0.3.2" | ruled CO-179 (restyle is its own visual iteration) and CO-206 (needs a stalled-database probe no finding observed), both re-dated after 0.3.2 with the reason |
| V1-9 | PL-4 | The operator's request for Kimi, Goose, Gemini CLI, OpenCode and OpenClaw was recorded nowhere | fixed: CO-220 with the measured versions, ACP entry points and forced permission modes; lane 6 |
| V1-10 | PL-5, DO-7, DO-8 | Next-free lines stale (ADR-0119, CO-213); CO-213…217 above CO-212 | fixed: ADR index → ADR-0121 with the 0120 reservation named; carry-over → CO-222; CO-212 in order |
| V1-11 | PL-6, PL-7, DO-10 | A7-001 counted fixed while the exposure remains; "253 P2 and P3" deferred was 99 P2 + 153 P3 + one P1 | fixed: A7-001 re-disposed to CO-219 (`raw/dispositions.json`, regenerated list: fixed 22, deferred 254, duplicate 2); audit README §2–§4 recounted |
| V1-12 | PL-8 | CO-215/216's reasons did not fit the authority and privacy findings they carry | fixed: CO-215 names A7-012/015/016/025/027 and takes them first |
| V1-13 | PL-9 | No decision record covers analytics on by default | ruled CO-218: the operator's product and privacy decision; 0.3.2 makes every description true and changes no behaviour |
| V1-14 | PL-10 | P-10's task table was not a backlog source | fixed: `docs/backlog-sources.json` declares `docs/evidence/plans/2026-10-05-agent-support.md` (Tasks) |
| V1-15 | PL-11 | CO-196…198 read as if 0.3.1 had not shipped | fixed: each row's deadline names 0.3.2 (CO-198: the 78 → 79 rehearsal) |
| V1-16 | PL-12, PL-13 | `unified-plan.mjs check` exits 1 (584 uncovered); the organization roadmap does not name 0.3.2 | ruled CO-221: the derived queue is recompiled after the release; the roadmap is the knowledge-base update at release |
| V1-17 | PL-15 | P-09 said 11 analytics tests; there are 12 | fixed: "12 tests — counted 2026-10-06 by `node --test`" |
| V1-18 | UX-3, DO-20a | "Allow once" never showed "until when" on the Board: the detail closed on the re-read | fixed: the Board keeps a granted row (`BoardScreen.tsx` `grantedHere`, `ObligationActs` `grantedUntil`), time in the app's locale; `BoardScreen.test.tsx` "a one-time grant keeps its row and its "until"" (watched: 1 failed) |
| V1-19 | UX-4 | An answered row still offered "Next time" and "Waiting" | fixed: neither on a settled row; covered by V1-18's test |
| V1-20 | UX-5, DO-19b | Text typed while a save was in flight was lost when that save conflicted | fixed: the diff's side is the buffer (`seed`), carried across a second conflict; `EditorWindow.conflict.test.tsx` "what was typed while the conflicting save was in flight…" (watched) |
| V1-21 | UX-6 | A file deleted while open read as "changed on disk" | fixed: its own sentence, Close without saving / Save it again (`ABSENT_HASH`); `EditorWindow.conflict.test.tsx` "a file deleted while open says so…" (watched) |
| V1-22 | ER-5 | A second save during the first spent a second grant and showed a false conflict | fixed: one save at a time, buttons disabled while saving; `EditorWindow.conflict.test.tsx` "a second save while the first is in flight writes nothing" (watched) |
| V1-23 | UX-7, ER-6 | Errors outside React rendering were not recorded | fixed: `CrashBoundary.tsx` `installWindowErrorReporting` (`error`, `unhandledrejection`); `CrashBoundary.test.tsx` (watched) |
| V1-24 | UX-8 | The crash screen had no test, claimed "recorded", followed the OS language, showed React's minified text | fixed: app language via `<html lang>`, "sent the details", minified messages hidden; `CrashBoundary.test.tsx` (watched) |
| V1-25 | UX-9, DO-18 | The exposure warning sat only in a project's side column, could miss the startup check, pointed at a nonexistent "Settings → Diagnostics" | fixed: `StackExposureNotice` above every screen and in Diagnostics; `stack.exposure()` waits for a check in flight and re-checks after 5 min; SCN-073 reworded; `DiagnosticsSection.test.tsx` |
| V1-26 | UX-10 | A2-001 had no test; the view read a stale `running` | fixed: `pty-resize.test.mjs` (native stand-in throws EBADF after exit; watched); `TerminalView` reads `running` through a ref |
| V1-27 | UX-11, DA-5, DO-11 | A5-001's query direction and UUID guard were untested | fixed: `readSessionHistory` in `shared/sessionHistory.ts`; `sessionHistory.test.ts` "returns the newest 200 events…" (watched with ascending) |
| V1-28 | DA-6, DO-11 | A1-001's main-process half was untested | fixed: `resolutionsOf` in `shared/attention.ts`; `attention.test.ts` "what resolves a refusal (A1-001, main half)" (watched) |
| V1-29 | DO-20b | The "earlier events" note showed at exactly 200 events | fixed: the read takes one beyond the window; `mayHaveEarlier` measures it; `EstateAgents.test.tsx` |
| V1-30 | UX-13a, UX-13b | "in the journal" named nothing on screen; an unreadable switch looked off | fixed: the note says the session has earlier events the list leaves out; the box is `indeterminate`; `UsageCountsSetting.test.tsx` |
| V1-31 | UX-12, UX-13c, UX-13d | Main-process prompts English-only; no first-run test for the new rows; a second conflict repeats its sentence | ruled CO-221 |
| V1-32 | UX-14, ER-10 | `files.test.mjs` split its output on a literal backslash-n | fixed: the out-of-template escapes |
| V1-33 | DO-22 | `csp.test.mjs` fails in `pnpm test` on a fresh tree | not a defect: the probe reads the built page by design (a policy loosened for development is the one that ships), and `scripts/ci.sh` builds before it runs; its failure names the build step |
| V1-34 | ER-2 | Force stop and an early Ctrl-C bypassed the shell's cleanup | fixed: a detached reaper ends the group if the shell dies uncleanly; Ctrl-C before the session opens exits 130; `acp-shell.test.mjs` "a SIGKILL of the shell still ends an agent…" and "Ctrl-C at the sign-in prompt…" (watched) |
| V1-35 | ER-3 | An unhandled EPIPE crashed the shell when the agent died before reading | fixed: a stdin `error` listener, writes skipped once input is gone; `acp-shell.test.mjs` "a write to an agent that stopped reading is not a crash" (watched: `write EPIPE`) |
| V1-36 | ER-4, DA-4, DO-15 | The redactor missed ACP `{name, value}` headers, the bridge variable, escaped JSON, Python dicts | fixed: `redact.ts` `header-pair`, `api-key-field`, wider `assignment`; `redact.test.ts` nine shapes (three plants watched) |
| V1-37 | DA-3 | Ctrl-C during a permission question did not answer it cancelled | fixed: pending questions answered `cancelled`, then `session/cancel`; `acp-shell.test.mjs` (watched) |
| V1-38 | DA-7, ER-7 (A6-029), DO-21c | The bridge's end-of-input close had no test | fixed: `mcp-stdio-bridge.test.mjs` "the agent closing the bridge's input ends the HTTP session and the bridge" (watched) |
| V1-39 | DO-21b | The sign-in pick read typed-ahead input | fixed: `freshLine()`; `acp-shell.test.mjs` "the sign-in pick takes only a line typed after the methods are listed" (watched) |
| V1-40 | ER-7 (sender), ER-8, DO-19a, DO-20c, DO-21a | Sender check proven without Electron; unbounded synchronous read on save; BOM/line endings rewritten; digest past 50,000 rows; an agent ignoring cancel keeps its turn | ruled CO-221 |
| V1-41 | ER-9 | A packaged build trusted `ELECTRON_RENDERER_URL` as an app origin | fixed: `index.ts` `APP_ENTRY.devOrigin` is null when packaged |
| V1-42 | DA-9 | A non-uuid board id read as "unavailable" | fixed: `boardService.ts` refuses it as an unknown id before the door; `board-service.test.mjs` (watched) |
| V1-43 | DA-10, DA-11 | Three board functions skip the active-Project check; digest offset paging can skip a row | ruled CO-221: DA-10 needs migration 82 (schema 80); DA-11 needs >1000 matching rows and a concurrent change |
| V1-44 | DO-9 | SCN-134 had no index row | fixed: the row; `check-docs.sh` U003 gone |
| V1-45 | DO-12 | ADR-0119's 43.8% was 55.1% | fixed: ADR-0119 amendment 4 corrects it; the dated report keeps its number |
| V1-46 | DO-13 | ADR-0119 read as built where it is not (catalogue, probe-based "connected", quota gate) | fixed: amendment 4 "State at 0.3.2"; SCN-126 amended |
| V1-47 | DO-16 | Region markers pointed at a dated report; new files had none | fixed: `navigation-guard` → ADR-0020, `stack-exposure` → SCN-073, ACP regions → ADR-0119 amendments; regions on `CrashBoundary.tsx`, `sessionHistory.ts`, `rendererRecovery.ts`, `StackExposureNotice.tsx`; the remainder in changed files ruled CO-221 |
| V1-48 | DO-17 | CONTEXT.md described board responders and leases as built | fixed: both terms say what 0.3.2's board does not have yet (COM-03) |
| V1-49 | DO-11 (A7-003, A6-004) | The audit claimed watched tests for A7-003 and A6-004 that did not catch the real cases | fixed: V1-3 and V1-4; audit README §3 names the five and points here |

Fixes landed in `8d002f4d` (the iteration-2 candidate). Iteration 2 rechecked these rows; where one held only in
part, the remainder is an iteration-2 finding below (V1-1, V1-2, V1-6, V1-12, V1-15, V1-20, V1-25, V1-28, V1-41,
V1-42, V1-47, V1-48).

Exit for iteration 1: every finding above is fixed, ruled with a register id or not a defect, at `8d002f4d`. Blocking findings open: none.

## Iteration 2

Five fresh reviewers, 2026-10-06, against `8d002f4d` (`8d002f4dc00595e94bea58a96962bb8c6971ff98`), each forming its own
findings before reading this ledger and then rechecking the iteration-1 rows of its level. Reports:
[scenarios/UX/UI](2026-10-06-release-032-verification/iteration-2/2026-10-06-ux.md) (UX-n, 1 blocking + 9),
[errors and boundaries](2026-10-06-release-032-verification/iteration-2/2026-10-06-errors.md) (ER-n, 1 + 11),
[code ↔ documents](2026-10-06-release-032-verification/iteration-2/2026-10-06-docs.md) (DO-n, 1 + 14),
[data, memory, orchestration, harness](2026-10-06-release-032-verification/iteration-2/2026-10-06-data.md) (DA-n, 0 + 6),
[plan and roadmap](2026-10-06-release-032-verification/iteration-2/2026-10-06-plan.md) (PL-n, 1 + 9).
53 findings; three reviewers found the same upgrade-runbook defect (V2-1). The machine ran at load averages of
95–750 from other sessions during this iteration; reviewers worked in scratch copies and gave timing tests a retry.
One reviewer's helper wrote a byte-identical `files.ts` into `/tmp/x/`, outside the repository; one reviewer's
rsync overlapped another's scratch copy around 12:50 — neither touched the candidate checkout.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V2-1 | PL-1, DO-1, DA-3 (blocking) | The upgrade runbook wrote `pre-0.3.1.dump`, read `pre-0.3.2.dump`, demanded `--from 78` while the operator's database is at 75, and step 1 still described 0.3.0 → 0.3.1; followed literally, step 2 overwrote the operator's 184 MB backup | fixed `992602ff`: read the schema first, `--from FROM`, one new backup name that keeps `pre-0.3.1.dump`, 75 → 79 in one step stated. Seeded rehearsals on 2026-10-06 against `9372880b` (`node scripts/rehearse-upgrade.mjs --make-fixture N`, then `--from N --ref HEAD`): **PASS 75 → 79** and **PASS 78 → 79**, journal 6 → 6, no table lost rows, failures `[]`; receipts kept outside the repository |
| V2-2 | ER-1 (blocking) | Typing into the diff during a Keep-mine save was marked saved and its recovery copy cleared | fixed: the buffer after Keep mine is the diff's side; `EditorWindow.conflict.test.tsx` "typing into the diff during a Keep mine save stays unsaved and kept for recovery" (watched: 1 failed) |
| V2-3 | UX-1 (blocking) | Restoring a kept buffer over a changed file showed the disk text on both sides and lost the kept text — a regression of V1-20 | fixed: `restoredMine` is the diff's side once; `EditorWindow.conflict.test.tsx` "restoring a kept buffer over a changed file…" (watched: 1 failed) |
| V2-4 | UX-3 | Every conflict resolution threw Monaco's "TextModel got disposed…", now recorded as an error | fixed: the diff widget is disposed before its models; no jsdom test reproduces Monaco's model lifecycle (the stand-in has none) — checked by reading |
| V2-5 | UX-10 | "Close without saving" on a deleted file raised the unsaved-changes guard again | fixed: it sets the leaving flag and drops the kept copy; `EditorWindow.conflict.test.tsx` (watched) |
| V2-6 | ER-6 | A packaged build still loaded an inherited `ELECTRON_RENDERER_URL` into its windows | fixed: one `devServer()` (null when packaged) for loading and the guard; no test through a packaged app |
| V2-7 | ER-7 | Each startup Retry registered the process failure handlers again | fixed: installed once per process; no test through Electron |
| V2-8 | ER-10, UX-6, DO-6 | The exposure check never retried a failed first check, re-checked ~10 min apart while the notes said five, was drawn twice on a project page, said "Ports 54321 answered", showed backticks | fixed: a null result is re-checked; one banner above every screen; wording and notes corrected; `StackExposureNotice.test.tsx` |
| V2-9 | DA-2 | The private-history archive read the journal in one request capped at 1000 rows, so every larger estate's export was refused | fixed: `journalBySeq` pages on seq; `backup-paging.test.mjs` 2500 events (watched: 2 failed) |
| V2-10 | DA-4, DA-5 | An epoch past int32 read as "unavailable"; submit did not apply list/get's id rule | fixed: epoch bounded, thread and reply ids by `boardId`; `board-service.test.mjs` "submit refuses an epoch past int32…" |
| V2-11 | DO-2 | Two `CONTEXT.md` board terms were false (a projection; messages only) | fixed: stored rows beside the journal, only request states and read marks are projections; requests are stored `queued`, nothing claims them yet |
| V2-12 | DO-8, DO-15 | The CHANGELOG cited amendment 3 for redaction and said servers go to every agent; SCN-034 and `check-containment.mjs` wording | fixed: amendment 4; "every agent that connects to it"; SCN-034 names the BOM exception (CO-221); "THREE RULES" |
| V2-13 | DO-10 | The audit README's 59/55 were 60/54; two of the 13 carry qualifiers | fixed: a dated correction note in the README, the findings unchanged |
| V2-14 | DO-11, UX-5 | SCR-52 still said «анонимными»; SCN-091 had no amendment and "none yet" | fixed: the real label; SCN-091 amended with its coverage |
| V2-15 | DO-12, PL-4 | P-11's status, its carried list and iteration 1's exit line were stale | fixed: P-11 status and CO-215…222; iteration 1 closed above |
| V2-16 | DO-13 | The Settings note left out the session id, and its test passed whatever the note said | fixed: the note names the session id; `UsageCountsSetting.test.tsx` asserts both ids and no "anonymous" |
| V2-17 | PL-2 | P-11 sat in no lane | fixed: P-11 and P-12 in lane 2 |
| V2-18 | PL-3 | The plan said "P-08 remains Now" and described a recompile as done | fixed: the paragraph is marked superseded with the measured `unified-plan.mjs check` result; the recompile is CO-221 |
| V2-19 | PL-5 | P-10's plan still scheduled OpenClaw as a runner and did not cite CO-220 | fixed: the agent-support plan's note cites CO-220 and OpenClaw as a hub client |
| V2-20 | PL-7 | 0.3.2 crosses CO-212's deadline: restore ships with the board, and a restored estate loses board messages unsaid | ruled CO-212: re-dated to COM-02.3 with the reason; the release notes say the gap |
| V2-21 | PL-8 | CO-216 said none widens authority though it carries A7-025 and A7-027; CO-215 claimed them | fixed: CO-216 names them and takes them first; CO-215 keeps A7-012/015/016 |
| V2-22 | PL-9 | CO-199's premise was gone; CO-198 lacked the live-dump PASS | fixed: CO-199 re-ruled with the reason; CO-198 records `2932fbbd` |
| V2-23 | PL-10 | CO-218 had no deadline relative to a release | fixed: before 0.3.3 ships |
| V2-24 | DO-7 | The IPC sender check has no test through Electron | ruled CO-221 (already carried as ER-7 of iteration 1) |
| V2-25 | ER-2, ER-3, ER-4, ER-5, ER-8, ER-9, ER-11, ER-12, UX-2, UX-4, UX-7, UX-8, UX-9, DO-3, DO-4, DO-5, DO-9, DO-14, DA-1, DA-6, PL-6 | Each named in CO-222 with its reason | ruled CO-222 |

The fixes are in the commit that carries this section; `bash scripts/ci.sh fast` exited 0 on it on 2026-10-06
(the first fully green fast run of this release, at a load average of 6).

Exit for iteration 2: every finding above is fixed, ruled with a register id or not a defect. Blocking findings open: none.

## Iteration 3

Five fresh reviewers, 2026-10-06, against `3745f835` (`3745f835137cb74fb24cb4f2b2d17f4f3a6fbc39`), each forming its own
findings, then rechecking every iteration-1 and iteration-2 row of its level with the fix reverted in a scratch copy.
Reports, committed under `docs/evidence/reviews/` as the release gate requires after the verified commit:
[scenarios/UX/UI](../reviews/0.3.2/iteration-3/2026-10-06-ux.md) (UX-n, 1 blocking + 9),
[errors and boundaries](../reviews/0.3.2/iteration-3/2026-10-06-errors.md) (ER-n, 2 + 6),
[code ↔ documents](../reviews/0.3.2/iteration-3/2026-10-06-docs.md) (DO-n, 0 + 9),
[data, memory, orchestration, harness](../reviews/0.3.2/iteration-3/2026-10-06-data.md) (DA-n, 0 + 2),
[plan and roadmap](../reviews/0.3.2/iteration-3/2026-10-06-plan.md) (PL-n, 0 + 9). 38 findings; two reviewers found the
same take-disk defect (V3-1). Load average ~3–6. One reviewer deleted a stranger's `/tmp/x.2595.log` while removing
its own stray file; contents unknown, not recoverable — recorded, not hidden.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V3-1 | ER-1, UX-1 (blocking) | "Take the version on disk" kept the person's text, marked saved, and the next save overwrote the agent's version — the diff's cleanup (V1-20's change) wrote its right side back | fixed: `keepDiffSide` — closing the diff after Take-disk carries nothing back; `EditorWindow.conflict.test.tsx` "taking the version on disk leaves the disk text, clean, and a save writes nothing" (watched: 1 failed) |
| V3-2 | ER-2 (blocking) | Two permission questions in flight got each other's answers ("n" for a deletion allowed it) — the A7-007 fix put the newest question first | fixed: questions have their own first-shown-first-answered queue ahead of prompts; `acp-shell.test.mjs` "two questions in flight are answered in the order they were shown" (watched with the old order) |
| V3-3 | PL-1, DO-8 | P-11 and CO-198 still assumed a database at 78 | fixed: both name the installed schema (75 from 0.3.0, 78 from 0.3.1) |
| V3-4 | PL-2 | AS-03/AS-08 still scheduled OpenClaw as a runner; no task for the operator's four runners | fixed: AS-03/AS-08 carry Kimi Code, Goose, Gemini CLI, OpenCode (CO-220) and OpenClaw as a hub client |
| V3-5 | PL-3 | Fabric's rows and the organization roadmap did not name each other (RM-19, RM-05) | fixed in Fabric: P-12 names RM-19, CO-220 names RM-05; the roadmap's own text is ruled CO-221 (PL-13, the knowledge-base update at release) |
| V3-6 | PL-4 | Stale numbers: 602 uncovered (605 measured), the recount history, a run-together CO-198 sentence | fixed |
| V3-7 | PL-5 | P-11 and P-08 would publish as status `unknown` | fixed: "in progress — in verification", "done — released"; `normalizeStatus` reads both; P-08 left lane 2 |
| V3-8 | PL-6 | P-11's carried list omitted CO-179, CO-206, CO-212 | fixed |
| V3-9 | PL-7 | P-12 did not name CO-218 | fixed |
| V3-10 | PL-8 | DA-10's fix and the pipeline's reservation both pointed at migration 82 | fixed: CO-221 says which moves |
| V3-11 | PL-9 | Iteration-3 reports filed like iterations 1–2 would make the gate refuse the release commit; the runbook's ledger list stopped at 0.3.1 | fixed: protocol note above, reports under `docs/evidence/reviews/`, runbook lists 0.3.2's ledger and corrects the website fact's tense |
| V3-12 | DA-1 | `com.submit` passed participants and request targets un-normalised | fixed: lower-cased uuids; `board-service.test.mjs` "submit lower-cases the participants…" (watched) |
| V3-13 | DA-2, ER-5 (part) | A header pair written value first leaked | fixed: `header-pair-value-first`; `redact.test.ts` (watched); ER-5's YAML and spaced-Python spellings ruled CO-222 |
| V3-14 | DO-1, UX-6 | SCN-073 and comments still placed the warning in Diagnostics | fixed |
| V3-15 | DO-2, ER-7 | The failed-check retry had no test | fixed: `exposureNeedsCheck` in `stackExposure.ts`; `stack-exposure.test.mjs` "a read starts a check when none finished…" (watched) |
| V3-16 | DO-3, DO-4, DO-5 | CHANGELOG overstated who gets board tools and where the receipt holds; named the audited candidate wrongly | fixed: CHANGELOG and this ledger |
| V3-17 | DO-6 | The audit README's summary still said 59/55 | fixed: 60/54 with the qualifier |
| V3-18 | DO-7 | SCN-134 step 1 and `analytics.ts`'s header still left out the ids | fixed |
| V3-19 | DO-9 | CO-221 claimed the sender check was proven by a source probe | fixed: CO-221 says its wiring has no test |
| V3-20 | UX-3 | Take-disk stayed enabled during a Keep-mine save | fixed: disabled while saving; checked by reading (no test) |
| V3-21 | UX-5 | The usage switch stretched the Settings bar's buttons to ~340 px | fixed: the bar wraps and aligns to the top, the switch has a 42ch column; checked by reading the CSS (no render test) |
| V3-22 | UX-8 (V1-19) | Hiding "Next time" on an answered row had no test | fixed: `BoardScreen.test.tsx` A3-001 test asserts no Next time and no Waiting (watched) |
| V3-23 | UX-10 | FLW-40 did not trace SCN-134 | fixed |
| V3-24 | ER-3, ER-4, ER-5 (rest), ER-6, ER-8, UX-2, UX-4, UX-7, UX-8 (rest), UX-9 | Each named in CO-222 with its reason | ruled CO-222 |
| V3-25 | ER recheck, UX recheck | Two leftovers the rechecks named: no test pins the order "questions before prompts" when an agent asks outside a turn (the code is right); the comment at `main/index.ts` still says the warning shows in Diagnostics | ruled CO-222: ER-8's test-gap class and DO-3's wording class; code is not changed after the verified commit |

**Rechecks and the final candidate.** The fixes landed in `d8eb9ff5`. Each blocking finding was rechecked by the
reviewer who raised it, at that commit: ER-1 and ER-2 by the errors reviewer (both hold; each named test fails with
its fix reverted; its delete/read probe answers `delete=no read=yes`), UX-1 by the UX reviewer in real Monaco in
the built renderer (holds; the next write after Take-disk is the person's new edit on the disk text). `ci.sh full`
at `d8eb9ff5` then failed one owned-cluster suite, `run-ceo-private-archive-db`: its journal stand-in did not speak
the paged read V2-9 introduced. `e483fbdc` (`e483fbdca3de074cb69062a15f34c945b051e3b4`) changes only that stand-in and the design map; the data
reviewer rechecked it (no product code changed, the stand-in pages faithfully, its suite passes on its own
cluster, verdict 0 blocking). **`bash scripts/ci.sh full` exited 0 at `e483fbdc`** on 2026-10-06, the stack-backed
probes included, on a disposable stack. The rechecks are appended to the reports above.

Exit for iteration 3: every finding above is fixed, ruled with a register id or not a defect, rechecked by its reviewer at the final candidate `e483fbdc`. Blocking findings open: none.

