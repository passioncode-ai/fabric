# Execution briefs — one self-contained brief per task

**Dated 2026-09-06.** Each brief carries what a DIFFERENT agent needs to make the
right calls without re-deriving context: where it sits, the exact contract, the
files it will touch (by symbol, not line), the boundary of what it must NOT do,
the retro traps that already bit us here, and the acceptance a reviewer checks.

**v2, same day — after a self-audit that found one brief contradicting a recorded
operator decision, one false dependency, and one ordering that made review harder.
The audit findings are listed at the bottom; the briefs below are corrected.**

**How to work one:** read `~/.claude/CLAUDE.md` + `CLAUDE.md` first (the gate and
projector rules are non-negotiable). **Step 0 of every brief: re-measure its
claims against the tree** — three audit rows in this repository have already
expired between writing and working, so a brief's facts are checked, not trusted;
if the tree moved, update the brief and say so before building. TDD — planted
defects watched being caught. Take an agent-sync lease on any guarded file. End
with the iteration contract: living map entry, anchors, retro — **and the
standing question to the operator: did we plan this right, and are we doing the
right thing, naming the specific choices they might overturn.**

Order is the backlog's layer order. `→` marks a hard dependency.

---

## BLOCK A — security first

### M195 · Redaction at the agent surface  ·  layer −1  ·  no deps

**Why now.** `redact()` (`shared/redact.ts#redact`, M95) is applied to
transcripts and to nothing an agent writes through a tool. A secret an agent
writes into a `memory_facts` claim becomes a CURRENT fact → `contextPack.ts`
puts current facts into EVERY next session → it multiplies through transcripts,
and a question carrying one reaches the Board and (R3) Telegram. HIGH.

**Contract.** Every agent-written free-text field is passed through `redact()`
at the surface boundary before it is journalled:
- `fabric_memory_remember` → the `claim`
- `fabric_task_note` → the body
- `fabric_task_brief` → each brief field
- `fabric_question_ask` (M149) → `text`, `why_blocked`, each option label —
  **this line lands with M149, not here**: the tool does not exist yet, and M195
  covers the tools that do; M149's own acceptance asserts redaction on its fields
The redaction COUNT is journalled on the event (like transcripts already do), so
"this fact was scrubbed of 2 secrets" is answerable; the raw secret is never
stored, not even redacted-in-place with a marker that reveals length.

**Files.** `main/agentSurface.ts` (the tool handlers — search the `fabric_*`
registrations); reuse `shared/redact.ts#redact` and `#describeRedactions`
unchanged. No schema change — the scrubbed text is just what gets written.

**Boundary.** Do NOT redact `about` keys (they are subjects like `db.version`,
not free text) or ids. Do NOT change `redact.ts` — it has its own tests; you are
adding CALLERS.

**Retro traps that apply here.** Probe scripts never use bare backticks in
template literals (`check-probes.mjs`). A planted defect must be VALID code that
behaves like the old defect — here, a handler that writes the raw claim — not a
deletion that fails to compile.

**Acceptance.** A probe plants a fake token (`sk-live_…` shape) in each field,
drives the tool, and reads the stored row back: the token is gone, the count is
on the event. Watch it fail first by pointing at the pre-fix handler. Also assert
mint entropy ≥128 bits (S5) in the same probe. `ci.sh full` green.

---

### M196 · Window sandbox  ·  layer −1  ·  no deps

**Contract.** The three `BrowserWindow`s in `main/index.ts` run `sandbox: false`.
The preload uses only `contextBridge` (`preload/index.ts`), so `sandbox: true` is
likely compatible. Turn it on; if a real incompatibility surfaces, record the
exact reason in the window's own comment. An undocumented `sandbox: false` reads
as an oversight forever.

**Acceptance.** App boots (`pnpm --filter @fabric/desktop smoke` → `SMOKE OK`),
the editor and session windows open and function, OR the comment names what
broke. No test can prove this alone — it is watched in the running app (`/run`).

---

## BLOCK B — foundations (structure, not behaviour)

### M97 · Dissolve the legacy projector  ·  layer 0  ·  no deps

**Why.** `apply_projections_legacy` is the monolith nine migrations have edited;
every new concern already goes into its own `apply_*` function off the dispatcher
(`apply_questions`, `apply_priority`, …). This finishes that migration: split the
legacy body into per-concern functions the dispatcher calls, so no one edits a
193-line copy again.

**Contract.** Behaviour is BYTE-IDENTICAL. The event→projection mapping does not
change; only its structure does. The dispatcher `apply_projections` calls the new
functions in the SAME order the legacy body ran its `case` arms.

**Files.** A new migration (next number). Copy each `when '…'` arm out of the
legacy function into `apply_<concern>(e journal)`, `revoke execute` on each new
function (the pattern every existing per-concern fn follows). Leave
`apply_projections_legacy` callable but empty, or drop its call — decide by
whether any arm resists extraction, and say which in the migration comment.

**Boundary.** No new event types, no new columns, no behaviour change. If you find
a latent bug while splitting, do NOT fix it here — journal it as a finding; a
refactor that also changes behaviour cannot be reviewed.

**The overlap trap — measured, not hypothetical.** `task.finished@1` and
`task.started@1` appear in NINE migrations, `task.abandoned@1` in six: several
event types are handled by BOTH a legacy arm and a per-concern function (0016's
comment on `task.abandoned@1` records the both-run semantics deliberately). So
step 1 is an INVENTORY: list every event type against every function that touches
it, and for each overlap decide keep-both (current semantics) or collapse — with
the decision written in the migration comment. Splitting without the inventory
silently changes which arm wins.

**Retro traps.** The proof of a pure refactor is that behaviour did not move:
`supabase db reset` + the FULL `planted.test.mjs` (24 probes) must pass unchanged.
A migration that fails to apply from zero is the failure, not a red probe.

**Acceptance.** All 24 probes green after `db reset`. A rebuild-parity probe:
row counts + per-table checksums of every projection BEFORE the migration and
AFTER a full rebuild through the new dispatcher — equal, or the refactor moved
behaviour. `ci.sh full` green.

---

### M98 · Split the two monoliths  ·  layer 1  ·  → M97
*(order flipped in v2: the split is MOVE-ONLY and reviewed as such; running the
sweep first would mix edits into a diff that must contain none. The sweep then
lands on small files where each drift is reviewable.)*

See the full brief below — unchanged except its position.

### M109 remainder · The `Returns<>` sweep  ·  layer 1  ·  → M98

**Why.** `Returns<FabricApi[…]>` (`main/index.ts`) ties a handler's return to the
one declaration the renderer holds; it was applied to 3 handlers and found 3
drifts. ~40 remain unannotated.

**Contract.** Annotate every `ipcMain.handle` return with
`Promise<Returns<FabricApi['ns']['fn']>>`. Where `tsc` then flags a drift, FIX
the handler to match the declared contract (or, if the declaration is wrong, fix
the declaration — and say which in the commit). Mechanical, but each drift is a
real finding.

**Files.** `main/index.ts` (all `ipcMain.handle` sites), `shared/types.ts`
(`FabricApi`) only if a declaration is the wrong side.

**Acceptance.** Every handler annotated; `pnpm -r typecheck` 0; each drift found
listed in the commit with which side was wrong.

---

### M98 · Split the two monoliths — full brief  ·  → M97

**Why.** `main/index.ts` is 2 692 lines, `ProjectHome.tsx` 1 786 — both tripled/
doubled since the audit flagged them. The IPC handlers already group by prefix
(terminal 8, tasks 7, workspace 5, projects 5, repos 4, files 3…); ProjectHome
already splits into section functions (`BoardSection`, `ReposSection`,
`AgentsSection`, `MemorySection`, …). Split along THOSE seams.

**Contract.** Extract handler groups into `main/ipc/<domain>.ts` modules
(`registerTaskIpc(ctx)`, `registerTerminalIpc(ctx)`, …) taking a typed context
of the shared singletons (`db`, `journal`, `ptys`, `surface`, …). Extract
ProjectHome's sections into their own files. **v4 (module review F1): the scope
includes the THIRD monolith — `agentSurface.ts` at 1 290 lines — split by tool
domain (`surface/tasks.ts`, `surface/memory.ts`, `surface/questions.ts`, …) with
the credential/transport core staying in one place.** NO behaviour change.

**Boundary.** Do not reorder handler registration relative to bootstrap (some
depend on `db`/`ptys` being set). Do not touch M102/M105 while here — they are
the NEXT bricks and the split is what makes them reviewable.

**Retro traps.** A `git checkout`/relative `cd ..` has destroyed work here before
— restores use absolute paths, verified by content. The split's proof is that
`ci.sh full` and the renderer suite pass unchanged.

**Acceptance.** By ROLE, not by line count: `main/index.ts` holds bootstrap and
wiring only — no `ipcMain.handle` bodies; `ProjectHome.tsx` holds composition
only — no section implementations. All tests green unchanged; the diff is
move-only (a reviewer spot-checks moved handlers byte-identical), which is why
this runs BEFORE the M109 sweep.

---

### M102 · Six loaders off the feed tick  ·  layer 1  ·  → M98

**Why.** `ProjectHome.tsx` fires `loadRepos, loadStats, loadClaims,
loadTranscripts, loadQuota, loadTasks` on an effect whose deps include
`feedMark`; the feed polls every 2 s, so all six go over IPC every 2 s while any
session journals. M107 showed the cure on repo state (own clock + push channel);
apply the pattern.

**Contract.** Each loader moves to the clock that matches its data (M107's
`repoWatch` is the template): event-driven where a journal event implies it,
a slow interval where nothing pushes, and off entirely while the window is
hidden. `feedMark` stops being the universal trigger.

**Acceptance.** A test asserts that N feed ticks with no relevant event cause 0
extra loads for the unrelated loaders (the M107 test is the shape). `ci.sh fast`
green.

---

### M105 · The scrollback tax  ·  layer 1  ·  → M98

**Why.** `pty.onData` does a synchronous `writeSync` then a regex+split+map+filter
over the whole ~400 000-char scrollback to compute a 120-char tail, and ships
that scrollback over IPC every 3 s for all sessions. The main process is also the
MCP server and journal writer.

**Contract.** Compute the tail incrementally (keep a rolling last-line, not a
full re-scan); ship a bounded tail over IPC, not the whole scrollback; the full
scrollback is fetched only when a session window opens (it already reattaches).

**Acceptance.** A probe measures that `onData` cost is O(chunk), not O(scrollback)
— feed a growing buffer and assert the per-call work is flat. IPC payload per tick
is bounded. `ci.sh full` green.

---

## BLOCK C — health + runs

### M177 · Cheap harness gaps  ·  layer 2  ·  no deps

**Contract, four independent fixes (each its own commit is fine):**
1. **Date into the pack** — `contextPack.ts` prepends today's date; a model with
   a cutoff answers staleness from memory otherwise.
2. **Vocabulary into the protocol** — `fabric_whoami`'s protocol block lists the
   allowed task statuses (the ladder's) now; the step statuses join when M188
   lands — a forward reference in the brief, not a dependency.
3. **`actor_kind` in trust** — where the pack presents facts, an agent-authored
   fact is marked distinct from a person-authored one (`memory_facts.actor_kind`
   exists, unused in presentation).
4. **Protocol re-assertable** — `fabric_whoami` may be called again and returns
   the same current protocol, so a CLI compaction that dropped it is recoverable.

**Acceptance.** Each has a unit test on the pure part (pack assembly, protocol
text). `ci.sh fast` green.

---

### M178 · Heartbeat  ·  layer 2  ·  → M177 (protocol block)

**Contract.** `fabric_heartbeat({ phase, note?, waiting_on? })` → `agent.heartbeat@1`.
`phase` ENUMERATED: `reading·working·waiting·verifying·blocked`. `waiting_on`
present only for waiting/blocked, naming a question id / grant. Projection: last
heartbeat, phase, gap per session. Liveness becomes five states
(`working·waiting·quiet·stalled·gone`, ADR-0040) — a pure function
`shared/liveness.ts` over (last beat, phase, now, thresholds). **Thresholds live
in `estate_settings`** (the row M156 created, journalled on change) — named here
so two agents do not invent two homes.

**Boundary.** The heartbeat is OBSERVED, never refused: an agent that never beats
becomes `stalled`, not blocked. Do not average the claim (phase) with the
observation (gap) — the five-state function takes both and returns one state with
a reason.

**Acceptance.** New event type + feed sentence (`event.agent.heartbeat@1`).
`shared/liveness.test.ts` covers each state and the ambiguity the timer could not
resolve (thinking vs wedged vs blocked). A schema probe on the projection.
`ci.sh full` green.

---

### M179/M180/M181 · Outside watch, failure taxonomy, honest degradation  ·  layer 2  ·  → M178

Three briefs, one block (see `agent-health-and-failure.md` for the full model):
- **M179** — the routine tick raises `harness.break@1` from a heartbeat gap past
  the stall threshold AND from the ABSENCE of `context.read` after a grace period.
  A session producing output that never read its rules is running without the
  harness. Pure function `shared/harnessBreak.ts`; probe.
- **M180** — `onExit`/`SpawnFailure` classify into the eight kinds
  (`agent-health-and-failure.md` §4), journalled with the kind; unknown says so.
  A task that failed HONESTLY is `review` with "no", not a crash.
- **M181** — degradation notes on the review outcome and the notifier: "ran
  without skill X", advisory-unavailable, notifier-partial. Never silent.

**Acceptance.** Each a pure classifier with a test; a `stalled`/`harness-break`
agent appears as a Board obligation (reuses `attention.ts`). `ci.sh full` green.

---

### M188 · Runs + plan steps  ·  layer 2  ·  → M178

**Contract (ADR-0042).** A run is a session bound to a task — no new id.
`fabric_plan_declare({task_id, steps})` → `plan.declared@1`;
`fabric_plan_step({task_id, step_id, status, note?})` → `plan.step@1`. Statuses
ENUMERATED (`planned·active·done·blocked·skipped·failed`), keyed to (task, run).
A re-run starts fresh step statuses; history keeps every run. Projection
`task_plans`/`plan_steps`, rebuildable.

**Boundary.** A step status is a CLAIM. The projection stores it as the agent's
claim; the widget (M189) renders it beside observations, never merged. The plan
tools REQUIRE a claimed task — a plain session with no task has no run to key
steps to, and the refusal names that rather than inventing an anonymous run.

**Acceptance.** A probe: declare a plan, report steps across TWO runs, assert the
second run's statuses are independent and the first run's are retained as history.
Two projector defects planted and caught. New event types + feed sentences.
`ci.sh full` green.

### M182 + M183 · Insight categories + the anonymised loop  ·  layer 2  ·  M182 → nothing, M183 → M182, M195

**M182 contract.** `category` on `memory_facts` — `project` (default) · `agents` ·
`harness` · `fabric` · `process` — CHECK-closed; optional param on
`fabric_memory_remember`; projector upsert extends the same way `kind` does.
Probe: a category round-trips; an invalid one is refused (23514).

**M183 contract.** `fabric_feedback` projection: ONLY service categories eligible
— a `project` insight is refused in the schema, not stripped (its essence IS
project data). A row carries the claim AFTER `redact()` (which is why M195 comes
first) + identifier stripping (paths→basenames, UUIDs→`‹id›`), the version, a
WEEK-coarse date, and **no estate/project/actor/session columns at all** —
anonymity by absence (ADR-0041). The pending queue is a visible list on SCR-35;
the switch is journalled. Upstream transport: named as waiting on an endpoint.
Probe: a `fabric`-category insight lands stripped; a `project` one is refused;
the row has no joinable column.

---

## BLOCK D — the Board loop

### M149 · `fabric_question_ask` + `fabric_question_check`  ·  layer 3  ·  → M148, M195

**Contract.** `fabric_question_ask({project_id, task_id?, text, why_blocked,
kind, about?, options?, blocks[]})` → `question.asked@1` (M148's projector already
handles it — verify the payload shape matches the migration exactly).
`fabric_question_check()` returns answers to questions THIS session asked. The
protocol block (M177) names the obligation "ask rather than guess".

**Boundary.** M195 must land first — question text is agent-written and must be
redacted. `about` is a subject key, not free text (not redacted). An agent that
asks does NOT wait: it records and takes other work or ends.

**Acceptance.** A probe drives ask→projector→row, and `check` returns the answer
after `question.answered@1`. Redaction on `text`/`why_blocked`/options asserted
(M195's function, this brief's fields). **NO per-session cap** — v1 of this brief
required one, contradicting the operator's recorded decision (board-and-ceo §9
Q2: the cap was dropped; a runaway asker becomes ONE board item via the CEO's
hygiene tick, M153). The audit that caught this is why step 0 exists. `ci.sh full`.

---

### M151 · The three Board surfaces  ·  layer 3  ·  → M149, M150, UX pass

**Precede with a UX pass** (scenario → flow → screen states) for "answer a
question from the board" — SCN exists (SCN-041) but the answer flow does not.

**Contract.** One query `boardItems(scope)` in the main process = ranked union of
`open_questions` (M148) + derived obligations (`attention.ts`), ordered by
`rankBoard` (M150, `shared/boardRank.ts`). Three surfaces: top-5 (estate home),
top-10 (project), full screen (all projects, sortable). Project cards count from
the SAME query (M147's rule). Clamp `priority_weights` on read (S4).

**Boundary.** The Board is a QUERY, not a table — nothing stored, nothing
markable-read. Each item shows its priority components (M150 already carries them).

**Acceptance.** Renderer tests: top-5/top-10 cut, an item's components visible,
the "needs you" items cannot be dismissed, a spent-window tone. `ci.sh full`.

---

### M152 · Answering closes the loop  ·  layer 3  ·  → M151

**Why this is the milestone.** First step at which the product does what the whole
design is for: the operator answers, tasks unblock, and the answer becomes a
`decision` fact the next session is handed via the pack — no delivery code.

**Contract.** TWO appends, and the ORDER is load-bearing: first
`memory.remembered@1` (the decision fact, `kind=decision`, carrying the question
text + `about`), THEN `question.answered@1` carrying that `decision_id`. A crash
between the two leaves an orphan decision fact — harmless — where the reverse
order leaves an answered question with no decision, which breaks the delivery
route (the pack carries facts, so the fact must exist by the time the question
closes). The projector (M148) already unblocks tasks and records the fields.
`digest.ts` already reads decisions — verify "where were we" shows it.

**Acceptance.** End-to-end probe: ask → prioritise → answer → both tasks
unblocked → decision fact current → the next `contextPack` for a blocked task
contains it. `ci.sh full` green. This is the acceptance the whole R1 aims at.

---

### M153 + M184 · CEO hygiene tick + retro cycle  ·  layer 3  ·  → M152, M182, M183

**Contract.** On the routine tick, all scripts: withdraw stale questions (blocked
tasks all cancelled / project archived) with the reason; merge exact duplicates
(same `about`+project); recompute priority (`question.prioritised@1`); mirror
service-category insights to `fabric_feedback` (M183); count recurrences and raise
a recurring trap (N≥3) as a `question` of kind `process`; propose retirement of
dangling insights. Judgement is a PROPOSAL, never exercised.

**Files.** `main/routineTick.ts` (extend the existing tick), pure decision modules
in `shared/`. `createRoutineTick(deps)` is already the injectable seam.

**Acceptance.** Probes on each pure rule; a fake tick over a fixture estate
produces exactly the expected events. `ci.sh full`.

### M157 · The CEO settles what it can cite  ·  layer 3  ·  → M152, M153

**The product meaning, as the operator put it (2026-09-06, paraphrased):** the question
limit IS the CEO's autonomy — the more the CEO settles, the fewer questions are left
for the operator. The trust dial is the operator's WORKLOAD dial: what the CEO
settles never reaches them, and what it cannot is exactly what remains. That is
why this ships model-less and early, not behind a provider.

**Contract (ADR-0036).** On the hygiene tick, for each open question within the
project's effective trust (`ceoTrustFor`, M156):
- `cited`: a current decision fact with the same `about` key, or an identical
  answered question → `question.settled@1` with `settled_basis`; unblock flows
  through the M148 projector; the answer becomes/reuses a decision fact (M152's
  append order applies).
- `routine`: + policy rules the operator WROTE (a small table:
  `about-pattern → answer`), each rule journalled when created.
- The FLOOR regardless of level: never a question above the criticality
  threshold, never one whose answer reverses a person's decision, never one
  authorising what ADR-0004 refuses, never without a basis. Refused-at-floor
  questions go to the Board — where they were always going.
- Every settlement lands on the standing "settled by the CEO" list (SCR-30/35),
  one-press override, the override superseding the CEO's decision.

**The absorption meter — what makes raising the dial an informed act.** The
trust setting shows, per level, MEASURED absorption: "at `cited`, 12 of 30 last
week's questions were settled; `routine` would have settled 19" — the
counterfactual is computable (which questions had a citable basis / matched a
rule). A dial with a measured consequence beats a dial with a vibe.

**Acceptance.** Probe: a question with a matching `about` fact settles with the
basis recorded; one without a basis does NOT settle at any level; one above the
threshold does not settle even with a basis; the override supersedes. The
absorption counts recompute from a fixture week. `ci.sh full`.

### M158 · A decision change is scored, and the operator's word is held  ·  layer 3  ·  → M157

**Contract (ADR-0036 §7).** `decision.change.proposed@1` (an agent superseding
via `fabric_memory_remember` with `supersedes`) is scored:
`40×(replaces a PERSON's decision) + 30×(needs a grant) + 20×(already released)
+ min(5×dependents, 20) + project weight`. Above
`estate_settings.criticality_threshold` → an `approval` question carrying the
original, the replacement and the components; below → the CEO may settle within
trust (M157's path). The first term plus the floor puts any change to the
operator's own decision beyond the CEO at every level. A CEO-authored decision
carries no such term — the estate revises its own reasoning freely.

**Acceptance.** Probe: a change to a person's decision scores ≥40 and becomes an
approval question at any trust; a change to a CEO decision below threshold
settles; the components travel on the question. Pure scorer in `shared/` with
tests. `ci.sh full`.

### M154 · The retro reader  ·  layer 3  ·  → M182
Findings and traps grouped by the task that produced them, on SCR-34; a wrong one
is superseded there (machinery exists). **Acceptance:** a fixture with a
finding+trap pair renders grouped; superseding one shows the lineage.

### M173 · The decision graph on SCR-33  ·  layer 3  ·  → M152
Human decisions the spine, agent decisions branching off the work; a superseding
pair shows both; clicking an agent decision opens its context — the lockfile's
facts + the transcript (the JOIN already exists: decision → `source_ref` →
session → lockfile). **Acceptance:** a fixture with one person decision, one
agent decision and one supersession renders all three shapes; the context click
resolves to the exact `fact_ids` of the lockfile.

---

## BLOCK E — visibility  (each surface takes its UX pass first)

### M189 · Current-task widget  ·  → M188
Preview on the agent tile + task page: run counter, plan steps with statuses,
live heartbeat line, blocked-on named. Claims labelled as claims, observations as
facts. Density: main fraction + strip, rest behind the open. **Acceptance:**
renderer test drives a fixture run and asserts a claim and an observation render
distinctly; a blocked step shows its question. Full history is M190's.

### M190 · SCR-40 the graphs screen  ·  → M188, M149
Three tabs — agent DID / project DID / plan SHOULD — each a QUERY over existing
edges (`task_links.rel`+`needs`, `origin_ref`, `question_blocks`, `assigned_by/to`,
handoffs). DID graphs time-ordered from the journal; SHOULD graph the dependency
DAG with progress overlay. Two kinds, two renderings, never one toggle.
**Precede with a UX pass.** **Acceptance:** a fixture project renders each graph;
a node opens its subject; the DID graph shows a task the agent ADDED and where it
went.

### M191 · Memory made visible  ·  → nothing (v2: the M152 dependency was FALSE —
the pack preview reads `compileContextPack`, which exists; lineage reads
`superseded_by`, which exists. Cheap and high-value: may be taken any time,
including as a warm-up brief)
Pack preview (compile the next session's pack DRY, show chosen facts + budget
omissions), fact lineage on click (superseded chain, source session), mirror drift
state. Zero new stores. **Acceptance:** the preview matches what a real session
would receive for the same task (assert against `compileContextPack` output);
lineage shows a superseded pair.

### M185 · The inbox  ·  → M151
Two lanes over the feed + the Board, split by "does this need you?". The needs-you
lane is the Board's slice and can never be marked read (`attention.ts` rule); the
happened lane expands to payload/actor/project/deep-link and owes nothing.
**Acceptance:** renderer test — a Board item cannot be dismissed, a feed item
expands, neither lane invents a store.

### M186 · The cycles view  ·  → M178
Everything that ticks, estate-wide: routine tick, chain advance, CEO hygiene,
retro cycle, evening letter, board review — cadence, last run, next due, health
in the SAME five states as agents (a cycle that silently stopped is a stalled
agent one level up). **v4 (module review F2): tick errors are currently
SWALLOWED** (`routineTick.ts` catches and comments "the next tick will try
again") — the tick must record its last error where this view reads it, giving a
THIRD state between healthy and stopped: "alive, but the last run failed:
‹reason›". **Acceptance:** a fixture with one healthy, one late, one stopped and
one failing-but-alive cycle renders four distinct states with reasons.

---

## BLOCK F — the manager seat  (→ D exists to be managed)

### M194 · Manager-as-binding  ·  → M152
`role=manager` binding, `provider_ref` = built-in / external. Fixed: core,
checker, schema floor, trust ceiling, ONE manager tool surface. Selectable: the
loop. Lifecycle: wake on tick/Board-delta; verify by heartbeat + outside watch +
eval; data in via the MANAGER PACK (lockfile journalled); data out only through
tools. Seat picker shows the per-wake session cost of an external seat vs
in-process. **Acceptance:** a fake external manager (a stub reachable over the
manager surface) makes a settlement that passes the schema floor and lands in the
journal identically to the built-in one; a basis-less settlement is refused
regardless of seat.

### M166–M168, M175, M176 · the built-in loop + eval
Core (M166), `ModelPort|null` (M167), checker (M168) ship without a provider.
**M176 (trajectory eval) is a precondition** for M175's loop tuning — build the
eval over journalled tool calls before tuning any prompt. M169–M171 activate when
a provider lands. **M157 and M158 do NOT belong here** — v2 mis-gated them on a
provider; `cited` is a key match and `routine` is operator-written rules, both
mechanical (ADR-0036 §11.1), and they moved to block D where they serve the
operator's workload TODAY. The v3 finding below records it.

---

## BLOCK G — deep UX audit  ·  → D, E
`/ux-audit` deep over all 49 scenarios with `file:line`→`file#symbol` evidence,
once the Board loop and visibility surfaces exist. A progon, not a build; leaves a
dated audit report.

## BLOCK H — Telegram  ·  → D
M159→M160→M161(+S3 strip-not-escape)→M162→M163→M164→M165, in the dependency order
of `telegram-surface.md`. M162 (reply-to-answer) is where the operator's day moves
to Telegram. Each surface takes its UX pass (binding, reply, evening letter).

---

## The shape every brief shares — for the agent that writes the next one

1. **Where it sits** — layer, dependencies, why now.
2. **Contract** — the exact behaviour, event names, enum values, what is stored.
3. **Files by symbol** — never a bare line number (the citation gate enforces it).
4. **Boundary** — what it must NOT touch, and the adjacent brick it must not
   pre-empt.
5. **Retro traps that apply HERE** — the specific ones already recorded, not the
   whole list.
6. **Acceptance** — the probe/test a reviewer runs, the gate that must be green,
   and for a refactor: the proof that behaviour did not move.


---

## The v2 self-audit — what was wrong with v1, so the next plan avoids the class

| # | Finding | Class |
|---|---|---|
| 1 | **M149 required a per-session question cap — the operator's recorded decision DROPPED it** (board-and-ceo §9 Q2: a runaway asker becomes ONE board item via M153). A brief that contradicts a recorded decision would have been built as written. | plan vs decision drift |
| 2 | **M191 declared a false dependency on M152.** The pack preview reads `compileContextPack`, which exists; nothing in it needs answering. A false edge delays cheap value — the fake-edge test from the graph doctrine, applied to our own plan. | fake edge |
| 3 | **M109-then-M98 made the split unreviewable.** A move-only diff must contain no edits; sweeping first mixes them. Flipped: split, then sweep on small files. | review-shape |
| 4 | **M97 lacked the overlap inventory.** `task.finished@1`/`task.started@1` appear in nine migrations, `task.abandoned@1` in six — same-event-multiple-functions semantics is real and deliberate (0016). Splitting without the inventory silently changes which arm wins. | measured trap |
| 5 | **M152's two appends had no order.** Decision fact FIRST, then the answer carrying `decision_id`: a crash between leaves an orphan fact (harmless), where the reverse leaves an answered question with no decision (breaks the delivery route). | crash-order |
| 6 | Six milestones sat in the layer order with no brief (M182, M183, M185, M186, M173, M154). A plan that covers 80% reads as complete. | coverage |
| 7 | M178's thresholds had no named home (now: `estate_settings`); M188's plan tools had no no-task refusal; M195 listed a field of a tool that does not exist yet; M98's acceptance was a line count instead of a role. | precision |

| 8 | **v3, from the operator's reframing:** M157/M158 were gated on a provider — but `cited` is a key match and `routine` is operator-written rules, both mechanical (ADR-0036 §11.1). The mis-gating deferred the exact dial that reduces the operator's question load. Moved to block D with full briefs, plus the absorption meter so raising trust is an informed act. | plan vs decision drift, again |

| 9 | **v4, from the per-module review** (docs/audit/2026-09-06-module-review.md): `agentSurface.ts` is a THIRD 1 290-line monolith outside M98's scope (→ scope extended); tick errors are swallowed with no visible trace (→ M186 gains the failing-but-alive state); journal payload size is uncapped but accepted with rationale — service-role only, every agent input capped at the tool (measured 600/300/2000); the RU locale question goes to the operator. | coverage, again |

**The standing rule this audit produced** (now in the header and in `CLAUDE.md`):
every brief starts by re-measuring its claims, and every iteration ends by asking
the operator whether the plan and the direction still look right — naming the
specific choices they might overturn. The v3 finding shows the rule working: the
operator's one sentence re-measured a gate the self-audit missed.
