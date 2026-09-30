# ADR-0035 — The Board is a query, the CEO is a mechanism before it is an agent, and an answer is a decision

**Status:** accepted · 2026-09-05 · supersedes nothing · design in [`../architecture/board-and-ceo.md`](../architecture/board-and-ceo.md)

## Context

The operator holds many projects and opens the app perhaps once a day. What they
need in that visit is the list of things only they can settle, in the order that
matters, with the act that settles each one — and then to leave, with the estate
carrying their answers back into the work.

Three questions had to be answered before any of that can be built, and each has
a plausible wrong answer that would have been expensive to reverse.

Measured on this tree first: an operator queue already exists and is **derived**
(`shared/attention.ts`); the agent surface already has 17 tools; project memory
already carries `note | finding | decision | trap` and is bi-temporal; every
session is already handed a context pack compiled from current facts; and
**there is no model provider, and none is scheduled** (M119, M126).

## Decision

### 1. The Board is a query, not a table

It is `rank(derived_obligations ∪ open_questions)`, computed on read.

A stored board is a second copy of the truth. The copy that drifts is the one
the operator is looking at, and they have no way to tell which is wrong. This
also settles the ranking: the rank is recomputed too, because every item on this
board ages by definition and a stored rank is stale the moment it is written.

The consequence accepted with it: **nothing on the Board can be marked read.**
An item leaves when the thing it names is resolved. `attention.ts` already holds
this rule — *a queue you can mark as read is a queue that lies, and the lie is
worst exactly when the list is long* — and this ADR extends it to authored
questions rather than carving an exception for them.

### 2. A question is authored and therefore stored; an obligation is derived and therefore not

These are two kinds of item that **end in different ways**, and one record for
both breaks whichever half it does not fit:

- treat questions as derived → they can never be answered, only worked around;
- treat obligations as authored → they become dismissible, and the queue lies.

So `questions` is a real table with a real lifecycle, and the derived half stays
exactly as it is. A question resolves when an **answer is recorded**; an
obligation resolves when the world changes.

A question that blocks work is not a new task status. `blocked_by` is a column,
because a blocked task is still in its rung and still someone's obligation — a
`blocked` status would let a task leave `running` by being blocked, and then
"how much is running" stops being true.

### 3. The CEO is a mechanism before it is an agent

Everything the CEO does today — collect, withdraw the stale, de-duplicate
exactly, rank, escalate — is arithmetic, runs on the routine tick, and holds no
work node.

The alternative was to wait for a model and ship nothing. `attention.ts` already
rejected the third option in the same words this ADR adopts: *a chat that echoes
would be a notepad pretending to be a colleague.*

When a model lands it **proposes** — a re-order with a reason, a semantic merge,
the digest as prose, an answer drawn from a cited fact. The arithmetic stays
underneath as the floor, because it is what keeps the Board correct when the
model is unavailable, wrong, or expensive.

### 4. An answer is recorded as a decision fact in project memory

Not as a message, not as a field read by a bespoke delivery step.

This is the decision that made the design small, and it reuses four mechanisms
that already exist:

| Reused | What it gives, for free |
|---|---|
| `contextPack.ts` carries current facts into every session | the next agent to touch the task is **told** the answer — no delivery code |
| `decisions.ts` models `superseded_by` | an answer later changed is a decision superseding a decision, both readable |
| `digest.ts` reads decisions | M133's "where were we" shows the answer without knowing what a question is |
| `memory_facts` is bi-temporal | "what did the agent know when it did that" stays answerable |

The route that matters is the one that works when the asking session is **gone**,
which is the normal case: an operator answering once a day is answering
questions asked by sessions that ended hours earlier.

### 5. The mandatory protocol is returned by `fabric_whoami`, not put in the preamble

`preamble.ts` carries a rule with a test behind it: the preamble names one tool
and no rule, because *anything else is a rule living in two places, and the
second copy is the one that goes stale*. A long system-prompt protocol would be
exactly that second copy, frozen at the moment each session started.

`fabric_whoami` already promises "the rules for this session" and is already the
first call every session makes. The protocol goes there: one source, current by
construction, versioned with the code.

## Consequences

- The Board cannot be wrong about what is waiting, because it does not remember
  anything. It can be wrong about **order**, and every item therefore carries the
  reason it sits where it does.
- Nine of the protocol's eleven obligations already have their verb; **one new
  tool** (`fabric_question_ask`) and one new table are the whole of the new
  surface area.
- The protocol splits into what is **refused** (the ladder, the authority floor,
  the chain's named thing, the loop bound), what is **observed** (rules unread, a
  review with no brief, a lease left held), and what is **advice** (the quality of
  a question or an insight). Blocking on the unenforceable third is how a
  protocol becomes a workaround factory.
- `board.reviewed@1` makes "this question was never shown" a finding rather than
  a mystery — the price of the top-five cut is paid in the open.
- A question is never expired by age. Age raises its rank; it does not remove it.
  A question withdrawn by the projector (cancelled work, archived project)
  carries its reason, because an agent that asked deserves to know no answer is
  coming.

## Refused

- **A board table with a `dismissed` flag.** It is the obvious shape and it makes
  the list lie exactly when it is long enough to matter.
- **A `blocked` task status.** It reads well and it breaks every count that asks
  how much work is in flight.
- **A CEO chat now.** There is no model. Echoing the estate's own state back in
  conversational prose is a notepad pretending to be a colleague.
- **A separate insight store.** `memory_facts.kind` already has `finding` and
  `trap`. The gap was never the verb — it is that nothing read them back, so two
  readers are added and no store is.
- **An agent that waits for its answer.** It records the question, the task
  blocks, and the session takes other work or ends. Waiting sessions are how an
  estate pays for idleness and how a question gets guessed at instead of asked.
