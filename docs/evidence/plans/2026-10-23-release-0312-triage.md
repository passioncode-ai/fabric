# Fabric 0.3.12: the triage of every carried row

**Date:** 2026-10-23. **Owner:** P-25 ([backlog](../backlog.md)). **Why:** the 0.3.11 review (iteration 2, PL-2) found rows
moved from release to release up to five times without a decision, and P-25 opens with a triage that decides each carried
row before any is built: do it (in a named wave of a named release), re-rule it with a reason, or retire it. The
operator, 2026-10-23: «давай доделывай все сам автономно и выбирай лучшие решения для меня»; the decisions below are the
agent's on that instruction, chosen by the order the backlog keeps (actual prerequisites and integrity first, then the
operator's named places, then hardening), and open to the operator's review like any other.

**Scope.** Every open row ruled to 0.3.12: the rows of D-7's note in the
[carry-over register](../specs/2026-08-16-software-fabric-carryover.md) (CO-277 to CO-390 as listed there, CO-383's triage
half), the 0.3.11 review's rulings (CO-391 to CO-400, CO-405), the walk's moves (CO-401), CO-386, CO-388, CO-402 and the
operator's ADR-0176 (CO-403, CO-404): 69 rows, 68 open and CO-377, which is done (`4f0e1d40`, Comms «Объявления»).

**How to read a ruling.** `0.3.12 W<n>` is a wave of 0.3.12 below; `0.3.13` and `0.4.0` name the release that decides
the row, with the reason; `retired` closes the row with the reason. A row keeps its words; this page is its ruling, and
the register's dated note points here. A row moved again later needs a new decision written beside it, never a silent
move.

## The waves of 0.3.12

| Wave | What | Rows |
|---|---|---|
| W1 | The operator's ADR-0176 and the protocol text it changes, and the asks waiting for an answer | CO-403, CO-404, CO-397, CO-399, CO-360, CO-383 |
| W2 | Project onboarding and the project page (D-6), with the places the walk named and their docs; a project's business on its page, which the board's wall between businesses is built on | CO-368, CO-369, CO-401, CO-391, CO-392, CO-393, CO-394, CO-395, CO-388, CO-307, CO-367, CO-329, CO-306, CO-313, CO-400 |
| W3 | The reads say when they stop, the waits have deadlines, and the gate can be trusted | CO-310, CO-405, CO-311, CO-312, CO-314, CO-370, CO-373, CO-374, CO-375, CO-386, CO-390, CO-284, CO-379, CO-332, CO-346, CO-347, CO-352, CO-353, CO-363 |

## 0.3.13: the contract's repin and one schema step

Two batches that each touch many files of one kind and are safest done once, after 0.3.12's surface has landed:

| Batch | Why not 0.3.12 | Rows |
|---|---|---|
| The contract's repin: Fabric adopts fabric-agent-contract at its current head in one change | each row says "at the contract's next repin"; doing them one by one repins three times | CO-396, CO-402, CO-339, CO-343, CO-345, CO-354, CO-359, CO-331 |
| Projection integrity, one schema step: every fix that needs a migration ships in one schema version with its rehearsal | each schema step is a manual outage today (CO-364); one step instead of six | CO-340, CO-341, CO-342, CO-355, CO-356, CO-357, CO-358, CO-398 |

## 0.4.0 (P-16, agents first)

| Row | Reason |
|---|---|
| CO-364 | An upgrade that applies its own schema step is the self-updater's work (P-12, 0.4.0): Fabric replaces its bundle and migrates in one move. Until then the runbook's step stays and 0.3.13's single step keeps the outage to one |
| CO-277 | `supabase db reset` is in no upgrade path (the runbook uses `supabase migration up`); what is left is the stack Fabric starts refusing the CLI's reset, which belongs with CO-364's automated upgrade |
| CO-336 | The hub as a caller of jobs is P-16's agents-first work (the hub calls agents), not a 0.3.x surface |
| CO-372 | The share flow (CX-FAB-04) is a new surface of 0.4.0's sharing; nothing in 0.3.12 writes share grants |
| CO-326 | What remains (Hermes's model key) comes with the agents of CO-220 as runners (P-06.1); the PATH half is done (ADR-0169) |
| CO-365 | The login item is on since 0.3.7; whether it starts Fabric after a reboot is measured at the next real reboot, which an agent cannot cause. The measurement is owed at the first reboot after 0.3.12 is installed; the row stays open until then |
| CO-366 | Excessive disk writes need a profile of the PTY read path under real sessions; 0.4.0's console work rewrites that path (P-13) |
| CO-308 | Comms search past its budget and the board-wide page aggregation are board scale, decided with COM-02's durable board in lane 13 |
| CO-315 | Only a 0.3.6 backup that lost its `board.json` is affected; no such backup is known on any install. Kept, not retired, because a restore that misnames a missing file is a data-honesty defect |
| CO-378 | Windows `/clear` matching: no Windows install is in use; decided with the Windows runner work of 0.4.0 |

## Re-ruled to its owners

| Row | Ruling |
|---|---|
| CO-371 | Both halves live in other repositories (fabric-agent-adapter's session hooks, fabric-agent-contract's board states). Fabric asked on the board on 2026-10-23 (thread `a5969ac5`, message `6ba8440a`); Fabric's own part is none until they answer. The row stays open with its home in those repositories, and W1's board triage (CO-360) tracks the answer |

## Retired

| Row | Reason |
|---|---|
| CO-293 | Not reproduced: the one 180 s survival after `exit 0` (2026-10-14, under load) never recurred; "a real Electron main process exits gracefully on SIGTERM" passed in the local fast gate under load on `339c44e1` (2026-10-15, 0.8 s) and in 0.3.11's gates. If it recurs, a new row with that run's evidence |

## Each row

| Row | Ruling | Note |
|---|---|---|
| CO-277 | 0.4.0 | with CO-364 |
| CO-284 | 0.3.12 W3 | `agent-surface.test.mjs` and `probe-fresh-vs-upgraded.mjs` ran green on disposable stacks for 0.3.11's final candidate; COM03-14's real-client smoke remains |
| CO-293 | retired | not reproduced |
| CO-306 | 0.3.12 W2 | the splash in the working language, with OF-37's display pass |
| CO-307 | 0.3.12 W2 | a project's last activity from its own events, with the project page |
| CO-308 | 0.4.0 | board scale, COM-02 |
| CO-310 | 0.3.12 W3 | each capped read says it stopped |
| CO-311 | 0.3.12 W3 | the stack start's own deadline |
| CO-312 | 0.3.12 W3 | Comms read marks bounded |
| CO-313 | 0.3.12 W2 | failure wording, with the display pass |
| CO-314 | 0.3.12 W3 | Retry-After honoured up to a stated ceiling |
| CO-315 | 0.4.0 | rare; kept |
| CO-326 | 0.4.0 | with P-06.1 |
| CO-329 | 0.3.12 W2 | Switchboard's two attribution rules, with project onboarding |
| CO-331 | 0.3.13 | the aliases, at the contract's repin |
| CO-332 | 0.3.12 W3 | the launch test under load, with CO-379 |
| CO-336 | 0.4.0 | agents first |
| CO-339 | 0.3.13 | the contract's resolver for enrollment |
| CO-340 | 0.3.13 | one schema step |
| CO-341 | 0.3.13 | one schema step |
| CO-342 | 0.3.13 | the migration ledger check, with the schema step |
| CO-343 | 0.3.13 | CT-66 adoption, at the repin |
| CO-345 | 0.3.13 | the console catalogue from the contract |
| CO-346 | 0.3.12 W3 | one budget per binding |
| CO-347 | 0.3.12 W3 | «Отключить» keeps a disconnected agent off the board too |
| CO-352 | 0.3.12 W3 | «Вернуть мой текст» clears on the next edit |
| CO-353 | 0.3.12 W3 | the revoked agent's name in the act |
| CO-354 | 0.3.13 | resolve's pending, at the repin |
| CO-355 | 0.3.13 | one schema step |
| CO-356 | 0.3.13 | with CO-355 |
| CO-357 | 0.3.13 | one schema step |
| CO-358 | 0.3.13 | one schema step |
| CO-359 | 0.3.13 | the adapter's rows, at the repin |
| CO-360 | 0.3.12 W1 | each named ask gets a Fabric row or an answer on its thread |
| CO-363 | 0.3.12 W3 | the resolve lane reuses its binding |
| CO-364 | 0.4.0 | with P-12 |
| CO-365 | 0.4.0 | measured at the first reboot after 0.3.12 |
| CO-366 | 0.4.0 | with P-13 |
| CO-367 | 0.3.12 W2 | repositories without a project are offered to onboarding |
| CO-368 | 0.3.12 W2 | an operator rule broken today; moved from W1 on 2026-10-23: Fabric has no notion of a project's business, so the wall needs the business field the project page (W2) adds |
| CO-369 | 0.3.12 W2 | with CO-368: the directory names a project by its repository when names collide |
| CO-370 | 0.3.12 W3 | the epochs age out together around 2026-11-15, before 0.3.13 |
| CO-371 | its owners | asked on `a5969ac5` |
| CO-372 | 0.4.0 | sharing |
| CO-373 | 0.3.12 W3 | a lapsed responder and a lapsed claim |
| CO-374 | 0.3.12 W3 | the stack watch's gaps |
| CO-375 | 0.3.12 W3 | tracking's leftovers |
| CO-377 | done | `4f0e1d40` |
| CO-378 | 0.4.0 | Windows runners |
| CO-379 | 0.3.12 W3 | the gate under load |
| CO-383 | 0.3.12 W1 | the three threads and DEC-0102's adoption get their answer |
| CO-386 | 0.3.12 W3 | with the journal's no-false-positive probe |
| CO-388 | 0.3.12 W2 | with the project page and the task page's «Назад» |
| CO-390 | 0.3.12 W3 | the sync says when it stops |
| CO-391 | 0.3.12 W2 | «Нужны вы» lists only the person's part, naming the asker |
| CO-392 | 0.3.12 W2 | Fabric stops reading quotas |
| CO-393 | 0.3.12 W2 | the agent page |
| CO-394 | 0.3.12 W2 | one place a task opens |
| CO-395 | 0.3.12 W2 | «Что делали агенты» as History |
| CO-396 | 0.3.13 | at the repin |
| CO-397 | 0.3.12 W1 | the protocol's board rule, with ADR-0176's text |
| CO-398 | 0.3.13 | the index, in the schema step |
| CO-399 | 0.3.12 W1 | the rules recorded at every `fabric_whoami` that changes them |
| CO-400 | 0.3.12 W2 | screens and flows, in the same change as each place |
| CO-401 | 0.3.12 W2 | the walk's items |
| CO-402 | 0.3.13 | at the repin |
| CO-403 | 0.3.12 W1 | ADR-0176 §1 |
| CO-404 | 0.3.12 W1 | ADR-0176 §2, §3 |
| CO-405 | 0.3.12 W3 | the reads' edges |

Counts, recomputed from this table: 0.3.12 W1 6, W2 15, W3 19 (40 in 0.3.12); 0.3.13 16; 0.4.0 10; its owners 1;
retired 1; done 1; 69 in all.

## Added on 2026-10-23: the board's asks

Wave 1 answered every ask CO-360 and CO-383 named, on its thread (the rows' statuses list each answer). Five asks
became rows, ruled here with the same rules:

| Row | Ruling | Note |
|---|---|---|
| CO-406 | 0.4.0 | agent templates, with agent creation |
| CO-407 | 0.3.12 W3 | `crossSessionInbound` behind a Settings switch |
| CO-408 | 0.3.13 | the stale contract pins, with the repin |
| CO-409 | 0.4.0 | the wake when nobody answers |
| CO-410 | 0.4.0 | a marketplace agent connected to a project |

CO-360 and CO-383 are resolved; the counts above keep the 69 rows the triage started with.

## Wave 2's spec (2026-10-23)

[The spec](../specs/2026-10-23-0312-w2-project-onboarding.md) orders wave 2 in six slices and decides its open
questions: one schema step in 0.3.12 (migration 123, a project's profile), the business wall on a name the profile
carries, people read from Git and never stored. It narrows CO-401: OF-40 and OF-37's display pass with a model move to
0.4.0.

## Moved on 2026-10-23, during wave 2

CO-307 moves from 0.3.12 W2 to 0.3.13's schema step: a project's last activity needs a journal read grouped by project,
an SQL function, and 0.3.12 keeps its one schema step for the project profile (migration 123).
