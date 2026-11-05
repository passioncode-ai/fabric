# Agents you can place, a status that does not lie, logs that are read, and the improvement loop

**Date:** 2026-11-04. **Asked by:** the operator, in session 5d9bed98, with a screenshot of the Агенты page:
«в левом списке не видно, кто к какому проекту, какой ветке и папке относится … статус не обновляется: задача давно
закрыта, а показано, что в работе … изучи логи … вся система должна логироваться, анализ логов раз в час и раз в
день, цикл обратной связи после работы агента … хранить централизованно на уровне Observatory и Fabric … чётко
разделить, кто за что отвечает, и записать это в Fabric … все продукты по умолчанию автообновляют плагины, приложения
и скилы, в настройках можно выключить, но уведомление всё равно приходит».

**Rows:** CO-498 (folder and branch for every agent, done in this change), CO-499 (a status that does not outlive its
work, done in this change), CO-500 (the hourly and daily reading of the log), CO-501 (Fabric updates itself by
default), CO-502 (the `retro-after-work` obligation), CO-503 (the daily digest sent to Observatory), CO-504 (the churn
of short enrolled sessions). **Decision:** [ADR-0188](../../adr/0188-fabric-reads-its-own-logs-observatory-keeps-what-every-agent-learned.md)
(who keeps, reads and uses logs, findings and lessons).

## 1. What was found, with receipts

Read on the operator's Mac on 2026-11-04 between 17:20 and 17:40 UTC.

1. **No folder and no branch for an agent that joined from its terminal.** The enrollment receives the folder, resolves
   it to a project and then keeps only its digest: `apps/desktop/src/main/sessionEnroll.ts#enrollSessionOnce` journals
   `cwd_sha256`, and the surface's session registry (`main/agentSurface.ts#mint`) has no folder field. The branch is
   read only for a console Fabric holds (`main/agentBranches.ts#withBranches`, `a.console ? …`). Every agent that came
   in through `fabric-mcp` therefore reads «ветка неизвестна»; on the day of the reading all four live claims were
   held by such agents (`work_claims.came_in = 'enrolled'`).
2. **A status that outlives its work.** Three mechanisms, each seen in the data:
   - a claim stays live while the agent's process lives, because `fabric-mcp`'s sign renews it every two minutes;
     the claim of one personal agent taken on 2026-10-30 was still live on 2026-11-04 while its task had been in
     review for days (`work_claims.released_at is null`, `project_tasks.status = 'review'`);
   - the sweep releases a lapsed claim and moves a task whose last claim ended, but never releases a live claim on a
     task that is no longer running (`shared/abandonedSweep.ts`);
   - an agent's words on the screen are its newest stage report whatever its age: the same agent's text was from
     2026-11-03 21:44 UTC while it made turns on 2026-11-04 every few minutes (`agent_stages.reported_at` against
     `journal` `session.turn.observed@1`).
3. **Logs exist and nobody reads them.** `userData/logs/operations*.jsonl`: 226 558 structured lines from
   2026-10-21 13:18 UTC to 2026-11-04, 83 MB within the 96 MB budget (`main/ops.ts`). In that week: 465 failed
   `ipc.feed:replay`, 311 failed `cycle.receipt`, 273 failed `ipc.work:home` (238 of them `fetch failed` while the stack
   was lost, the last on 2026-10-27), 266 failed `board.tick`, 135 failed `agentSurface.hub-authenticate`, 19
   `stack.lost`. In the last two hours of the reading: 425 `tool.fabric.session.enroll` against 414
   `agentSurface.session-left`, a churn of short sessions no screen shows (CO-504). No job summarises any of it; the operator
   learns of a failure when a screen is wrong.
4. **Fabric does not update itself.** ADR-0121 is still `proposed`; `git grep autoUpdater apps/desktop/src` finds
   nothing. Switchboard, Observatory, Inbox and Dashboards each have an updater of their own.

## 2. The changes in Fabric

### 2.1 Folder and branch for every agent (CO-498)

- The enrollment hands the resolved folder (`folder.real`) to the surface with the bearer (`MintOrigin.folder`); the
  surface keeps it in memory for the life of the session, and `heldSessions` returns it. The journal is unchanged: it
  still keeps the digest only, because the journal is synchronised and the folder is the person's.
- `withBranches` reads the branch of every held session with a folder, not only of a console; with no folder, or a
  folder git cannot name, it keeps the branch the agent's last turn reported (CO-459, on main since 0.3.15).
- `LiveAgent.folder` carries the folder; the left column, the home's «В работе» and the agent page show its last
  segment beside the branch («fabric-co409-dispatch · feat/reply-at-once»), the whole path in the tooltip.

### 2.2 A status that does not outlive its work (CO-499)

- The sweep lets go of a live claim whose task is no longer `running` (review, done, cancelled, backlog), as the
  system `work-sweep`, with the reason «задача уже не в работе», and tells the session on its next answer.
- An agent's own words older than its newest sign by more than 30 minutes (`shared/homeLive.ts#DOING_OLD_MS`) are
  shown as old: the row and the agent page say how long ago they were written and that it has worked since.

### 2.3 Logs read every hour and every day, and the improvement loop (CO-500, CO-502, CO-503)

- **Hourly, in Fabric, no model:** the cycle folds the hour's operations log and journal into one
  `ops.digest.hourly@1` receipt: counts by operation and outcome, the failures that rose against the previous hour,
  sessions started and left, requests waiting. A rise above a threshold becomes a finding in «На проверке».
- **Daily, in Fabric, no model:** the day's hourly receipts fold into `ops.digest.daily@1`, written as a report row and
  sent to Observatory as a record of the project `fabric` (statement plus counts, no log line, no path).
- **After work, every agent:** when a session releases a claim `done` or ends, the protocol obligation
  `retro-after-work` (served in `fabric_whoami`) asks it to write, in the same turn, what went wrong and what would
  have prevented it as an `observatory_lesson` (one class key per lesson) and its product insights as `insight/1`
  lines. Fabric counts the retros asked and the retros written per day in the daily digest.
- **Daily, in Observatory:** Observatory reads the day's lessons, records and Fabric digests across all agents, groups
  repeats by class key and promotes a lesson seen in two projects (its corroborator). Its daily summary is what the
  operator reads; Fabric shows the count and links to it.

*Done 2026-11-04 (CO-500):* the counting, the hourly and daily folds and the «На проверке» rows, written to
`userData/digests/` rather than the journal so the release of 2026-11-05 takes no schema step; the `retro-after-work`
obligation is served (CO-502). Left: the retro counts and the session and request counts in the digest, and the daily
digest sent to Observatory (CO-503).

### 2.4 Fabric updates itself by default (CO-501)

ADR-0121's updater is built: on by default for new and existing installs, checks every six hours, downloads in the
background, installs on the next quit, never past a schema step. Settings has «Обновлять Fabric автоматически»; off,
Fabric still checks and shows a notice «Доступна версия X» with a button. The same rule goes to every PassionCode
product and to skills and plugins (section 4).

## 3. Who keeps, reads and uses what (ADR-0188)

The table is the decision's; ADR-0188 holds it with its reasons.

| | Fabric | Project Observatory |
|---|---|---|
| Keeps | its operations log (local, a week), its journal (runs, claims, sessions, board), the hourly and daily digests of both | agent memory (ADR-0105): episodes, checkpoints, hand-overs, lessons, learnings, every product's digests and insights, across machines |
| Reads | its own log and journal, every hour and every day, with no model | every project's lessons and digests, every day; corroborates repeats |
| Uses | to tell the operator what failed now (findings, «На проверке»), to give an agent its obligations | to answer agents (`observatory_search`, `kinds: lesson`), to show the operator the daily summary, to promote a lesson |
| Never | keeps another product's log, keeps lessons | reads Fabric's raw log, keeps a secret or a log line |

## 4. What goes to other products

| Product | What | Row |
|---|---|---|
All asked in one board thread, `f7758225` (message `516761e1`, 2026-11-04 17:38 UTC), with the operator's words.

| Product | What |
|---|---|
| Project Observatory | accept Fabric's daily digest as a record kind; a daily cross-agent summary of lessons and digests; keep board references (OBS-323) |
| fabric-agent-contract | `retro-after-work` as a protocol obligation every agent serves; the `ops.digest` shape |
| fabric-agent-adapter | serve `retro-after-work` and an hourly log digest in every adapted agent |
| Switchboard, Dashboards, Inbox, the launcher | updates on by default with an off switch that still notifies; their own log digests |
| sshlg-skills | skills and plugins updated by default, an off switch with a notice |
| fabric-workspace | the split in the knowledge base, and following each product to done |
