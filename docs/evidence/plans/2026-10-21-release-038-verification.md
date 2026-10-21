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

48 findings, 6 blocking. Two changed the patch: the per-project cap rise to 16 rested on evictions that happened on
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
| V1-37 | DA-8 | For the record, the bound itself: 16 changes no memory or bookkeeping ceiling. | not-a-defect: a note on the withdrawn bound |
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
