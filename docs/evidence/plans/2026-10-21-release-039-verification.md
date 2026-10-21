# Release verification: Fabric 0.3.9, the core holds, three independent iterations

Fabric 0.3.9 is the operator's priority of 2026-10-21: the hub always up, Fabric knowing which agent works on what in
which project, the tasks, and the project board. [Plan](2026-10-21-core-reliability/README.md), with the three audits
of the installed system it answers.

## Protocol

As for 0.3.7 and 0.3.8: per iteration five fresh reviewers (ux, errors, docs, data, plan) read the candidate read-only
in a detached checkout and write a report; every finding gets a disposition (fixed with a test watched failing, ruled to
a register row, not a defect, not recoverable, stopped), recorded here and in a receipt under
`docs/evidence/reviews/0.3.9/iteration-N/`. The final candidate of iteration 3 is the verified commit.

## Iteration 1

Five fresh reviewers, 2026-10-21, against `8100be6b` (`8100be6b528836d6be784563af411ae5beada7b7`), read-only in a detached checkout. Reports:
[UX](../reviews/0.3.9/iteration-1/2026-10-21-ux.md), [errors](../reviews/0.3.9/iteration-1/2026-10-21-errors.md),
[documents](../reviews/0.3.9/iteration-1/2026-10-21-docs.md), [data](../reviews/0.3.9/iteration-1/2026-10-21-data.md),
[plan](../reviews/0.3.9/iteration-1/2026-10-21-plan.md). Hosted `ci` on `8100be6b`: run 39611462308, success.

48 findings, 13 blocking. The ones that would have hurt the core: on Windows and Linux a start that waited quit
at the moment it succeeded (ER-1); the new fabric-mcp could not enroll against the older hub still running until the
app restarted (PL-2); agents through fabric-mcp never heard why the hub refused (UX-3); an agent's session end stopped
reaching the journal (DA-1); and the home showed a false, ever-present count (UX-1). The fixes were built on three
branches (`agent/core-st2`, `agent/core-tr2`, `agent/core-bd2`, notes in the plan folder) and merged without conflict.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | UX-1 (blocking) | The home board panel counts unread deliveries as "board messages" (3,103 on the operator data) | fixed: the panel shows only requests no agent can answer, with the oldest age, and nothing when none wait (`HomeBoardWaiting.tsx`, `commsOperatorRead.ts#waiting`; `HomeBoardWaiting.test.tsx`, watched failing) |
| V1-2 | UX-2 (blocking) | The stack-lost notice says "Next try in 0 s" while a try runs; an external stack is said to be brought back | fixed: «Пробуем сейчас» while a try runs, the watch keeps 30 s, Retry-After 30 s; an external stack is waited for (`stackWatch.ts`; `stackWatch.test.ts`, `StackHealthNotice.test.tsx`) |
| V1-3 | UX-3 (blocking) | Agents through fabric-mcp never hear stack-starting or stack-unavailable | fixed: the transport reads up to 4 KB of a 429/503 body and the agent hears the code and reason (`fabricMcpClient.ts`; `fabric-mcp.test.mjs` UX-3, watched failing) |
| V1-4 | UX-4 (blocking) | The wait window and the stack-lost notice name OrbStack on Windows and Linux | fixed: per-OS keys `.win32`/`.linux` for both (`platformWords.test.ts`, a rule that no OrbStack string reaches Windows or Linux, watched failing) |
| V1-5 | UX-5 | The wait window (460 x 240, not resizable) cuts its Russian text | fixed: 460 x 360, resizable, follows the page height (`startup-wait.test.mjs`) |
| V1-6 | UX-6 | "Waiting for a project" reads "requests 0 · 1 of them have no agent" | fixed: the no-responder figure is its own count; a project with only a read unanswered request says "nothing unread" (`CommsScreen.test.tsx`) |
| V1-7 | UX-7 | The home hint advises a grant nobody can give yet | fixed: the hint says a reply from the asked project answers a request; `noResponder` says the target agent asks and the operator allows |
| V1-8 | UX-8 | The timeline shows the raw cause `target-reply` | fixed: `launch.comms.cause.target-reply` in en and ru |
| V1-9 | UX-9 | Agent-facing descriptions still state 0.3.8 rules | fixed: `fabric_session_observe`, `fabric_work_claim`, `fabric_work_release` state the 0.3.9 rules (`tracking-surface.test.mjs`) |
| V1-10 | UX-10 | English plurals and "?" for an unknown age | fixed: the colon count form; an unknown age leaves the clause out (`HomeBoardWaiting.test.tsx`) |
| V1-11 | ER-1 (blocking) | On Windows and Linux a start that waited quits when it succeeds | fixed: `quit.ts`: closing the last window during a start does not quit; the main window opens before the wait window closes (`quit.test.mjs` win32/linux/darwin, `startup-wait.test.mjs`, watched failing) |
| V1-12 | ER-2 | A request during the standby-to-hub handover gets no answer | fixed: the standby answers until the hub handler is on the same sockets (`hub-standby.test.mjs`, watched failing) |
| V1-13 | ER-3 | The watch restarts a deliberately stopped stack and repeats supabase start against running containers | fixed: `docker ps -a` before a try; one `supabase start` per try; none while containers run; a stopped stack is respected until the next launch (`stack-watch.test.mjs`, `stackStartRetry.test.ts`) |
| V1-14 | ER-4 | A slow but working database puts the hub into refusal | fixed: a 6 s read deadline (past the hub 5 s); 3 slow or 2 refused reads in a row (`stackWatch.test.ts`, `stack-watch.test.mjs`) |
| V1-15 | ER-5 | hub.json can name a closed port after a failed takeover | fixed: an untaken standby is stopped and hub.json and the door token withdrawn; sockets of a throwing takeover are closed (`hub-standby.test.mjs`) |
| V1-16 | DO-1 (blocking) | The notes do not say every install needs a database upgrade | fixed: CHANGELOG `Upgrading.`: schema 95, backup, 0.3.8 cannot open 95, what the first tick does |
| V1-17 | DO-2 (blocking) | The lifecycle table says supabase stop stops the stack, but the watch starts it again | fixed: the watch respects a `supabase stop` until the next launch (ER-3); AGENTS.md says so |
| V1-18 | DO-3 (blocking) | CO-277 falls due in 0.3.9 and was moved on a false reason | fixed: CO-277 re-ruled: the upgrade uses `supabase migration up`, which works; only `db reset` refuses and no upgrade step uses it |
| V1-19 | DO-4 | Wave 4 renumbering incomplete; P-20 lists CO-362; OF-08 not tied to TR-4 | fixed: the simple plan row, final pass, onboarding banner, OF-08, OF-13, P-19 and P-20 corrected; OF-08 names TR-4 and its 0.3.9 fix |
| V1-20 | DO-5 | The handoff sends the next agent to 0.3.9 (P-20); the Now line names schema 94 | fixed: the handoff update names P-22 and this ledger; the Now line names schema 95 |
| V1-21 | DO-6 | The reservation table names superseded migration files | fixed: the table names 121 and 122 |
| V1-22 | DO-7 | "Keeps at least 7 days" is not what the log does | fixed: "sized for 7 days within 96 MB, a cut inside the week is recorded" in AGENTS.md, CHANGELOG and CO-362; keep-alive pings are sampled (DA-2) |
| V1-23 | DO-8 | Audit findings without a disposition | fixed: the plan README table "Every audit finding, where it went" |
| V1-24 | DO-9 | What migration 120 does to existing data is in no operator document | fixed: CHANGELOG Upgrading and release-mac say 4 of 6 answered at the first tick, the others get 7 days |
| V1-25 | DO-10 | The SCN-141 amendment is on a retired scenario; Coverage fields cite no new files | fixed: the amendment moved to SCN-140; SCN-140, 143 and 161 Coverage name the new files |
| V1-26 | DO-11 | The new panel and notice are in no screen record | fixed: SCR-30 and SCR-81 amended |
| V1-27 | DO-12 | CO-365 names `main/loginItem.ts` | fixed: `shared/loginItem.ts` |
| V1-28 | DO-13 | "Expires after 7 days" and "marks read" overstate the code | fixed: "one sent without a deadline expires after 7 days"; ADR-0149 "says whether it is read" |
| V1-29 | DA-1 (blocking) | An enrolled agent end stops reaching the journal | fixed: `session.ended@1` with reason `agent-left` when the agent own fabric-mcp leaves, once (`tracking-surface.test.mjs`, watched failing) |
| V1-30 | DA-2 (blocking) | The 2-minute ping is unsampled and breaks the week | fixed: successful fast `mcp.ping` is counted like `ipc.*` (`ops-retention.test.mjs`: 40 agents for a week fit 96 MB, watched failing) |
| V1-31 | DA-3 (blocking) | The availability figure leaves out the outage the window starts inside | fixed: 86.9 %, 22 outages, 22.0 h in CHANGELOG, the plan and the map |
| V1-32 | DA-4 | noResponder and answered reach callers who never asked | fixed: the descriptions and ADR-0149 say who receives what; kept always-on as additive |
| V1-33 | DA-5 | The migration header says the tick answers six requests | fixed: the migration is immutable; the plan, CHANGELOG and release-mac say 4 of 6 |
| V1-34 | DA-6 | Claims and the task column outlive idle work | fixed: a claim let go takes its task back to backlog (`work-release-session.test.mjs`, `work-claims-db.test.mjs`); renewal by ping is the plan intent |
| V1-35 | DA-7 | "Keeps its identity after Fabric restarts" holds for the runtime id only | fixed: CHANGELOG and the plan: after a restart the agent rejoins as a new Fabric session; its claims were released at quit |
| V1-36 | DA-8 | The home unread figure starts at about 3,100 | fixed: with UX-1: the home shows no unread count |
| V1-37 | DA-9 | The last sampling window counts are lost at quit | not a defect: they count successful reads only; failures and slow calls are always written, so no outage evidence is lost |
| V1-38 | PL-1 (blocking) | No upgrade instructions; 0.3.9 refuses the schema-94 database | fixed: with DO-1 |
| V1-39 | PL-2 (blocking) | The new fabric-mcp cannot enroll or rejoin against an older hub | fixed: it enrolls again without `agentPid` when the hub refuses it, per hub pid (`fabric-mcp.test.mjs` PL-2 against a strict 0.3.8 schema, watched failing) |
| V1-40 | PL-3 | Findings claimed or left without a home | fixed: with DO-8 |
| V1-41 | PL-4 | OF-08 and CO-362 in the wrong version | fixed: with DO-4 |
| V1-42 | PL-5 | The board still says wave 4 is 0.3.9 | ruled: corrected in the 0.3.9 publication message on the release threads (Release close) |
| V1-43 | PL-6 | Wire changes not offered to owners; a false statement on thread a5969ac5; links to a branch | ruled: the Release close corrects thread a5969ac5 (noResponder and answered reach every caller), raises the hub 503 body with fabric-agent-contract (CO-371) and relinks both asks to main |
| V1-44 | PL-7 | No after-install measurement | fixed: the plan section "How we will know it holds" |
| V1-45 | PL-8 | The release gate is not prepared for 0.3.9 | ruled: the release commit sets the version, the CHANGELOG heading and the gate on this ledger |
| V1-46 | PL-9 | No person steps named | fixed: the plan names them: none for the release; agents restart on their own schedule; CO-365 needs a reboot |
| V1-47 | plan:DO-1 | The availability headline drops the first gap | fixed: with DA-3 |
| V1-48 | plan:DO-2 | MERGES records a landing that has not happened | ruled: the merge log entry is written at the landing, in the release commit |

Exit for iteration 1: every finding is fixed or ruled to a register row or the Release close. Blocking findings open: none.

## Iteration 2

Five fresh reviewers, 2026-10-21, against `026d77c8` (`026d77c86a95df4aed4f6499e621330b5951e4ab`), read-only in a detached checkout; they stopped once at
the account's weekly limit and resumed on another account. Reports: [UX](../reviews/0.3.9/iteration-2/2026-10-21-ux.md),
[errors](../reviews/0.3.9/iteration-2/2026-10-21-errors.md), [documents](../reviews/0.3.9/iteration-2/2026-10-21-docs.md),
[data](../reviews/0.3.9/iteration-2/2026-10-21-data.md), [plan](../reviews/0.3.9/iteration-2/2026-10-21-plan.md).
Hosted `ci` on `026d77c8`: run 39624915065, success. The data reviewer applied migration 120 to a copy of the
operator's schema-94 database: it applies in one transaction and the first tick answers exactly the 4 requests a
target replied to.

35 findings, 4 blocking: three were iteration-1 document fixes that held only in part, and one was the
rollout, which as written would have opened 0.3.9 on an unmigrated database (PL-1); the plan now migrates first. The
code fixes (`agent/core-i2`, [notes](2026-10-21-core-reliability/2026-10-21-notes-i2.md)) close the three errors
findings: one chain of stack-watch reads, an agent's leave that survives an outage and a signal, a log that cannot
outgrow its budget.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V2-1 | UX-1 | The notice says «Пробуем сейчас» while a hold stands | fixed: a try shows only when no hold stands (`shared/stackWatch.ts`; `stack-watch.test.mjs` UX-1, watched failing) |
| V2-2 | UX-2 | The next-try seconds update only on a read | ruled: CO-374 (0.3.10) |
| V2-3 | UX-3 | On a low disk the wait window puts the disk third | fixed: `startupWaitLines` puts it after the title (`stackWatch.test.ts`, `startup-wait.test.mjs`, watched failing) |
| V2-4 | UX-4 | Detached windows show no stack notice | ruled: CO-374 (0.3.10) |
| V2-5 | UX-5 | The home count and noResponder use two definitions; ru says «принять» | fixed: the wording says «на которые сейчас не отвечает ни один агент» / "no agent is answering now" (`HomeBoardWaiting.test.tsx`); one definition needs a migration, CO-373 (0.3.10) |
| V2-6 | UX-6 | The wait window is resizable in width only | not a defect: its height follows the page text, so a person never needs to resize it vertically |
| V2-7 | UX-7 | "Nothing of this call was done" twice | fixed: `fabricMcp.ts#sayHubRefusal` (`fabric-mcp.test.mjs` UX-7, watched failing) |
| V2-8 | UX-8 | "Agents are asked to wait" without the hub port | fixed: shown only while the standby holds the port, else `startup.wait.agentsNoHub` (`stackWatch.test.ts`) |
| V2-9 | UX-9 | The panel and notice are recorded only on the superseded home | ruled: carried to the wave-4 home with the 0.3.10 rebuild (P-20); SCR-30 keeps the record until then |
| V2-10 | UX-10 | The English timeline repeats "by a reply" | fixed: the English state is "answered" (`CommsScreen.test.tsx`, watched failing) |
| V2-11 | ER-1 | The stack watch can run two timer chains | fixed: only the newest scheduled read schedules the next (`stack-watch.test.mjs` ER-1 through `start()`, watched failing) |
| V2-12 | ER-2 | An agent exiting during an outage leaves its session and claims | fixed: the leave DELETE passes a cooldown; fabric-mcp leaves on SIGTERM, SIGHUP, SIGINT and stdin end; a hook end for a dead agent process ends the session (`fabric-mcp.test.mjs`, `session-observe-wire.test.mjs`, `tracking-surface.test.mjs`, `session-enroll.test.mjs`, watched failing) |
| V2-13 | ER-3 | With rotation failing the log grows without bound and records false losses | fixed: rotation is separate from the append; one `ops.rotate-failed`; the file stops at the budget (`ops-retention.test.mjs` ER-3, watched failing) |
| V2-14 | DO-1 (blocking) | V1-28 does not hold: SCN-143 and the plan still say every unanswerable request expires after 7 days | fixed: SCN-143 and the plan say only a request sent without a deadline gets 7 days |
| V2-15 | DO-2 (blocking) | V1-35 does not hold: the plan and P-22 say a session keeps its identity across a restart | fixed: the plan, P-22 and SCN-140 say the agent rejoins as a new Fabric session |
| V2-16 | DO-3 (blocking) | V1-25 holds in part: StackHealthNotice.tsx is in no Coverage field | fixed: SCN-161 Coverage names `StackHealthNotice.tsx` |
| V2-17 | DO-4 | The plan contradicts itself on TR-13 | fixed: the "Not in this release" sentence is removed; the table says fixed |
| V2-18 | DO-5 | The LC-09 row says the home reads unread board messages | fixed: the row says requests no agent can answer and the oldest age |
| V2-19 | DO-6 | The board architecture page describes the 0.3.8 board | fixed: `operating-surfaces.md` gains the 0.3.9 additions |
| V2-20 | DO-7 | TR-3 one-off and TR-4 display have no home | fixed: CO-375 (0.3.10) |
| V2-21 | DO-8 | CO-277 re-ruling cites a future upgrade as evidence | fixed: CO-277 says the 94 to 95 run is measured at install, in the release close |
| V2-22 | DO-9 | V1-47 and V1-48 reuse source ids | fixed: the ledger says plan:DO-1 and plan:DO-2 |
| V2-23 | DO-10 | "4 of the 6" is stale: 8 queued now | fixed: CHANGELOG, plan and release-mac say 4 of the 8 queued on 2026-10-21 |
| V2-24 | DO-11 | noResponder is said to mean "no Project serves the capability" | fixed: ADR-0149, CHANGELOG, plan and SCN-143 say the target Project has no live responder |
| V2-25 | DA-1 | A responder whose lease lapsed counts as able to answer | ruled: CO-373 (0.3.10, a migration); the live database has no responder slots |
| V2-26 | DA-2 | A lapsed claim leaves its task in running | ruled: CO-373 (0.3.10) |
| V2-27 | DA-3 | The log counts operator writes too, not only polling reads | fixed: CHANGELOG says fast successful IPC calls are counted; failures and slow calls are always written |
| V2-28 | data:DO-1 | The plan still says the log keeps at least 7 days | fixed: the plan says sized for 7 days, a cut inside the week recorded |
| V2-29 | PL-1 (blocking) | The rollout ends in the refusal it set out to remove; V1-46 does not hold | fixed: the plan names the rollout order: back up and rehearse, install the bundle, migrate the live database to 95 while 0.3.8 runs, then the next quit and open runs 0.3.9 on a ready database; 0.3.8 against schema 95 is checked in iteration 3 |
| V2-30 | PL-2 | The notes say 4 of 6 with 2 expiring on 10-26 | fixed: with docs DO-10 |
| V2-31 | PL-3 | Release-close obligations to other projects have no home; thread a5969ac5 has a false sentence; passioncode-vesta not told | fixed: corrected on a5969ac5 (2026-10-21 16:34 UTC), CO-371 names both threads and the 503 body, passioncode-vesta told on thread d1ffada2; the rest is in the Release close |
| V2-32 | PL-4 | Two requests to Fabric would be expired by its own tick | fixed: both answered on 2026-10-21 (threads 87af4473 and e75d502d), recorded as CO-372 and CO-336; the tick will settle them as answered |
| V2-33 | PL-5 | TR-14 claimed fixed but only its stage half changed | fixed: the plan table says half fixed; the heartbeat half is CO-375 |
| V2-34 | PL-6 | The watch never restarts a stack whose PostgREST or Kong is down | ruled: CO-374 (0.3.10) |
| V2-35 | PL-7 | The upgrade window shortens 0.3.8 log evidence | fixed: the rollout order migrates first so the window is one quit and open; the plan says so |

Exit for iteration 2: every finding is fixed or ruled to a register row or the Release close. Blocking findings open: none.

## Release close

Written as each step of the rollout ([plan](2026-10-21-core-reliability/README.md), "Rollout order") lands. Owed here,
by the rows that point to it:

- the publication: the tag, the release run, the assets;
- the install: both dumps, the rehearsal receipt, the 94 to 95 run with `schema_version()` and the journal count (CO-277's
  measurement), the version running, the hub and the board tick (the queued requests their target replied to read
  `answered`);
- the board: the 0.3.9 publication message on the release threads (wave 4 is 0.3.10; the backoff and the hub's 503),
  the links on threads `02bf19c5` and `a5969ac5` moved to `main`, the answers from fabric-agent-adapter and
  fabric-agent-contract if they came;
- the knowledge base's version rows and the workspace publication;
- the first measurements of "How we will know it holds" (the plan), against the audits' baselines.

