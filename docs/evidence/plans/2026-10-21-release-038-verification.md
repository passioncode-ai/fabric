# Release verification: Fabric 0.3.8, the patch of the operator's audit, three independent iterations

Run `r-8db0598178fb`. The operator's rule (2026-10-03, plan row P-02, kept for every release): before the release,
three independent testing iterations across every level of the project, every finding fixed or ruled, and only then
the release. The operator asked on 2026-10-21 to check everything done for 0.3.7, gather the logs, errors, documents
out of step and anything half done or misread, build the fixes, and release. This ledger covers everything on `main`
since v0.3.7: the audit's fixes (CO-361, CO-335) and the renumbering of wave 4 to 0.3.9 (P-20, P-21).

## Protocol

The protocol is 0.3.5's, unchanged ([0.3.5 ledger, Protocol](2026-10-12-release-035-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.8/iteration-N/`.

## The audit that opened this release

The installed 0.3.7's operations log from 00:15 to 01:04 UTC on 2026-10-21: 336 warnings `mcp.notifications/initialized`
(an accepted notification, HTTP 202, read as `unknown`), 148 errors `tool.fabric.session.enroll` with no reason (typed
refusals, CO-335), 5 `com.submit` and 2 `com.list` the same. The machine: OrbStack stopped with «I/O error» three
times on 2026-10-20 with the disk under 1 GB (swap 45 GB, `fseventsd` 9 GB), and the startup failure named only the
missing Docker socket. A History sentence promised the agents' acts «в 0.3.8», which is now the patch. Two more came from
the board and the live data during iteration 1: Observatory's live check of `fabric.project.resolve` failed at the
access step (no ask of Fabric itself admitted `project.resolve`, thread `617c8cbe`, 00:32 UTC), and one Hermes in the
home folder had been refused as too broad every 30 s for three days (187 of 259 enrollment errors). The release lead's
sessions that ended on 2026-10-20 ended on 0.3.6, whose cap counted every project (fixed in 0.3.7, CO-334); on 0.3.7 the
Fabric project never held more than one session of the lead, so the per-project cap stays 8.

## Iteration 1

Five fresh reviewers, 2026-10-21, against `00f6596f` (`00f6596fb8ceff6676f4a857c6b7baf732da8ec6`), read-only in a detached checkout. Reports:
[UX](../reviews/0.3.8/iteration-1/2026-10-21-ux.md), [errors](../reviews/0.3.8/iteration-1/2026-10-21-errors.md),
[documents](../reviews/0.3.8/iteration-1/2026-10-21-docs.md), [data](../reviews/0.3.8/iteration-1/2026-10-21-data.md),
[plan](../reviews/0.3.8/iteration-1/2026-10-21-plan.md).

48 findings, 7 blocking. Two changed the patch: the per-project cap rise to 16 rested on evictions that happened on
0.3.6 (DA-1), so it is withdrawn and the cap stays 8; and Observatory's live check had failed at the access step
(PL-2), now fixed. The errors reviewer moved the shared checkout to `v0.3.7` for about a minute by mistake and restored
it (its report says so); no other report cites a file read in that minute.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | UX-1 (blocking) | Regression of the 0.3.5 UX-2 fix: on Windows and Linux the startup dialog names OrbStack again | fixed: `startup.diskLow` has a text per OS in both languages and the English fallback; the per-OS test builds the dialog with `freeDiskBytes: 0`; `startupFailure.test.ts` "a full disk is named" (watched failing with one text for every OS) |
| V1-2 | UX-2 | The free space is written as a machine number | fixed: `startupFailure.ts#diskLowLine`: decimal GB, the reader's number format («0,7»), never below 0.1 |
| V1-3 | UX-3 | On a full disk the dialog still leads with the wrong action | fixed: the disk line comes first and no longer says «then retry» |
| V1-4 | UX-4 | The disk is not named on the failure whose remedy says "This is almost always Docker" | fixed: the disk line also for a stack that timed out, and for an unclassified failure |
| V1-5 | UX-5 | The free space reaches neither the copied details nor the log | fixed: `main/index.ts`: the free space is in `startup-failure.log` and in the copied details |
| V1-6 | UX-6 | The scenarios were not amended for the new dialog behaviour | fixed: SCN-161 amended 2026-10-21 |
| V1-7 | UX-7 | The release notes do not say what moved out of 0.3.8 | fixed: CHANGELOG says what 0.3.7 promised for 0.3.8 comes in 0.3.9 |
| V1-8 | UX-8 | The История lede promises a version number, and this patch is the second time it had to be edited for it | fixed: История says «в одной из следующих версий» / "in a later version" |
| V1-9 | UX-9 | Release-note figures are not what was measured | fixed: «336 in 49 minutes», in the notes and the code comments |
| V1-10 | ER-1 (blocking) | The candidate fails its own docs gate: the plan still schedules CO-335 after the patch closed it. | fixed: `d637e870`: CO-335 left lane 12 and P-20; `check-plan-ids.mjs` exit 0 |
| V1-11 | ER-2 | Every typed refusal becomes coarse outcome `ok`, including the ones that say Fabric or the product failed. | fixed: `shared/toolOutcome.ts#refusalOps`: `outcome-unknown` is unknown, `hub-unavailable`, `product-credential-unavailable`, `product-error`, `internal` stay errors (`toolOutcome.test.ts`) |
| V1-12 | ER-3 | The disk line is gated to three causes and leaves out the two a full disk most plausibly lands in. | fixed: with UX-4 |
| V1-13 | ER-4 | The free-space reading reaches only the dialog, not the log or the copied details. | fixed: with UX-5 |
| V1-14 | ER-5 | The disk number is honest about what it measures but not in the units or the reference the person will check against. | fixed: decimal GB (1e9); the disk measured is the data volume, said in SCN-161 |
| V1-15 | ER-6 | The cap rise to 16 has no test that would fail at 8, and it moves the eviction threshold without changing who is evicted. | fixed: the cap rise is withdrawn: the per-project cap stays 8 (DA-1 measured the cause on 0.3.6, already fixed by CO-334) |
| V1-16 | ER-7 | A 202 with an unreadable body is now read as accepted. | fixed: only a 202 with no bytes is `returned`; a 202 with an unreadable body stays `unknown` (`toolTrace.ts`, `toolOutcome.test.ts`) |
| V1-17 | ER-8 | Renumbering wave 4 to 0.3.9 is not complete in the living plan. | fixed: README, P-19 and CO-335 say 0.3.9 / resolved in 0.3.8 |
| V1-18 | DO-1 (blocking) | The docs gate is red: CO-335 is resolved but the general plan still schedules it. | fixed: with ER-1 |
| V1-19 | DO-2 | CO-335's version column says 0.3.9 while its status says resolved in 0.3.8. | fixed: CO-335's version column says 0.3.8 (resolved there) |
| V1-20 | DO-3 | The wave-4 renumbering is incomplete in living registers and plans. | fixed: P-19, the plan README, CO-291 (via P-20), the onboarding banner read 0.3.9 or name the renumbering |
| V1-21 | DO-4 | The newest handoff sends the next agent to "Fabric 0.3.8 (P-20)". | fixed: the handoff's 2026-10-21 update names P-21 and then P-20 |
| V1-22 | DO-5 | The release notes promise to readers of 0.3.7 two things "in 0.3.8" that 0.3.8 does not ship, and the Unreleased section does not say they m | fixed: with UX-7 |
| V1-23 | DO-6 | The cap's decision record still says 8. | fixed: the cap stays 8, so ADR-0134 holds; the access ask is ADR-0166's 2026-10-21 note |
| V1-24 | DO-7 | The ledger says the lead's "board session" was evicted at the 8-session cap. | fixed: the ledger's audit section is corrected: the endings were on 0.3.6 |
| V1-25 | DO-8 | "336 an hour" is 336 in 49 minutes. | fixed: with UX-9 |
| V1-26 | DO-9 | The record of the typed-refusal fix cites a test that does not cover the recording. | fixed: `refusalOps` carries the mapping and has its own test; the over-4 KiB refusal stays an error with no code, as before, said in CO-335 |
| V1-27 | DO-10 | The disk line says "GB" for GiB, and its comment says "read once" inside the retry loop. | fixed: decimal GB; the free space is read once per failure, before the dialog loop |
| V1-28 | DO-11 | The design map's 0.3.8 entry links no anchor of what changed. | fixed: the map's 0.3.8 entries link SCN-161 and the ledger |
| V1-29 | DO-12 | Three changed files gained no region marker. | fixed: regions `audit-038-trace`, `audit-038-disk`, `audit-038-backoff` |
| V1-30 | DA-1 (blocking) | The release notes give the cap raise a cause the live data contradicts. | fixed: the cap rise and its cause are withdrawn from the notes, CO-361, P-21 and the ledger |
| V1-31 | DA-2 | The trace change relabels lines; it removes none, and the 20 000-line log holds hours. | ruled: CO-362 (0.3.9): the 20 000-line log holds hours; size it by time |
| V1-32 | DA-3 | One stuck poller is most of what the patch relabels, and it never stops. | fixed: `main/fabricMcp.ts#backoffFor`: a lasting refusal doubles to 30 min (`fabric-mcp.test.mjs`, watched failing) |
| V1-33 | DA-4 | A typed code that reports a failure or an unknown is now traced `outcome: ok`, and the write path has no test. | fixed: with ER-2 |
| V1-34 | DA-5 | The disk line covers three causes and not the timeout, and a disk running out while Fabric runs is still unnamed. | fixed: with UX-4; a disk running out while Fabric runs is CO-362 |
| V1-35 | DA-6 | The upgrade runbook says nothing about 0.3.8. | fixed: the runbook says 0.3.8 admits 94 with no step, and FROM has 94 for 0.3.7 |
| V1-36 | DA-7 | Two places still carry the old numbering or both numbers. | fixed: with DO-2 and DO-4 |
| V1-37 | DA-8 | For the record, the bound itself: 16 changes no memory or bookkeeping ceiling. | not a defect: a note on the withdrawn bound |
| V1-38 | PL-1 (blocking) | The docs gate is red at the candidate. | fixed: with ER-1 |
| V1-39 | PL-2 (blocking) | Observatory's live check of `fabric.project.resolve` failed on the installed 0.3.7 and the audit did not see it. | fixed: `shared/access.ts`, `main/accessService.ts`: `project.resolve` on `projects` asked of Fabric, allowed at once on the operator's machine (`hub-access-service.test.mjs`, watched failing); ADR-0166 note; Observatory told on `617c8cbe` |
| V1-40 | PL-3 (blocking) | The published 0.3.7 notes promise two things "in 0.3.8" that 0.3.8 does not ship, and 0.3.8's notes are silent. | fixed: with UX-7 |
| V1-41 | PL-4 | The board still tells every project that 0.3.8 is wave 4. | fixed: the correction posted on the release threads (Release close) |
| V1-42 | PL-5 | Renumbering leftovers in living registers and in the next agent's entry point. | fixed: with DO-3, DO-4 |
| V1-43 | PL-6 | OF-08 is neither measured nor re-homed. | ruled: OF-08 is the first task of 0.3.9 (P-20), its row says so |
| V1-44 | PL-7 | Other 0.3.7 Release close items are open and recorded nowhere. | ruled: CO-360 names SD-3 / MA-06 and the board asks; the workspace publication is in the Release close |
| V1-45 | PL-8 | The cap of 16 is a decision with no record and no test that would fail at 8. | fixed: with ER-6 |
| V1-46 | PL-9 | The audit relabels the refusals but does not say why they happened. | fixed: with DA-3: most of them were the Hermes in the home folder |
| V1-47 | PL-10 | The disk line has two honesty limits. | fixed: per-OS words and decimal GB; the volume measured is said in SCN-161 |
| V1-48 | plan:DO-1 | Rates and dates stated more exactly than measured. | fixed: with UX-9 |

Exit for iteration 1: every finding is fixed or ruled to a register row. Blocking findings open: none.

## Iteration 2

Five fresh reviewers, 2026-10-21, against `587b75c1` (`587b75c12557ca023aeb9ef5237e018b93339b1a`), read-only in a detached checkout that none of them moved. Reports:
[UX](../reviews/0.3.8/iteration-2/2026-10-21-ux.md), [errors](../reviews/0.3.8/iteration-2/2026-10-21-errors.md),
[documents](../reviews/0.3.8/iteration-2/2026-10-21-docs.md), [data](../reviews/0.3.8/iteration-2/2026-10-21-data.md),
[plan](../reviews/0.3.8/iteration-2/2026-10-21-plan.md).

41 findings, 14 blocking (many are one defect seen from several levels). Two changed the patch: the
`project.resolve` grant gated nothing, so revoking it in Settings withdrew nothing (ER-1, DA-2), and a coding agent the
person disconnected could take a fresh credential through the new lane (DA-3); both are fixed. The backoff decision is
narrowed: only a folder that is no project grows (to 10 minutes), because a denial and an unattached folder are the
person's to lift in Fabric and must be seen within a minute (UX-6). Five iteration-1 "fixed" dispositions did not hold
(V1-14, V1-20, V1-26, V1-33, V1-47); each is fixed here and its record now says what it claims.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V2-1 | UX-1 (blocking) | Settings names the new `project.resolve` grant as a tool Fabric does not know | fixed: `shared/access.ts#askLines` has a `resolve` line, `accessWords.ts` says it in both languages («узнавать, к какому проекту Fabric относится папка»); `accessWords.test.ts` "a project.resolve ask and grant" |
| V2-2 | UX-2 (blocking) | V1-14 and V1-47 do not hold: SCN-161 names neither the disk measured nor what the number leaves out, nor the unclassified failure | fixed: SCN-161's 2026-10-21 amendment names the volume of Fabric's data folder, the purgeable space macOS leaves out, Docker on another volume, and all five causes |
| V2-3 | UX-3 | The threshold is 3 GiB while the line shows decimal GB | fixed: `startupFailure.ts#LOW_DISK_BYTES` is 3e9; `startupFailure.test.ts`: 3.1 GB is room, 2.9 GB names the disk (watched failing at 3 GiB) |
| V2-4 | UX-4 | On a full disk the dialog says 0.1 GB, the log 0.0 GB | fixed: one formatter, `startupFailure.ts#freeDiskGb`, for the dialog, the copied details and the log; the 0.1 floor is gone (test watched failing) |
| V2-5 | UX-5 | "This disk" is not named, and the figure leaves out purgeable space | fixed: SCN-161 and the release notes say which volume is read and that Finder may show more on macOS; a reading while Fabric runs stays CO-362 |
| V2-6 | UX-6 | The growing backoff slows the person's own fixes to up to 30 minutes | fixed: `main/fabricMcp.ts#backoffFor`: only a folder that is no project grows (to 10 min); a denial and a folder not yet attached keep 60 s and 30 s; SCN-137 amended (`fabric-mcp.test.mjs`, watched failing) |
| V2-7 | UX-7 | No agent-facing text says how to ask for `project.resolve`; SCN-132 not amended | fixed: the `fabric.access.request` and `fabric.project.resolve` descriptions say how to ask (`main/hubTools.ts`); SCN-132 amended 2026-10-21 |
| V2-8 | ER-1 (blocking) | Revoking the `project.resolve` grant withdraws nothing: every binding is served the tool | fixed: `main/hubTools.ts`: `fabric.project.resolve` answers only while the binding holds a live `project.resolve` or `session.enroll` grant, else `access-required`; `board-surface.test.mjs` (watched failing) |
| V2-9 | ER-2 (blocking) | Settings describes the new grant as an unknown tool | fixed: with UX-1 |
| V2-10 | ER-3 (blocking) | V1-14 and V1-47 do not hold: SCN-161 does not name the volume | fixed: with UX-2 |
| V2-11 | ER-4 | The `failed` state retries every 3 s and never grows | fixed: `backoffFor`: `failed` doubles from 3 s up to a minute (`FAILED_CEILING_MS`; `fabric-mcp.test.mjs`) |
| V2-12 | ER-5 | Up to 30 minutes between a person's fix and the agent; a whoami during a connection attempt is lost | fixed: with UX-6: what the person can lift waits at most its 60 s or 30 s base, so a lost wake costs no more; AGENTS.md's row is corrected |
| V2-13 | ER-6 | `refusalOps` logs the board's `not_available` as ok | fixed: `shared/toolOutcome.ts#refusalOps`: `not_available` is `unknown`; `toolOutcome.test.ts` |
| V2-14 | ER-7 | The immediate lane mints a binding per ask and skips the disconnect check | fixed: the disconnect check is in (`accessService.ts`, `hub-access-service.test.mjs`, watched failing); the per-ask binding is ruled to CO-363 (0.3.9) |
| V2-15 | ER-8 | Agent-facing text is out of date: only session.enroll is said to be immediate; "the coding agent's act" for a service | fixed: the `fabric.access.request` description names both immediate asks; the allow notes say "recorded as your own act" |
| V2-16 | ER-9 | Two honesty edges of the disk line remain | fixed: with UX-3 and UX-5 |
| V2-17 | DO-1 (blocking) | V1-20 does not hold: CO-291, the onboarding-036 banner and CO-277 still say 0.3.8 | fixed: CO-291 and CO-277 say 0.3.9; the onboarding-036 plan gains a 2026-10-21 line (its 2026-10-20 line is kept as written) |
| V2-18 | DO-2 (blocking) | V1-14 does not hold: SCN-161 does not say which disk | fixed: with UX-2 |
| V2-19 | DO-3 (blocking) | V1-26 does not hold: CO-335 omits the 4 KiB limit and says every typed refusal is a warning | fixed: CO-335 states the 4 KiB read and which codes stay errors and which are unknown |
| V2-20 | DO-4 | "Under 3 GB" is not the threshold the code uses | fixed: with UX-3 |
| V2-21 | DO-5 | SCN-161 lists four causes; the code names the disk for five | fixed: with UX-2 |
| V2-22 | DO-6 | AGENTS.md's fabric-mcp row says 60 s for a denial and 30 min for a refused folder | fixed: the row says what the code does: no project to 10 min, a repeated failure to a minute, a 503 with Retry-After waited out |
| V2-23 | DO-7 | The ledger and the map count 6 blocking in iteration 1; there were 7 | fixed: the ledger and the map say 7 |
| V2-24 | DO-8 | The MERGES entry describes `00f6596f`, not the candidate | fixed: the entry lists the files this landing changes and drops `sessionEnroll.ts` |
| V2-25 | DO-9 | P-20 "after 0.3.7"; the final pass moves CO-335 to 0.3.9; the Now line says schema 89 | fixed: P-20 "planned, 0.3.9, after 0.3.8"; the final pass names CO-335 as closed in 0.3.8; the Now line says schema 94 |
| V2-26 | DA-1 (blocking) | The new grant is shown as a tool Fabric does not know | fixed: with UX-1 |
| V2-27 | DA-2 (blocking) | Revoking the grant revokes nothing | fixed: with ER-1 |
| V2-28 | DA-3 (blocking) | A disconnected coding agent gets a fresh credential through the new lane | fixed: with ER-7: refused as disconnected before any write |
| V2-29 | DA-4 (blocking) | V1-33 does not hold in full: `not_available` and the product codes log as ok; no write-path test | fixed: `refusalOps`: `product-unreachable`, `product-refused`, `product-outdated` are failed at error, `not_available` unknown; the write path is tested through `beginAttempt` (`test/tool-trace.test.mjs`, watched failing) |
| V2-30 | DA-5 | Every door ask of `project.resolve` mints a binding with a year-long grant | ruled: CO-363 (0.3.9): bound the lane like enrollment and sweep uncollected bindings |
| V2-31 | DA-6 | The backoff misses `failed` and ignores a 503's Retry-After | fixed: `failed` grows to a minute; a 503 with Retry-After is a cooldown (`fabricMcpClient.ts`, `fabric-mcp.test.mjs`, watched failing) |
| V2-32 | DA-7 | The line fires at 3.2 GB; the log can print 0.0 | fixed: with UX-3 and UX-4 |
| V2-33 | PL-1 (blocking) | V1-20 does not hold: the banner, P-20's status and CO-291 | fixed: with DO-1 and DO-9 |
| V2-34 | PL-2 (blocking) | V1-14, V1-47 and V1-26 cite records that do not say what they claim | fixed: with UX-2 and DO-3 |
| V2-35 | PL-3 | The threshold is in GiB | fixed: with UX-3 |
| V2-36 | PL-4 | CO-360 holds 3 of the open asks; five threads and the contract's audit are unrecorded | fixed: CO-360 names the five threads, thread `b0bdbfab` and SB-141's registry prerequisite |
| V2-37 | PL-5 | OF-08 is missing from P-20's list | fixed: P-20 names OF-08's first-session measurement; the 0.3.7 ledger's close is a dated record and stays as written |
| V2-38 | PL-6 | Switchboard has no registry entry; the 00:17 board message still says CO-339 in 0.3.8 | ruled: CO-360 records SB-141's registry prerequisite; the 0.3.8 publication message on thread `617c8cbe` corrects CO-339 to 0.3.9 (Release close) |
| V2-39 | PL-7 | The knowledge base still lists Fabric v0.3.6 | ruled: updated to the published version at this release's close (fabric-workspace `knowledge/products.md`, `roadmap.md`) |
| V2-40 | PL-8 | No hosted database-backed run for 0.3.7's tag or the candidate | fixed: `ci.sh full` runs locally on the iteration-2 candidate; its exit is in the ledger |
| V2-41 | PL-9 | The MERGES entry and a dated code comment are out of step | fixed: with DO-8; the comment dates the audit 2026-10-21 |

Exit for iteration 2: every finding is fixed or ruled to a register row. Blocking findings open: none.

## Iteration 3

Five fresh reviewers, 2026-10-21, against `9b309b04` (`9b309b04d72b723a2284a9d994509e80cdce6509`), read-only in a detached checkout that none of them moved. Reports:
[UX](../reviews/0.3.8/iteration-3/2026-10-21-ux.md), [errors](../reviews/0.3.8/iteration-3/2026-10-21-errors.md),
[documents](../reviews/0.3.8/iteration-3/2026-10-21-docs.md), [data](../reviews/0.3.8/iteration-3/2026-10-21-data.md),
[plan](../reviews/0.3.8/iteration-3/2026-10-21-plan.md).

22 findings, 5 blocking, and they are two defects. The iteration-2 narrowing of the backoff still let a
detached or ambiguous folder grow to 10 minutes, though the notes promised a person's fix is seen within a minute
(UX-1, ER-1, DO-1): now only the too-broad refusal grows, the one nothing in Fabric lifts. And iteration 2 said a
local full gate would be recorded and did not record it (DO-2, PL-1): it is recorded here. The data level found
nothing blocking; the decisions the brief asked about (the live-grant gate, the disconnected agent, refusal levels
by code, the decimal disk line, the cap of 8, the renumbering) hold at every level.

Local full gate on the iteration-3 candidate: `bash scripts/ci.sh full` at `9b309b04`, exit 0, "full tier green",
the disposable test stack created and removed (the live stack on 54321/54322 was not addressed). Hosted `ci` on
`9b309b04`: run 39558930042, success. The workspace publication run 39558930029 failed as stale, which it is until
the publication after landing (the same as 0.3.7).

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V3-1 | UX-1 (blocking) | A detached or ambiguous folder waits up to 10 minutes; V2-6 does not hold, a regression from 0.3.7 | fixed: `main/fabricMcp.ts#backoffFor`: only the too-broad refusal grows (`LASTING_NO_PROJECT`, checked against `sessionEnroll.ts#TOO_BROAD_MESSAGE`); a detached or ambiguous folder and a failed Git read keep 30 s; the run loop counts repeats per refusal; `fabric-mcp.test.mjs` (watched failing); CHANGELOG, SCN-137, AGENTS.md say so |
| V3-2 | UX-2 | With 2.95 to 3.0 GB free the line says "3.0 GB" | fixed: `startupFailure.ts#freeDiskGb` rounds down to a tenth (`startupFailure.test.ts`, watched failing) |
| V3-3 | UX-3 | A binding refused by `fabric.project.resolve` reads texts meant for other asks | fixed: the binding's `fabric.access.request` description names the two asks allowed at once; a failed allow says "the local allow"; the allow note for an asker that already holds a credential is ruled to CO-363 (0.3.9) |
| V3-4 | UX-4 | A 503 cooldown is told to the agent as HTTP 429 and "rate limited" | fixed: `classifyFailure` reports the status the hub answered; the cooldown text says "Fabric asked to wait" (`fabric-mcp.test.mjs`) |
| V3-5 | ER-1 (blocking) | V2-12 and part of V2-6 do not hold: a person's fix of a detached folder is not seen within a minute | fixed: with UX-1 |
| V3-6 | ER-2 | A Git read that failed once lands in the growing wait | fixed: with UX-1: only the too-broad refusal grows |
| V3-7 | ER-3 | A 503 with Retry-After is reported as HTTP 429 | fixed: with UX-4 |
| V3-8 | ER-4 | The `project.resolve` lane skips the "is the runner installed" check | fixed: `accessService.ts`: an uninstalled coding agent is refused before anything is journalled (`session-enroll-request.test.mjs`, watched failing) |
| V3-9 | ER-5 | A failed allow of `project.resolve` says "local enrollment" | fixed: it says "the local allow could not be recorded" |
| V3-10 | DO-1 (blocking) | The backoff promise is false for undoing a detach; V2-6 and V2-12 do not hold | fixed: with UX-1; the code comment, the test names, the notes and SCN-137 say what the code does |
| V3-11 | DO-2 (blocking) | V2-40 does not hold: no `ci.sh full` exit is recorded | fixed: `bash scripts/ci.sh full` on `9b309b04`: exit 0, "full tier green", the disposable stack removed (recorded in this section) |
| V3-12 | DO-3 | CO-361 still says a lasting refusal waits up to 30 min | fixed: CO-361 says 10 min for a too-broad folder, a minute for a repeated failure |
| V3-13 | DO-4 | Both SCN-161 amendments sit under the next section; Coverage leaves out the disk line | fixed: the amendments are inside SCN-161 and its Coverage names `startupFailure.ts`, `index.ts` and the test |
| V3-14 | DO-5 | The OF-08 row contradicts itself | fixed: the row says it is not measured yet and is the first task of 0.3.9 |
| V3-15 | DO-6 | The MERGES entry lists a `platformWords` test this release does not change | fixed: the entry lists the tests this landing changes |
| V3-16 | DA-1 | CO-361 says 30 min; a code comment says 2,758 where the log has 2,757 | fixed: CO-361 corrected; the comment says 2,757 |
| V3-17 | DA-2 | A running coding agent keeps its old `fabric-mcp` until restarted, and the notes do not say so | fixed: CHANGELOG and SCN-137 say a running agent keeps its old `fabric-mcp` until it is restarted |
| V3-18 | DA-3 | MERGES lists a `platformWords` test | fixed: with DO-6 |
| V3-19 | PL-1 (blocking) | V2-40 does not hold: no full CI exit is recorded | fixed: with DO-2 |
| V3-20 | PL-2 | The ledger has no Release close yet several rows point to it | ruled: the Release close is written after the tag, as in 0.3.7; it carries the publish time on thread `617c8cbe` with CO-339 at 0.3.9, Observatory's re-check, the note to Switchboard (SB-141, CO-360), the knowledge base rows and the workspace publication |
| V3-21 | PL-3 | The board correction on `bb87af23` says "up to 30 minutes" | ruled: corrected in the 0.3.8 publication message on the release threads (Release close) |
| V3-22 | PL-4 | The 10-minute wait covers detached and ambiguous folders | fixed: with UX-1 |

The reviewers read `9b309b04`; their fixes are one commit after it, `0b8dd7cb` (`0b8dd7cbb032bc0d0cadef1a7ae81220d1e9df34`), the final candidate, on
which `ci.sh fast` passed before landing.

Exit for iteration 3: 22 findings dispositioned; the final candidate `0b8dd7cbb032bc0d0cadef1a7ae81220d1e9df34` is `verifiedCommit`. Blocking findings open: none.

## Release close: state on 2026-10-21

- **Published.** [v0.3.8](https://github.com/passioncode-ai/fabric/releases/tag/v0.3.8) at 2026-10-21 08:22:43 UTC
  (measured `gh release view v0.3.8`: prerelease, 14 assets), tag on `a3b8d9b4`; release run 39566358959 green (guard,
  preflight, macOS, Windows x64 and arm64, Linux x64 and arm64, publish). Hosted `ci` on `a3b8d9b4`: run 39565129396,
  success.
- **Installed on the operator's Mac.** The universal DMG matched `SHA256SUMS`; `spctl` reads "Notarized Developer ID";
  `/Applications/Fabric.app` is 0.3.8 (`CFBundleShortVersionString`), the 0.3.7 bundle kept outside `/Applications`.
  The running process is still 0.3.7: the operator opened it, so the lifecycle broker answers `in_use_by_person`
  (`taken_over_by_person`) to a restart and the next quit and open of Fabric runs 0.3.8. No database step: schema 94.
  Between 0.3.7 and 0.3.8 no dependency, preload or IPC changed (`git diff v0.3.7 v0.3.8 --stat`), so a window the old
  process opens from the new bundle meets the same contract.
- **Running coding agents** keep the `fabric-mcp` they started with until each is restarted (iteration 3, DA-2).
- **Board.** The publication message on thread `617c8cbe` (Observatory: `project.resolve` is live in 0.3.8, rerun the
  live check after the restart; CO-339 is 0.3.9) and on the three release threads (0.3.8 published; the backoff is
  10 minutes for a too-broad folder, not the 30 minutes the earlier correction said). Switchboard's SB-141 needs a
  registry entry in Fabric before its `project.resolve` ask is admitted (CO-360).
- **Knowledge base and workspace.** fabric-workspace `knowledge/products.md` and `roadmap.md` move from v0.3.6 to
  v0.3.8; the workspace publication follows the landing.
- **Open after the release:** OF-08's measurement is the first task of 0.3.9 (P-20); CO-360, CO-362 and CO-363 are
  0.3.9.
