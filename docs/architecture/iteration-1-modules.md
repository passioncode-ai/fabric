# Iteration 1 — module architecture

**Status: canonical design for slices 1–3; boundaries only for slices 4–6.** Decided in
run `2026-08-31-iteration-ladder` under ADR-0027…0031; the slice ladder itself is
[`iterations.md`](iterations.md). Cutting rule: **one module per seam that a decision
already names** — the journal (ADR-0014/0027), policy (ADR-0004/0023/0028), the runner
(ADR-0021; `external-contracts.md` §1), the work lifecycle (ADR-0005/0009/0013/0022/0030),
memory (`federation.md` §5) — never a speculative service layout. Field names align with
`CONTEXT.md` and `schemas/project-blueprint.schema.json`.

> **Vocabulary note, 2026-09-08 (S10 · [ADR-0045](../adr/0045-workflow-runs-task-runs-and-explicit-iterations.md)):**
> where this document says **run** it means a **WorkflowRun** — one execution of one
> pinned graph version, the wire's `run_id`. A **TaskRun** is a different identity: one
> admitted attempt at one Task. The bare word is no longer used alone, and
> [`CONTEXT.md`](../../CONTEXT.md) defines both. This note clarifies the reading; the
> text below is unchanged and remains the record of its own decision.


## 1. Repository layout

```
fabric/                          (this repo becomes a pnpm workspace — ADR-0031 §3)
├── apps/desktop/                Electron: main (v1 control plane) · preload · renderer (React)
├── packages/
│   ├── schema/                  Supabase migrations + generated types + planted-defect tests
│   ├── journal/                 append · replay · projection registry · Realtime wake-up
│   ├── policy/                  floor + grants + autonomy algebra (the decide port, v1)
│   ├── runner/                  RunnerAdapter · ClaudeCodeSdkAdapter · PtyManager
│   ├── work/                    runs · nodes · chains · routines · the question queue
│   ├── memory/                  project memory · FTS projection · context packs
│   ├── connectors/              connector SDK + cloudflare/http-probe/gsc/ga4   (slice 4)
│   └── proposals/               cross-project proposals to the target PM        (slice 4)
└── supabase/                    config + migrations/ + seed.sql (arrive with slice 1)
```

Plane mapping (§5 of the platform architecture): Product experience →
`apps/desktop` renderer+preload · Control → main + `policy` + `schema` · Execution →
`runner` + `work` · Integration → `connectors` · Knowledge → `memory` · Evidence →
`journal`. All six live in one app and one Postgres in v1; the federation rule survives
as interface discipline — a module speaks to a module only through the contracts named
here, never through another module's tables.

## 2. Dependencies and the walking skeleton

```
schema ◄── journal ◄──┬── work ◄── runner     (run events are written by work, not runner)
                      ├── memory
                      ├── connectors
                      └── proposals
policy ◄── work, runner                        (checked before every external effect)
apps/desktop/main — the single assembly point (DB client, module instances, IPC)
renderer — never touches the database; typed IPC only
```

**Walking skeleton (first week of slice 1):** migration 1 →
`journal.append('project.created')` → the `projects` projection → a card in the renderer
→ `runner.pty.open(project)` → a live Claude Code terminal in the tab. One end-to-end
path through four modules; everything else grows on it.

## 3. `schema` — slice 1

The single home of data shape: migrations, RLS policies, planted tests, generated
TypeScript types. **The floor lives here** (ADR-0004/0028): raising it is a migration.
No runtime API — migrations plus the exported `Database` types.

Planted tests that must be watched failing: a cross-tenant read under an authenticated
role; a floored effect intent without a grant; a second active `product-manager` binding
in one project; an `UPDATE` on the journal. A green suite whose failures were never
observed is not evidence.

Deliberately absent in v1: journal partitions, pgvector, Cedar schemas (§12).

## 4. `journal` — slice 1

ADR-0027 implemented:

```ts
append(e: NewEvent): Promise<JournalEvent>       // the ONLY journal write in the codebase
replay(estateId, fromSeq, filter?): AsyncIterable<JournalEvent>
registerProjection(p: {name, eventTypes, apply, rebuild}): void
subscribe(estateId, cb): Unsubscribe             // Realtime wake-up; reading is replay()
```

`append` is an `append_event(...)` RPC: **type checked against the `event_types`
registry** → per-estate advisory lock → `seq = last+1` → insert → **projections applied
synchronously in the same transaction** (v1 projectors are SQL functions; a failing
projector rolls the append back — no bus, no dual-write).

Two properties of that door were added by migration 7 after both were measured missing.
**The type set is closed**: `event_types` is a table, adding a type is a migration, and
an unregistered one is refused with `22023` before the lock is even taken — previously a
misspelled type was journalled, given a gapless seq, projected nothing and reported no
error, which made a typo durable and invisible. **The wait is bounded**: the function
carries `lock_timeout = 3s`, so contention fails `55P03` instead of blocking (measured
before: still waiting at 6 000 ms). The DECISION to try again lives in this package, not
in SQL, because only the client can release the connection between attempts — bounded,
jittered, and never applied to any other error code.
Every projection ships `rebuild()` from replay plus the fixture `rebuild() == current`.
Projectors are **upserts** and rebuild is upsert-replay (learned at the walking
skeleton: deleting projection rows breaks FKs from non-projection tables such as
`agent_bindings`); removing an orphan row the journal never produced is a slice-3
concern.
Failure model: lock contention retries the append; a Realtime gap loses nothing because
reconnect reads `WHERE seq > last_seen`.

## 5. `policy` — slice 1

The executable half of ADR-0028, signature-compatible with the future Cedar port
(ADR-0023):

```ts
decide(req: {principal: ActorRef; action: ActionClass; resource: ResourceRef;
             context: {goalAutonomy?: 'safe'|'guarded'|'maximum';
                       accessCeiling?: 'read'|'draft'|'effect';
                       grantId?; bindingId?}})
  : Promise<{verdict: 'allow'|'deny'|'indeterminate'; receiptSeq: number}>
```

Composition by minimum; the floor requires a live grant and is duplicated as the
database constraint, so bypassing this module still hits the schema. Any evaluation
failure → deny with a receipt; the receipt (`policy.decided@1`) is appended **before**
the effect executes.

## 6. `runner` — slice 1 (PTY) + slice 3 (SDK)

Both channels of `external-contracts.md` §1.

```ts
// slice 1 — interactive terminals (ADR-0008 §3)
pty.open(projectId, cwd): PtySession      // node-pty spawns `claude` in the project cwd
pty.write / resize / kill(sessionId)      // journal: terminal.opened/closed

// slice 3 — headless nodes; later implemented by Cursor/OpenClaw adapters (CO-074)
interface RunnerAdapter {
  spawn(spec: NodeSpec): NodeHandle
  interrupt(h): Promise<void>             // SIGTERM semantics: clean abort, exit 143
  resume(h, fromCheckpoint): NodeHandle
}
```

`ClaudeCodeSdkAdapter` drives `query({prompt, options})` in a `utilityProcess` worker:
`cwd`, `maxBudgetUsd`, `permissionMode`, `disallowedTools`, `mcpServers` +
`strictMcpConfig`, `outputFormat: {type:'json_schema'}` for the typed result,
`canUseTool: q => work.ask(q)`, `sessionId = node.id`, env spread over the parent
(gotcha 4). For repositories the operator does not own, `--bare`/`settingSources: []`
is mandatory (the RCE path of gotcha 2); in slices 1–3 both projects are trusted and
the bare flag is a binding field from day one. Failure model: a crashed worker marks the
node `interrupted` for the chain's retry policy; a vanished worktree fails the node with
the named cause `workspace_lost`, never silently; budget exhaustion is terminal with a
receipt.

## 7. `work` — slice 3

The work lifecycle. **Run = one execution of one graph** (ADR-0030); routine fields are
exactly the blueprint schema's (`capabilityRef`, `preferredAgentBindingId`, `trigger`,
`concurrency: parallel|queue-one|skip`, `catchUp: all|latest-only|none`,
`checkerPolicyRef`); chains are versioned records whose running graphs pin their version
(ADR-0005/0009), and every edge names its payload.

```ts
startRun(source: {routineId} | {chainId, input}): RunId        // run.started@1
// executor per node: policy.decide → memory.compileContextPack → runner.spawn → NodeResult
ask(q: Question): Promise<Resolution>                          // canUseTool → queue row + IPC push
bindings.hire / replace / retire                               // admitted-provider selector;
                                                               // exactly one PM enforced by schema
```

**Suspend, v1 — an honest interim:** on `ask()` the node's process waits with a
configurable timeout (default 30 min; expiry → `escalation_expired`, resumable). This is
recorded debt against ADR-0022's released-worker suspend (CO-083), returned at the first
multi-day run; whether `canUseTool` can block that long is `external-contracts.md`
unresolved #3 and gets measured in this slice. Retry budgets cap the run, not the
provider. A result missing any of the four envelope fields is malformed and the node
does not close.

Deliberately absent: the durable-execution engine (interface-compatible; Temporal by
trigger), LLM checkers (the first checker is schema validation of the result; CO-060's
six-class verdict arrives with slice 4+), goal decomposition UI (iteration 2).

## 8. `memory` — slice 2 (transcripts shipped 2026-08-31)

`federation.md` §5 at v1 scope, ordered by ADR-0032: **transcripts first** — captured
whole, content-addressed in Storage with journal refs, and searchable, because verbatim
text measured 16–22 points ahead of extracted artifacts; then `memory.project.*` events →
FTS projection; then a **context pack** — bounded, cited — compiled into the session/node
cwd, with what-the-agent-knew journalled. No LLM on the write path, and each record is
read in three tiers (annotation / summary / full text) so a reader chooses what to spend
context on.

**Shipped:** `transcript.captured@1` and `session_transcripts` (migration 8). One record
per session that produced anything, streamed to a file while the session runs and turned
into one event when it ends. Three decisions worth carrying:

- **The decode is the transport, not the content.** A PTY stream is text interleaved with
  cursor movement; ANSI/OSC sequences are removed and carriage-return repaints resolve to
  what was left standing — the same operation a terminal performs to show it to a person.
  `sha256` addresses the stored text, and the raw stream is not retained.
- **The FTS index is bounded to the first 400 000 characters and the column is not.** The
  projector runs inside the append transaction (ADR-0027), so a `to_tsvector` that throws
  would roll back the session's own exit record. Measured on this stack: 400 000 chars of
  high-entropy text produce 491 164 bytes of tsvector, 900 000 produce 1 105 182, and
  2 000 000 fail outright with 54000. Transcripts repeat far more than that test did; an
  append transaction is the wrong place to rely on it.
- **The size ceiling keeps the HEAD.** 8 MB, and past it the record is marked truncated on
  its own annotation line. The beginning of a runaway session explains it; the end is the
  same line ten thousand times.

**Every retrieval is recorded, including the ones that found nothing (M46,
migration 11).** `memory.retrieved@1` → `memory_retrievals`, carrying which store was
asked, by whom, and how many rows came back. The reason is the doctrine's own sentence:
memory that was never queried and empty memory score identically, and only the log tells
them apart. A hit is self-evident to whoever got it; a MISS is invisible to everyone,
including the agent, which simply carries on without the thing it did not find. The
statistics strip reads the ratio, so "nobody asks" and "nothing matches" stop looking
like the same project. The operator's own searches count too — leaving them out would
have made the number flattering.

**A memory fact carries who recorded it (M44, migration 10).** The actor comes from the
journal ENVELOPE, never from the payload: a payload is what the caller said, and an actor
must be what the door observed. The provenance was in the journal from migration 1 and the
projection dropped it, so an operator's note and an agent's self-report were
indistinguishable — the same claim/observation collapse ADR-0008 forbids, reintroduced one
layer down. Backfilled from the journal rather than re-entered.

**Memory is bi-temporal (M48, migration 12).** `recorded_at` is when we learned a fact;
`valid_from`/`valid_to` is when it was true. A correction CLOSES the earlier window and
names its successor (`supersedes` on the recording event) — nothing is deleted, so the
correction is reversible and "what did this project believe in June" stays answerable.
A constraint forbids a closed window with no successor: a fact does not expire on its
own, something replaces it. Reads default to what is currently true; the corrected fact
stays readable behind a flag. A supersession cannot reach outside its own project.

**The context pack is the one entrance to the model (M49, migration 13).** At spawn,
Fabric compiles a bounded, cited selection of the project's memory into `context.md`
beside the credential — never in the repository — and journals `context.compiled@1` as
the LOCKFILE: which facts by id and journal seq, which sessions, and what did not fit.
Three properties are load-bearing and each has a probe:

- **Bounded, and honest about it.** The budget is spent in a fixed order — facts before
  session annotations, because a fact was written down deliberately and an annotation is
  a measurement. What does not fit is counted, and the count is **in the pack**, because
  the agent is the party that needs to know its memory is partial. A bundle that
  truncates silently makes an agent stop searching.
- **Cited.** Every fact carries its journal seq, so a claim in an agent's output traces
  to the event that put it in front of the agent.
- **Current only.** A superseded fact is never handed over as current — the one thing
  bi-temporality exists to prevent.

Nothing here calls a model: the pack is a selection, never a retelling (ADR-0032 §2).
The lockfile is written **before** the session starts, so "what did this agent know" is
answerable even for a session that dies in its first second. Verified end to end against
the shipped CLI: an agent returned a fact that exists only in its compiled pack.

**The eval fixture (M47) ships with it, as ADR-0032 decision 5 requires.**
`apps/desktop/test/memory-eval.test.mjs` scores retrieval through the real MCP tools in
three phases — memory present, memory removed, memory rebuilt from the journal — and fails
if the delta is zero, because memory that was never queried and empty memory score
identically. Current: 6/6 with, 0/6 without, 6/6 rebuilt. It also carries one question
nothing in the corpus answers, which must come back empty AND say so.

```ts
remember(projectId, fact: {claim, sourceRef, kind}): seq
recall(projectId, query, limit): Fact[]                 // own project only (RLS + test)
compileContextPack(projectId): {markdown, sha256, factIds[], factSeqs[], omitted*}  // shipped
captureTranscript(sessionRef, content): artifactRef     // sessionStore vs post-hook:
                                                        // measured, resolves unresolved #2
```

Isolation is proven by the planted test (a fact in A never surfaces in B). Truncation of
a pack is marked inside the pack, never silent. Absent: pgvector, sleep-time
consolidation, estate-knowledge promotion, decay (§12).

## 9. `connectors` + `proposals` — slice 4, boundaries only

Connector SDK (cadence, processing rule, quota tracking that records actual consumption
— the GA4/GSC lessons of `external-contracts.md` §3) plus the first four connectors;
observations are sourced, timestamped events, and `registry/domains.yaml` becomes a
projection. Proposals implement ADR-0029 over the existing `proposal.schema.json`. Field
schemas, the crash source (CO-086) and validity domains are decided at the slice-4
grill, not here.

## 10. `apps/desktop` — slice 1

**main** is the v1 control plane: module assembly, the only Supabase client (service
key confined here), PTY host, the window manager, later the utilityProcess pool, IPC
handlers. **preload** exposes the typed bridge; **renderer** (React, electron-vite) is
a browser-shaped shell: **projects are tabs**, a project tab is the project home
(header/settings, the agents grid, memory, workflows, the entry to the canvas), and a
session opens in **its own window** rather than inside the tab.

```
IPC v1: projects.create/update/list · feed.replay(fromSeq)
        memory.remember/search
        terminal.options/open(projectId, optionId)/list/get/write/resize/close
          + on('terminal:data' | 'terminal:exit')   ← broadcast to every window
        windows.openSession(sessionId) · meta.info() → {estate, sessionId?}
slice 3: runs.start/list/get · questions.list/resolve · bindings.hire/replace
```

**The launch selector is the binding selector early.** `terminal.options()` returns what
can hold a session — today an agent session (Claude Code) or a plain shell, each with an
`available` flag measured on the machine. In slice 3 the same list is generated from
admitted provider bindings, so the surface does not change when the registry arrives.

**`sessionBundle` is a separate module because it writes a credential.** It is the only
place in the app where one reaches disk, and its rule is lifetime, not secrecy: every
session runs as the same operating-system user, so 0600 stops other people and not the
next agent. A bundle is written immediately before a spawn into a 0700 directory and
destroyed the moment that session is over — **including a session that never started**,
where nothing else could reclaim it, because revocation used to hang off an exit event a
process that never existed cannot fire. The credential it carries opens exactly one MCP
session (§11), so a copy taken afterwards opens nothing.

**The filesystem API is bounded by what the operator opened.** `FileRoots` holds the
repositories attached to any project plus folders picked in the native dialog, and every
path is resolved through symlinks before it is checked against them. Before this, the
typed bridge handed every window a read and write primitive over the whole home
directory. Attaching or detaching a repository moves the boundary; the tree only ever
offers what is already inside it, so the guard is invisible in normal use (SCN-034).

**A task cannot outlive the process running it (M43, migration 10).** The session→task
link lives in this process, so quitting with work in flight left the task `open` forever —
not "we lost track of this" but a positive claim that it is still running, by an app with
no way to know. At boot every open task belongs to a process that is gone, and is closed
with `task.abandoned@1` and a named reason. Never `task.finished@1`: an outcome nobody
watched is not an outcome, the projector refuses to overwrite a task that really finished,
and the interface stopped rendering a null exit code as `0`.

**Session status is honest tier-0.** A plain PTY cannot report which step it is on, so a
tile shows `running | idle | ended` (idle = no output for 60s), uptime, last activity and
the last line of output. Real step state arrives with SDK runs (slice 3) on the same tile.

**Two settings layers, deliberately not one.** *Project* settings — memory backend,
default agent, repositories — are journal events with a configuration revision, because
they describe the workspace and must survive a move to another machine. *Application*
settings — theme, locale — are a JSON file in `userData` written by main, because they
describe this installation. Collapsing them puts a preference in the domain record.

**Repositories are a set, and the primary is derived.** `project_repos` holds them;
`projects.repo_path` mirrors whichever row is primary, so everything that starts a
session in "the project's directory" keeps one source. Attaching the first makes it
primary; detaching the primary promotes the oldest remaining one — both in the projector,
not in the caller.

**The interface has two mechanical gates** (`scripts/check-design.mjs`), and they exist
so a new screen cannot invent what it looks like or what it says:

- **palette** — no raw colour in the renderer; values live in the style pack's token
  layer (`tokens.paperclip.css`, copied verbatim) and the app's semantic aliases
  (`tokens.app.css`). The pack is `paperclip`, chosen because its register names this
  product and it ships a `--terminal` surface; the dials are recorded in
  `docs/ux/foundation.md` → Design tooling.
- **strings** — no literal interface text in a component and no unknown key; the registry
  is `i18n/en.ts`, typed, with `ru` present as a registry to fill rather than a system to
  add later.

**The agent surface — Fabric's own door, opened inward.** Every session Fabric
starts is handed a credential scoped to itself and an `mcp.json` pointing at a
loopback Streamable HTTP server the main process runs. Through it an agent can
ask what it is working on (`fabric_whoami`), see who else is running
(`fabric_agents_list`), report its own stage (`fabric_stage_report`), read and
write project memory, and list what has been asked here. This is the same shape
ADR-0026 gives the northbound control surface — one server, a credential that
resolves to a scope, typed tools, everything through the journal — and it is
deliberately the same server: the only difference between an agent inside a
session and an external MCP client is where the credential came from.

Two rules carry it, and both are load-bearing:

- **A claim is not an observation.** `agent.stage.reported@1` records what the
  agent SAYS about itself; the session manager separately observes the process it
  actually runs in. They are stored apart (`agent_stages` versus the live session)
  and rendered apart, the claim captioned as the agent's own account. ADR-0008
  hosted the terminal precisely so progress could be read rather than believed;
  this adds the agent's account beside that reading, never in place of it.
- **The scope is the credential's, never the caller's claim.** A tool argument
  naming a project proves nothing; the token decides what is reachable, and a
  session that ends has its credential revoked in the same handler that journals
  its close.

- **The credential is a handshake, not a password.** It opens exactly ONE MCP
  session; a second `initialize` on the same bearer is refused, and every later
  request must also carry the `mcp-session-id` the transport returned — which the
  initialising client alone receives and which is never written to disk. A
  credential minted for a session that never initialises expires. One credential
  also has a call budget (120 per minute by default): an agent in a loop meets a
  429 with `Retry-After` and a readable reason instead of starving the estate.

The credential lives in the app's own data directory, mode 600 in a 0700 directory,
never in the operator's repository — where it would be committed. `--strict-mcp-config`
means the session sees Fabric's tools and nothing else the machine happens to have
configured. **Mode 600 is not the boundary and should not be read as one**: every
session runs as the same operating-system user, so the file is readable by the next
agent. The boundary is the handshake above, which makes a token copied after the session
started worthless — and does not defend against a reader that wins the race before it
(CO-090).

**The workspace canvas** (`SCR-26`) is a constrained grid under ADR-0024 rendering
**tier-0 widgets**: the host generates them from projections and session state. Tier 1
(a provider's declared view schema) and tier 2 (a sandboxed provider view, ADR-0020)
occupy the same slots later; the grid, the widget frame and the tier label exist now so
that arrival is a swap rather than a redesign.

**Auth v1, stated honestly:** one operator, hard-wired as org #1's owner in main. RLS
policies ship and are tested from migration 1 (planted tests run under an authenticated
role); runtime principals arrive with membership (horizon 2). The floor does not depend
on auth — it is a constraint. Failure model: a renderer crash never kills PTYs (they
live in main; reopen reattaches); a down Supabase degrades the app read-only with a
banner — journal-requiring actions block honestly rather than buffering appends.

## 11. Cross-cutting contracts

**Envelope + event-type register v1** (ADR-0027 §5–6):

```
JournalEvent {estate_id, seq, type: 'noun.verb@N', schema_rev, actor {kind, id},
              occurred_at, project_id?, run_id?, node_id?, payload}
slice 1: estate.created@1 · project.created@1 · project.updated@1 ·
         project.settings.updated@1 · project.archived@1 ·
         project.repo.attached@1 · project.repo.detached@1 · project.kickoff@1 ·
         terminal.opened@1 · terminal.closed@1        (the terminal events carry option_id)
slice 2: memory.project.recorded@1 (shipped early with the workbench) · transcript.captured@1
agent surface: agent.stage.reported@1 (a claim by the agent, projected into agent_stages)
tasks:  task.started@1 · task.session.attached@1 · task.finished@1
slice 3: binding.hired@1 · binding.replaced@1 · routine.defined@1 · chain.defined@1 ·
         run.started@1 · node.started@1 · node.asked@1 · question.resolved@1 ·
         node.completed@1 · run.completed@1 · policy.decided@1 · grant.issued@1 ·
         grant.consumed@1 · effect.executed@1
```

**NodeSpec** (Fabric-owned; the spec side never crosses the contract boundary):

```ts
NodeSpec  {nodeId, projectId, bindingId, cwd, prompt, inputArtifacts[], outputSchema,
           budget: {maxUsd, maxTurns}, permission: {mode, disallowedTools[], bare: boolean},
           mcp: {servers, strict: true}, contextPackPath?}
```

**NodeResult IS the contract's envelope, not a sketch of it.** The 2026-09-05
audit (ARCH-03) found the earlier four-string sketch here would be REJECTED by
the very contract it claimed alignment with: `result.schema.json` (0.1.0)
requires `{id, contractVersion, outcome, done[]: {claimId, statement}, proof[],
scope, notVerified, artifacts[], createdAt, producer}` — `done` is an array of
claims, `scope` an object, and `additionalProperties: false` throughout. ADR-0012
rules that Fabric consumes the exact revision and does not copy schemas; this
section now references rather than restates. A validating runner imports the
schema from the pinned contract revision. Fabric's own cost estimate is stored
BESIDE the envelope (a column on the node row), never inside it, because the
contract forbids extra fields — which is precisely how `costUsdEstimate` got the
sketch rejected.

**Question / Resolution:** `Question {id, nodeId, kind: 'permission'|'choice', payload,
askedAt, sla?}` · `Resolution {questionId, by, verdict, note?, at}`. The fabric answers
by default what the goal's level allows (ADR-0007); the queue holds the remainder.

## 12. The v1 diet — deliberately not built, with return triggers

| Deferred | Module | Return trigger |
|---|---|---|
| Journal partitions; async projectors | schema/journal | measured volume/latency |
| Cedar evaluator, signed bundles | policy | second principal or hosting |
| Temporal-class durable engine (port stays compatible) | work | first multi-day run |
| Cursor/OpenClaw adapters, conformance passports (CO-074) | runner | a second runner is really needed |
| pgvector, consolidation, decay, estate knowledge | memory | FTS stops finding / iteration 2 |
| Declared-layer git mirror (as a projection) | journal | slice 3, or the cofounder's first review |
| LLM checkers (CO-060), goal-decomposition UI | work | slice 4 / iteration 2 |
| MCP control surface (M15), BYA bootstrap, federation | — | iterations 2–3 by horizon gates |

## 13. Flows the design must keep true

```
A. Terminal (slice 1)
renderer terminal.open ─IPC→ main: journal.append(terminal.opened) → pty.spawn(claude, cwd)
  → data ─IPC→ xterm; renderer crash → PTY survives, reattach on reopen

B. Cron routine (slice 3)
scheduler tick → work.startRun [run.started] → per node: policy.decide
  → memory.compileContextPack → runner.spawn(NodeSpec) → SDK stream → NodeResult{4 fields}
  [node.completed] → artifacts → memory (the run→project row of the sharing matrix)
  → run.completed → cards/feed update through projections

C. Escalation (slice 3)
SDK canUseTool(q) → work.ask: [node.asked] Question row + IPC push → badge in the app
  → operator resolves → [question.resolved] → callback returns → the node continues.
  v1 interim: the process waits (30-min timeout, resumable) — CO-083, debt vs ADR-0022.
```
