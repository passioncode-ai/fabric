# Agent health, the heartbeat, and what happens when something breaks

**Status:** design, 2026-09-06. The operator asked how the system knows an agent
is alive, how it tracks them, how it detects a broken harness, and what happens
when a skill or an agent simply fails — because not everything runs correctly.
Every claim about the current system below was measured in this tree today.

---

## 1. What exists, measured — and the gap it leaves

| Signal | Today | Where |
|---|---|---|
| A session is `running` / `idle` / `ended` | exists — `idle` is **no output for 60s** | `pty.ts` `IDLE_AFTER_MS` |
| A non-zero exit is captured | exists — `exitCode`, `SpawnFailure` | `pty.ts` |
| The agent self-reports a stage | exists — `stage.reported@1`, a CLAIM | `agent_stages` |
| An automation is stuck | exists — 3 consecutive pauses | `automations.ts` `isStuck` |
| A session never read its rules | journalled but not surfaced | `whoami` fires `context.read` |

**The gap the operator named.** Liveness today is inferred from **silence**, and
silence is ambiguous three ways that matter:

- an agent **thinking** is silent;
- an agent **wedged** is silent;
- an agent **waiting on the operator** — a Board question, a grant — is silent.

All three read as `idle`, and the product cannot tell "working hard" from "hung"
from "blocked on you". That is the hole this document fills, and it fills it with
a **positive** signal rather than a better guess at silence.

---

## 2. The heartbeat — a positive signal, because silence cannot be read

A heartbeat is the agent saying **"I am alive and here is what I am doing"**, on a
cadence, through a tool it already has. Not a network ping — a statement of state.

```
fabric_heartbeat({ phase, note?, waiting_on? })   // a new tool, §3 of the map
```

- **`phase`** — one of an ENUMERATED set (the harness rule: an agent told to
  report status invents `pending`/`todo`/`done` in one run unless the values are
  closed): `reading` · `working` · `waiting` · `verifying` · `blocked`.
- **`waiting_on`** — present only for `waiting`/`blocked`, and it names WHAT: a
  question id, a grant, a chain input. This is the field that turns silence into
  a fact: "silent because it asked you Q-142", not "silent, unknown".
- **`note`** — the last line of what it is doing, for the tile.

The heartbeat is **journalled** (`agent.heartbeat@1`), so liveness is a view over
a durable trace, not a variable that resets on restart. A session's health is
then a projection: last heartbeat, its phase, and the gap since.

### 2.1 The three-state liveness becomes five, and each is actionable

| State | Means | Derived from | The operator's move |
|---|---|---|---|
| `working` | a heartbeat within the window, phase working/reading/verifying | last heartbeat < warn threshold | nothing — leave it |
| `waiting` | heartbeat phase `waiting`/`blocked` with a `waiting_on` | the heartbeat itself | answer the named thing (it is on the Board) |
| `quiet` | no heartbeat for longer than the warn threshold, process alive | gap since last heartbeat | watch; it may be a long tool call |
| `stalled` | no heartbeat past the stall threshold, process alive | a longer gap | intervene — it is likely wedged |
| `gone` | the process exited | `onExit` | read the outcome; the task was closed or abandoned |

The thresholds are configuration, not constants in source (the same rule the
launch options follow). `quiet` is deliberately a soft state — a real tool call
can take minutes — and only `stalled` is a claim that something is wrong.

### 2.2 Why not just shorten the idle timer

Because the failure is not "silent for too long" — it is "silent for a reason we
cannot see". A 20-second idle timer would call a thinking agent dead and a
question-blocked agent dead, and the operator would learn to ignore the state
that cried wolf. A heartbeat that carries `waiting_on` distinguishes the cases
the timer never could, and that distinction is the whole value.

---

## 3. Tracking — the agent is watched from outside, because a broken agent cannot report itself

The heartbeat is the agent's own account, and an account is not enough: **the
thing most likely to be broken is the reporter.** So Fabric watches from the
harness side, where it can see what the agent cannot say.

| Watched | How | Fires |
|---|---|---|
| The process | `onExit` already | `gone` immediately, with the exit code |
| The heartbeat gap | the routine tick compares `now − last_heartbeat` | `stalled` past the threshold |
| **The rules were never read** | `context.read` is journalled by `whoami`; its ABSENCE after a grace period is the signal | a `harness-break` finding: the agent started but never learned its rules (a bad prompt, a failed skill load, a stripped surface) |
| The surface is unreachable | the agent's tool calls stop arriving while the process lives | `harness-break`: the MCP seam died under a live process |
| A tool errors repeatedly | the same tool refused N times in a session | a finding — the agent is looping on something it cannot do |

**`context.read`'s absence is the load-bearing harness-break signal.** Every
session is told to call `fabric_whoami` first (the protocol, ADR-0035 §5.1), and
that call is journalled. A session that produces output but never reads its rules
is a session running **without the harness** — the skill failed to load, the
prompt was wrong, or the surface was stripped. Nothing surfaces this today; it
becomes a `harness.break@1` finding with the reason it can infer.

---

## 4. When a skill or an agent breaks — the taxonomy, because "it failed" is not one thing

The operator's point: not everything runs correctly. A single "failed" hides
distinct failures with distinct remedies, and conflating them is how an operator
loses trust in the whole system for one recoverable fault.

| Failure | What it looks like | Detected by | What happens |
|---|---|---|---|
| **Runner missing** | the binary is not installed | `SpawnFailure` at launch (already) | the task is `abandoned` with the reason; the launcher already names the binary (M100 class) |
| **Skill failed to load** | the agent runs but without its skill's behaviour | `context.read` present but the skill's own marker absent, or the agent says so | `harness.break@1`; the task is not silently trusted |
| **Harness unreachable** | tool calls stop under a live process | §3 | `harness.break@1`; heartbeat `gone` on the surface even though the PID lives |
| **Agent crashed** | non-zero exit mid-task | `onExit` with a code (already) | `task.abandoned@1` with the code; the transcript is captured FIRST (M45) |
| **Agent wedged** | alive, no heartbeat, no progress | §2 `stalled` | surfaced to the operator; the operator can end it, and ending is a clean `gone` |
| **Task failed honestly** | the agent finished and reports it could not | the agent's own `stage.reported` / brief | `review` with the failure stated — NOT a crash; the work is done, the answer is "no" |
| **Advisory model call failed** | the CEO's provider errored | the `ModelPort` router (ADR-0038 §4) | the deterministic core continues; the advisory result is skipped, not stubbed |
| **Notifier data source down** | a notifier cannot gather | the notifier's own tool error | the notification says it could not gather, rather than sending a hollow one |

**The rule under the whole table:** a failure is **journalled with its kind**, and
a kind that cannot be determined is `unknown` and says so — never a guess dressed
as a diagnosis. This is M100's lesson generalised from startup to every agent
fault: the operator is told which precondition failed, or told honestly that we
do not know.

### 4.1 Degradation is honest, never silent

Three degradations, each with the same discipline:

- **A skill breaks mid-run** → the agent continues without it if it can, and the
  task's outcome carries "ran without skill X"; the operator sees a review that
  says so, not a green tick.
- **The model is absent or erroring** → the CEO runs its deterministic tools and
  the interface names the advisory capabilities as unavailable (ADR-0038 §4). The
  Board is still correct; only the prose and the semantic merges are missing.
- **A notifier fails** → it sends what it has WITH a note that it is partial, or
  it sends nothing and records why. A notification that silently omits a project
  is worse than one that says "could not reach project X".

A degradation the operator cannot see is a lie the system tells by omission, and
every row here is designed so the omission is stated.

---

## 5. The health surface — where the operator sees it

SCR-35 (Project harness) and SCR-39 (Estate agents) already exist as the homes
for this. The health model above gives them content:

- **The agent tile** shows the five-state liveness (§2.1) with its `waiting_on`,
  so "blocked on Q-142" is on the tile, not inferred.
- **The harness screen** lists `harness.break@1` findings — the sessions that ran
  without their rules, the surfaces that died under a live process — with the
  reason each was inferred, because a finding without its evidence is a rumour.
- **A `stalled` agent** raises a Board item (a derived obligation, §2 of the
  Board design), so it enters the same one queue the operator already reads.

Nothing new is invented for where the operator looks. The heartbeat and the
failure taxonomy give the existing surfaces something true to show, replacing a
three-state guess with a five-state fact.

---

## 6. How this connects to the rest

- **The heartbeat is an agent obligation** (the management protocol, ADR-0035
  §5.2), returned by `fabric_whoami` like the others, enforced by OBSERVATION not
  refusal: an agent that never beats becomes `stalled` and is surfaced, not
  blocked — blocking on an unenforceable thing is how a protocol becomes a
  workaround factory.
- **A `stalled` or `harness-break` agent is a Board obligation**, so it is ranked
  by the same arithmetic (M150) and reaches the operator through the same queue
  and the same Telegram surface as everything else.
- **The CEO watches the heartbeats** as part of its hygiene tick (ADR-0038 §1 core
  work): it is the mechanism that turns a gap since last heartbeat into a
  `stalled` finding, which is arithmetic — a subtraction against a threshold — and
  therefore a script, not a judgement (ADR-0039 §4).

---

## 7. Build order

| # | Step | Ships without a model? |
|---|---|---|
| 1 | `fabric_heartbeat` + `agent.heartbeat@1` + the liveness projection (last beat, phase, gap) | yes |
| 2 | Five-state liveness on the agent tile, with `waiting_on` | yes |
| 3 | `harness.break@1` from the absence of `context.read` after a grace period | yes |
| 4 | The failure taxonomy on `onExit` and `SpawnFailure` — journalled with its kind | yes |
| 5 | `stalled` and `harness-break` raised as Board obligations | yes — needs the Board (M151) |
| 6 | Degradation notes on the review outcome and the notifier | yes |
| 7 | The CEO's hygiene tick computes `stalled` from the heartbeat gap | yes |

All of it ships without a provider, because all of it is observation and
arithmetic. That is the map's own rule (`agent-system-map.md` §3) holding here:
health is computable, so it is computed — not left to a model to notice.
