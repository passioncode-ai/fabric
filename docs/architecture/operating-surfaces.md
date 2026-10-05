# Operating surfaces — the board, the task page, the threads, the leases

**Status: proposed**, written 2026-09-05 from the operator's 2026-09-03 intake
(M118–M135), the screen walk of 2026-09-04 (SCR-30…39, gaps П-1…П-21) and the
2026-09-05 project audit. This is the design for the layer BETWEEN the spine that
exists — journal, projections, policy, memory, the agent surface — and the
screens that are drawn. Module design for the spine itself stays in
[`iteration-1-modules.md`](iteration-1-modules.md); this file owns what the
intake added and names every event, table and tool it needs, so the build is a
transfer rather than a re-derivation.

## 1. The one rule of the layer, stated once

Three independent decisions during the screen walk landed on the same boundary,
which makes it a system rule rather than a screen's taste:

> **Working context is bounded and disposable; knowledge lives in one place and
> outlives it.**

- a task note does not accumulate knowledge — it **promotes** to project memory,
  and the task keeps a link;
- a task page does not become documentation — it **links** to `docs/` and memory;
- a manager thread does not become an archive — it is **per project**, folds, and
  what deserves to survive leaves as an artifact or a fact.

Every design below is this rule applied. Where a table or event seems missing,
check first whether the thing is working context (then it is local and
disposable) or knowledge (then it is memory, the journal or `docs/` — which
already exist).

## 2. What already exists and is reused, not rebuilt

Measured against the schema and the contract, not recalled:

| Need | Already exists | Where |
|---|---|---|
| decisions for the digest and the graph | `memory_facts.kind = 'decision'` | migration 10; `fabric_memory_remember` already accepts the kind |
| goals | `goals` table with an autonomy level | migration 1, empty — M144 fills it, no schema change |
| lease semantics | **normative in the contract**: `coordination.schema.json` defines `claim`/`renew`/`release` with `work`, `owner`, `idempotencyKey`, `expiresAt`, `writeScopes` | `fabric-agent-contract` 0.1.0 |
| who-did-what per agent | the journal, filtered by actor | SCR-39's history column is a query |
| task provenance fields | `actor {kind,id}` on every event | ADR-0027 envelope |
| the agent's door | `AgentSurface` with per-session credentials | `agentSurface.ts` — the task tools EXTEND it |

## 3. Events — the vocabulary the layer adds

Per ADR-0014 nothing gets a table without an event behind it. All are
project-scoped. Registered in one migration, exactly as the authority plane was
(M138).

```
tasks     task.created@1        {id, title, origin: {kind: observation|person|task, ref}, task_type, section}
          task.assigned@1       {task_id, assigned_by: actorRef, assigned_to: bindingRef|'operator'}
          task.moved@1          {task_id, from, to}          -- board drag, agent tool, or state action
          task.closed@1         {task_id, outcome: done|cancelled, reason?}   -- cancel REQUIRES reason
          task.linked@1         {task_id, rel: blocks|follows|spawned, target_task_id | goal_id}
          task.note.added@1     {task_id, note_id, body_md}                    -- append-only
          task.note.promoted@1  {task_id, note_id, fact_id}                    -- the note LEAVES for memory
          task.brief.edited@1   {task_id, section: what|why|expected, body_md} -- operator override, agent draft kept

leases    work.claimed@1        {work: task_id, owner: session_id, idempotency_key, expires_at, write_scopes[]}
          work.renewed@1        {work, owner, expires_at}
          work.released@1       {work, owner, outcome: succeeded|failed|cancelled|expired|abandoned}
          -- kinds and fields are the contract's coordination schema, journalled;
          -- expiry is written by the reconciler that already closes orphaned tasks (M43)

goals     goal.defined@1        {id, title, autonomy}
          task.prioritised@1    {goal_id, task_id, position}   -- order is a FIELD, not a screen's opinion

registry  agent.registered@1    {descriptor_id, label, program, args[], env{}, permission_modes[], surface_adapter}
          -- terminal.opened@1 payload GAINS permission_mode (additive, no @2 needed)
```

**Existing `task.started@1` stays.** `task.created@1` precedes it: M79's backlog
state is a task that exists before anything runs. The reconciler treats a
`created` task with a dead lease exactly as it treats an orphaned `open` one.

## 4. Projections — four changes, one new table, one deliberate non-table

| Projection | Change |
|---|---|
| `project_tasks` | gains `title`, `task_type`, `section`, `goal_id`, `position`, `origin_kind`, `origin_ref`, `assigned_by`, `assigned_to`; `status` ladder becomes `backlog → running → review → done / cancelled` (existing rows map: open→running, finished→done, abandoned→cancelled with reason) |
| `task_notes` | **new**: `(id, task_id, author_kind, author_id, body_md, promoted_fact_id, created_at)` — append-only by construction: no UPDATE grant on any role, same technique as the journal |
| `task_links` | **new**: `(task_id, rel, target)` with the DAG check at write time (M91) — see §4.1, which is the rule the check taught the whole layer |
| `leases` | **new**: `(work_id, owner_session, expires_at, write_scopes, claimed_seq)` — current holders only; history is the journal |
| `threads` | **not built, and not because it was forgotten.** Step 8 reached this row and found there is no model behind the CEO: a chat that echoes is a notepad pretending to be a colleague, and a table nobody writes to is a schema pretending to be a feature — the same lesson `agent.registered@1` taught in step 6. What the mockup's CEO actually DID — name what is waiting and offer the act that resolves it — needs no model, and that is what step 8 built instead (`shared/attention.ts`). The decision that was recorded here stands for when a model arrives: chat text is working context, so it lives in a local table and is never journalled, because journalling it would turn the estate's record into a chat log and the record must stay smaller than what it describes. What it would take is named: a provider, a key, a budget the wallet meters |

The task page's brief lives ON the task row (`brief_what/why/expected` +
`brief_author`), with the agent's draft kept in `brief_draft` when the operator
overrides — both versions readable, per the two-writers rule.

### 4.1 A projection may not refuse what the journal accepted

Found by building this layer, not by reasoning about it. The cycle check started
life as a trigger on `task_links` and nothing else. A probe then appended three
cyclic edges to the test estate's journal — and `rebuild_estate_projections`
**aborted at that event and could never finish again**. The estate was
permanently unrebuildable: replay re-attempted an event the journal had already
accepted, the trigger refused it, and the whole loop rolled back.

That is ADR-0014's spine violated from underneath. The journal is the record;
projections are derived from it. A derived thing that can veto its source is not
a projection — it is a second, disagreeing authority, and the disagreement
surfaces as an estate that cannot be rebuilt.

**The rule, which applies to every projector branch this repository will ever
add:** a guard belongs at the WRITE boundary — before the event is appended —
never on the replay path. Concretely, three callers with three jobs:

| Caller | Job | On a cycle |
|---|---|---|
| `link_tasks` (the command) | the only writer of `task.linked@1` | refuses, with the cycle named — the answer a caller can act on |
| the trigger on `task_links` | defence for direct table writes | raises; nothing legitimate reaches it |
| `apply_task_link` | replay | drops the edge and `raise warning`s — **never aborts** |

The projector's drop is reachable only by writing to the journal around the
command. It is loud rather than silent because of this repository's own rule that
a no-op reporting success is indistinguishable from work.

**And the write boundary is a COMMAND, not a check the caller remembers to run
(ADR-0053).** The rule above says a guard belongs before the append; it did not
say the guard and the append must be the same act, and that gap held three
measured failures at `d28c321`. The check ran in the client with `error`
destructured away, so a check that could not run waved the write through. It ran
in a separate round trip, so two clients writing `A→B` and `B→A` both read *no
cycle* and both wrote. And the second event was then dropped by the projector,
leaving the journal holding an edge the board does not contain — the divergence
this whole section exists to prevent, arriving from the other side.

`link_tasks` takes the estate's advisory lock — the one `append_event` already
took — **before** it asks, so scope, project, idempotency, topology and the
append commit or fail together, and every outcome is a typed `reason_code`.
`scripts/check-commands.mjs` refuses a direct append of a commanded event type.

**`spawned` is provenance, not dependency.** Only `blocks` and `follows` order
what may run next, so only they can form a queue nobody can act on.
`link_is_dependency(rel)` is the single definition the walk, the trigger and the
projector all read: a record of what happened is never refused for the topology
of what may happen.

**What to check when adding any projector branch:** could this branch raise on
an event that a previous version accepted? If yes, the estate is one bad event
away from being unrebuildable, and the guard is in the wrong place. The probe
that proves it is a rebuild AFTER the offending event exists — not before.

## 5. The task tools — M123 as a contract, not a document

Six tools join the agent surface, closed over the same per-session scope, so an
agent can only work its own project's board:

| Tool | Does | Journals |
|---|---|---|
| `fabric_task_claim` | lease a task (contract `claim`); refuses if held, and READS THE LEASE BACK — two agents that see "free" in the same instant both append, and the projection arbitrates by seq | `work.claimed@1` |
| `fabric_task_move` | change state; refuses transitions the ladder forbids — and its schema offers an agent only `backlog`, `running`, `review`, so §5.1's rule is not merely enforced but unphraseable | `task.moved@1` |
| `fabric_task_create` | file adjacent work; **requires `origin`** — a card with no evidence is refused at creation | `task.created@1` + `task.assigned@1` |
| `fabric_task_note` | append to the task's notes | `task.note.added@1` |
| `fabric_leases_list` | who holds what in my scope — the neighbour visibility M123 exists for | — (read) |
| `fabric_task_release` | release with an outcome (contract `release`) | `work.released@1` |

`fabric_stage_report` stays as is — a claim, not a state change. The instruction
layer follows the Orca lesson already recorded in this repo's study: **the stub
on disk says only "call the tools"; the full, version-matched contract is what
`fabric_whoami` returns**, extended with the task rules. A document cannot drift
from the binary when the binary is the document.

### 5.1 An agent does not close its own task

The ladder lives in `apps/desktop/src/shared/ladder.ts` and it knows who is
asking. An agent may move work to `backlog`, `running` or `review`; `done` and
`cancelled` are a person's moves, in both directions.

This is the product's thesis in one table. An agent's account of its work is a
CLAIM, and a claim that can write itself into an outcome is indistinguishable
from the outcome — which is the confusion ADR-0008 hosted the terminal to
prevent. The vision says we automate explicit loops and not implied authority;
an agent marking its own work done is implied authority with no receipt. When we
do want it automated, it goes through a grant like any other floored act, not
through a quietly widened enum here.

It is enforced twice, and the second is stronger than the first: `mayMove`
refuses it, and `fabric_task_move`'s schema does not offer the word. The agent
meets `expected one of "backlog"|"running"|"review"` — a refusal it cannot
rephrase and therefore cannot retry. The ladder is shared rather than living in
the tool because step 4 makes the board draggable and will need the same answer;
two copies of a permission table is how a rule stops being one.

## 6. The agent registry — M116's second half, and the ARCH-03 correction

`launchOptions()`'s two hardcoded rows become a descriptor table (seeded with
the same two, so nothing changes until a third is added):

```ts
AgentDescriptor {
  id, label,
  program: string | null,           // null = login shell
  args: string[],                   // static args
  env: Record<string,string>,       // e.g. GOOSE_MODE=auto — spawn merges it
  detect: string,                   // binary probed with `env which`
  permissionModes: {id, label, args: string[]}[],  // plan / ask / bypass — per LAUNCH, journalled
  surfaceAdapter: 'mcp-config-flag' | 'none'       // how THIS cli learns mcp.json; claude-code = flag
}
```

The chosen `permission_mode` rides in `terminal.opened@1`, additively: a reader
that predates the field sees it absent, which is what "we did not record it"
should look like.

**M95 has shipped and bypass is available**, with its residue named rather than
its history erased. The three-place refusal is still the pattern for anything
blocked — the descriptor carries the reason, `mayLaunch` refuses, and
`PtyManager.open` asks again at creation, because a picker is a suggestion and
the check at spawn is the rule.

What changed: secrets are removed from a session's output BEFORE it reaches the
spool file, and the count travels with the record. What did not: the redactor
matches shapes, so a credential that looks like an ordinary word still passes.
So `blockedKey` became `warnKey` — a downgrade, not a deletion. A block that
turns into silence when its condition clears spends the reader's trust once and
keeps nothing; a block that turns into a warning keeps the reason available to
the person choosing.

The registry is CODE, not rows, and `agent.registered@1` still projects to
nothing. A table would let an agent be added at runtime, which is M17's job and
is not scheduled; a table nobody writes to is a schema pretending to be a
feature. The return trigger is written where the empty branch is: the first
agent that must exist without a release.

**ARCH-03:** `iteration-1-modules.md` §11's `NodeResult` sketch is replaced by a
reference: the envelope IS `result.schema.json` of the pinned contract —
`{id, contractVersion, outcome, done[]: {claimId, statement}, proof[], scope,
notVerified, artifacts[], createdAt, producer}` — and `costUsdEstimate` moves to
a Fabric-side annotation stored NEXT TO the envelope, never inside it, because
the contract forbids additional properties. ADR-0012 said "do not copy schemas";
the sketch copied one badly, which is exactly why the rule exists.

## 7. Build order — each step leaves the product usable

Mapped to the release ladder already agreed; the layer's own internal order:

| Step | Builds | Usable/testable after |
|---|---|---|
| 1 | migration: events + projections + ladder mapping; the DAG trigger **watched failing on a planted cycle** | old tasks appear in the new ladder untouched |
| 2 | board read-only (SCR-31 centre) from `project_tasks` | existing tasks lie in columns; drag disabled |
| 3 | task tools on the surface + leases; probe = two fake agents contending for one task | an agent moves a card, the board follows the journal |
| 4 | drag as `task.moved@1` with refusal rollback; task state actions (close/cancel-with-reason) | the operator and the agent share one board honestly |
| 5 | task page (SCR-32): brief, notes, promote-to-memory, receipts | a task is understandable cold |
| 6 | registry + permission mode (M116/M17); ARCH-03 doc fix lands here | a third agent = one descriptor row |
| 7 | goals + prioritise + graph read-only (SCR-33) | direction is visible; orphan backlog names itself |
| 8 | threads table + CEO chat pane (SCR-30/31 third column) | a conversation ends in an artifact or in nothing, stated |

Steps 1–5 need nothing from slice 3; steps 6–8 are its first half arriving
early, which `iterations.md` already allows ("only the blocks that ship next are
detailed").

## 8. What this deliberately does not build

Return triggers named, per the diet's discipline: thread sync across machines
(single-operator until M38); graph EDITING beyond drawing task/goal edges (the
decision nodes come from memory and ADRs, which have their own doors); a
notification transport for the attention queue (M8, after the queue exists);
per-column WIP limits (a rule nobody asked for yet); task search (M141 owns
search, one door for everything).

## 9. What was built after the eight steps, and the rules it settled

The build order above finished; nine more surfaces followed. This section exists
because those surfaces settled decisions that otherwise live only in commit
messages and code comments, and a person returning to this repository reads a
document rather than a git log. It is written in the same change as the last of
them, not as a catch-up — the catch-up is what it is CORRECTING, and that
correction is itself the finding: verification rows and screen states were kept
current for ten iterations while this file, which says why the pieces are
SHAPED as they are, stood still.

### 9.1 Three surfaces have no model behind them, and say so

The CEO panel, the digest and the decisions view were all asked for as things a
model would produce — a colleague to talk to, a summary to read, a graph to
look at. There is no model in this product. Each was built as the half that
needs none, and each says what the other half would take:

| Surface | The half that is real | What the other half needs |
|---|---|---|
| CEO panel | what is waiting, derived from state, with the act that resolves it | a provider, a key, a budget the wallet meters |
| Digest | rows that exist, each carrying the store and id that open it | nothing — a summary written by a model would be a CLAIM about the project rather than a reading of it |
| Decisions | every decision with what it replaced beneath it | edges. Measured: 44 decisions, zero superseded, so the graph has none |

The pattern is one decision made three times: **where a model is missing, build
the half that needs none and name the other half.** A text box with nothing
behind it implies a model exists; an empty diagram implies edges do.

### 9.2 Operator-local state is not estate truth

Three things are facts about the PERSON at the desk rather than about the
estate: which projects they pinned, which they have caught up on, and which
side panel is open. None is journalled. `main/localStore.ts` holds the first
two, extracted the moment there were two — one copy of "tolerate a missing
file, never let a failed read look like an empty answer" is a utility, two are
a pair that drifts.

The boundary is the same one that kept CEO threads out of the record: **the
record has to stay smaller than what it describes**, and it would not if it
grew every time somebody glanced at a screen.

Return trigger, written where the code is: when a second person can sign in
(M38), a favourite becomes a `(person_id, project_id)` row, because then it
stops being "this machine" and starts being "this person".

### 9.3 One derivation, several views

The estate card's "N waiting" and the CEO panel's list come from one call and
one grouping function. This is a rule rather than an optimisation: **two
numbers describing one thing, on two surfaces, is worse than one surface having
none** — the operator cannot tell which is wrong, so neither is usable.

The same rule put every panel on the project page onto the journal's
high-water mark. Before that the board followed it and three neighbours read
once on mount, so an agent recording a fact left the board saying five tasks
and the plan saying four, both on screen.

### 9.4 A duplicated list is acceptable only when a gate holds it

The harness screen reads `shared/surfaceTools.ts` rather than running an MCP
client against the main process. That duplicates the tool registrations, and the
duplication is legitimate ONLY because the surface probe asserts the manifest
equals what the server registers — a tool added without a row fails the build.

The general form: a second copy of anything is a decision to maintain a
disagreement, and the only honest version of it is one a check keeps in step.

### 9.5 What each surface refuses to show, and why that is design

Three numbers were deliberately not built, and each absence is stated on the
surface itself rather than left as a gap:

- **Per-tool call counts.** Sixteen tools, eleven of which journal. A count
  taken from the journal would show the other five as unused — worse than no
  number, because it reads as a measurement.
- **A miss rate with no denominator.** Nothing asked and an unreadable log are
  two different reasons to have no rate, and neither of them is zero.
- **"Nothing matches" from a partial search.** Only claimable when every store
  answered; otherwise the search is inconclusive and names who was silent.

One rule underneath all three: **a number that is an artefact of what we could
measure, presented as a measurement of the estate, is the most expensive kind of
wrong** — it is believed.

### 9.6 The seams that were declared and not implemented

Two, both found by trying to use them rather than by reading:

- `surfaceAdapter` was on every agent descriptor from step 6 and read only by a
  test asserting a constant equals itself. The bundle compiler hardcoded one
  agent's flags for all of them. It dispatches now, and an unimplemented adapter
  REFUSES rather than borrowing another program's arguments.
- The descriptor could not express an agent's ENVIRONMENT, so "adding an agent
  is one descriptor row" was false for any agent configured by env rather than
  by flags.

Both are the same lesson: **a design assertion about extension is worth exactly
the first time somebody extends it**, and with one instance both sides of a
seam look identical.

### 9.7 The rules were served and never delivered, and now they are observed

§5 says the stub on disk says only "call the tools" and the version-matched
contract is what `fabric_whoami` returns. The second half shipped; **the stub did
not exist at all**. What asked an agent to make that call was one sentence inside
a tool description — "Call this first" — which an agent may never read and need
not obey. An agent that skipped it never learned that it may not close its own
task, that a note is not documentation, or that spending money needs a person.

Three things settled it, and the third is the one that matters:

1. **One stub, incapable of holding a rule.** `shared/preamble.ts` points at
   `fabric_whoami` and stops. A test asserts it names **no other Fabric tool** —
   because the pressure to also paste "and remember not to…" into a system prompt
   is constant and always feels harmless, and the moment a rule lives in two
   places, one of them is free to go stale.
2. **Delivery is the adapter's business.** `mcp-config-flag` carries it as
   `--append-system-prompt`; `none` carries nothing, which is correct rather than
   a shortfall — every descriptor on that adapter has `connectsToSurface: false`,
   so there is no tool for the text to point at. An adapter that DID connect and
   could not carry a preamble would have to be decided at the dispatch, which is
   what makes `unimplemented`'s refusal load-bearing rather than tidy.
3. **The instruction is observed, not assumed.** A preamble is a claim until
   something records the result, so `fabric_whoami` journals `session.oriented@1`
   once per session. **A session with no such row worked without the rules it was
   bound by** — and that is a fact about our delivery, not about the agent. It is
   the only way to find out whether any of this does anything at all.

The flag was verified against the binary rather than against memory: `claude
--help` lists `--append-system-prompt`, and a print-mode call with a planted
codeword returned it. A flag that a runner silently ignores would have passed
every test written here and delivered nothing.

## 10. Messaging between projects — the participant tools (COM-02.2, ADR-0117)

A session's surface also carries the participant half of `fabric-project-comms/0.1`. It is registered by
`apps/desktop/src/main/boardTools.ts#registerBoardTools` and served by
`apps/desktop/src/main/boardService.ts#createBoard`, over the SQL commands of migration 79
(`20261005000081_project_board.sql`).

| Tool | Does | Journals |
|---|---|---|
| `com.submit` | sends a message or a request to other Projects, addressed to a Project and never a session; the same key and message return the same receipt | `comms.message_submitted@1` (ids and digest, never the body) |
| `com.list` | one page of what the session's Project takes part in, oldest first; the cursor is bound to this reader, filter and run | — (read) |
| `com.get` | one message; an absent one and another Project's read alike | — (read) |
| `com.read_ack` | an explicit read mark; reading alone marks nothing | `comms.read_acked@1` |
| `com.status` | whether the board can be read and the unread count; no responders until COM-03, mirror off | — (read) |

- **Identity comes from the scope.** The session's Project is the sender or reader, and its principal is the
  session itself, `trusted`. The SDK is handed an open input schema on purpose. The service validates every
  call against the contract's shapes and answers a refusal in the contract's form. An undeclared field such
  as a forged `estate_id` is refused, not silently stripped.
- **Unreadable is not empty.** A board that cannot be read answers `not_available` (`com.list`, `com.get`,
  `com.submit`) or `board.state: unavailable` (`com.status`), never an empty page.
- **Not built yet:**
  - `com.reply` and `com.cancel` (COM-02.3);
  - the responder tools (COM-03);
  - enrollment of agents Fabric did not start (ADR-0117 §3);
  - any screen (COM-06/07).

  `scripts/check-surface-tools.mjs` keeps `apps/desktop/src/shared/surfaceTools.ts` equal to what both
  modules register.

