# Runs, graphs, and what the operator sees of an agent's work

> **Target clarification, 2026-09-07:** The following earlier design remains historical context.
> The current task-level proposal is [system-contract.md](system-contract.md) and
> [engineering-specs.json](engineering-specs.json), visualised in [system.html](../reports/system.html).
> ADR-0045–0047 are proposed, not an assertion that runtime or external wire contracts changed.


**Status:** design, 2026-09-06. Covers the operator's visibility asks — the run
model with checkpoints, the per-agent history graph, the project task/plan
graphs, preview widgets — plus the storage/sync visualisation and the selectable
manager seat. Grounded in the 2026-09-06 audit: the graph EDGES already exist in
the data (`task_links.rel`, `needs`, `origin_kind/ref`, `question_blocks`,
`assigned_by/to`, the pack lockfile); what is missing is the run entity and the
readers.

---

## 1. The run — the unit of progress (ADR-0042)

**A run is one execution attempt of one task.** The adopted rule: when there is
a loop, every iteration of the loop counts as a whole run, from one to as many
as happen. A re-run starts a fresh set of step statuses;
history keeps every run.

What identifies a run needs no new id: **a run IS a session bound to a task**
(`task.session.attached@1` already journals the pair). A routine's nightly fire,
a chain step, iteration N of a loop — each opens a session, so each is a run.

### 1.1 The plan and its steps — declared by the agent, tracked by events

The current-task widget needs a plan with checkpoints. The agent already
decomposes (subtasks via `fabric_task_create` + `_link`); what is missing is the
**lightweight in-task plan** — steps too small to be tasks:

```
fabric_plan_declare({ task_id, steps: [{ id, title }] })     → plan.declared@1
fabric_plan_step({ task_id, step_id, status, note? })        → plan.step@1
```

- `status` is ENUMERATED: `planned · active · done · blocked · skipped · failed`
  (the harness rule: an open field grows five spellings of "done" in a week).
- Steps are keyed to **(task, run)** — a new run re-declares or inherits the plan
  and its step statuses start clean; the previous run's statuses are history.
- `blocked` carries what on (`question_id` / `needs`), joining the Board.
- Everything is journalled first; the projection (`task_plans`, `plan_steps`) is
  rebuildable — ADR-0014, nothing new.

**Honesty rule:** a step status is the agent's CLAIM (like `stage.reported`).
The widget renders claims as claims; the things Fabric *observes* — session
alive, heartbeat phase, subtask states, question blocks — are drawn as facts.
Claim and observation are never averaged into one indicator (ADR-0002).

### 1.2 The current-task widget (preview on the agent tile / task page)

```
┌─ Task: "wire the outbox" · run 3 of 3 · working ────────┐
│ ▸ plan 4/7 done                                          │
│   ✓ read the design        ✓ schema probe                │
│   ✓ outbox table           ● retry_after pacing (active) │
│   ○ mutes                  ⊘ telegram send (blocked: Q-9)│
│   ○ feed sentences                                       │
│ heartbeat: working · 40s ago · "pacing per chat"         │
└─ open the run history → SCR-40 ─────────────────────────┘
```

Preview shows: run counter, steps with statuses, live heartbeat line. The FULL
history (every run, every step transition, timings) opens as its own screen.

## 2. The graphs — every one is a query (ADR-0042)

Three graphs, three different questions, ONE storage — the journal and the
projections that exist. No graph is stored; a stored graph is a second copy of
the truth (the Board's own rule, one surface along).

| Graph | Question | Nodes | Edges (all existing data) |
|---|---|---|---|
| **Agent history** (per agent in a project) | what did THIS agent actually do, and how did it get here | tasks it claimed / created / asked about | `origin_ref` (came-from), `task_links.rel` (created→parent), `question_blocks` (asked), handoffs (passed to whom), `assigned_by/to` |
| **Project task graph** | everything all agents did and added — where each task came from, where it is now | all tasks, all agents | the same edges, unioned across agents; colour = status; badge = which agent |
| **Plan graph** | how it SHOULD go, and how it is going | goals → tasks → (runs) | goal membership, `follows` + `needs` (chains), progress overlay from statuses |

**Agent history is the DID graph; the plan is the SHOULD graph.** The operator
named the distinction and it is load-bearing: the first is assembled from what
happened (journal — it cannot be wrong about the past), the second from
declarations (goals, chains — it is a commitment). They are two screens, not one
with a toggle, because overlaying them invites reading a plan as history.

### 2.1 Where they live

- **Preview widgets** on the project page and the agent tile: last N nodes of
  the DID graph, progress fraction of the SHOULD graph. Density principle
  (ADR-0041): the widget is the main number plus a one-line sparkline of nodes;
  everything else behind the open.
- **Full graphs are their own screen** (SCR-40, one screen, three tabs — agent
  DID / project DID / plan SHOULD), rendered appropriately for the graph kind:
  DID graphs are time-ordered left-to-right; the SHOULD graph is the dependency
  DAG. Every node opens its subject (task page, question, session transcript).

## 3. Storage and sync — what the user sees, what they should

### 3.1 The stores, and their sync paths (measured inventory)

| Store | Synced how | Visible today | Should see |
|---|---|---|---|
| Journal | THE source; append-only | feed (SCR-30) | unchanged |
| Projections | derived, rebuildable | each surface | rebuild button + last-rebuild receipt (exists in harness) |
| `memory_facts` | journal-first, bi-temporal | SCR-34 (M135) | + **lineage on click**: superseded chain, source session |
| Transcripts | captured at exit, redacted | SCR-31 panel | unchanged |
| Context packs | compiled per session, lockfile journalled | **nothing** | **the pack preview** (§3.2) |
| Retrieval log | journalled incl. misses | SCR-34 misses panel (M135) | unchanged |
| Declared mirror | estate → git YAML (M118, ADR-0002) | workspace panel | + drift state: "mirror behind by N events" |
| `fabric_feedback` | anonymised copy (M183) | designed: visible queue | as designed |

### 3.2 The pack preview — the cheapest, most explanatory memory view

The pack is deterministic and its lockfile is already journalled. A "what will
the next agent be handed" button on the memory screen compiles the pack DRY —
same code path, no session — and shows: the facts chosen (with why: current,
newest-first), the transcripts included, what was OMITTED by the budget and how
close the budget is. This answers the operator's actual question about memory —
*"how does an agent get data"* — with the artefact itself instead of a diagram.

## 4. The manager seat is a binding — ours or an external agent (ADR-0043)

The operator wants the manager/CEO selectable: the built-in one, or an external
agent such as Claude Code. The design reuses three standing decisions:

- **ADR-0010:** an agent is a provider bound to a ROLE. The manager is a role.
- **ADR-0021:** execution placement is a property of the binding.
- **ADR-0039:** auditability lives in the TOOLS, not the loop's shape — which is
  exactly what makes the seat swappable: the loop above the tools may be anyone's.

### 4.1 What is fixed and what is selectable

| | Fixed (Fabric's, non-negotiable) | Selectable (the seat) |
|---|---|---|
| The deterministic core: rank, hygiene, criticality, digest | ✅ scripts on the tick | — |
| The checker: every proposal validated, refusals journalled | ✅ | — |
| The floor: `settle_by_citation` refuses no-basis in the schema; trust ceiling | ✅ | — |
| The manager TOOLS (board list, settle, prioritise-propose, task_create…) | ✅ one tool surface | — |
| The judgement loop above the tools | — | **built-in loop** (M175) or **an external runner** (claude-code, codex, pi) |

An external manager is hired exactly like any agent: a binding with
`role = manager`, `provider_ref = claude-code`, instructions, and a scoped
manager credential. It reaches the SAME tools over the SAME surface — so every
settlement it makes passes the same schema floor and lands in the same journal.
**Swapping the seat changes no guarantee**, which is the point.

### 4.2 Lifecycle — wake, verify, pass data

The operator's three verbs, each answered by an existing mechanism:

| Verb | Mechanism |
|---|---|
| **Wake** | the routine tick (manager cadence), or on a Board delta since the last manager run — both existing routine machinery |
| **Verify / "будить"** | the heartbeat (M178) with `phase`, the OUTSIDE watch (M179: `context.read` absent → harness-break), and the trajectory eval (M176) over its journalled tool calls — an external manager is watched exactly like any agent, because it IS one |
| **Pass data in** | the MANAGER PACK: a context pack whose content is the Board slice, open questions, estate settings and the trust level — compiled like any pack, lockfile journalled, so "what did the manager know" stays answerable |
| **Pass data out** | ONLY through tools. A manager's prose is not a channel; its settlements, priorities and created tasks are journalled tool calls, and anything it "says" outside the tools does not exist |

**Cost note, stated up front:** an external seat spawns a session per wake (PTY,
credential, transcript). The built-in loop is in-process calls. Both are
metered; the seat picker shows the difference rather than hiding it.

## 5. The work plan — blocks, order, and what each changes

Foundations-first (the standing rule), security ahead of features. Each block
lands with its UX pass (scenario → flow → screen) immediately before its build.

| Block | Contents | Layer | Waits on |
|---|---|---|---|
| **A · security** | **M195** redaction at the agent surface (S1) + entropy check (S5) · **M196** sandbox investigation (S2) · S3/S4 folded into M161/M151 as requirements | 0 | nothing |
| **B · foundations** | M97 projector dissolve → M109 sweep → M98 split → M102 loaders → M105 scrollback | 0–1 | nothing |
| **C · health + runs** | M177 cheap gaps → M178 heartbeat → M179/M180/M181 → **M188 runs + plan steps** (tool, events, projection, probe) | 2 | nothing |
| **D · Board loop** | M149 ask-tool → UX pass → M151 surfaces (+S4) → M152 answer→decision → M153/M184 hygiene+retro → M154 | 3 | C for heartbeat on tiles |
| **E · visibility** | **M189** current-task widget → **M190** SCR-40 graphs screen (DID agent / DID project / SHOULD plan) → **M191** pack preview + memory lineage + mirror drift | 3–4 | C (runs), D (questions on graphs) |
| **F · manager seat** | M166–M168 core+port+checker → **M194 manager-as-binding** (tools, manager pack, seat picker) → M175 built-in loop → M176 eval | 4 | D (the Board is what it manages) |
| **G · deep UX audit** | `/ux-audit` deep over all scenarios once D+E land | — | D, E |
| **H · Telegram** | M159–M165 (+S3 requirement in M161) | 5 | D |

Что меняем / что изучаем / что добавляем — по блокам: A меняет границу
поверхности (одна функция + проба); B меняет структуру без поведения (в этом его
проверка: `git diff` поведения пуст); C добавляет два инструмента и две проекции;
D добавляет три поверхности и замыкает продуктовый цикл; E — только читатели
(запросы + экраны), ноль новых хранилищ; F добавляет роль и picker, изучить —
формат manager-брифа для внешнего раннера; G — прогон, не стройка; H — по
готовому дизайну ADR-0037.
