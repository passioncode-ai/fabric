# Fabric keeps every coding session in view and coordinates conflicting work (CO-522, SCN-180)

**Status:** draft, 2026-11-06.

**Source:** the operator in Fabric's session `5d9bed98`, 2026-11-06. Fabric should follow what every running session
does and where, coordinate the sessions, and catch a task that contradicts another session's work so the sessions
settle it on the board. The person should direct them all through the Fabric agent.

**Scenario:** [SCN-180](../../ux/scenarios.md#scn-180-fabric-keeps-every-coding-session-in-view-and-coordinates-conflicting-work).
**Row:** CO-522 in the [carry-over ledger](2026-08-16-software-fabric-carryover.md).

Paths are relative to `apps/desktop/` unless they start with `docs/` or `supabase/`. The inventory was read on
`e05bbb47`.

## 1. Every running session in view (SCN-180 step 1)

**Exists.**
- A live agent row (`src/shared/homeLive.ts#LiveAgent`) carries the agent, project, held task with what and since when,
  last stated stage (`doing`), branch, folder and newest heartbeat.
- Heartbeats come from `src/main/agentHeartbeats.ts#withHeartbeats`.
- Stages come from `fabric_stage_report` (`agent.stage.reported@1`, `src/main/agentSurface.ts`).
- The branch comes from git in the session's folder (`src/main/agentBranches.ts#withBranches`, cached 60 s), or from
  the agent's own report when it enrolled (CO-459). Tests: `test/agent-branches.test.mjs`,
  `test/session-observe-wire.test.mjs`.
- The folder of an enrolled agent travels in `MintOrigin.folder` (CO-498). Tests: `test/session-enroll.test.mjs`,
  `src/shared/railAgents.test.ts`.
- The agent page (`src/renderer/src/launch/AgentPage.tsx`) shows all of the above.
- A status does not outlive its work (CO-499): `src/shared/abandonedSweep.ts`, `src/shared/homeLive.ts#DOING_OLD_MS`.

**Partial.**
- Switchboard's sessions (`src/main/switchboardSessions.ts`, `launch/SwitchboardSessions.tsx`) are rows without a task
  or a stage, unless the session also enrolled.
- CO-457 still owes the Dashboards mark and the project's main session.
- Codex and Kimi send no turns, so their branch is never reported (CO-427).

## 2. An overlap caught before work starts (step 2)

**Exists.**
- `src/shared/workClaims.ts#relatedTo` finds three kinds of overlap: the same backlog row, a link between the tasks, and
  overlapping declared folders or files (`touchesOverlap`).
- `fabric_work_claim` answers with `related` and a warning (`src/main/workTools.ts#warningOf`). The warning names the
  other agent, its session, its task, since when, and the overlap.
- A claim on a task someone else holds is refused.
- Tests: `src/shared/workClaims.test.ts`, `test/work-claims-db.test.mjs`.

**Missing.**
- A task Fabric launches into a console (`ptys.deliverWhenReady` in `src/main/index.ts`) is not checked against the
  live claims. No start path calls `relatedTo`.
- The check runs only when an agent claims, and only on the `touches` that agent declares. Nothing infers touches from
  the task itself: its backlog row's `where`, its brief, or the files its instruction names.

## 3. The overlap becomes coordination (step 3)

**Exists, as parts.**
- The board's tools (`src/main/boardTools.ts`).
- The person's door onto the board (`AgentSurface#operatorBoard`). Today only CO-458's «Поручить агенту B» uses it.
- `askHandover` on `fabric_work_claim`.

**Missing.**
- A `related` warning reaches the claiming agent only. Nothing turns it into a board thread or into an item for the
  person.
- The sweep has no overlap kind.

## 4. The person directs every session through the Fabric agent (step 4)

**Exists.** The CEO conversation stores the person's messages behind private history
(`src/main/ceoConversationService.ts`, `src/renderer/src/CeoChat.tsx`).

**Missing.** No responder reads those messages, and the conversation has no tools over claims, tasks, the board or
sessions.

**How an instruction reaches a running session today.**

| Session | How words reach it |
|---|---|
| Launched by Fabric | Typed into its console (`window.fabric.terminal.write` to `src/main/pty.ts#write`); answers to its questions are delivered there (`src/main/continuationDelivery.ts`). |
| Enrolled from its own terminal | Nothing is pushed. It meets Fabric's words only when it calls a tool: nudges in a turn answer, `fabric_heartbeat` or `fabric_work_list`; `operator_said` on a task returned from review (SCN-179); handover requests on its claims; board messages; question answers. |
| Launched by Switchboard without enrolling | Read only. |

## 5. Waves

Each wave is a unit with its own tests, gates and map entry, taken in this order. A wave that changes the interface goes
through its scenario first.

| Wave | What | Done when |
|---|---|---|
| A | **Overlap at launch, said to the person.** Before Fabric launches a task, `relatedTo` runs against the live claims, with touches inferred from the task's backlog row `where` and its brief's paths beside the declared ones. An overlap is said before the start: the other session, its task and the overlap, with «Всё равно запустить», «Подождать» and «Открыть ту сессию». | A test launches a task that overlaps a live claim and sees the warning, and a planted defect (the check removed) is caught. |
| B | **Overlap becomes coordination.** A claim that warns, or a launch the person runs anyway, files one board thread between the two projects (`project.work`, through `operatorBoard`) and one item in «Нужны вы» with three choices. «Подождать» queues the new task behind the held one (a `follows` link). «Передать» asks the holder for a handover. «Разделить» leaves both with a note that names the split. A sweep kind `overlap` keeps the item until either claim ends. | Tests cover each of the three answers and the item ending when a claim ends. |
| C | **Words to a running session.** «Написать агенту» on the agent page. The words reach a launched session's console as a line. They reach an enrolled session through its next `fabric_heartbeat`, `fabric_work_list` or turn answer as `operator_said` (the field SCN-179 uses), with a receipt when it was read. | A launched and an enrolled session each receive one message, once. |
| D | **The Fabric agent directs sessions.** A responder for the CEO conversation, with tools over the same claims, tasks, board and wave C's messages, acting only through doors a person has. It is an agent system, so it goes through `agent-stack`; runner, model, evals and spend limits are decided there. | Decided in its own spec. |
| E | **Sessions outside Fabric.** Switchboard's sessions carry their task and stage once they enroll (CO-457). Codex and Kimi report their branch on their next tool call instead of a turn. | CO-457's rows close. |

## 6. Open questions

1. **Wave A: warn or block?** Warning is proposed. The person decides, and blocking would stop work on a guess about
   touches.
2. **Wave D: which model and runner for the responder?** Decided in its own spec, in line with the operator's model
   priority (wiki `synthesis/llm-models.md`).
