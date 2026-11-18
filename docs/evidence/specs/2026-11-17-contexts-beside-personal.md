# Contexts beside `personal`: one Fabric, several organizations (CO-422)

**Status:** design, 2026-11-17 (promised on the board for 2026-11-18: thread `f1fd7e94` reply `3f7c57e5`, thread
`6255f2d5` replies `d12fcee7` and `e1bd75e1`). Build follows the board-apart waves (ADR-0195,
[the plan](../plans/2026-11-17-board-apart-waves.md)): the contexts live in the board's process.

**Source.** The carry-over row CO-422 (TP-02, the Organization R1 plan row 3.1); fabric-workspace's report
`docs/reports/2026-10-12-org-contexts/README.md` (the operator's decisions В-1 to В-8 of 2026-10-12, the model §4, the
invariants §5, the decisions CX-01 to CX-32); the organizations service's ask `cca8393d` (the personal context is seen by no
organization); studio-agent's C8 `ea3274cd` (one device identity per organization context on one machine).

## 1. What changes for the person

| Today | After CO-422 |
|---|---|
| One Fabric process opens one estate (`main/activeEstate.ts#readActiveEstate`; `ACTIVE_ESTATE` had 136 uses in `main/index.ts` at `6b590cfa`; since W2a.3 and W2a.4 moved the composition out, 108 there, 12 in `main/board.ts` and 19 in `main/boardCycle.ts`, counted 2026-11-18) | One Fabric serves the person's own context and every organization context they belong to, at once |
| Every project is in the one open estate | Every project is in exactly one context, shown by its badge; it moves only by the person's act |
| A session in any project sees the whole board | A session sees only its project's context: its projects, tasks, board, grants and accounts |
| Board events of every project may reach a mirror | An organization's events go only to that organization's own copy; personal events never leave the machine |

The screens get one filter («Личное · PassionCode.ai · Acme»), default «Всё»; it filters, it never switches the
process.

## 2. The model: a context is an estate

The schema already holds several estates: `persons`, `memberships(person_id, estate_id, role)`, `projects.estate_id`,
and row security through `member_estates()` (`supabase/migrations/20260831000001_migration_one.sql`); 92 column
definitions in the migrations carry `estate_id ... not null`. So a context is an estate, and an organization context is
an estate of kind `organization` bound to the organization's id. Nothing new names a context.

| Concept (report §4) | In Fabric |
|---|---|
| `personal` | the person's own estate, `kind: personal` (today's default estate, marked in place) |
| `org:<orgId>` | an estate with `kind: organization`, `organization_id` the organization's id at its issuer (the organizations service), made when the person joins or creates the organization |
| Membership | a `memberships` row (owner, member); the organization's roles stay in the organization's own record, read through the organizations service |
| Project's context | `projects.estate_id`; set by the person when a folder is attached (ADR-0136), moved by a recorded act |
| Session's context | its project's estate; a session without a project is personal |

**Schema step (one migration):** `estates.kind text not null default 'personal' check (kind in ('personal',
'organization'))`, `estates.organization_id text null unique`, and a check that an organization estate names its
organization. No table changes its key; every projection is rebuilt as today.

## 3. Decisions

| # | Decision | Report | Why |
|---|---|---|---|
| D-1 | A context is an estate; no new table or id kind | CX-01, CX-02 | the schema and row security already scope by estate |
| D-2 | The process serves all its person's estates; `ACTIVE_ESTATE` becomes the personal estate, used only where no project or session names one | CX-02, CX-03 | one install, no switch of process (C-02) |
| D-3 | Every write the board makes takes its estate from the project, task, grant or session it acts on, never from the process; a call that names none is personal | CX-02, I-1 | a session cannot write into another context by mistake |
| D-4 | A session's reads are narrowed to its project's estate: `fabric_work_list`, `fabric_board_search`, `com.*`, `fabric_tasks_list`, `fabric_agents_list` | CX-26, I-1 | the personal context is seen by no organization (the organizations service's ask) |
| D-5 | The board (threads, requests, responder slots) is per estate; a request across contexts is refused `cross-context` | I-7 | no leak through the board; a deliberate exchange is an artefact (I-7), later |
| D-6 | The mirror and every outbound sync carry only organization estates' events, each to its own organization; the personal estate never leaves the machine | I-6, CX-22 | the organizations service's confirmation, as written in `3f7c57e5` |
| D-7 | One hub port and one `hub.json`; the hub's key id (`kid`) and enrolment are per (machine, estate), so two organizations on one machine are not linked by a device id | CX-05, CX-22, C8 | studio-agent's acceptance: two organizations show different `device.id` |
| D-8 | Switchboard launches a session of an organization project from that organization's group (`--org`), and refuses personal accounts there | CX-07, I-5 | Switchboard already groups accounts by organization |
| D-9 | Migration: every existing project stays personal; the person moves a project to an organization with one act (History can undo it) | CX-03, CX-06 | nothing changes context silently |
| D-10 | Isolation level 1 only (one OS account); level 2 stays with the organization's policy, later | CX-25, В-8 | convenience first, by the operator's word |

## 4. Waves

| Wave | What | Exit check |
|---|---|---|
| C0 | The migration of §2 and the personal estate marked `personal` | migration test; `rebuild_estate_projections()` unchanged |
| C1 | The board's per-call estate: board code takes the estate from the project, task, grant or session (inside `fabric-board` after ADR-0195 W2a.3) | a test per tool: a session of estate A cannot read or write estate B |
| C2 | Narrowed reads for sessions, and `cross-context` refusals on the board | contract tests over `hub-surface`, `board-surface` |
| C3 | The screens' filter and the project's context badge; «Перенести в организацию» as an act with undo | screens stand; scenario walk |
| C4 | Joining or creating an organization makes its estate (with the organizations service's `org-membership/2`, due 2026-11-24 on the organizations service's side) | the flow from the prompt to the first organization project (CO-337) |
| C5 | Per-estate `kid` and enrolment; per-organization mirror | two organizations on one machine show different device ids; the mirror carries no personal event |

C0 to C2 are code in Fabric alone; C4 needs the organizations service's `org-membership/2`; C5 needs the contract's per-context check-in
(CX-22's amendments). The first commit of C0 and C1 is due on a branch by 2026-11-24 (said on the board); the release
that carries C0 to C3 is named with the first board-apart release after W2d.

## 5. Tests that prove it

- A session enrolled in a project of estate A: every read tool returns nothing of estate B, and every write into B is
  refused (C1, C2).
- The mirror's outbound queue holds no event of the personal estate after a day of mixed work (C5).
- Two organization estates on one machine: their enrolments carry different `kid` values; no board message names the
  other (C5).
- A project moved to an organization: its tasks, claims and board threads move with it in one recorded act, and History
  undoes it (C3).

## 6. Not decided here

Cross-context exchange (an artefact through a declared point, I-7), organization memory in the cloud (CX-16, CX-31),
level-2 isolation, and the registries of relations (CX-29) follow their own rows. Nothing here changes Observatory's
vault: a key stays named per project, as today.
