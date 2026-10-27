---
report: fabric-stability-debts
project: fabric
date: 2026-10-27
status: in-progress
---

# Fabric: stability and Windows debts, 2026-10-27

**Operator, 2026-10-27:** «проверим все долги, которые нам есть сейчас виситки, типа по поводу стабильности и
работоспособности этого проекта и также поддержки его на Windows. И давай все доделаем.»

The coordinator's frame (fabric-workspace, MD-18): this review runs beside the release plan, never instead of it. A debt
that keeps the next release from being usable joins that release; every other debt becomes a row with evidence and a
target. Windows debts keep MD-17's order: the Mac path first, Windows after OBS-277 and Q-A. The order of releases is
0.3.15 (P-30), then the release of 2026-11-05 (P-29), then the organization slice of 2026-11-21 (P-27).

Rows are the carry-over register's, [`docs/evidence/specs/2026-08-16-software-fabric-carryover.md`](../../evidence/specs/2026-08-16-software-fabric-carryover.md);
this page classifies them and records what this review changed. It does not restate a row's text.

## Fixed in this review (branch `fix/stability-wave`, lands after 0.3.15)

| Row | What was wrong | Fix | Proof |
|---|---|---|---|
| CO-454 | the heal of a half-up stack reported success while Docker still showed the database without rest or kong, so the watch healed again every try | after the heal Docker is asked once more; a database still half up throws `STACK_HEAL_FAILED` and the stack is said lost (`apps/desktop/src/main/stackHalfUp.ts`) | `apps/desktop/test/stack-half-up.test.mjs`, 13 pass; with the check removed, 2 fail |
| CO-439, part 1 | the running tasks read stopped at 500 rows with no order and passed as the whole set | the read is ordered oldest first (`moved_at`, then `id`) and a read at its bound is said as capped, so the receipt names `tasks` and their kinds keep their earlier tellings (`apps/desktop/src/main/abandonedSweepRun.ts#readRunningTasks`) | `apps/desktop/test/abandoned-sweep-run.test.mjs` «CO-439: …», watched failing before the fix; the file passes 83 of 83 |

CO-439's parts 2 and 3 stay open: part 2 needs a measured answer to whether a launch can put a person-moved task into
running with no claim; part 3 (the first sweep on the third pass) is kept on purpose, since a sweep in the first minute
would judge claims before the sessions that hold them have rejoined after a restart.

## Into the release of 2026-11-05 (P-29): they keep a release from being usable

| Row | Why it blocks use | Evidence today |
|---|---|---|
| CO-365 | after a reboot nobody knows whether Fabric comes back by itself | measured 2026-10-27: the Mac booted at 04:16 local (`sysctl kern.boottime`), the running Fabric started at 05:04 (`ps -o lstart`); whether the login item started any copy is not recorded. The next reboot is read against the operations log |
| CO-294, the start half | a Mac where Docker is not running at all is said, not started | `apps/desktop/src/shared/stackStartRetry.ts` waits up to 90 s for a Docker that is starting; a stopped engine is left to the person |
| CO-469, CO-477 | the home's journal reads have no index of their own and cost more than they need, on a journal already past 31 000 events | already targeted to P-29 by 0.3.15's review |

## Kept at their targets (not blocking the next release)

| Row | Target | Why it waits |
|---|---|---|
| CO-246, CO-364 | the organization slice (P-27), with self-update (P-12) | a schema step is a manual outage only when a release carries one; 0.3.14 and 0.3.15 carry none (schema 98) |
| CO-219 | the organization slice (P-27), the installation path | the warning above every screen stands in for the fix; the binding is the container engine's, machine-wide |
| CO-366 | 0.4.0 (P-16) | disk writes need attribution (PTY scrollback, sockets, the log) before a bound |
| CO-129 | before an operator is told a restore is safe to interrupt | no such statement ships |
| CO-264, CO-265, CO-461 | 0.4.0 wave 3, or the release with the next schema step | each needs a checked statement in the database, a migration |
| CO-315 | 0.4.0 (P-16) | a manifest field; a lost `board.json` is said wrongly, never restored wrongly |
| CO-248 | the next change to the PTY launch | needs a probe that fails the `terminal.opened@1` append and counts descriptors |

## Windows (after OBS-277 and Q-A, MD-17)

Measured 2026-10-27: `platforms.yml` builds, installs silently, starts and uninstalls Fabric nightly on `windows-latest`
(x64) and `windows-11-arm` (arm64), and its last five runs passed (`gh run list --workflow platforms.yml`); `ci.yml`
runs only on `ubuntu-latest`, so no unit or wire test ever runs on Windows.

| Row | What | Target |
|---|---|---|
| CO-267 | the Windows quit, stop and ACL paths are tested as pure functions only | the organization slice (P-27) |
| CO-250 | the native view host throws off macOS | before a Windows or Linux build is called complete |
| CO-378 | the `/clear` rename cannot match under `fabric-mcp.cmd` | 0.4.0 (P-16) |
| CO-257 | an uninstall leaves `enrollments/` behind | wave 8 of 0.4.0 |
| (new row) | `ci.yml`'s fast tier has no Windows job | with CO-267, the organization slice (P-27) |

## Next

Land `fix/stability-wave` after 0.3.15's tag (rebased on `main`), update CO-454 and CO-439 in the register under the
project lease, file the Windows CI row, and move CO-365 and the start half of CO-294 into P-29.
