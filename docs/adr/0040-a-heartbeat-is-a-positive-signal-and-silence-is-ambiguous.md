# ADR-0040 — A heartbeat is a positive signal, silence is ambiguous, and a failure is journalled with its kind

**Status:** accepted · 2026-09-06 · design in [`../architecture/agent-health-and-failure.md`](../architecture/agent-health-and-failure.md)

## Context

The operator asked how the system knows an agent is alive, how it detects a
broken harness, and what happens when a skill or an agent simply fails — because
not everything runs correctly.

Measured today: session liveness is three-valued (`running` / `idle` / `ended`),
and `idle` is inferred from **60 seconds of no output**. A non-zero exit is
captured; a stage is self-reported. Nothing distinguishes an agent thinking from
an agent wedged from an agent blocked on a Board question — all three are silent,
and all three read as `idle`.

## Decision

### 1. Liveness is a positive heartbeat, not a reading of silence

An agent states `fabric_heartbeat({ phase, note?, waiting_on? })` on a cadence,
through a tool it already holds. `phase` is an **enumerated** set
(`reading` · `working` · `waiting` · `verifying` · `blocked`) because an agent
told to report status invents its own vocabulary otherwise. `waiting_on` names
what a `waiting`/`blocked` agent is blocked on — a question id, a grant — which
is the field that turns silence into a fact.

The heartbeat is journalled (`agent.heartbeat@1`), so health is a projection over
a durable trace, not a variable that resets on restart.

**Why not shorten the idle timer.** The failure is not "silent too long", it is
"silent for a reason we cannot see". A shorter timer calls a thinking agent and a
question-blocked agent dead alike, and an operator learns to ignore a state that
cries wolf.

### 2. The agent is watched from OUTSIDE, because the reporter is what breaks

A heartbeat is the agent's own account, and the thing most likely to be broken is
the reporter. Fabric watches from the harness side:

- the process, by `onExit` (already);
- the heartbeat gap, by the routine tick — a subtraction against a threshold;
- **the absence of `context.read`** after a grace period — every session is told
  to call `fabric_whoami` first and that call is journalled, so a session that
  produces output but never read its rules is running WITHOUT the harness: the
  skill failed to load, the prompt was wrong, or the surface was stripped. This
  is the load-bearing harness-break signal, and nothing surfaces it today.

### 3. Liveness is five states, and only one of them claims something is wrong

`working`, `waiting` (with what it waits on), `quiet` (soft — a real tool call
can take minutes), `stalled` (the claim that something is wrong), `gone`. Only
`stalled` asserts a fault; `quiet` deliberately does not, so the alerting state
stays credible.

### 4. A failure is journalled WITH ITS KIND

"Failed" is not one thing. Runner-missing, skill-failed-to-load,
harness-unreachable, agent-crashed, agent-wedged, task-failed-honestly,
advisory-model-failed, notifier-source-down — each has a distinct detector and a
distinct remedy, and a kind that cannot be determined is `unknown` and says so.
This is M100's startup lesson generalised to every agent fault: name the
precondition that failed, or say honestly that we do not know — never a guess
dressed as a diagnosis.

**A task that failed HONESTLY is not a crash.** An agent that finishes and reports
it could not do the thing is `review` with the answer "no" — the work is done.
Conflating it with a crash discards a real result.

### 5. Degradation is stated, never silent

A skill that breaks mid-run: the agent continues without it if it can, and the
outcome carries "ran without skill X". The model absent: the CEO runs its
deterministic tools and the interface names the advisory capabilities as
unavailable (ADR-0038 §4). A notifier that cannot gather: it sends what it has
with a partial note, or nothing with a recorded reason. A degradation the
operator cannot see is a lie by omission.

### 6. Health is computed, not noticed by a model

Every signal here is observation and arithmetic — a subtraction against a
threshold, the presence or absence of a journalled event. So it is a SCRIPT
(ADR-0039 §4), it ships without a provider, and the CEO's hygiene tick computes
`stalled` the same way it computes everything else. A model is never the thing
that notices an agent broke.

## Consequences

- The heartbeat is an agent obligation in the management protocol (ADR-0035
  §5.2), enforced by OBSERVATION not refusal: an agent that never beats becomes
  `stalled` and is surfaced, not blocked. Blocking on an unenforceable thing is
  how a protocol becomes a workaround factory.
- A `stalled` or `harness-break` agent is a Board obligation, ranked by M150 and
  reaching the operator through the same queue and the same Telegram surface as
  everything else — no separate alerting channel.
- SCR-35 (Project harness) and SCR-39 (Estate agents) gain content: the tile
  shows the five-state liveness with `waiting_on`; the harness screen lists
  `harness.break@1` findings with the reason each was inferred.
- Thresholds are configuration, not constants in source.

## Refused

- **A shorter idle timer as the fix.** It cannot distinguish the cases that
  matter and it trains the operator to ignore the state.
- **Trusting the heartbeat alone.** The reporter is what breaks; the outside
  watch is what catches a broken reporter.
- **A single "failed" status.** It hides distinct faults with distinct remedies
  and costs the operator's trust in the whole system for one recoverable fault.
- **Silent degradation.** Running without a skill, without a model, or with a
  half-gathered notification is a fact the operator must see, not one the system
  smooths over.
- **A model that notices faults.** Liveness is arithmetic; making it a judgement
  would make the cheapest, most reliable signal in the system depend on the most
  expensive, least reliable one.
