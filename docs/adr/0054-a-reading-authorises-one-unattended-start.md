# ADR-0054 — A quota reading authorises one unattended start, and an empty answer authorises none

- **Status:** accepted
- **Date:** 2026-09-10
- **Supersedes:** nothing. Sharpens the gate recorded in `apps/desktop/src/shared/quotaGate.ts#mayStart` (M94).
- **Related:** [ADR-0023](0023-policy-is-an-embedded-decision-port-that-never-grants-on-uncertainty.md), [ADR-0028](0028-one-effects-algebra-and-the-floor-lives-in-the-schema.md), [ADR-0053](0053-a-link-is-one-act-and-provenance-is-not-dependency.md)

## Context

M94 put a gate in front of work nobody is watching, and its header states the
rule correctly: *"an unknown quota blocks unattended work. Absent is not zero and
not a hundred: it is 'we cannot see', and the entire reason this gate exists is
that nobody else is looking either."*

**Measured at `d28c321`, and the code did not do what its own header said:**

1. **An empty answer was a green light.** The vendor returned HTTP 200 with `{}`.
   Nothing had failed — the request succeeded, the parse succeeded, both windows
   were legitimately absent — so the producer set `problem: null`. The gate then
   looped the two windows, skipped each absent one with `if (!w) continue`, fell
   out of the loop and returned `{ ok: true }`. The status code was the only
   thing that succeeded and it stood in for an answer.

2. **A corrupt number was indistinguishable from an idle account.** The
   comparison is `w.utilization >= threshold`, and `NaN >= 90` is false.

3. **One observation authorised three starts.** `routineTick` called `mayStart`
   ONCE, outside the loop, and then started up to `MAX_STARTS_PER_POLL` routines
   from that single verdict.

4. **Chains asked nothing at all.** `chainAdvance` consults `mayStartFanIn`,
   which answers whether the PREDECESSORS are done — a different question with a
   confusingly similar name. No quota gate stood between a finished predecessor
   and a new unattended session.

5. **The main process imported the gate and never called it.** One occurrence of
   `mayStart` in `index.ts`: the import.

6. **A reading did not say which account it was about**, so "the headroom of the
   account this work will run as" could not be asked.

## Decision

**1. A reading is validated before it is consulted.** `readSnapshot` refuses a
reading that is absent, reported-as-failed, empty of windows, non-finite,
outside a percentage's range, older than `MAX_SNAPSHOT_AGE_SECONDS`, or taken
for another account. Every refusal carries a code and a sentence.

**2. An absent WINDOW and an empty READING are different things.** A plan with
no seven-day window is a fact about the plan and blocks nothing. A reading with
no windows at all is a fact about the reading and blocks everything unattended.
The type could not express the difference, so the code guessed — and it guessed
the direction that starts agents.

**3. The producer names which of the two it saw.** Only the producer knows
whether the body was empty or the plan is narrow, so an HTTP 200 carrying no
recognisable window is recorded as `problem: 'empty'` there.

**4. One reading authorises ONE unattended start.** This is a DERIVATION, not a
new judgement: `quotaGate.ts` already states why the threshold is 90 rather than
99 — *"the number must leave room for a RUN, not for a request."* Headroom above
the threshold is, by that definition, room for one run. A single observation of
the remainder can therefore justify a single start, and the next start needs an
observation taken after the previous one.

**5. There is ONE door, and both unattended callers go through it.** The routine
tick and the chain advance spend the same account; two gates would each
authorise a start against one observation, which is the defect a gate exists to
close, arriving by having two of them.

**6. The claim is the LAST question asked.** A reading is spent by a start, so it
is claimed after every other reason not to start — otherwise a routine skipped
for an empty backlog consumes the account's headroom without running anything.

**7. A refusal never consumes a reading.** Telling the next caller the remainder
was spent on a start that did not happen is the same class of untruth as
starting on a number nobody has.

## Consequences

- **Throughput drops, deliberately, and the receipts say so.** A poll that finds
  five routines due starts one and pauses the rest with `already-spent`; they
  stay due and are taken on later polls. The alternative is subtracting a cost
  per run from the headroom, and Fabric has no cost model — an invented one
  would be a number nobody measured deciding when agents run.
- **The claim is in-process state, and that is correct HERE and nowhere wider.**
  Both callers run on one event loop and `claim` is synchronous, so nothing can
  be scheduled between its check and its mark: the claim is atomic by
  construction rather than by a lock, and a restart has no in-flight admission to
  lose. A SECOND process breaks this, and at that moment it belongs in the
  database beside `link_tasks` and `admit_task_launch`. Named as CO-120 so the
  boundary is visible before it is crossed.
- **`Quota` and `QuotaWindow` now have one definition.** They were declared twice
  — in `shared/types.ts` and in `main/quota.ts` — and neither was wrong alone.
  The duplicate was collapsed in this change (R-005) because the producer filling
  the new fields could not compile against its own copy.
- **The account check is enforced only when an expectation is given.** One
  account exists today, so an unconditional check would compare a field against
  itself. This way the rule is testable now and binding when M199's provider
  accounts land, rather than a check somebody must remember to add then.
- **Operator override is NOT built here.** The packet asks that an override stay
  advisory and never widen a grant or project scope. No override exists in the
  tree, so there is nothing to constrain; building one to constrain it would be
  shipping a permission in order to limit it. Recorded as CO-121.
