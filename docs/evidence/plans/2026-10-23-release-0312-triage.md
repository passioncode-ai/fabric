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

The table keeps the first ruling of each row; a row moved since names its new release in "Moved again" and "Each row" below.

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

## Moved again during 0.3.12 (a new decision for each)

| Row | From | To | Reason |
|---|---|---|---|
| CO-370 | 0.3.12 W3 | 0.3.13, the one schema step | Its three halves are SQL: staggering the epochs' age rotation (`board_epoch_gate`), `board_list` using the participants index, and replies addressed to the sender by default; 0.3.12 keeps its one schema step for the project profile (W2-2). BD-9 is low: a session that holds a closed epoch reads `com.status` and resends |
| CO-373 | 0.3.12 W3 | 0.3.13, the one schema step | The lease's expiry in the three waiting checks is a migration of `board_waiting_operator` by the row's own words, and a claim that lapses without a release moving its task back needs the projector; both belong with the 0.3.13 integrity step |
| CO-367 | 0.3.12 W2 | 0.3.13, with the tracking of turns | Attributing a commit or a turn in another repository to that repository's project needs the hooks' turn facts read per repository, which Fabric does not keep yet; it is one read with CO-375's «idle in the agent» and CO-329's activity rule |
| CO-329 | 0.3.12 W2 | 0.3.13, with the tracking of turns | Its first rule needs an owner list a Project carries (the profile of W2-1 has a business, not owners) and its second the same activity read as CO-367 |
| CO-375 | 0.3.12 W3 | 0.3.13, with the tracking of turns | «Idle in the agent» is the hooks' turns, read with CO-367; the eight finished tasks sit in other projects' boards and are moved by their own agents or the operator, not by Fabric's code; dropping the heartbeat rows of ended sessions goes with that read |
| CO-374 (its rest) | 0.3.12 W3 | 0.3.13 | The countdown and the notice in detached windows shipped in 0.3.12 (W3e); restarting PostgREST or Kong alone, while the database runs, is the stack watch restarting one container on its own, a decision taken with its next change |
| CO-348 | (never ruled: in D-7's list, missed by the first triage; the 0.3.12 review, PL-3) | 0.3.13, Settings' section pass | A Settings row for folder trust beside «Разрешения агентов» and a one-time note after an upgrade belong with Settings' section names, «Сохранено» and OF-33's section review (CO-392's rest): one pass over Settings instead of three |
| CO-392 (its rest) | 0.3.12 W2 | 0.3.13, Settings' section pass | The quota is gone from the window (S6); Settings' section names, «Сохранено» after a change and OF-33's review are one pass with CO-348 |
| CO-284 | 0.3.12 W3 | 0.3.13 | Its checks need a disposable stack and a disposable built app (about 15 GB); the machine has had under 10 GB free through 0.3.12 (measured 2026-10-24: 0.1 to 9 GB). The two scripts last ran green on 0.3.11's final candidate |

## Retired

| Row | Reason |
|---|---|
| CO-293 | Not reproduced: the one 180 s survival after `exit 0` (2026-10-14, under load) never recurred; "a real Electron main process exits gracefully on SIGTERM" passed in the local fast gate under load on `339c44e1` (2026-10-15, 0.8 s) and in 0.3.11's gates. If it recurs, a new row with that run's evidence |

## Each row

| Row | Ruling | Note |
|---|---|---|
| CO-277 | 0.4.0 | with CO-364 |
| CO-284 | 0.3.13 | moved 2026-10-24 (above): the disk |
| CO-293 | retired | not reproduced |
| CO-306 | 0.3.12 W2 | the splash in the working language, with OF-37's display pass |
| CO-307 | 0.3.13 | moved 2026-10-23 (below): the schema step |
| CO-308 | 0.4.0 | board scale, COM-02 |
| CO-310 | 0.3.12 W3 | each capped read says it stopped |
| CO-311 | 0.3.12 W3 | the stack start's own deadline |
| CO-312 | 0.3.12 W3 | Comms read marks bounded |
| CO-313 | 0.3.12 W2 | failure wording, with the display pass |
| CO-314 | 0.3.12 W3 | Retry-After honoured up to a stated ceiling |
| CO-315 | 0.4.0 | rare; kept |
| CO-326 | 0.4.0 | with P-06.1 |
| CO-329 | 0.3.13 | moved 2026-10-23 (above): with the tracking of turns |
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
| CO-348 | 0.3.13 | ruled 2026-10-24 (above): Settings' section pass |
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
| CO-367 | 0.3.13 | moved 2026-10-23 (above): with the tracking of turns |
| CO-368 | 0.3.12 W2 | an operator rule broken today; moved from W1 on 2026-10-23: Fabric has no notion of a project's business, so the wall needs the business field the project page (W2) adds |
| CO-369 | 0.3.12 W2 | with CO-368: the directory names a project by its repository when names collide |
| CO-370 | 0.3.13 | moved 2026-10-23 (above): SQL, the one schema step |
| CO-371 | its owners | asked on `a5969ac5` |
| CO-372 | 0.4.0 | sharing |
| CO-373 | 0.3.13 | moved 2026-10-23 (above): SQL, the one schema step |
| CO-374 | 0.3.12 W3, in part; its rest 0.3.13 | the countdown and detached windows shipped; one container's restart moved (above) |
| CO-375 | 0.3.13 | moved 2026-10-23 (above): with the tracking of turns |
| CO-377 | done | `4f0e1d40` |
| CO-378 | 0.4.0 | Windows runners |
| CO-379 | 0.3.12 W3 | the gate under load |
| CO-383 | 0.3.12 W1 | the three threads and DEC-0102's adoption get their answer |
| CO-386 | 0.3.12 W3 | with the journal's no-false-positive probe |
| CO-388 | 0.3.12 W2 | with the project page and the task page's «Назад» |
| CO-390 | 0.3.12 W3 | the sync says when it stops |
| CO-391 | 0.3.12 W2 | «Нужны вы» lists only the person's part, naming the asker |
| CO-392 | 0.3.12 W2, in part; its rest 0.3.13 | the window reads no quota; Settings' section pass moved (above) |
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
| CO-404 | 0.3.12 W1 | ADR-0176 §2, §3; resolved 2026-10-24 when the organization's side answered |
| CO-405 | 0.3.12 W3 | the reads' edges |

Counts, recomputed from this table (2026-10-24, after every move above): 0.3.12 W1 6, W2 12 (CO-392 in part), W3 15
(CO-374 in part): 33 in 0.3.12, the two rests in 0.3.13; 0.3.13 24; 0.4.0 10; its owners 1; retired 1; done 1; 70 in
all (the first triage's 69 and CO-348, which it missed). The rows added below are counted in their own tables.

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

CO-360 and CO-383 are resolved. With these five, 0.3.12 W3 holds 1, 0.3.13 1 and 0.4.0 3.

## Wave 2's spec (2026-10-23)

[The spec](../specs/2026-10-23-0312-w2-project-onboarding.md) orders wave 2 in six slices and decides its open
questions: one schema step in 0.3.12 (migration 123, a project's profile), the business wall on a name the profile
carries, people read from Git and never stored. It narrows CO-401: OF-40 and OF-37's display pass with a model move to
0.4.0.

## Moved on 2026-10-23, during wave 2

CO-307 moves from 0.3.12 W2 to 0.3.13's schema step: a project's last activity needs a journal read grouped by project,
an SQL function, and 0.3.12 keeps its one schema step for the project profile (migration 123).

## Added on 2026-10-24: the release review's homeless items and the operator's rows

The 0.3.12 review, iteration 1, found work with no open row (PL-5, DO-6), and the operator asked that a task one agent
gives another carry its whole spec and its context (2026-10-24). Each is a row, ruled here:

| Row | Ruling | Note |
|---|---|---|
| CO-413 | 0.4.0 | OF-40 and OF-37's display pass with a model, agents first |
| CO-414 | 0.3.13 | История's filters and detail pane |
| CO-415 | 0.3.13 | a request between agents carries the whole spec (ADR-0176 amendment 5), with the contract's repin |
| CO-416 | 0.3.13 | a request's context pack, with CO-415 |
| CO-417 | 0.4.0 | one memory search across the operator's stores, agents first |
| CO-418 | 0.3.13 | the review's findings 0.3.12 does not fix, three of them SQL for the schema step |

With these six, 0.3.13 holds 4 more and 0.4.0 2 more.
